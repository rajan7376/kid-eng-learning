import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ error: "需要學生權限" }, { status: 403 });
  }

  const { weekId, score, total } = await req.json();
  if (total === undefined || score === undefined) {
    return NextResponse.json({ error: "缺少測驗分數資料" }, { status: 400 });
  }

  const userId = session.sub;
  const admin = createAdminClient();

  await admin.from("test_results").insert({
    user_id: userId,
    week_id: weekId || null,
    kind: "quiz",
    score,
    total,
  });

  const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Taipei" }).split(",")[0].trim();

  const { data: progress } = await admin
    .from("student_progress")
    .select("*")
    .eq("user_id", userId)
    .single();

  let care = progress?.care ? { ...progress.care } : {};
  let points = progress?.points ?? 0;
  
  let diamondAwarded = false;
  let feedAwarded = false;

  if (care.lastFeedEarned !== today) {
    care.feed = Math.min((care.feed || 0) + 1, 5);
    care.lastFeedEarned = today;
    feedAwarded = true;
  }

  if (score === total && total > 0) {
    if (care.lastDiamondEarned !== today) {
      care.diamonds = (care.diamonds || 0) + 1;
      care.lastDiamondEarned = today;
      diamondAwarded = true;
    }
  }

  await admin
    .from("student_progress")
    .update({ care, points })
    .eq("user_id", userId);

  return NextResponse.json({
    ok: true,
    diamondAwarded,
    feedAwarded,
    currentDiamonds: care.diamonds || 0
  });
}
