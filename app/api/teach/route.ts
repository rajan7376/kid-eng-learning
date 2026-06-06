import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/authServer";
import { teachWord } from "@/lib/gemini";
import type { WordCardRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { cardId } = (await req.json().catch(() => ({}))) as { cardId?: string };
  if (!cardId) return NextResponse.json({ error: "缺少 cardId" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("word_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "找不到卡片" }, { status: 404 });
  const card = data as WordCardRow;

  // 已有快取直接回
  if (card.teach_tip) return NextResponse.json({ tip: card.teach_tip });

  try {
    const tip = await teachWord({
      word: card.english_word,
      partOfSpeech: card.part_of_speech,
      meaning: card.word_meaning_zh,
      sentence: card.sentence,
    });
    await admin.from("word_cards").update({ teach_tip: tip }).eq("id", cardId);
    return NextResponse.json({ tip });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI 產生失敗" },
      { status: 503 },
    );
  }
}
