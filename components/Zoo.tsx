"use client";

import { useEffect, useRef, useState } from "react";
import type { Creature } from "@/lib/creatures";
import type { ZooPositions } from "@/lib/useStudent";

const TOKEN = 48;

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
}: {
  collection: Creature[];
  positions: ZooPositions;
  onSave?: (positions: ZooPositions) => void;
  readOnly?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ZooPositions>(positions);
  const drag = useRef<{ i: number; dx: number; dy: number } | null>(null);

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

        {collection.map((c, i) => {
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
