import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { synthesizeSpeech, isAzureConfigured } from "@/lib/azureTts";
import { synthesizeEdge } from "@/lib/edgeTts";
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

  // 依序嘗試：Azure(若有金鑰) -> Edge 免費真人語音 -> 瀏覽器語音
  let mp3: Buffer | null = null;
  let lastErr = "";
  if (isAzureConfigured()) {
    try {
      mp3 = await synthesizeSpeech(text, speed);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Azure TTS 失敗";
    }
  }
  if (!mp3) {
    try {
      mp3 = await synthesizeEdge(text, speed);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Edge TTS 失敗";
    }
  }

  if (!mp3) {
    // 全部失敗 -> 讓前端降級為瀏覽器語音
    return NextResponse.json({ fallback: true, text, error: lastErr }, { status: 503 });
  }

  try {
    const path = `${cardId}/${target}-${speed}.mp3`;
    const { error: upErr } = await admin.storage
      .from("audio")
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from("audio").getPublicUrl(path);
    await admin
      .from("word_cards")
      .update({ [column]: pub.publicUrl })
      .eq("id", cardId);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (err) {
    return NextResponse.json(
      {
        fallback: true,
        text,
        error: err instanceof Error ? err.message : "音檔儲存失敗",
      },
      { status: 503 },
    );
  }
}
