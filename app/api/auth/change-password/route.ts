import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, hashPassword, verifyPassword } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { oldPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    oldPassword?: string;
    newPassword?: string;
  };
  if (!oldPassword || !newPassword)
    return NextResponse.json({ error: "請輸入舊密碼與新密碼" }, { status: 400 });
  if (newPassword.length < 4)
    return NextResponse.json({ error: "新密碼至少 4 個字元" }, { status: 400 });

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("app_users")
    .select("password_hash")
    .eq("id", session.sub)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "帳號不存在" }, { status: 404 });

  if (!(await verifyPassword(oldPassword, user.password_hash)))
    return NextResponse.json({ error: "舊密碼錯誤" }, { status: 400 });

  await admin
    .from("app_users")
    .update({ password_hash: await hashPassword(newPassword) })
    .eq("id", session.sub);

  return NextResponse.json({ ok: true });
}
