import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { EXPIRE_DAYS, GRADUATE_DAYS, ageDays, taipeiToday } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("student_progress")
    .upsert({ user_id: session.sub }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: progress } = await admin
    .from("student_progress")
    .select("points, unlocked_count, zoo_positions")
    .eq("user_id", session.sub)
    .maybeSingle();

  const { data: mistakesRaw } = await admin
    .from("student_mistakes")
    .select("card_id, english_word, word_meaning_zh, sentence, sentence_zh, created_at, last_reviewed")
    .eq("user_id", session.sub);

  const today = taipeiToday();
  const expired: string[] = [];
  const mistakes = (mistakesRaw ?? [])
    .filter((m) => {
      const age = ageDays(m.created_at);
      if (age > EXPIRE_DAYS) {
        expired.push(m.card_id);
        return false; // 超過緩衝仍未畢業 → 過期移除
      }
      return true;
    })
    .map((m) => {
      const age = ageDays(m.created_at);
      return {
        id: m.card_id,
        english_word: m.english_word,
        word_meaning_zh: m.word_meaning_zh,
        sentence: m.sentence,
        sentence_zh: m.sentence_zh,
        reviewedToday: m.last_reviewed === today,
        due: age >= GRADUATE_DAYS,
        daysLeft: Math.max(0, GRADUATE_DAYS - age),
      };
    });

  if (expired.length > 0) {
    await admin
      .from("student_mistakes")
      .delete()
      .eq("user_id", session.sub)
      .in("card_id", expired);
  }

  return NextResponse.json({
    role: session.role,
    username: session.username,
    points: progress?.points ?? 0,
    unlockedCount: progress?.unlocked_count ?? 0,
    zooPositions: progress?.zoo_positions ?? {},
    mistakes,
  });
}
