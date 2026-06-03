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

// 比對用：去標點/省略號、大小寫無視、空白收斂
function normAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.．。…,，!！?？'’"“”、:：;；()\[\]/\\\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 一個單字可接受的多種寫法(單複數、斜線、括號內替代形式)
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

const POS = "n|v|vt|vi|adj|adv|prep|pron|conj|interj|art|aux|phr|num";
// 剝掉單字裡的詞性標記，如「abandon (v.)」「run v.」→「abandon」「run」
function stripPos(word: string): string {
  return word
    .replace(new RegExp(`[\\(（]\\s*(?:${POS})\\.?\\s*[\\)）]`, "gi"), "")
    .replace(new RegExp(`\\b(?:${POS})\\.`, "gi"), "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Question {
  card: WordCardRow;
  word: string; // 已剝除詞性的測驗單字
  isPhrase: boolean; // 片語(含空格)→ 只考選擇題
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

  return shuffle(cards)
    .map((card) => {
      const word = stripPos(card.english_word);
      if (!word) return null; // 剝完詞性後為空 → 排除
      // 句子挖空用主要形式(去掉括號/斜線替代與省略號)
      const primary =
        word
          .replace(/[(（][^)）]*[)）]/g, " ")
          .split("/")[0]
          .replace(/\.{2,}|…/g, " ")
          .trim() || word;
      const fromSentence = Boolean(
        card.sentence && new RegExp(escapeRegExp(primary), "i").test(card.sentence),
      );
      const blanked = fromSentence
        ? card.sentence!.replace(new RegExp(escapeRegExp(primary), "ig"), "＿＿＿＿")
        : "";
      const correct = card.word_meaning_zh || word;
      const distractors = shuffle(meanings.filter((m) => m !== correct)).slice(0, 3);
      return {
        card,
        word,
        isPhrase: /\s/.test(primary),
        options: shuffle([correct, ...distractors]),
        choiceAnswer: correct,
        fromSentence,
        blanked,
        fillAnswer: word,
      } as Question;
    })
    .filter((q): q is Question => q !== null);
}

function isQuestionCorrect(q: Question, r: Response): boolean {
  if (q.isPhrase) return r.choice === q.choiceAnswer;
  return r.choice === q.choiceAnswer && fillMatches(r.fill, q.fillAnswer);
}

export default function ListeningTest({
  cards,
  onComplete,
  onWrong,
  onActiveChange,
}: {
  cards: WordCardRow[];
  onComplete?: (score: number, total: number) => void;
  onWrong?: (card: WordCardRow) => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => buildQuestions(cards), [cards, round]);

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
      void speak(current.card.id, "word", "normal", current.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started]);

  // 通知父層測驗是否進行中(鎖定分頁切換)
  useEffect(() => {
    onActiveChange?.(started && !done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done]);
  useEffect(() => () => onActiveChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

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
          onClick={() => {
            setRound((r) => r + 1);
            setStarted(true);
          }}
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
            const fillOk = fillMatches(r.fill, q.fillAnswer);
            const ok = choiceOk && (q.isPhrase || fillOk);
            return (
              <div
                key={q.card.id}
                className={`rounded-xl border-2 p-3 ${
                  ok ? "border-green-200 bg-green-50" : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {i + 1}. {q.word}
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
                {!q.isPhrase && (
                  <p className="text-sm text-slate-600">
                    拼字：{q.fillAnswer}
                    {!fillOk && (
                      <span className="text-rose-500">
                        （你寫：{r.fill || "未填"}）
                      </span>
                    )}
                  </p>
                )}
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

  const canNext =
    picked !== null && (current.isPhrase || input.trim() !== "");

  function commitAndGo(target: number, finish = false) {
    const newResponses = [...responses];
    newResponses[idx] = { choice: picked, fill: input };
    setResponses(newResponses);

    if (finish) {
      const score = questions.reduce(
        (s, q, i) => s + (isQuestionCorrect(q, newResponses[i]) ? 1 : 0),
        0,
      );
      questions.forEach((q, i) => {
        if (!isQuestionCorrect(q, newResponses[i])) onWrong?.(q.card);
      });
      setDone(true);
      onComplete?.(score, questions.length);
      return;
    }

    const r = newResponses[target] ?? { choice: null, fill: "" };
    setIdx(target);
    setPicked(r.choice);
    setInput(r.fill);
  }

  function prev() {
    if (idx > 0) commitAndGo(idx - 1);
  }
  function next() {
    if (idx + 1 >= questions.length) commitAndGo(idx, true);
    else commitAndGo(idx + 1);
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
          onClick={() => speak(current.card.id, "word", "normal", current.word)}
          className="rounded-full bg-violet-100 text-brand px-4 py-2 font-bold"
        >
          🔊 再聽一次
        </button>
        <button
          onClick={() => speak(current.card.id, "word", "slow", current.word)}
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

      {/* 第二步：拼單字（片語略過，只考選擇題） */}
      {!current.isPhrase && (
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name={`answer-${idx}-${round}`}
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2"
          />
        </form>
      </div>
      )}

      <div className="flex justify-between border-t border-slate-100 pt-3">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="rounded-full bg-violet-100 text-brand px-6 py-2 font-bold disabled:opacity-40"
        >
          上一題
        </button>
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
