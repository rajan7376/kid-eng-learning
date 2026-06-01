import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";

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

  const { data: mistakes } = await admin
    .from("student_mistakes")
    .select("card_id, english_word, word_meaning_zh, sentence, sentence_zh")
    .eq("user_id", session.sub);

  return NextResponse.json({
    role: session.role,
    username: session.username,
    points: progress?.points ?? 0,
    unlockedCount: progress?.unlocked_count ?? 0,
    zooPositions: progress?.zoo_positions ?? {},
    mistakes: (mistakes ?? []).map((m) => ({
      id: m.card_id,
      english_word: m.english_word,
      word_meaning_zh: m.word_meaning_zh,
      sentence: m.sentence,
      sentence_zh: m.sentence_zh,
    })),
  });
}
