import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { POINTS_PER_CREATURE, MAX_WEEK_POINTS } from "@/lib/creatures";
import { taipeiToday, CARE_ITEM_CAP } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { weekId, score, total } = await req.json();
  const admin = createAdminClient();
  const userId = session.sub;
  const today = taipeiToday();

  // 1. 取得目前學生進度與 care 狀態
  const { data: prog } = await admin
    .from("student_progress")
    .select("points, unlocked_count, zoo_positions, care")
    .eq("user_id", userId)
    .maybeSingle();

  const currentPoints = prog?.points ?? 0;
  const prevUnlocked = prog?.unlocked_count ?? 0;
  let careData = (prog?.care as any) || {
    lastCleaned: today,
    poopCount: 0,
    hungerStage: "ok",
    feed: 3,
    broom: 3,
    diamonds: 0,
    inventory: {},
    lastItemDate: null,
    weekScores: {},
    diamondWeeks: {}
  };

  let awarded = 0;
  let capReached = false;
  let diamondAwarded = false;
  let itemAwarded = false;

  const isPerfect = total > 0 && score === total;

  if (isPerfect) {
    // 檢查該週次獲得點數上限 (上限 2 點)
    const weekScores = careData.weekScores || {};
    const currentWeekCount = weekScores[weekId] || 0;

    if (currentWeekCount < MAX_WEEK_POINTS) {
      awarded = 1;
      weekScores[weekId] = currentWeekCount + 1;
      careData.weekScores = weekScores;
    } else {
      capReached = true;
    }

    // 鑽石規則：每個課程終身僅能因滿分獲得一次鑽石
    const diamondWeeks = careData.diamondWeeks || {};
    if (weekId && !diamondWeeks[weekId]) {
      diamondWeeks[weekId] = true;
      careData.diamondWeeks = diamondWeeks;
      careData.diamonds = (careData.diamonds || 0) + 1;
      diamondAwarded = true;
    }
  }

  // 道具規則：全帳號每天限領一次道具 (不限課程)
  if (careData.lastItemDate !== today) {
    careData.lastItemDate = today;
    itemAwarded = true;
    const itemRewardType = Math.random() > 0.5 ? "feed" : "broom";
    if (itemRewardType === "feed") {
      careData.feed = Math.min(CARE_ITEM_CAP, (careData.feed || 0) + 1);
    } else {
      careData.broom = Math.min(CARE_ITEM_CAP, (careData.broom || 0) + 1);
    }
  }

  const newPoints = currentPoints + awarded;
  const newUnlockedCount = Math.floor(newPoints / POINTS_PER_CREATURE);

  const newCare = {
    ...careData,
    lastCleaned: careData.lastCleaned || today,
    poopCount: careData.poopCount ?? 0,
    hungerStage: careData.hungerStage || "ok",
    feed: careData.feed ?? 3,
    broom: careData.broom ?? 3,
    diamonds: careData.diamonds || 0,
    inventory: careData.inventory || {},
    diamondWeeks: careData.diamondWeeks || {}
  };

  const updatePayload = {
    user_id: userId,
    points: newPoints,
    unlocked_count: newUnlockedCount,
    care: newCare,
    updated_at: new Date().toISOString()
  };

  await admin.from("student_progress").upsert(updatePayload, { onConflict: "user_id" });

  return NextResponse.json({
    points: newPoints,
    unlockedCount: newUnlockedCount,
    prevUnlocked,
    awarded,
    capReached,
    diamondAwarded,
    itemAwarded,
    currentDiamonds: newCare.diamonds,
    care: newCare
  });
}