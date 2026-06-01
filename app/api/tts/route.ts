import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { synthesizeSpeech, isAzureConfigured } from "@/lib/azureTts";
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
  const { cardId, target, speed } = (await req.json()) as {
    cardId: string;
    target: AudioTarget;
    speed: Speed;
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

  // Azure 未設定 -> 通知前端改用瀏覽器語音
  if (!isAzureConfigured()) {
    return NextResponse.json(
      { fallback: true, text, error: "Azure 未設定" },
      { status: 503 },
    );
  }

  try {
    const mp3 = await synthesizeSpeech(text, speed);
    const path = `${cardId}/${target}-${speed}.mp3`;
    await admin.storage
      .from("audio")
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    const { data: pub } = admin.storage.from("audio").getPublicUrl(path);
    await admin
      .from("word_cards")
      .update({ [column]: pub.publicUrl })
      .eq("id", cardId);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (err) {
    // 生成失敗也讓前端降級為瀏覽器語音
    return NextResponse.json(
      {
        fallback: true,
        text,
        error: err instanceof Error ? err.message : "TTS 失敗",
      },
      { status: 503 },
    );
  }
}
