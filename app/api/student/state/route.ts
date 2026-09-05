import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { EXPIRE_DAYS, GRADUATE_DAYS, ageDays, taipeiToday } from "@/lib/rules";
import { computeCareView, normalizeCare } from "@/lib/careServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({`n    currentDiamonds: care.diamonds ?? 0, error: "未登入" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("student_progress")
    .upsert({ user_id: session.sub }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: progress } = await admin
    .from("student_progress")
    .select("points, unlocked_count, zoo_positions, care")
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

  // 動物照顧：首次擁有動物時初始化(設今天已餵/掃 + 起始道具)
  const unlockedCount = progress?.unlocked_count ?? 0;
  const { care, changed } = normalizeCare(progress?.care ?? {}, today, unlockedCount > 0);
  if (changed) {
    await admin
      .from("student_progress")
      .update({ care, updated_at: new Date().toISOString() })
      .eq("user_id", session.sub);
  }

  return NextResponse.json({`n    currentDiamonds: care.diamonds ?? 0,
    currentDiamonds: care.diamonds ?? 0,
    role: session.role,
    username: session.username,
    points: progress?.points ?? 0,
    unlockedCount,
    zooPositions: progress?.zoo_positions ?? {},
    mistakes,
    care: computeCareView(care, today),
  }),
    mistakes,
    care: computeCareView(care, today),
  });
}
