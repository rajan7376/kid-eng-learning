"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  fromSentence: boolean; // 填空題是否來自句子
  blanked: string;
  fillAnswer: string;
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
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const [picked, setPicked] = useState<string | null>(null);
  const [choiceDone, setChoiceDone] = useState(false);
  const [input, setInput] = useState("");
  const [fillDone, setFillDone] = useState(false);
  const [done, setDone] = useState(false);
  const firedRef = useRef(false);

  const current = questions[idx];

  useEffect(() => {
    if (current) void speak(current.card.id, "word", "normal", current.card.english_word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      onComplete?.(scoreRef.current, questions.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (!current) {
    return <p className="text-slate-400">此週次沒有可測驗的單字。</p>;
  }

  if (done) {
    const full = score === questions.length && questions.length > 0;
    return (
      <div className="bg-white rounded-2xl p-6 card-shadow text-center space-y-3">
        <p className="text-xl font-extrabold text-brand">
          {full ? "🎉 滿分！太棒了！" : "測驗完成！"}
        </p>
        <p className="text-lg">
          得分 {score} / {questions.length}
        </p>
        <button
          onClick={() => {
            scoreRef.current = 0;
            setIdx(0);
            setScore(0);
            setPicked(null);
            setChoiceDone(false);
            setInput("");
            setFillDone(false);
            setDone(false);
            firedRef.current = false;
          }}
          className="rounded-full bg-brand text-white px-6 py-2 font-bold"
        >
          再玩一次
        </button>
      </div>
    );
  }

  const fillCorrect =
    input.trim().toLowerCase() === current.fillAnswer.trim().toLowerCase();
  const canNext = choiceDone && fillDone;

  function chooseOption(opt: string) {
    if (choiceDone) return;
    setPicked(opt);
    setChoiceDone(true);
  }

  function submitFill() {
    if (fillDone) return;
    setFillDone(true);
  }

  function next() {
    const ok =
      picked === current.choiceAnswer &&
      input.trim().toLowerCase() === current.fillAnswer.trim().toLowerCase();
    if (ok) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    } else {
      onWrong?.(current.card);
    }
    if (idx + 1 >= questions.length) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
      setChoiceDone(false);
      setInput("");
      setFillDone(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          第 {idx + 1} / {questions.length} 題
        </span>
        <span>得分 {score}</span>
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

      {/* 第一步：選正確的中文意思 */}
      <div>
        <p className="font-bold text-slate-600 mb-2">1. 聽發音，選出正確的中文意思：</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {current.options.map((opt) => {
            const correct = opt === current.choiceAnswer;
            const cls = !choiceDone
              ? "bg-white border-slate-200 hover:border-brand"
              : correct
                ? "bg-green-50 border-green-400 text-green-700"
                : opt === picked
                  ? "bg-rose-50 border-rose-400 text-rose-600"
                  : "bg-white border-slate-200 opacity-60";
            return (
              <button
                key={opt}
                onClick={() => chooseOption(opt)}
                disabled={choiceDone}
                className={`rounded-xl border-2 px-4 py-3 font-bold text-left ${cls}`}
              >
                {opt}
                {choiceDone && correct && " ✓"}
                {choiceDone && !correct && opt === picked && " ✗"}
              </button>
            );
          })}
        </div>
      </div>

      {/* 第二步：拼出英文單字（選完中文後才出現） */}
      {choiceDone && (
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
              submitFill();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={fillDone}
              autoFocus
              placeholder="在這裡輸入單字"
              className={`flex-1 rounded-lg border-2 px-3 py-2 ${
                fillDone
                  ? fillCorrect
                    ? "border-green-400 bg-green-50"
                    : "border-rose-400 bg-rose-50"
                  : "border-slate-200"
              }`}
            />
            {!fillDone && (
              <button
                type="submit"
                className="rounded-full bg-brand text-white px-5 py-2 font-bold"
              >
                送出
              </button>
            )}
          </form>
          {fillDone && !fillCorrect && (
            <p className="text-sm text-rose-500 mt-1">
              正確答案：<span className="font-bold">{current.fillAnswer}</span>
            </p>
          )}
        </div>
      )}

      {canNext && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-500">
            {current.card.english_word}　{current.card.word_meaning_zh}
          </p>
          <button
            onClick={next}
            className="rounded-full bg-brand text-white px-6 py-2 font-bold"
          >
            {idx + 1 >= questions.length ? "看結果" : "下一題"}
          </button>
        </div>
      )}
    </div>
  );
}
