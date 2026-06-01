import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, signSession, verifyCaptcha, type Role } from "@/lib/auth";
import {
  checkGuards,
  clearGuards,
  ensureSeedAdmin,
  getClientIp,
  registerFailure,
  verifyPassword,
} from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { username, password, captchaToken, captchaInput } = (await req
    .json()
    .catch(() => ({}))) as {
    username?: string;
    password?: string;
    captchaToken?: string;
    captchaInput?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: "請輸入帳號與密碼" }, { status: 400 });
  }

  await ensureSeedAdmin();
  const admin = createAdminClient();
  const ip = getClientIp(req);

  // 1) 鎖定檢查
  const guard = await checkGuards(admin, username, ip);
  if (guard.lockedSeconds > 0) {
    return NextResponse.json(
      {
        error: `嘗試太多次，帳號與來源已鎖定，請於 ${Math.ceil(guard.lockedSeconds / 60)} 分鐘後再試`,
        lockedSeconds: guard.lockedSeconds,
        requireCaptcha: true,
      },
      { status: 423 },
    );
  }

  // 2) 需要驗證碼時先驗
  if (guard.requireCaptcha) {
    const ok = await verifyCaptcha(captchaToken, captchaInput);
    if (!ok) {
      return NextResponse.json(
        { error: "驗證碼錯誤，請重新輸入", requireCaptcha: true },
        { status: 400 },
      );
    }
  }

  // 3) 驗證帳密
  const { data: user } = await admin
    .from("app_users")
    .select("id, username, password_hash, role, display_name")
    .eq("username", username)
    .maybeSingle();

  const valid = user && (await verifyPassword(password, user.password_hash));
  if (!valid) {
    await registerFailure(admin, username, ip);
    const after = await checkGuards(admin, username, ip);
    return NextResponse.json(
      {
        error:
          after.lockedSeconds > 0
            ? "失敗次數過多，帳號已鎖定 10 分鐘"
            : "帳號或密碼錯誤",
        requireCaptcha: after.requireCaptcha,
        lockedSeconds: after.lockedSeconds,
      },
      { status: 401 },
    );
  }

  // 4) 成功
  await clearGuards(admin, username, ip);
  const role = user.role as Role;
  const token = await signSession({
    sub: user.id,
    username: user.username,
    role,
    name: user.display_name || user.username,
  });

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
