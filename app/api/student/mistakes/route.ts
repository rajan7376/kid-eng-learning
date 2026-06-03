import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { CREATURE_COUNT, POINTS_PER_CREATURE } from "@/lib/creatures";
import { GRADUATE_DAYS, ageDays, taipeiToday } from "@/lib/rules";
import { computeCareView, grantBroomDaily, normalizeCare } from "@/lib/careServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "add" | "remove" | "review";
    card?: {
      id: string;
      english_word: string;
      word_meaning_zh: string | null;
      sentence: string | null;
      sentence_zh: string | null;
    };
    cardId?: string;
    correct?: boolean;
  };

  const admin = createAdminClient();

  // 每日複習：每字每天一次；滿 GRADUATE_DAYS 天答對 → 畢業 +1 點
  if (body.action === "review" && body.cardId) {
    const { data: m } = await admin
      .from("student_mistakes")
      .select("created_at, last_reviewed")
      .eq("user_id", session.sub)
      .eq("card_id", body.cardId)
      .maybeSingle();
    if (!m) return NextResponse.json({ error: "找不到此錯字" }, { status: 404 });

    const today = taipeiToday();
    if (m.last_reviewed === today)
      return NextResponse.json({ error: "今天已複習過", reviewedToday: true }, { status: 409 });

    await admin
      .from("student_mistakes")
      .update({ last_reviewed: today })
      .eq("user_id", session.sub)
      .eq("card_id", body.cardId);

    // 讀進度 + 每日複習發 1 把掃把
    await admin
      .from("student_progress")
      .upsert({ user_id: session.sub }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: cur } = await admin
      .from("student_progress")
      .select("points, unlocked_count, care")
      .eq("user_id", session.sub)
      .maybeSingle();
    const { care } = normalizeCare(cur?.care ?? {}, today, (cur?.unlocked_count ?? 0) > 0);
    grantBroomDaily(care, today);

    const due = ageDays(m.created_at) >= GRADUATE_DAYS;
    if (body.correct && due) {
      // 畢業：移除錯字 + 記一次打敗大魔王 + 加 1 點
      await admin
        .from("student_mistakes")
        .delete()
        .eq("user_id", session.sub)
        .eq("card_id", body.cardId);
      await admin.from("test_results").insert({
        user_id: session.sub,
        kind: "boss",
        score: 1,
        total: 1,
      });
      const prevUnlocked = cur?.unlocked_count ?? 0;
      const points = (cur?.points ?? 0) + 1;
      const unlockedCount = Math.min(
        Math.floor(points / POINTS_PER_CREATURE),
        CREATURE_COUNT,
      );
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
        graduated: true,
        points,
        unlockedCount,
        prevUnlocked,
        care: computeCareView(care, today),
      });
    }

    await admin
      .from("student_progress")
      .update({ care, updated_at: new Date().toISOString() })
      .eq("user_id", session.sub);
    return NextResponse.json({ graduated: false, care: computeCareView(care, today) });
  }

  if (body.action === "add" && body.card) {
    await admin.from("student_mistakes").upsert(
      {
        user_id: session.sub,
        card_id: body.card.id,
        english_word: body.card.english_word,
        word_meaning_zh: body.card.word_meaning_zh,
        sentence: body.card.sentence,
        sentence_zh: body.card.sentence_zh,
      },
      { onConflict: "user_id,card_id" },
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove" && body.cardId) {
    await admin
      .from("student_mistakes")
      .delete()
      .eq("user_id", session.sub)
      .eq("card_id", body.cardId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
}
