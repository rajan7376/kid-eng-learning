import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./auth";

export const LOCK_THRESHOLD = 5; // 連續失敗幾次鎖定
export const LOCK_MINUTES = 10; // 鎖定分鐘
export const CAPTCHA_AFTER = 1; // 失敗幾次後要求驗證碼

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function getSession(): Promise<SessionPayload | null> {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// 首次啟動依 env 建立管理員(冪等)
export async function ensureSeedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (data) return;
  const password_hash = await hashPassword(password);
  await admin
    .from("app_users")
    .insert({ username, password_hash, role: "admin", display_name: "管理員" });
}

// ---- 防爆破 guard ----
interface GuardRow {
  fail_count: number;
  locked_until: string | null;
}

type Admin = ReturnType<typeof createAdminClient>;

async function readGuard(
  admin: Admin,
  scope: string,
  key: string,
): Promise<GuardRow | null> {
  const { data } = await admin
    .from("login_guards")
    .select("fail_count, locked_until")
    .eq("scope", scope)
    .eq("key", key)
    .maybeSingle();
  return (data as GuardRow) ?? null;
}

function lockedSecondsLeft(row: GuardRow | null): number {
  if (!row?.locked_until) return 0;
  const left = new Date(row.locked_until).getTime() - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export interface GuardState {
  lockedSeconds: number;
  requireCaptcha: boolean;
}

// 登入前檢查：是否被鎖、是否需要驗證碼
export async function checkGuards(
  admin: Admin,
  username: string,
  ip: string,
): Promise<GuardState> {
  const [u, i] = await Promise.all([
    readGuard(admin, "user", username),
    readGuard(admin, "ip", ip),
  ]);
  const lockedSeconds = Math.max(lockedSecondsLeft(u), lockedSecondsLeft(i));
  const requireCaptcha =
    (u?.fail_count ?? 0) >= CAPTCHA_AFTER || (i?.fail_count ?? 0) >= CAPTCHA_AFTER;
  return { lockedSeconds, requireCaptcha };
}

async function bump(admin: Admin, scope: string, key: string) {
  const row = await readGuard(admin, scope, key);
  const fail = (row?.fail_count ?? 0) + 1;
  const locked_until =
    fail >= LOCK_THRESHOLD
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : (row?.locked_until ?? null);
  await admin
    .from("login_guards")
    .upsert(
      { scope, key, fail_count: fail, locked_until, updated_at: new Date().toISOString() },
      { onConflict: "scope,key" },
    );
}

export async function registerFailure(admin: Admin, username: string, ip: string) {
  await Promise.all([bump(admin, "user", username), bump(admin, "ip", ip)]);
}

export async function clearGuards(admin: Admin, username: string, ip: string) {
  await admin.from("login_guards").delete().eq("scope", "user").eq("key", username);
  await admin.from("login_guards").delete().eq("scope", "ip").eq("key", ip);
}
