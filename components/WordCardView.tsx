"use client";

import { useState } from "react";
import type { TeachTip, WordCardRow } from "@/lib/types";
import { speak, speakText } from "@/lib/speak";
import { highlightWord } from "./highlight";

// 由單字產生穩定 seed，讓同一個字每次拿到同一張情境圖
function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

export default function WordCardView({ card }: { card: WordCardRow }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [showZh, setShowZh] = useState(false);
  const [showTeach, setShowTeach] = useState(false);
  const [tip, setTip] = useState<TeachTip | null>(card.teach_tip ?? null);
  const [teaching, setTeaching] = useState(false);
  const [teachErr, setTeachErr] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);

  async function openTeach() {
    setShowTeach(true);
    if (tip || teaching) return;
    setTeaching(true);
    setTeachErr("");
    try {
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id }),
      });
      const d = await res.json();
      if (d.tip) setTip(d.tip);
      else setTeachErr(d.error || "產生失敗，請稍後再試");
    } catch {
      setTeachErr("連線失敗，請稍後再試");
    } finally {
      setTeaching(false);
    }
  }

  async function play(target: "word" | "sentence", speed: "normal" | "slow") {
    const key = `${target}-${speed}`;
    setPlaying(key);
    const text = target === "word" ? card.english_word : card.sentence ?? "";
    await speak(card.id, target, speed, text);
    setPlaying(null);
  }

  const Btn = ({
    label,
    target,
    speed,
  }: {
    label: string;
    target: "word" | "sentence";
    speed: "normal" | "slow";
  }) => {
    const key = `${target}-${speed}`;
    return (
      <button
        onClick={() => play(target, speed)}
        disabled={playing === key || (target === "sentence" && !card.sentence)}
        className="rounded-full bg-violet-100 text-brand px-3 py-1 text-sm font-bold hover:bg-violet-200 disabled:opacity-40"
      >
        {playing === key ? "🔊…" : label}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 card-shadow flex flex-col gap-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-extrabold text-slate-800">
          {card.english_word}
        </span>
        {card.part_of_speech && (
          <span className="text-sm text-violet-400 font-bold">
            {card.part_of_speech}
          </span>
        )}
      </div>
      {card.word_meaning_zh && (
        <p className="text-slate-600 flex items-center gap-2">
          {card.word_meaning_zh}
          <button
            onClick={() => speakText(card.word_meaning_zh ?? "", "zh-TW")}
            title="念中文詞義"
            className="text-brand"
          >
            🔊
          </button>
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Btn label="🔊 發音" target="word" speed="normal" />
        <Btn label="🐢 慢速" target="word" speed="slow" />
        <button
          onClick={openTeach}
          className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-bold hover:bg-amber-200"
        >
          💡 學習小技巧
        </button>
      </div>

      {card.sentence && (
        <div className="mt-1 border-t border-slate-100 pt-3">
          <p className="text-slate-800 leading-relaxed">
            {highlightWord(card.sentence, card.english_word)}
          </p>
          {card.sentence_zh &&
            (showZh ? (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                {card.sentence_zh}
                <button
                  onClick={() => speakText(card.sentence_zh ?? "", "zh-TW")}
                  title="念中文翻譯"
                  className="text-brand"
                >
                  🔊
                </button>
              </p>
            ) : (
              <button
                onClick={() => setShowZh(true)}
                className="text-sm text-brand underline mt-1"
              >
                中文翻譯
              </button>
            ))}
          <div className="flex gap-2 flex-wrap mt-2">
            <Btn label="🔊 唸句子" target="sentence" speed="normal" />
            <Btn label="🐢 慢速句子" target="sentence" speed="slow" />
          </div>
        </div>
      )}

      {showTeach && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowTeach(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-md w-full card-shadow space-y-3 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xl font-extrabold text-amber-600">
                💡 {card.english_word} 學習小技巧
              </p>
              <button
                onClick={() => setShowTeach(false)}
                className="text-slate-400 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {teaching && (
              <p className="text-slate-500 py-6 text-center">
                🤖 AI 老師正在想記憶小技巧…
              </p>
            )}
            {teachErr && <p className="text-rose-500">{teachErr}</p>}

            {tip && (
              <div className="space-y-3">
                {tip.image_prompt ? (
                  <div className="relative rounded-2xl overflow-hidden bg-amber-50 aspect-[4/3]">
                    {!imgLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                        🎨 正在畫情境圖…
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://image.pollinations.ai/prompt/${encodeURIComponent(
                        tip.image_prompt,
                      )}?width=512&height=384&nologo=true&seed=${seedOf(card.english_word)}`}
                      alt={card.english_word}
                      onLoad={() => setImgLoaded(true)}
                      className={`w-full h-full object-cover transition-opacity ${
                        imgLoaded ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                ) : (
                  <div className="text-center text-5xl">{tip.emoji}</div>
                )}
                <TipRow icon="🔤" title="音節拆解" text={tip.syllables} speakable />
                <TipRow icon="🗣️" title="諧音念念看" text={tip.sound_alike} />
                <TipRow icon="🧠" title="聯想記憶" text={tip.memory_trick} />
                <TipRow icon="✏️" title="拼字技巧" text={tip.spelling_tip} />
                <TipRow icon="📖" title="小故事" text={tip.mini_story} />
                <div className="pt-1">
                  <button
                    onClick={() => speak(card.id, "word", "slow", card.english_word)}
                    className="rounded-full bg-violet-100 text-brand px-4 py-2 text-sm font-bold"
                  >
                    🐢 慢慢念一次給我聽
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TipRow({
  icon,
  title,
  text,
  speakable = false,
}: {
  icon: string;
  title: string;
  text: string;
  speakable?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-3">
      <p className="text-sm font-bold text-amber-700 flex items-center gap-2">
        <span>{icon}</span>
        {title}
        {speakable && (
          <button
            onClick={() => speakText(text.replace(/-/g, " "), "en-US")}
            title="念念看"
            className="text-brand"
          >
            🔊
          </button>
        )}
      </p>
      <p className="text-slate-700 mt-0.5">{text}</p>
    </div>
  );
}
