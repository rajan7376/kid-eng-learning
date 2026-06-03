"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { speak } from "@/lib/speak";
import type { Creature } from "@/lib/creatures";
import type { MistakeCard } from "@/lib/useStudent";

function normAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.．。…,，!！?？'’"“”、:：;；()\[\]/\\\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function answerVariants(word: string): string[] {
  const set = new Set<string>();
  set.add(word);
  const noParen = word.replace(/[(（][^)）]*[)）]/g, " ").trim();
  if (noParen) set.add(noParen);
  for (const m of word.matchAll(/[(（]([^)）]*)[)）]/g)) {
    m[1].split(/[/、,，]/).forEach((x) => x.trim() && set.add(x.trim()));
  }
  [word, noParen].forEach((s) =>
    s.split("/").forEach((x) => {
      const t = x.replace(/[(（][^)）]*[)）]/g, "").trim();
      if (t) set.add(t);
    }),
  );
  return [...set].map(normAnswer).filter(Boolean);
}

function fillMatches(input: string, word: string): boolean {
  return answerVariants(word).includes(normAnswer(input));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BossBattle({
  mistakes,
  onReview,
  onGraduate,
}: {
  mistakes: MistakeCard[];
  onReview: (
    cardId: string,
    correct: boolean,
  ) => Promise<{ graduated: boolean; newly: Creature[] }>;
  onGraduate: (newly: Creature[]) => void;
}) {
  const todoToday = useMemo(
    () => mistakes.filter((m) => !m.reviewedToday),
    [mistakes],
  );

  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<MistakeCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [graduatedNow, setGraduatedNow] = useState(false);

  const current = queue[idx];
  const finished = started && idx >= queue.length;

  useEffect(() => {
    if (current) void speak(current.id, "word", "normal", current.english_word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started]);

  function start() {
    setQueue(shuffle(todoToday));
    setIdx(0);
    setInput("");
    setSubmitted(false);
    setGraduatedNow(false);
    setStarted(true);
  }

  const isCorrect = !!current && fillMatches(input, current.english_word);

  async function submit() {
    if (submitted || !current) return;
    setSubmitted(true);
    const r = await onReview(current.id, isCorrect);
    if (r.graduated) {
      setGraduatedNow(true);
      if (r.newly.length > 0) onGraduate(r.newly);
    }
  }

  function next() {
    setIdx((i) => i + 1);
    setInput("");
    setSubmitted(false);
    setGraduatedNow(false);
  }

  // 完全沒有錯字
  if (mistakes.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 card-shadow text-center space-y-2">
        <p className="text-5xl">😴</p>
        <p className="font-bold text-slate-600">目前沒有錯字，大魔王還在睡覺～</p>
        <p className="text-sm text-slate-400">
          在「聽力測驗」答錯的單字會被關進這裡，每天回來複習一次，滿 30 天後答對就能讓牠畢業 +1 點！
        </p>
      </div>
    );
  }

  // 結算
  if (finished) {
    return (
      <div className="bg-white rounded-2xl p-8 card-shadow text-center space-y-3">
        <p className="text-6xl">🎉</p>
        <p className="text-xl font-extrabold text-brand">今日複習完成！</p>
        <p className="text-sm text-slate-500">
          還有 {mistakes.length} 個錯字在大魔王手上，明天再回來繼續複習吧！
        </p>
      </div>
    );
  }

  // 開始前 / 今天已複習完
  if (!started) {
    const dueCount = todoToday.filter((m) => m.due).length;
    return (
      <div className="bg-white rounded-2xl p-8 card-shadow text-center space-y-4">
        <div className="text-6xl">👹</div>
        <p className="font-extrabold text-rose-500">錯字大魔王</p>
        {todoToday.length === 0 ? (
          <>
            <p className="text-5xl">✅</p>
            <p className="font-bold text-slate-600">今天的錯字都複習過了！</p>
            <p className="text-sm text-slate-400">
              明天再回來複習剩下的 {mistakes.length} 個錯字～
            </p>
          </>
        ) : (
          <>
            <p className="text-slate-600">
              今天有 <span className="font-bold text-rose-500">{todoToday.length}</span> 個錯字要複習
              {dueCount > 0 && (
                <>
                  ，其中 <span className="font-bold text-amber-500">{dueCount}</span> 個可以畢業 +1 點 🎓
                </>
              )}
            </p>
            <p className="text-xs text-slate-400">
              每個錯字每天只能複習一次，滿 30 天後答對就能讓牠畢業。
            </p>
            <button
              onClick={start}
              className="rounded-full bg-rose-500 text-white px-8 py-3 font-bold"
            >
              開始複習
            </button>
          </>
        )}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow space-y-4">
      <div className="text-center">
        <div className="text-6xl">👹</div>
        <p className="font-extrabold text-rose-500">錯字大魔王</p>
        <p className="text-xs text-slate-400 mt-1">
          第 {idx + 1}/{queue.length} 個
        </p>
        {current.due ? (
          <span className="inline-block mt-1 rounded-full bg-amber-100 text-amber-600 px-3 py-0.5 text-xs font-bold">
            🎓 畢業挑戰！答對 +1 點
          </span>
        ) : (
          <span className="inline-block mt-1 rounded-full bg-slate-100 text-slate-500 px-3 py-0.5 text-xs">
            還要 {current.daysLeft ?? "—"} 天可畢業
          </span>
        )}
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
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name={`boss-${idx}`}
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
            {graduatedNow ? (
              <span className="text-amber-600 font-bold">🎓 畢業成功！+1 點</span>
            ) : isCorrect ? (
              <span className="text-green-600 font-bold">答對了！繼續保持 💪</span>
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
