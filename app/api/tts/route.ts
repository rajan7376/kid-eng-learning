import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAudio } from "@/lib/ttsCache";
import type { AudioTarget, Speed, WordCardRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const COL: Record<string, string> = {
  "word:normal": "audio_word_normal",
  "word:slow": "audio_word_slow",
  "sentence:normal": "audio_sentence_normal",
  "sentence:slow": "audio_sentence_slow",
};

export async function POST(req: Request) {
  const { cardId, target, speed, cacheOnly } = (await req.json()) as {
    cardId: string;
    target: AudioTarget;
    speed: Speed;
    cacheOnly?: boolean;
  };

  if (!cardId || !COL[`${target}:${speed}`]) {
    return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
  }
  const column = COL[`${target}:${speed}`];
  const admin = createAdminClient();

  const { data } = await admin
    .from("word_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "找不到卡片" }, { status: 404 });
  const card = data as WordCardRow;

  // 已有快取直接回
  const existing = card[column as keyof WordCardRow] as string | null;
  if (existing) return NextResponse.json({ url: existing });

  const text = target === "word" ? card.english_word : card.sentence;
  if (!text) return NextResponse.json({ error: "無內容可發音" }, { status: 400 });

  // 只查快取(不生成)：給前端「秒回」用，未命中就讓它先用瀏覽器語音
  if (cacheOnly) return NextResponse.json({ miss: true, text });

  // Azure(若有金鑰) -> Edge 免費真人語音 -> 上傳快取
  const url = await ensureAudio(admin, card, target, speed);
  if (url) return NextResponse.json({ url });

  // 失敗 -> 讓前端降級為瀏覽器語音
  return NextResponse.json({ fallback: true, text }, { status: 503 });
}
