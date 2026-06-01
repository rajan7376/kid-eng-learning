"use client";

import { useEffect, useMemo, useState } from "react";
import type { WordCardRow } from "@/lib/types";
import { speak } from "@/lib/speak";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Question {
  card: WordCardRow;
  options: string[];
  choiceAnswer: string;
  fromSentence: boolean;
  blanked: string;
  fillAnswer: string;
}

interface Response {
  choice: string | null;
  fill: string;
}

function buildQuestions(cards: WordCardRow[]): Question[] {
  const meanings = Array.from(
    new Set(cards.map((c) => c.word_meaning_zh).filter(Boolean) as string[]),
  );

  return shuffle(cards).map((card) => {
    const word = card.english_word;
    const fromSentence = Boolean(
      card.sentence && new RegExp(escapeRegExp(word.trim()), "i").test(card.sentence),
    );
    const blanked = fromSentence
      ? card.sentence!.replace(new RegExp(escapeRegExp(word.trim()), "ig"), "＿＿＿＿")
      : "";
    const correct = card.word_meaning_zh || card.english_word;
    const distractors = shuffle(meanings.filter((m) => m !== correct)).slice(0, 3);
    return {
      card,
      options: shuffle([correct, ...distractors]),
      choiceAnswer: correct,
      fromSentence,
      blanked,
      fillAnswer: word,
    };
  });
}

function isQuestionCorrect(q: Question, r: Response): boolean {
  return (
    r.choice === q.choiceAnswer &&
    r.fill.trim().toLowerCase() === q.fillAnswer.trim().toLowerCase()
  );
}

export default function ListeningTest({
  cards,
  onComplete,
  onWrong,
}: {
  cards: WordCardRow[];
  onComplete?: (score: number, total: number) => void;
  onWrong?: (card: WordCardRow) => void;
}) {
  const questions = useMemo(() => buildQuestions(cards), [cards]);

  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Response[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);

  const current = questions[idx];

  // 進入每一題唸一次單字
  useEffect(() => {
    if (started && !done && current)
      void speak(current.card.id, "word", "normal", current.card.english_word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started]);

  // 測驗進行中阻止意外重整/離開
  useEffect(() => {
    if (!started || done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [started, done]);

  if (!current) {
    return <p className="text-slate-400">此週次沒有可測驗的單字。</p>;
  }

  // ---- 開始頁 ----
  if (!started) {
    return (
      <div className="bg-white rounded-2xl p-8 card-shadow text-center space-y-4">
        <p className="text-5xl">🎧</p>
        <h2 className="text-xl font-extrabold text-brand">聽力測驗</h2>
        <p className="text-slate-600">
          共 {questions.length} 題。每題先聽發音，選出正確中文，再拼出英文單字。
          <br />
          作答過程不會顯示對錯，完成最後一題後一次看結果。
        </p>
        <button
          onClick={() => setStarted(true)}
          className="rounded-full bg-brand text-white px-8 py-3 font-bold text-lg card-shadow"
        >
          開始測試
        </button>
      </div>
    );
  }

  // ---- 結果頁 ----
  if (done) {
    const score = questions.reduce(
      (s, q, i) => s + (isQuestionCorrect(q, responses[i]) ? 1 : 0),
      0,
    );
    const full = score === questions.length;
    function restart() {
      setStarted(false);
      setIdx(0);
      setResponses([]);
      setPicked(null);
      setInput("");
      setDone(false);
    }
    return (
      <div className="bg-white rounded-2xl p-6 card-shadow space-y-4">
        <div className="text-center space-y-1">
          <p className="text-xl font-extrabold text-brand">
            {full ? "🎉 滿分！太棒了！" : "測驗完成！"}
          </p>
          <p className="text-lg">
            得分 {score} / {questions.length}
          </p>
        </div>

        <div className="space-y-2">
          {questions.map((q, i) => {
            const r = responses[i] ?? { choice: null, fill: "" };
            const choiceOk = r.choice === q.choiceAnswer;
            const fillOk =
              r.fill.trim().toLowerCase() === q.fillAnswer.trim().toLowerCase();
            const ok = choiceOk && fillOk;
            return (
              <div
                key={q.card.id}
                className={`rounded-xl border-2 p-3 ${
                  ok ? "border-green-200 bg-green-50" : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {i + 1}. {q.card.english_word}
                  </span>
                  <span>{ok ? "✅" : "❌"}</span>
                </div>
                <p className="text-sm text-slate-600">
                  中文：{q.choiceAnswer}
                  {!choiceOk && (
                    <span className="text-rose-500">
                      （你選：{r.choice ?? "未選"}）
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-600">
                  拼字：{q.fillAnswer}
                  {!fillOk && (
                    <span className="text-rose-500">
                      （你寫：{r.fill || "未填"}）
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={restart}
            className="rounded-full bg-brand text-white px-6 py-2 font-bold"
          >
            再測一次
          </button>
        </div>
      </div>
    );
  }

  const canNext = picked !== null && input.trim() !== "";

  function next() {
    const r: Response = { choice: picked, fill: input };
    const newResponses = [...responses];
    newResponses[idx] = r;
    setResponses(newResponses);

    if (idx + 1 >= questions.length) {
      // 結算：算分、回報錯題
      const score = questions.reduce(
        (s, q, i) => s + (isQuestionCorrect(q, newResponses[i]) ? 1 : 0),
        0,
      );
      questions.forEach((q, i) => {
        if (!isQuestionCorrect(q, newResponses[i])) onWrong?.(q.card);
      });
      setDone(true);
      onComplete?.(score, questions.length);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
      setInput("");
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          第 {idx + 1} / {questions.length} 題
        </span>
        <span>作答中…完成後看結果</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => speak(current.card.id, "word", "normal", current.card.english_word)}
          className="rounded-full bg-violet-100 text-brand px-4 py-2 font-bold"
        >
          🔊 再聽一次
        </button>
        <button
          onClick={() => speak(current.card.id, "word", "slow", current.card.english_word)}
          className="rounded-full bg-violet-100 text-brand px-4 py-2 font-bold"
        >
          🐢 慢速
        </button>
      </div>

      {/* 第一步：選中文 */}
      <div>
        <p className="font-bold text-slate-600 mb-2">1. 聽發音，選出正確的中文意思：</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {current.options.map((opt) => (
            <button
              key={opt}
              onClick={() => setPicked(opt)}
              className={`rounded-xl border-2 px-4 py-3 font-bold text-left ${
                picked === opt
                  ? "border-brand bg-violet-50 text-brand"
                  : "border-slate-200 bg-white hover:border-brand"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* 第二步：拼單字 */}
      <div className="border-t border-slate-100 pt-3">
        {current.fromSentence ? (
          <>
            <p className="font-bold text-slate-600 mb-2">2. 填入句子缺少的單字：</p>
            <p className="text-slate-800 leading-relaxed mb-2">{current.blanked}</p>
          </>
        ) : (
          <p className="font-bold text-slate-600 mb-2">
            2. 依發音與中文意思「{current.card.word_meaning_zh}」，拼出英文單字：
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canNext) next();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="在這裡輸入單字"
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2"
          />
        </form>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-3">
        <button
          onClick={next}
          disabled={!canNext}
          className="rounded-full bg-brand text-white px-6 py-2 font-bold disabled:opacity-40"
        >
          {idx + 1 >= questions.length ? "完成測試" : "下一題"}
        </button>
      </div>
    </div>
  );
}
