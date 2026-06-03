"use client";

import { useEffect, useRef, useState } from "react";
import type { Creature } from "@/lib/creatures";
import type { CareView, ZooPositions } from "@/lib/useStudent";

const TOKEN = 48;

const MOOD: Record<CareView["hungerStage"], string> = {
  ok: "😋",
  warn: "😟",
  sick: "🤢",
  away: "🏃",
};

interface Pos {
  x: number;
  y: number;
}

export default function Zoo({
  collection,
  positions,
  onSave,
  readOnly = false,
  title = "🦁 我的動物園",
  care,
  onFeed,
  onClean,
}: {
  collection: Creature[];
  positions: ZooPositions;
  onSave?: (positions: ZooPositions) => void;
  readOnly?: boolean;
  title?: string;
  care?: CareView | null;
  onFeed?: () => Promise<{ ok: boolean; error?: string }>;
  onClean?: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ZooPositions>(positions);
  const drag = useRef<{ i: number; dx: number; dy: number } | null>(null);
  const [msg, setMsg] = useState("");

  const severity = ["away", "sick", "warn", "ok"] as const;
  const worst: CareView["hungerStage"] = care
    ? severity.find((s) => care.hungerStage === s || care.messStage === s) ?? "ok"
    : "ok";
  const away = !!care?.away;
  const showCare = !!care && !readOnly && collection.length > 0;

  async function act(fn?: () => Promise<{ ok: boolean; error?: string }>, okMsg = "") {
    if (!fn) return;
    const r = await fn();
    setMsg(r.ok ? okMsg : r.error ?? "");
  }

  useEffect(() => {
    setPos(positions);
  }, [positions]);

  function defaultPos(i: number): Pos {
    return { x: 16 + (i % 8) * 60, y: 320 - Math.floor(i / 8) * 64 };
  }

  function clamp(p: Pos): Pos {
    const el = ref.current;
    const w = el ? el.clientWidth : 600;
    const h = el ? el.clientHeight : 420;
    return {
      x: Math.max(0, Math.min(p.x, w - TOKEN)),
      y: Math.max(0, Math.min(p.y, h - TOKEN)),
    };
  }

  function onPointerDown(e: React.PointerEvent, i: number) {
    if (readOnly) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cur = pos[i] ?? defaultPos(i);
    drag.current = {
      i,
      dx: e.clientX - rect.left - cur.x,
      dy: e.clientY - rect.top - cur.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const next = clamp({
      x: e.clientX - rect.left - d.dx,
      y: e.clientY - rect.top - d.dy,
    });
    setPos((p) => ({ ...p, [d.i]: next }));
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    onSave?.(pos);
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <p className="text-sm text-slate-500">
          拖曳動物，把牠們放到動物園裡喜歡的位置吧！🐾
        </p>
      )}

      {showCare && care && (
        <div className="bg-white rounded-2xl p-3 card-shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">
              {MOOD[worst]} 動物心情：
              {worst === "ok"
                ? "開心"
                : worst === "warn"
                  ? "需要照顧"
                  : worst === "sick"
                    ? "生病了"
                    : "離家出走"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => act(onFeed, "餵食成功，動物吃飽飽！🥰")}
              disabled={care.fedToday || care.feed < 1}
              className="flex-1 rounded-full bg-amber-100 text-amber-700 px-3 py-2 font-bold disabled:opacity-40"
            >
              🥕 餵食（{care.feed}）
            </button>
            <button
              onClick={() => act(onClean, "打掃完成，動物園好乾淨！✨")}
              disabled={care.cleanedToday || care.broom < 1}
              className="flex-1 rounded-full bg-sky-100 text-sky-700 px-3 py-2 font-bold disabled:opacity-40"
            >
              🧹 打掃（{care.broom}）
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {away
              ? "動物們離家出走了！今天餵食＋打掃就會把牠們找回來～"
              : [
                  care.fedToday ? "今天餵過了" : `已 ${care.daysSinceFed} 天沒餵食`,
                  care.cleanedToday ? "今天打掃過了" : `已 ${care.daysSinceCleaned} 天沒打掃`,
                ].join("・")}
          </p>
          <p className="text-[11px] text-slate-300">
            飼料來自每天完成測驗、掃把來自每天複習錯字大魔王；連續 3 天沒照顧會生病，7 天會離家。
          </p>
          {msg && <p className="text-xs text-brand font-bold">{msg}</p>}
        </div>
      )}
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative h-[420px] rounded-2xl overflow-hidden card-shadow select-none touch-none"
        style={{
          background:
            "linear-gradient(to bottom,#bae6fd 0%,#bae6fd 52%,#86efac 52%,#4ade80 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 text-3xl">
          <span className="absolute right-4 top-3 text-4xl">☀️</span>
          <span className="absolute left-3 top-24">🌳</span>
          <span className="absolute right-10 top-28">🌴</span>
          <span className="absolute left-1/2 top-20 -translate-x-1/2 text-xl font-extrabold text-amber-800 bg-white/70 rounded-full px-3 py-1 whitespace-nowrap">
            {title}
          </span>
          <span className="absolute bottom-2 left-6">🌷</span>
          <span className="absolute bottom-3 right-8">🌻</span>
          <span className="absolute bottom-1 left-1/3">🪨</span>
        </div>

        {collection.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p className="bg-white/80 rounded-xl px-4 py-3 text-slate-600 font-bold">
              還沒有動物～完成「聽力測驗」拿到滿分累積點數，
              <br />
              每 5 點就能解鎖一隻可愛動物放進來！
            </p>
          </div>
        )}

        {/* 髒污：未打掃時出現便便 */}
        {!readOnly &&
          care &&
          !away &&
          care.messStage !== "ok" &&
          collection.length > 0 && (
            <div className="pointer-events-none absolute inset-0 text-2xl">
              <span className="absolute bottom-10 left-10">💩</span>
              <span className="absolute bottom-24 right-16">💩</span>
              {care.messStage === "sick" && (
                <span className="absolute bottom-16 left-1/2">💩</span>
              )}
            </div>
          )}

        {/* 離家出走 */}
        {away && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p className="bg-white/85 rounded-xl px-4 py-3 text-slate-600 font-bold">
              🏃 動物們因為太久沒被照顧離家出走了…
              <br />
              今天「餵食」＋「打掃」就會把牠們找回來！
            </p>
          </div>
        )}

        {!away &&
          collection.map((c, i) => {
          const p = pos[i] ?? defaultPos(i);
          return (
            <button
              key={i}
              onPointerDown={(e) => onPointerDown(e, i)}
              title={c.name}
              className={`absolute text-4xl touch-none ${
                readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"
              }`}
              style={{ left: p.x, top: p.y }}
            >
              {c.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
