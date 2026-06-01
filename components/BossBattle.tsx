"use client";

import { useEffect, useRef, useState } from "react";
import { speak } from "@/lib/speak";
import type { MistakeCard } from "@/lib/useStudent";

export default function BossBattle({
  mistakes,
  onRemove,
  onDefeat,
}: {
  mistakes: MistakeCard[];
  onRemove: (cardId: string) => void;
  onDefeat: () => void;
}) {
  const latest = useRef(mistakes);
  latest.current = mistakes;

  const [queue, setQueue] = useState<MistakeCard[]>(() => mistakes);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const firedRef = useRef(false);

  // 還沒開打且尚無題目時，跟著最新錯字清單(例如剛從測驗進來)
  useEffect(() => {
    if (idx === 0 && !submitted && queue.length === 0 && mistakes.length > 0) {
      setQueue(mistakes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistakes]);

  const current = queue[idx];
  const finished = idx >= queue.length;

  useEffect(() => {
    if (current) void speak(current.id, "word", "normal", current.english_word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue]);

  useEffect(() => {
    if (finished && queue.length > 0 && mistakes.length === 0 && !firedRef.current) {
      firedRef.current = true;
      onDefeat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, mistakes.length]);

  if (mistakes.length === 0 && queue.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 card-shadow text-center space-y-2">
        <p className="text-5xl">😴</p>
        <p className="font-bold text-slate-600">目前沒有錯字，大魔王還在睡覺～</p>
        <p className="text-sm text-slate-400">
          在「聽力測驗」答錯的單字會被關進這裡，方便重點複習。
        </p>
      </div>
    );
  }

  const isCorrect =
    !!current &&
    input.trim().toLowerCase() === current.english_word.trim().toLowerCase();

  function submit() {
    if (submitted || !current) return;
    setSubmitted(true);
    if (input.trim().toLowerCase() === current.english_word.trim().toLowerCase()) {
      onRemove(current.id);
    }
  }

  function next() {
    setIdx((i) => i + 1);
    setInput("");
    setSubmitted(false);
  }

  function restart() {
    firedRef.current = false;
    setQueue(latest.current);
    setIdx(0);
    setInput("");
    setSubmitted(false);
  }

  if (finished) {
    const won = mistakes.length === 0;
    return (
      <div className="bg-white rounded-2xl p-8 card-shadow text-center space-y-3">
        <p className="text-6xl">{won ? "🎉" : "👹"}</p>
        <p className="text-xl font-extrabold text-brand">
          {won ? "打敗錯字大魔王！+1 點" : `大魔王還剩 ${mistakes.length} 個錯字`}
        </p>
        {!won && (
          <p className="text-sm text-slate-500">把牠們再複習一次，全部答對就能擊敗牠！</p>
        )}
        <button
          onClick={restart}
          className="rounded-full bg-brand text-white px-6 py-2 font-bold"
        >
          {won ? "再來一場" : "再挑戰一次"}
        </button>
      </div>
    );
  }

  const hp = mistakes.length;

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow space-y-4">
      <div className="text-center">
        <div className="text-6xl">👹</div>
        <p className="font-extrabold text-rose-500">錯字大魔王</p>
        <div className="mx-auto max-w-xs h-3 rounded-full bg-rose-100 overflow-hidden mt-1">
          <div
            className="h-full bg-rose-500 transition-all"
            style={{ width: `${(hp / Math.max(queue.length, 1)) * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">
          HP {hp}・第 {idx + 1}/{queue.length} 擊
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        <button
          onClick={() => speak(current.id, "word", "normal", current.english_word)}
          className="rounded-full bg-violet-100 text-brand px-4 py-2 font-bold"
        >
          🔊 聽發音
        </button>
        <button
          onClick={() => speak(current.id, "word", "slow", current.english_word)}
          className="rounded-full bg-violet-100 text-brand px-4 py-2 font-bold"
        >
          🐢 慢速
        </button>
      </div>

      <p className="text-center text-slate-600">
        中文意思：<span className="font-bold">{current.word_meaning_zh ?? "—"}</span>
      </p>
      <p className="text-center text-sm text-slate-400">
        聽發音，拼出正確的英文單字攻擊大魔王！
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitted}
          autoFocus
          placeholder="輸入英文單字"
          className={`flex-1 rounded-lg border-2 px-3 py-2 ${
            submitted
              ? isCorrect
                ? "border-green-400 bg-green-50"
                : "border-rose-400 bg-rose-50"
              : "border-slate-200"
          }`}
        />
        {!submitted && (
          <button
            type="submit"
            className="rounded-full bg-rose-500 text-white px-5 py-2 font-bold"
          >
            ⚔️ 攻擊
          </button>
        )}
      </form>

      {submitted && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-sm">
            {isCorrect ? (
              <span className="text-green-600 font-bold">命中！擊退一個錯字 💥</span>
            ) : (
              <span className="text-rose-500">
                正確答案：<span className="font-bold">{current.english_word}</span>
              </span>
            )}
          </p>
          <button
            onClick={next}
            className="rounded-full bg-brand text-white px-6 py-2 font-bold"
          >
            {idx + 1 >= queue.length ? "看結果" : "下一個"}
          </button>
        </div>
      )}
    </div>
  );
}
