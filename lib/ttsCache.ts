import type { SupabaseClient } from "@supabase/supabase-js";
import { synthesizeSpeech, isAzureConfigured } from "./azureTts";
import { synthesizeEdge } from "./edgeTts";
import type { AudioTarget, Speed, WordCardRow } from "./types";

const COL: Record<string, keyof WordCardRow> = {
  "word:normal": "audio_word_normal",
  "word:slow": "audio_word_slow",
  "sentence:normal": "audio_sentence_normal",
  "sentence:slow": "audio_sentence_slow",
};

/**
 * 確保某卡片某發音已有快取：已存在則回網址，否則合成(Azure→Edge)、上傳、寫欄位。
 * 失敗回 null（讓呼叫端決定降級或忽略）。
 */
export async function ensureAudio(
  admin: SupabaseClient,
  card: WordCardRow,
  target: AudioTarget,
  speed: Speed,
): Promise<string | null> {
  const column = COL[`${target}:${speed}`];
  if (!column) return null;

  const existing = card[column] as string | null;
  if (existing) return existing;

  const text = target === "word" ? card.english_word : card.sentence;
  if (!text) return null;

  let mp3: Buffer | null = null;
  if (isAzureConfigured()) {
    try {
      mp3 = await synthesizeSpeech(text, speed);
    } catch {
      /* 換下一個來源 */
    }
  }
  if (!mp3) {
    try {
      mp3 = await synthesizeEdge(text, speed);
    } catch {
      return null;
    }
  }

  try {
    const path = `${card.id}/${target}-${speed}.mp3`;
    const { error: upErr } = await admin.storage
      .from("audio")
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from("audio").getPublicUrl(path);
    await admin
      .from("word_cards")
      .update({ [column]: pub.publicUrl })
      .eq("id", card.id);
    return pub.publicUrl;
  } catch {
    return null;
  }
}

/**
 * 預生發音快取，限制併發。
 * 預設只生「單字正常/慢」(量小、最常點)，句子留到點擊時再生，避免上傳逾時。
 * includeSentence=true 時連句子也一起生。
 */
export async function pregenerateWeekAudio(
  admin: SupabaseClient,
  cards: WordCardRow[],
  concurrency = 4,
  includeSentence = false,
): Promise<void> {
  const jobs: Array<[WordCardRow, AudioTarget, Speed]> = [];
  for (const c of cards) {
    jobs.push([c, "word", "normal"], [c, "word", "slow"]);
    if (includeSentence && c.sentence) {
      jobs.push([c, "sentence", "normal"], [c, "sentence", "slow"]);
    }
  }
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const [card, target, speed] = jobs[i++];
      await ensureAudio(admin, card, target, speed);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, worker),
  );
}
