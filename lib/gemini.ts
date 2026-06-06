import {
  GoogleGenerativeAI,
  SchemaType,
  type Part,
} from "@google/generative-ai";
import type { ExtractedHandout, TeachTip } from "./types";

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

const teachSchema = {
  type: SchemaType.OBJECT,
  properties: {
    emoji: { type: SchemaType.STRING },
    syllables: { type: SchemaType.STRING },
    sound_alike: { type: SchemaType.STRING },
    memory_trick: { type: SchemaType.STRING },
    spelling_tip: { type: SchemaType.STRING },
    mini_story: { type: SchemaType.STRING },
  },
  required: [
    "emoji",
    "syllables",
    "sound_alike",
    "memory_trick",
    "spelling_tip",
    "mini_story",
  ],
} as const;

export async function teachWord(input: {
  word: string;
  partOfSpeech?: string | null;
  meaning?: string | null;
  sentence?: string | null;
}): Promise<TeachTip> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 未設定");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: teachSchema as any,
      temperature: 1.0,
    },
  });

  const prompt = `你是親切又有創意的國小英語老師，要幫一個剛學英文、覺得單字很難背的小朋友記住一個單字。
單字: ${input.word}
詞性: ${input.partOfSpeech ?? "(未提供)"}
中文意思: ${input.meaning ?? "(未提供)"}
例句: ${input.sentence ?? "(未提供)"}

請全部用「繁體中文」、口吻活潑可愛、像在跟 7~10 歲小朋友說話，輸出 JSON：
- emoji: 一個最能代表這個單字的 emoji。
- syllables: 把單字依音節用「-」拆開，例如 cucumber -> "cu-cum-ber"。
- sound_alike: 用中文諧音或注音幫助發音記憶，要好玩好念，例如 cucumber -> "可以康跛 🥒"。
- memory_trick: 一個聯想記憶法，把單字長相或發音跟中文意思連在一起，越有畫面越好。
- spelling_tip: 一個拼字小技巧(例如字根、重複字母、和已學過的字比較、規律)，幫助記住怎麼拼。
- mini_story: 用一句話講一個有趣、好笑或好記的小畫面/故事，把單字的意思演出來。
不要太長，每項 1~2 句即可。只輸出 JSON。`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as TeachTip;
}

export function inlinePart(base64: string, mimeType: string): Part {
  return { inlineData: { data: base64, mimeType } };
}

export function textPart(text: string): Part {
  return { text };
}
