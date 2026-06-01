import {
  GoogleGenerativeAI,
  SchemaType,
  type Part,
} from "@google/generative-ai";
import type { ExtractedHandout } from "./types";

const PROMPT = `你是英語教材分析助手。輸入是「親師小語」週報(圖片/PDF或純文字)。請嚴格依規則輸出 JSON：
1. class_code: 從「班別：」抽出班級代碼。例: "4A_" -> "4A"; "Shiny (3A)" -> "3A"。
2. week_label 與 date_range: 取「一、」開頭那一行的單字週次與日期(不要用第一行「週別」，那是上週)。
   week_label 統一成像 "W17"; date_range 統一成像 "06/01-06/05"。
3. cards: 萃取單字表(Vocabulary words 區塊)的每個單字，遇到「二、本週名句精選」就停止，後面的提醒事項、組距、家長信全部忽略。
   - 英文單字或例句若被換行拆開，要合併成完整字串。
   - 一個單字若有多個詞性(如 cause 同時 v. 與 n.)且各自有例句，拆成多筆。
   - 每筆欄位: english_word(英文單字/片語), part_of_speech(詞性如 n./v./adj./prep./ph./phr.),
     word_meaning_zh(中文詞義), sentence(英文例句), sentence_zh(中文翻譯，來源若無請你翻譯)。
只輸出 JSON，不要任何額外文字或 markdown。`;

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    class_code: { type: SchemaType.STRING },
    week_label: { type: SchemaType.STRING },
    date_range: { type: SchemaType.STRING },
    cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          english_word: { type: SchemaType.STRING },
          part_of_speech: { type: SchemaType.STRING },
          word_meaning_zh: { type: SchemaType.STRING },
          sentence: { type: SchemaType.STRING },
          sentence_zh: { type: SchemaType.STRING },
        },
        required: ["english_word"],
      },
    },
  },
  required: ["class_code", "week_label", "cards"],
} as const;

export async function extractHandout(parts: Part[]): Promise<ExtractedHandout> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 未設定");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: responseSchema as any,
      temperature: 0.2,
    },
  });

  const result = await model.generateContent([{ text: PROMPT }, ...parts]);
  const text = result.response.text();
  const parsed = JSON.parse(text) as ExtractedHandout;
  if (!parsed.cards) parsed.cards = [];
  return parsed;
}

export function inlinePart(base64: string, mimeType: string): Part {
  return { inlineData: { data: base64, mimeType } };
}

export function textPart(text: string): Part {
  return { text };
}
