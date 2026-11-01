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

const TOKEN = 52;

const MOOD: Record<CareView["hungerStage"], string> = {
  ok: "😋",
  warn: "😟",
  sick: "🤢",
  away: "🏃",
};

// 改用相對百分比 (rx, ry)，確保手機與平板畫面切換時大便不會超出邊界
const POOP_SPOTS = [
  { rx: 0.12, ry: 0.62 }, { rx: 0.32, ry: 0.72 }, { rx: 0.55, ry: 0.64 },
  { rx: 0.78, ry: 0.74 }, { rx: 0.20, ry: 0.84 }, { rx: 0.45, ry: 0.86 },
  { rx: 0.68, ry: 0.82 }, { rx: 0.28, ry: 0.58 }, { rx: 0.62, ry: 0.72 },
  { rx: 0.85, ry: 0.62 },
];

// 預設單字庫（若父元件未傳入 words 時使用，確保每隻動物有不同單字）
const DEFAULT_WORDS = [
  "apple", "brave", "castle", "dream", "eraser",
  "friend", "garden", "happy", "island", "jewel",
  "kind", "lemon", "magic", "nature", "ocean",
  "planet", "quiet", "rabbit", "smile", "tiger",
];

interface Pos { x: number; y: number; }

export default function Zoo({
  collection,
  positions,
  onSave,
  readOnly = false,
  title = "🦁 我的動物園",
  care,
  diamonds: propDiamonds = 0,
  inventory = {},
  words,
  onBuyDecoration,
  onFeed,
  onClean,
  onRenamePet,
}: {
  collection: Creature[];
  positions: ZooPositions;
  onSave?: (positions: ZooPositions) => void;
  readOnly?: boolean;
  title?: string;
  care?: CareView | null;
  diamonds?: number;
  inventory?: Record<string, number>;
  words?: string[];
  onBuyDecoration?: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  onFeed?: () => Promise<{ ok: boolean; error?: string }>;
  onClean?: () => Promise<{ ok: boolean; error?: string }>;
  onRenamePet?: (petId: string, name: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ w: 360, h: 420 });
  const [pos, setPos] = useState<ZooPositions>(positions);
  const [roamOffsets, setRoamOffsets] = useState<Record<string, Pos>>({});
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [msg, setMsg] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  const [naming, setNaming] = useState<{ id: string; name: string } | null>(null);
  const [localNames, setLocalNames] = useState<Record<string, string>>({});
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [petWords, setPetWords] = useState<Record<string, string>>({});
  const [treasure, setTreasure] = useState<{ rx: number; ry: number; found: boolean } | null>(null);

  // 1. 監聽手機/平板螢幕尺寸與旋轉變化，動態更新畫布邊界
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const updateBounds = () => {
      setBounds({
        w: el.clientWidth || 360,
        h: el.clientHeight || 420,
      });
    };
    updateBounds();
    const ro = new ResizeObserver(updateBounds);
    ro.observe(el);
    window.addEventListener("orientationchange", updateBounds);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", updateBounds);
    };
  }, []);

  // 2. 每次開啟動物園時，為每隻動物分配不重複的隨機英文單字（單字不夠則不顯示）
  useEffect(() => {
    const rawPool = words && words.length > 0 ? words : DEFAULT_WORDS;
    const uniquePool = Array.from(new Set(rawPool.map((w) => w.trim()).filter(Boolean)));
    // 洗牌
    for (let i = uniquePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniquePool[i], uniquePool[j]] = [uniquePool[j], uniquePool[i]];
    }
    const assigned: Record<string, string> = {};
    collection.forEach((_, idx) => {
      if (idx < uniquePool.length) {
        assigned[String(idx)] = uniquePool[idx];
      }
    });
    setPetWords(assigned);
  }, [collection.length, words]);

  // 3. 動物自行在草地上緩慢移動（每 3.5 秒更新一次漫步偏移量）
  useEffect(() => {
    if (collection.length === 0) return;
    const timer = setInterval(() => {
      if (drag.current) return; // 拖曳中暫停更新
      setRoamOffsets((prev) => {
        const next: Record<string, Pos> = { ...prev };
        collection.forEach((_, idx) => {
          const id = String(idx);
          // 每次約 65% 機率移動到附近草地座標
          if (Math.random() < 0.65) {
            const cur = prev[id] ?? { x: 0, y: 0 };
            const nx = Math.max(-45, Math.min(45, cur.x + (Math.random() - 0.5) * 50));
            const ny = Math.max(-25, Math.min(25, cur.y + (Math.random() - 0.5) * 30));
            next[id] = { x: Math.round(nx), y: Math.round(ny) };
          }
        });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [collection.length]);

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
  const currentDiamonds = Math.max((care as any)?.diamonds ?? 0, propDiamonds ?? 0, (care as any)?.diamond ?? 0);
  const showCare = !!care && !readOnly && collection.length > 0;

  // 隨機寶箱採用相對比例位置，適應手機螢幕
  useEffect(() => {
    if (!readOnly && collection.length > 0 && Math.random() > 0.3) {
      setTreasure({ rx: 0.15 + Math.random() * 0.7, ry: 0.56 + Math.random() * 0.28, found: false });
    }
  }, [collection.length, readOnly]);

  // 點擊動物：顯示該動物的姓名（4 秒後自動切回英文單字）
  function handleAnimalClick(id: string) {
    setActivePetId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    if (!activePetId) return;
    const t = setTimeout(() => setActivePetId(null), 4500);
    return () => clearTimeout(t);
  }, [activePetId]);

  function handleFindTreasure() {
    setTreasure((prev) => (prev ? { ...prev, found: true } : null));
    setMsg("🎉 發現隱藏寶箱！獲得額外驚喜！");
  }

  async function handleSaveName() {
    if (!naming) return;
    const targetName = naming.name.trim();
    setLocalNames((prev) => ({ ...prev, [naming.id]: targetName }));
    if (onRenamePet) {
      await onRenamePet(naming.id, targetName);
    } else {
      try {
        await fetch("/api/student/pet-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petId: naming.id, name: targetName }),
        });
      } catch (e) {}
    }
    setNaming(null);
    setMsg("✨ 命名成功！");
  }

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
      const nextPos = { ...pos, [newItemKey]: { x: 24, y: 60 } };
      setPos(nextPos);
      onSave?.(nextPos);
    } else {
      setMsg(r.error || "購買失敗");
    }
    setBuying(false);
  }

  useEffect(() => { setPos(positions); }, [positions]);

  // 依據目前螢幕寬度自適應計算預設位置（手機每排 4~5 隻，平板自動展開）
  function defaultPos(i: number): Pos {
    const cols = Math.max(3, Math.floor((bounds.w - 24) / 68));
    const col = i % cols;
    const row = Math.floor(i / cols);
    const spacingX = Math.floor((bounds.w - 32) / cols);
    const x = 16 + col * spacingX;
    const y = Math.max(220, bounds.h - 95 - row * 68);
    return clamp({ x, y });
  }

  // 強制將座標鎖在目前裝置的可視畫布範圍內（預留頂部氣泡與左右邊距）
  function clamp(p: Pos, isAnimal = false): Pos {
    const padX = 12;
    const minY = isAnimal ? 195 : 36; // 動物維持在草地區域，並預留頭頂單字氣泡高度
    const maxX = Math.max(padX, bounds.w - TOKEN - padX);
    const maxY = Math.max(minY, bounds.h - TOKEN - 10);
    return {
      x: Math.round(Math.max(padX, Math.min(p.x, maxX))),
      y: Math.round(Math.max(minY, Math.min(p.y, maxY))),
    };
  }

  function onPointerDown(e: React.PointerEvent, dragId: string, currentVisualPos: Pos) {
    if (readOnly) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 開始拖曳時歸零該動物的漫步偏移，避免座標跳動
    setRoamOffsets((prev) => ({ ...prev, [dragId]: { x: 0, y: 0 } }));
    setPos((prev) => ({ ...prev, [dragId]: currentVisualPos }));
    drag.current = {
      id: dragId,
      dx: e.clientX - rect.left - currentVisualPos.x,
      dy: e.clientY - rect.top - currentVisualPos.y,
      moved: false,
    };
    setDraggingId(dragId);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const isAnimal = !d.id.startsWith("deco_");
    const rawX = e.clientX - rect.left - d.dx;
    const rawY = e.clientY - rect.top - d.dy;
    const next = clamp({ x: rawX, y: rawY }, isAnimal);
    d.moved = true;
    setPos((p) => ({ ...p, [d.id]: next }));
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    setDraggingId(null);
    onSave?.(pos);
  }

  const placedDecos = Object.keys(pos).filter((k) => k.startsWith("deco_"));

  return (
    <div className="space-y-2 relative">
      {/* 玩法說明 Modal */}
      {helpOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-2xl p-4">
          <div className="bg-white p-5 rounded-2xl shadow-2xl max-w-sm w-full space-y-3 max-h-[92%] overflow-y-auto border-2 border-brand/20">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-brand text-base flex items-center gap-1">📖 動物園照顧手冊</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 font-bold leading-relaxed">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                <p className="text-amber-800 font-extrabold mb-1">🥕 每日餵食與 🧹 打掃</p>
                <p>每天記得餵胡蘿蔔，並用掃把清理草地上的 💩！如果太餓或太髒離家出走了，只要<strong>「同一天完成餵食＋打掃」</strong>就會立刻回家！</p>
              </div>

              <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100">
                <p className="text-sky-800 font-extrabold mb-1">🔤 頭頂隨機英文單字</p>
                <p>每次打開動物園，動物們頭上都會頂著不同的英文單字陪你一起背單字！</p>
              </div>

              <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-100">
                <p className="text-purple-800 font-extrabold mb-1">🏷️ 點擊動物看名字與改名</p>
                <p>點一下動物，頭頂就會顯示牠的<strong>專屬名字</strong>！按旁邊的 ✏️ 還可以幫牠取新名字喔！</p>
              </div>

              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                <p className="text-emerald-800 font-extrabold mb-1">🐾 自由散步與拖曳</p>
                <p>動物們會在草地上自己散步走動，你也可以隨時用手指按住牠們，拖曳到喜歡的位置！</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="w-full py-2 bg-brand text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              我知道了！
            </button>
          </div>
        </div>
      )}

      {/* 專屬命名卡片 Modal */}
      {naming && !readOnly && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-2xl">
          <div className="bg-white p-5 rounded-2xl shadow-2xl space-y-3 flex flex-col items-center max-w-[280px] w-full mx-4 border-2 border-brand/20">
            <span className="text-3xl">🏷️</span>
            <h3 className="font-bold text-brand text-base">幫動物取個專屬名字吧！</h3>
            <input
              autoFocus
              className="w-full border-2 border-violet-200 rounded-xl px-4 py-2 text-center font-bold text-slate-700 outline-none focus:border-brand bg-violet-50/50"
              value={naming.name}
              onChange={(e) => setNaming({ ...naming, name: e.target.value })}
              maxLength={10}
              placeholder="輸入 1~10 個字"
            />
            <div className="flex gap-2 w-full pt-1">
              <button
                type="button"
                onClick={() => setNaming(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveName}
                disabled={!naming.name.trim()}
                className="flex-1 py-2 bg-brand hover:opacity-90 disabled:opacity-40 text-white rounded-xl font-bold text-sm"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 頂部功能列（支援手機窄螢幕自動換行） */}
      {!readOnly && (
        <div className="flex flex-wrap justify-between items-center gap-2 bg-white rounded-2xl p-3 card-shadow">
          <p className="text-xs sm:text-sm text-slate-500 font-bold">點動物看名字，也可拖曳佈置喔！🐾</p>
          <div className="flex gap-1.5 sm:gap-2 ml-auto">
            <div className="bg-sky-100 text-brand px-2.5 py-1.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-1">💎 {currentDiamonds}</div>
            <button onClick={() => setHelpOpen(true)} className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-transform">📖 說明</button>
            <button onClick={() => setShopOpen(!shopOpen)} className="bg-brand text-white px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-transform">🛒 商店</button>
          </div>
        </div>
      )}

      {/* 裝飾品商店 */}
      {shopOpen && !readOnly && (
        <div className="bg-white rounded-2xl p-4 card-shadow border-2 border-brand/20">
          <h3 className="font-bold text-brand mb-3">裝飾品商店</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DECORATIONS.map((d) => {
              const owned = inventory[d.id] || 0;
              const affordable = currentDiamonds >= d.price;
              return (
                <div key={d.id} className="flex flex-col items-center p-2 rounded-xl bg-violet-50 border border-violet-100">
                  <span className="text-4xl">{d.emoji}</span>
                  <span className="font-bold text-sm mt-1">{d.name}</span>
                  <span className="text-xs text-slate-500 mb-2">已擁有: {owned}</span>
                  <button
                    onClick={() => handleBuy(d.id)}
                    disabled={!affordable || buying}
                    className={`px-3 py-1 rounded-full text-xs font-bold w-full flex justify-center gap-1 ${affordable ? "bg-brand text-white" : "bg-slate-200 text-slate-400"}`}
                  >
                    <span>💎</span> {d.price}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 照顧狀態面板 */}
      {showCare && care && (
        <div className="bg-white rounded-2xl p-3 card-shadow space-y-2">
          {away ? (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
              <p className="font-bold mb-1">😭 動物受不了離家出走了！</p>
              <p className="font-bold">救援任務：{care.fedToday ? "✅ 已餵食" : "❌ 尚未餵食"} ｜ {livePoop === 0 ? "✅ 已打掃" : "❌ 尚未打掃"}</p>
            </div>
          ) : worst === "warn" || worst === "sick" ? (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-amber-700 text-sm">
              <p className="font-bold mb-1">⚠️ 警告：{care.hungerStage === "warn" || care.hungerStage === "sick" ? "肚子咕嚕嚕，快餓扁啦！" : "環境太髒，大便太多囉！"}</p>
              <p className="font-bold">再不照顧，動物隨時會離家出走！</p>
            </div>
          ) : (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-2 text-emerald-700 text-xs sm:text-sm font-bold flex flex-wrap justify-between items-center gap-1">
              <span>🌟 今日照顧進度</span>
              <span>{care.fedToday ? "✅ 已餵食" : "⬜ 未餵食"} ｜ {livePoop === 0 ? "✅ 已打掃" : "⬜ 未打掃"}</span>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <span className="font-bold text-slate-700 text-sm">
              {MOOD[worst]} 動物心情：{worst === "ok" ? "很開心" : worst === "warn" ? "需要照顧" : worst === "sick" ? "生病了" : "離家出走"}
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => act(onFeed, "餵食成功，動物吃飽飽！🥰")} disabled={care.fedToday || care.feed < 1} className="flex-1 rounded-full bg-amber-100 text-amber-700 px-3 py-2 font-bold text-sm disabled:opacity-40">🥕 餵食（{care.feed}）</button>
            <button onClick={() => act(onClean, "打掃完成，動物園好乾淨！✨")} disabled={livePoop < 1 || care.broom < 1} className="flex-1 rounded-full bg-sky-100 text-sky-700 px-3 py-2 font-bold text-sm disabled:opacity-40">🧹 打掃（{care.broom}）</button>
          </div>
          {msg && <p className="text-xs text-brand font-bold">{msg}</p>}
        </div>
      )}

      {/* 動物園畫布（RWD 自適應高度與寬度防溢出） */}
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative w-full h-[380px] sm:h-[420px] rounded-2xl overflow-hidden card-shadow select-none touch-none"
        style={{ background: "linear-gradient(to bottom,#bae6fd 0%,#bae6fd 48%,#86efac 48%,#4ade80 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 text-3xl">
          <span className="absolute right-4 top-3 text-4xl">☀️</span>
          <span className="absolute left-3 top-20">🌳</span>
          <span className="absolute right-8 top-24">🌴</span>
          <span className="absolute left-1/2 top-14 -translate-x-1/2 text-base sm:text-xl font-extrabold text-amber-800 bg-white/80 rounded-full px-3 py-1 whitespace-nowrap shadow-sm">{title}</span>
          <span className="absolute bottom-2 left-6">🌷</span>
          <span className="absolute bottom-3 right-8">🌻</span>
          <span className="absolute bottom-1 left-1/3">🪨</span>
        </div>

        {collection.length === 0 && placedDecos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p className="bg-white/85 rounded-xl px-4 py-3 text-slate-600 font-bold text-sm">
              還沒有動物～完成「聽力測驗」拿到滿分累積點數解鎖動物，<br />
              或者拿到滿分鑽石去商店買裝飾品吧！
            </p>
          </div>
        )}

        {/* 尋寶彩蛋（依畫面比例安全定位） */}
        {!readOnly && !away && treasure && !treasure.found && (
          <button
            onClick={handleFindTreasure}
            className="absolute text-3xl sm:text-4xl animate-bounce drop-shadow-md z-10"
            style={{
              left: Math.round(treasure.rx * (bounds.w - 48)),
              top: Math.round(treasure.ry * (bounds.h - 48)),
            }}
          >
            🎁
          </button>
        )}

        {/* 大便顯示（依畫面比例安全定位） */}
        {!readOnly && care && !away && livePoop > 0 && collection.length > 0 && (
          <div className="pointer-events-none absolute inset-0 text-2xl z-10">
            {POOP_SPOTS.slice(0, Math.min(livePoop, POOP_SPOTS.length)).map((s, i) => (
              <span
                key={i}
                className="absolute"
                style={{
                  left: Math.round(s.rx * (bounds.w - 36)),
                  top: Math.round(s.ry * (bounds.h - 36)),
                }}
              >
                💩
              </span>
            ))}
          </div>
        )}

        {/* 離家出走提示 */}
        {away && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6 z-30">
            <p className="bg-white/90 rounded-xl px-4 py-3 text-slate-600 font-bold text-sm shadow-md">
              🏃 動物們因為太久沒被照顧離家出走了…<br />今天「餵食」＋「打掃」就會把牠們找回來！
            </p>
          </div>
        )}

        {/* 裝飾品（自動限制在手機/平板畫布內） */}
        {placedDecos.map((key) => {
          const baseId = key.split("_")[1];
          const deco = DECORATIONS.find((d) => d.id === baseId);
          if (!deco) return null;
          const rawP = pos[key] ?? { x: 24, y: 60 };
          const safeP = clamp(rawP, false);
          return (
            <button
              key={key}
              onPointerDown={(e) => onPointerDown(e, key, safeP)}
              title={deco.name}
              className={`absolute text-3xl sm:text-4xl touch-none z-10 ${readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
              style={{ left: safeP.x, top: safeP.y }}
            >
              {deco.emoji}
            </button>
          );
        })}

        {/* 動物列表：常駐隨機英文單字、點擊顯示姓名、自主漫步移動、RWD 邊界保護 */}
        {!away && collection.map((c, i) => {
          const dragId = String(i);
          const baseP = pos[dragId] ?? defaultPos(i);
          const roam = draggingId === dragId ? { x: 0, y: 0 } : (roamOffsets[dragId] ?? { x: 0, y: 0 });
          const visualP = clamp({ x: baseP.x + roam.x, y: baseP.y + roam.y }, true);

          const isShowingName = activePetId === dragId;
          const petName = localNames[dragId] || (care as any)?.petsInfo?.[dragId]?.name || c.name;
          const intimacy = (care as any)?.petsInfo?.[dragId]?.intimacy || 0;
          const assignedWord = petWords[dragId];

          return (
            <div
              key={dragId}
              className="absolute touch-none flex flex-col items-center z-20"
              style={{
                left: visualP.x,
                top: visualP.y,
                width: TOKEN,
                transition: draggingId === dragId ? "none" : "left 3s ease-in-out, top 3s ease-in-out",
              }}
            >
              {/* 頂部泡泡：點擊時顯示「姓名 + 改名按鈕」；平時顯示「隨機英文單字（若單字足夠）」 */}
              {isShowingName ? (
                <div className="absolute -top-8 bg-amber-50 border-2 border-amber-400 text-amber-900 font-extrabold text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-md flex items-center gap-1 z-30 animate-bounce">
                  <span>🏷️ {petName}</span>
                  {intimacy > 0 && <span className="text-pink-500 text-[10px]">💖{intimacy}</span>}
                  {!readOnly && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNaming({ id: dragId, name: petName });
                        setActivePetId(null);
                      }}
                      className="bg-white hover:bg-amber-100 px-1 rounded-full text-[10px] border border-amber-200 ml-0.5"
                      title="修改名字"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              ) : assignedWord ? (
                <div className="pointer-events-none absolute -top-6 bg-white/95 border border-brand/40 text-brand font-extrabold text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                  {assignedWord}
                </div>
              ) : null}

              <button
                type="button"
                onPointerDown={(e) => onPointerDown(e, dragId, visualP)}
                onClick={() => {
                  if (!drag.current?.moved) {
                    handleAnimalClick(dragId);
                  }
                }}
                title={petName}
                className={`text-3xl sm:text-4xl hover:scale-110 transition-transform select-none ${
                  readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                }`}
              >
                {c.emoji}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}