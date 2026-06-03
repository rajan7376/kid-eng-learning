import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { CREATURE_COUNT, POINTS_PER_CREATURE } from "@/lib/creatures";
import { MAX_WEEK_POINTS, taipeiToday } from "@/lib/rules";
import {
  computeCareView,
  grantBroomDaily,
  grantFeedDaily,
  normalizeCare,
} from "@/lib/careServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { weekId, score, total } = (await req.json().catch(() => ({}))) as {
    weekId?: string | null;
    score?: number;
    total?: number;
  };

  const admin = createAdminClient();
  const s = Number(score) || 0;
  const t = Number(total) || 0;

  // 記錄測驗成績
  await admin.from("test_results").insert({
    user_id: session.sub,
    week_id: weekId ?? null,
    kind: "quiz",
    score: s,
    total: t,
  });

  const fullMark = t > 0 && s === t;
  let awarded = 0;

  // 滿分才加分，且同一單字表最多累計 MAX_WEEK_POINTS
  if (fullMark && weekId) {
    await admin
      .from("week_points")
      .upsert(
        { user_id: session.sub, week_id: weekId },
        { onConflict: "user_id,week_id", ignoreDuplicates: true },
      );
    const { data: wp } = await admin
      .from("week_points")
      .select("points")
      .eq("user_id", session.sub)
      .eq("week_id", weekId)
      .maybeSingle();
    const earned = wp?.points ?? 0;
    if (earned < MAX_WEEK_POINTS) {
      awarded = 1;
      await admin
        .from("week_points")
        .update({ points: earned + 1 })
        .eq("user_id", session.sub)
        .eq("week_id", weekId);
    }
  }

  // 套用點數
  await admin
    .from("student_progress")
    .upsert({ user_id: session.sub }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: cur } = await admin
    .from("student_progress")
    .select("points, unlocked_count, care")
    .eq("user_id", session.sub)
    .maybeSingle();

  const prevUnlocked = cur?.unlocked_count ?? 0;
  const points = (cur?.points ?? 0) + awarded;
  const unlockedCount = Math.min(
    Math.floor(points / POINTS_PER_CREATURE),
    CREATURE_COUNT,
  );

  // 完成測驗每天發 1 飼料；若沒有錯字(無法打大魔王拿掃把)則一併補掃把
  const today = taipeiToday();
  const { care } = normalizeCare(cur?.care ?? {}, today, unlockedCount > 0);
  grantFeedDaily(care, today);
  const { count: mistakeCount } = await admin
    .from("student_mistakes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.sub);
  if (!mistakeCount) grantBroomDaily(care, today);

  await admin
    .from("student_progress")
    .update({
      points,
      unlocked_count: unlockedCount,
      care,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.sub);

  return NextResponse.json({
    fullMark,
    awarded,
    capReached: fullMark && awarded === 0,
    points,
    unlockedCount,
    prevUnlocked,
    care: computeCareView(care, today),
  });
}
