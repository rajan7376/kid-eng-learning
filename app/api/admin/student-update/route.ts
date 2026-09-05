import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  // 簡單權限檢查可依專案後台路由保護而定
  const { userId, diamonds, feed, broom, points } = await req.json();
  if (!userId) return NextResponse.json({ error: "缺少使用者 ID" }, { status: 400 });

  const admin = createAdminClient();
  
  // 取得現有 progress 與 care 資料
  const { data: prog } = await admin
    .from("student_progress")
    .select("care, points")
    .eq("user_id", userId)
    .maybeSingle();

  const care = (prog?.care as any) || {};
  if (diamonds !== undefined) care.diamonds = Number(diamonds);
  if (feed !== undefined) care.feed = Number(feed);
  if (broom !== undefined) care.broom = Number(broom);

  const updatePayload: any = { care, updated_at: new Date().toISOString() };
  if (points !== undefined) {
    updatePayload.points = Number(points);
    // 依點數同步更新解鎖數量
    updatePayload.unlocked_count = Math.floor(Number(points) / 6); // 假設每 6 點一隻動物
  }

  const { error } = await admin
    .from("student_progress")
    .upsert({ user_id: userId, ...updatePayload }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}