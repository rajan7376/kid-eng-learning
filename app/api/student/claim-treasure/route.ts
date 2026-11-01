import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { CARE_ITEM_CAP } from "@/lib/rules";
import { computeCareView, CareRow } from "@/lib/careServer";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const admin = createAdminClient();
  const { data: progress } = await admin
    .from("student_progress")
    .select("care")
    .eq("user_id", session.sub)
    .single();

  if (!progress) return NextResponse.json({ error: "找不到資料" }, { status: 404 });

  const care: CareRow = progress.care || {};

  // 隨機發放 1~2 根胡蘿蔔 或 1~2 把掃把
  const isFeed = Math.random() < 0.5;
  const count = Math.random() < 0.5 ? 1 : 2;

  if (isFeed) {
    care.feed = Math.min(CARE_ITEM_CAP, (care.feed ?? 0) + count);
  } else {
    care.broom = Math.min(CARE_ITEM_CAP, (care.broom ?? 0) + count);
  }

  await admin
    .from("student_progress")
    .update({ care, updated_at: new Date().toISOString() })
    .eq("user_id", session.sub);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  const careView = computeCareView(care, today);

  return NextResponse.json({
    ok: true,
    reward: {
      type: isFeed ? "feed" : "broom",
      name: isFeed ? "胡蘿蔔" : "掃把",
      emoji: isFeed ? "🥕" : "🧹",
      count,
    },
    care: careView,
  });
}