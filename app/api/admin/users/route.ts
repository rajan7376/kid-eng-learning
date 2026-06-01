import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, hashPassword } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const s = await getSession();
  return s && s.role === "admin" ? s : null;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  const admin = createAdminClient();

  const { data: users } = await admin
    .from("app_users")
    .select("id, username, role, display_name, created_at")
    .order("role")
    .order("username");

  const { data: progress } = await admin
    .from("student_progress")
    .select("user_id, points, unlocked_count");
  const { data: mistakes } = await admin
    .from("student_mistakes")
    .select("user_id");
  const { data: tests } = await admin
    .from("test_results")
    .select("user_id, score, total, kind, created_at")
    .order("created_at", { ascending: false });

  const pMap = new Map((progress ?? []).map((p) => [p.user_id, p]));
  const mCount = new Map<string, number>();
  (mistakes ?? []).forEach((m) =>
    mCount.set(m.user_id, (mCount.get(m.user_id) ?? 0) + 1),
  );
  const tCount = new Map<string, number>();
  const tLast = new Map<string, string>();
  (tests ?? []).forEach((t) => {
    tCount.set(t.user_id, (tCount.get(t.user_id) ?? 0) + 1);
    if (!tLast.has(t.user_id)) tLast.set(t.user_id, t.created_at);
  });

  return NextResponse.json({
    users: (users ?? []).map((u) => ({
      ...u,
      points: pMap.get(u.id)?.points ?? 0,
      unlockedCount: pMap.get(u.id)?.unlocked_count ?? 0,
      mistakeCount: mCount.get(u.id) ?? 0,
      testCount: tCount.get(u.id) ?? 0,
      lastTest: tLast.get(u.id) ?? null,
    })),
  });
}

export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  const { username, password, role, display_name } = (await req
    .json()
    .catch(() => ({}))) as {
    username?: string;
    password?: string;
    role?: string;
    display_name?: string;
  };
  if (!username || !password)
    return NextResponse.json({ error: "請填帳號與密碼" }, { status: 400 });

  const admin = createAdminClient();
  const { data: exists } = await admin
    .from("app_users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (exists)
    return NextResponse.json({ error: "帳號已存在" }, { status: 409 });

  const password_hash = await hashPassword(password);
  const { error } = await admin.from("app_users").insert({
    username,
    password_hash,
    role: role === "admin" ? "admin" : "student",
    display_name: display_name || null,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  const { id, password, display_name, role } = (await req
    .json()
    .catch(() => ({}))) as {
    id?: string;
    password?: string;
    display_name?: string;
    role?: string;
  };
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (password) update.password_hash = await hashPassword(password);
  if (display_name !== undefined) update.display_name = display_name;
  if (role) update.role = role === "admin" ? "admin" : "student";
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("app_users").update(update).eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  if (id === session.sub)
    return NextResponse.json({ error: "不能刪除自己" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("app_users").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
