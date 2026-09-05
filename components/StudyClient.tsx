"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassRow, WeekRow, WordCardRow } from "@/lib/types";
import { CREATURES, POINTS_PER_CREATURE, type Creature } from "@/lib/creatures";
import { useStudent } from "@/lib/useStudent";
import WordCardView from "./WordCardView";
import ListeningTest from "./ListeningTest";
import Zoo from "./Zoo";
import BossBattle from "./BossBattle";
import Leaderboard from "./Leaderboard";
import ZooBrowser from "./ZooBrowser";

interface Props {
  classes: ClassRow[];
  weeks: WeekRow[];
}

export default function StudyClient({ classes, weeks }: Props) {
  const supabase = createClient();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const weekOptions = useMemo(
    () => weeks.filter((w) => w.class_id === classId),
    [weeks, classId],
  );
  const [weekId, setWeekId] = useState(weekOptions[0]?.id ?? "");
  const [cards, setCards] = useState<WordCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<
    "cards" | "test" | "zoo" | "boss" | "rank" | "visit"
  >("cards");

  const student = useStudent();
  const progress = student.points % POINTS_PER_CREATURE;
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle?: string;
    newly: Creature[];
    diamondAwarded?: boolean;
  } | null>(null);
  const [testActive, setTestActive] = useState(false);

  function switchMode(target: typeof mode) {
    if (target === mode) return;
    if (testActive && mode === "test") {
      if (!confirm("測驗進行中，離開會放棄這次測驗喔！確定離開？")) return;
      setTestActive(false);
    }
    setMode(target);
  }

  async function handleTestComplete(score: number, total: number) {
    const r = await student.completeQuiz(weekId || null, score, total);
    
    if (r.awarded > 0) {
      setCelebration({ 
        title: "🎉 滿分！+1 點", 
        newly: r.newly,
        diamondAwarded: r.diamondAwarded 
      });
    } 
    else if (score === total && total > 0) {
      setCelebration({
        title: "🎉 滿分！",
        subtitle: r.diamondAwarded ? "獲得每日滿分鑽石獎勵！" : "這個單字表的點數已拿滿囉 (上限2點)",
        newly: [],
        diamondAwarded: r.diamondAwarded
      });
    }
  }

  useEffect(() => {
    const first = weeks.filter((w) => w.class_id === classId)[0]?.id ?? "";
    setWeekId(first);
  }, [classId, weeks]);

  useEffect(() => {
    if (!weekId) {
      setCards([]);
      return;
    }
    setLoading(true);
    supabase
      .from("word_cards")
      .select("*")
      .eq("week_id", weekId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setCards((data ?? []) as WordCardRow[]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        還沒有任何單字。請管理員先到後台上傳講義建立內容。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-2xl p-4 card-shadow">
        <label className="flex-1 text-sm font-bold text-slate-600">
          班級
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="block mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
                {c.name ? `（${c.name}）` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm font-bold text-slate-600">
          週次單字表
          <select
            value={weekId}
            onChange={(e) => setWeekId(e.target.value)}
            className="block mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {weekOptions.length === 0 && <option value="">（無）</option>}
            {weekOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.week_label}
                {w.date_range ? ` (${w.date_range})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto">
        <div className="flex w-max gap-1 rounded-full bg-violet-50 p-1">
          {(
            [
              { k: "cards", label: "單字卡" },
              { k: "test", label: "聽力測驗", disabled: cards.length === 0 },
              {
                k: "boss",
                label: `👹 錯字大魔王${student.mistakes.length > 0 ? ` (${student.mistakes.length})` : ""}`,
              },
              { k: "zoo", label: "🦁 我的動物園" },
              { k: "visit", label: "🌍 逛動物園" },
              { k: "rank", label: "🏆 排行榜" },
            ] as { k: typeof mode; label: string; disabled?: boolean }[]
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => switchMode(t.k)}
              disabled={t.disabled}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-40 ${mode === t.k ? "bg-brand text-white" : "text-brand"} ${testActive && mode === "test" && t.k !== "test" ? "opacity-50" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-slate-400">載入中…</p>}

      {!loading && mode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((c) => (
            <WordCardView key={c.id} card={c} />
          ))}
          {cards.length === 0 && <p className="text-slate-400">此週次尚無單字。</p>}
        </div>
      )}

      {!loading && mode === "test" && cards.length > 0 && (
        <ListeningTest
          cards={cards}
          onComplete={handleTestComplete}
          onWrong={(card) => student.addMistake(card)}
          onActiveChange={setTestActive}
        />
      )}

      {mode === "boss" && (
        <BossBattle
          mistakes={student.mistakes}
          onReview={student.reviewMistake}
          onGraduate={(newly) =>
            setCelebration({ title: "🎓 錯字畢業！+1 點", newly })
          }
        />
      )}

      {mode === "rank" && <Leaderboard />}

      {mode === "visit" && <ZooBrowser />}

      {mode === "zoo" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 card-shadow">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-brand">⭐ {student.points} 點</span>
              <span className="text-slate-500">
                已解鎖 {student.collection.length}/{CREATURES.length}・再{" "}
                {POINTS_PER_CREATURE - progress} 點滿分解鎖下一隻
              </span>
            </div>
            <div className="h-2 rounded-full bg-violet-100 overflow-hidden mt-2">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${(progress / POINTS_PER_CREATURE) * 100}%` }}
              />
            </div>
          </div>
          <Zoo
            collection={student.collection}
            positions={student.zooPositions}
            onSave={student.saveZoo}
            care={student.care}
            diamonds={student.diamonds}
            inventory={student.inventory}
            onBuyDecoration={student.buyDecoration}
            onFeed={student.feedPets}
            onClean={student.cleanPets}
          />
        </div>
      )}

      {celebration && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full card-shadow space-y-4">
            <p className="text-2xl font-extrabold text-brand">{celebration.title}</p>
            {celebration.subtitle && (
              <p className="text-slate-600">{celebration.subtitle}</p>
            )}
            
            {celebration.diamondAwarded && (
              <div className="flex flex-col items-center justify-center animate-bounce py-2">
                <span className="text-6xl drop-shadow-md">💎</span>
                <span className="text-brand font-bold mt-2">+1 鑽石</span>
              </div>
            )}

            {celebration.newly.length > 0 ? (
              <>
                <p className="text-slate-600">解鎖新朋友！</p>
                <div className="text-6xl">
                  {celebration.newly.map((c) => (
                    <span key={c.emoji} title={c.name}>
                      {c.emoji}
                    </span>
                  ))}
                </div>
                <p className="font-bold">
                  {celebration.newly.map((c) => c.name).join("、")}
                </p>
              </>
            ) : (
              !celebration.subtitle && (
                <p className="text-slate-600">
                  再 {POINTS_PER_CREATURE - progress} 點就能解鎖下一隻可愛生物！
                </p>
              )
            )}
            <button
              onClick={() => setCelebration(null)}
              className="rounded-full bg-brand text-white px-6 py-2 font-bold"
            >
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
