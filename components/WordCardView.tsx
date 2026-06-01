"use client";

import { useState } from "react";
import type { WordCardRow } from "@/lib/types";
import { speak, speakText } from "@/lib/speak";
import { highlightWord } from "./highlight";

export default function WordCardView({ card }: { card: WordCardRow }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [showZh, setShowZh] = useState(false);

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
    </div>
  );
}
