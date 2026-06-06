export type Speed = "normal" | "slow";
export type AudioTarget = "word" | "sentence";

export interface ClassRow {
  id: string;
  code: string;
  name: string | null;
  owner_id: string;
  created_at: string;
}

export interface WeekRow {
  id: string;
  class_id: string;
  week_label: string;
  date_range: string | null;
  sort_order: number | null;
  created_at: string;
}

export interface WordCardRow {
  id: string;
  week_id: string;
  sort_order: number | null;
  english_word: string;
  part_of_speech: string | null;
  word_meaning_zh: string | null;
  sentence: string | null;
  sentence_zh: string | null;
  audio_word_normal: string | null;
  audio_word_slow: string | null;
  audio_sentence_normal: string | null;
  audio_sentence_slow: string | null;
  teach_tip: TeachTip | null;
  created_at: string;
}

export interface TeachTip {
  emoji: string; // 代表性 emoji
  syllables: string; // 音節拆解，如 cu-cum-ber
  sound_alike: string; // 中文諧音/趣味發音
  memory_trick: string; // 聯想記憶法
  spelling_tip: string; // 拼字小技巧
  mini_story: string; // 一句有趣小故事/畫面
}

export type UploadStatus = "pending" | "processing" | "done" | "error";

export interface UploadRow {
  id: string;
  week_id: string | null;
  file_path: string;
  mime_type: string;
  status: UploadStatus;
  error: string | null;
  created_at: string;
}

export interface ExtractedCard {
  english_word: string;
  part_of_speech?: string;
  word_meaning_zh?: string;
  sentence?: string;
  sentence_zh?: string;
}

export interface ExtractedHandout {
  class_code: string;
  week_label: string;
  date_range?: string;
  cards: ExtractedCard[];
}
