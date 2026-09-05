"use client";

import { useEffect, useRef, useState } from "react";
import type { Creature } from "@/lib/creatures";
import type { CareView, ZooPositions } from "@/lib/useStudent";
import { POOP_AWAY, POOP_HOURS, POOP_SICK, POOP_WARN } from "@/lib/rules";
import { DECORATIONS } from "@/lib/decorations";

function poopStage(p: number): CareView["messStage"] {
  if (p >= POOP_AWAY) return "away";
  if (p >= POOP_SICK) return "sick";
  if (p >= POOP_WARN) return "warn";
  return "ok";
}

const TOKEN = 48;

const MOOD: Record<CareView["hungerStage"], string> = {
  ok: "😋",
  warn: "😟",
  sick: "🤢",
  away: "🏃",
};

const POOP_SPOTS = [
  { x: 40, y: 250 }, { x: 180, y: 300 }, { x: 320, y: 260 },
  { x: 470, y: 310 }, { x: 90, y: 350 }, { x: 250, y: 360 },
  { x: 400, y: 350 }, { x: 150, y: 240 }, { x: 360, y: 300 },
  { x: 520, y: 260 },
];

interface Pos { x: number; y: number; }

export default function Zoo({
  collection, positions, onSave, readOnly = false, title = "🦁 我的動物園",
  care, diamonds = 0, inventory = {}, onBuyDecoration, onFeed, onClean,
}: {
  collection: Creature[];
  positions: ZooPositions;
  onSave?: (positions: ZooPositions) => void;
  readOnly?: boolean;
  title?: string;
  care?: CareView | null;
  diamonds?: number;
  inventory?: Record<string, number>;
  onBuyDecoration?: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  onFeed?: () => Promise<{ ok: boolean; error?: string }>;
  onClean?: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ZooPositions>(positions);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const livePoop =
    care && care.lastCleaned
      ? Math.max(0, Math.floor((nowTs - new Date(care.lastCleaned).getTime()) / (POOP_HOURS * 3_600_000)))
      : care?.poopCount ?? 0;
  const liveMess = poopStage(livePoop);

  const severity = ["away", "sick", "warn", "ok"] as const;
  const worst: CareView["hungerStage"] = care
    ? severity.find((s) => care.hungerStage === s || liveMess === s) ?? "ok"
    : "ok";
  const away = !!care && (care.hungerStage === "away" || liveMess === "away");
  const showCare = !!care && !readOnly && collection.length > 0;

  async function act(fn?: () => Promise<{ ok: boolean; error?: string }>, okMsg = "") {
    if (!fn) return;
    const r = await fn();
    setMsg(r.ok ? okMsg : r.error ?? "");
  }

  async function handleBuy(itemId: string) {
    if (!onBuyDecoration || buying) return;
    setBuying(true);
    const r = await onBuyDecoration(itemId);
    if (r.ok) {
      setMsg("✨ 購買成功！裝飾品已經放到動物園左上角囉！");
      const newItemKey = "deco_" + itemId + "_" + Date.now();
      const nextPos = { ...pos, [newItemKey]: { x: 20, y: 20 } };
      setPos(nextPos);
      onSave?.(nextPos);
    } else {
      setMsg(r.error || "購買失敗");
    }
    setBuying(false);
  }

  useEffect(() => { setPos(positions); }, [positions]);

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

  function onPointerDown(e: React.PointerEvent, dragId: string, initialPos: Pos) {
    if (readOnly) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = { id: dragId, dx: e.clientX - rect.left - initialPos.x, dy: e.clientY - rect.top - initialPos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const next = clamp({ x: e.clientX - rect.left - d.dx, y: e.clientY - rect.top - d.dy });
    setPos((p) => ({ ...p, [d.id]: next }));
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    onSave?.(pos);
  }
  
  const placedDecos = Object.keys(pos).filter(k => k.startsWith("deco_"));

  return (
    <div className="space-y-2 relative">
      {!readOnly && (
        <div className="flex justify-between items-center bg-white rounded-2xl p-3 card-shadow">
          <p className="text-sm text-slate-500 font-bold">拖曳動物或裝飾品佈置動物園吧！🐾</p>
          <div className="flex gap-2">
            <div className="bg-sky-100 text-brand px-3 py-1.5 rounded-full font-bold text-sm flex items-center gap-1">💎 {diamonds}</div>
            <button onClick={() => setShopOpen(!shopOpen)} className="bg-brand text-white px-4 py-1.5 rounded-full font-bold text-sm hover:scale-105 transition-transform">🛒 商店</button>
          </div>
        </div>
      )}

      {shopOpen && !readOnly && (
        <div className="bg-white rounded-2xl p-4 card-shadow border-2 border-brand/20">
          <h3 className="font-bold text-brand mb-3">裝飾品商店</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DECORATIONS.map(d => {
              const owned = inventory[d.id] || 0;
              const affordable = diamonds >= d.price;
              return (
                <div key={d.id} className="flex flex-col items-center p-2 rounded-xl bg-violet-50 border border-violet-100">
                  <span className="text-4xl">{d.emoji}</span>
                  <span className="font-bold text-sm mt-1">{d.name}</span>
                  <span className="text-xs text-slate-500 mb-2">已擁有: {owned}</span>
                  <button 
                    onClick={() => handleBuy(d.id)} disabled={!affordable || buying}
                    className={`px-3 py-1 rounded-full text-xs font-bold w-full flex justify-center gap-1 ${affordable ? "bg-brand text-white" : "bg-slate-200 text-slate-400"}`}
                  >
                    <span>💎</span> {d.price}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showCare && care && (
        <div className="bg-white rounded-2xl p-3 card-shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">
              {MOOD[worst]} 動物心情：
              {worst === "ok" ? "開心" : worst === "warn" ? "需要照顧" : worst === "sick" ? "生病了" : "離家出走"}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => act(onFeed, "餵食成功，動物吃飽飽！🥰")} disabled={care.fedToday || care.feed < 1} className="flex-1 rounded-full bg-amber-100 text-amber-700 px-3 py-2 font-bold disabled:opacity-40">🥕 餵食（{care.feed}）</button>
            <button onClick={() => act(onClean, "打掃完成，動物園好乾淨！✨")} disabled={livePoop < 1 || care.broom < 1} className="flex-1 rounded-full bg-sky-100 text-sky-700 px-3 py-2 font-bold disabled:opacity-40">🧹 打掃（{care.broom}）</button>
          </div>
          {msg && <p className="text-xs text-brand font-bold">{msg}</p>}
        </div>
      )}

      <div ref={ref} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} className="relative h-[420px] rounded-2xl overflow-hidden card-shadow select-none touch-none" style={{ background: "linear-gradient(to bottom,#bae6fd 0%,#bae6fd 52%,#86efac 52%,#4ade80 100%)" }}>
        {/* 預設保留的背景裝飾元素 */}
        <div className="pointer-events-none absolute inset-0 text-3xl">
          <span className="absolute right-4 top-3 text-4xl">☀️</span>
          <span className="absolute left-3 top-24">🌳</span>
          <span className="absolute right-10 top-28">🌴</span>
          <span className="absolute left-1/2 top-20 -translate-x-1/2 text-xl font-extrabold text-amber-800 bg-white/70 rounded-full px-3 py-1 whitespace-nowrap">{title}</span>
          <span className="absolute bottom-2 left-6">🌷</span>
          <span className="absolute bottom-3 right-8">🌻</span>
          <span className="absolute bottom-1 left-1/3">🪨</span>
        </div>

        {collection.length === 0 && placedDecos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p className="bg-white/80 rounded-xl px-4 py-3 text-slate-600 font-bold">
              還沒有動物～完成「聽力測驗」拿到滿分累積點數解鎖動物，<br/>
              或者拿到滿分鑽石去商店買裝飾品吧！
            </p>
          </div>
        )}

        {!readOnly && care && !away && livePoop > 0 && collection.length > 0 && (
          <div className="pointer-events-none absolute inset-0 text-2xl">
            {POOP_SPOTS.slice(0, Math.min(livePoop, POOP_SPOTS.length)).map((s, i) => (
              <span key={i} className="absolute" style={{ left: s.x, top: s.y }}>💩</span>
            ))}
          </div>
        )}

        {away && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p className="bg-white/85 rounded-xl px-4 py-3 text-slate-600 font-bold">
              🏃 動物們因為太久沒被照顧離家出走了…<br />今天「餵食」＋「打掃」就會把牠們找回來！
            </p>
          </div>
        )}
        
        {placedDecos.map(key => {
          const baseId = key.split("_")[1];
          const deco = DECORATIONS.find(d => d.id === baseId);
          if (!deco) return null;
          const p = pos[key];
          return (
            <button key={key} onPointerDown={(e) => onPointerDown(e, key, p)} title={deco.name} className={`absolute text-4xl touch-none ${readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`} style={{ left: p.x, top: p.y }}>{deco.emoji}</button>
          )
        })}

        {!away && collection.map((c, i) => {
          const dragId = String(i);
          const p = pos[dragId] ?? defaultPos(i);
          return (
            <button key={dragId} onPointerDown={(e) => onPointerDown(e, dragId, p)} title={c.name} className={`absolute text-4xl touch-none ${readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`} style={{ left: p.x, top: p.y }}>{c.emoji}</button>
          );
        })}
      </div>
    </div>
  );
}