"use client";

import { useEffect, useState } from "react";
import { CREATURES } from "@/lib/creatures";
import type { ZooPositions } from "@/lib/useStudent";
import Zoo from "./Zoo";

interface ZooItem {
  userId: string;
  name: string;
  unlockedCount: number;
  diamondCount: number;
  isMe: boolean;
}
interface Comment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}
interface ViewData {
  ownerId: string;
  name: string;
  unlockedCount: number;
  zooPositions: ZooPositions;
  diamondCount: number;
  likedByMe: boolean;
  comments: Comment[];
}

export default function ZooBrowser() {
  const [list, setList] = useState<ZooItem[]>([]);
  const [view, setView] = useState<ViewData | null>(null);
  const [comment, setComment] = useState("");

  function loadList() {
    fetch("/api/zoo")
      .then((r) => r.json())
      .then((d) => !d.error && setList(d.zoos ?? []));
  }

  useEffect(() => {
    loadList();
  }, []);

  function open(userId: string) {
    fetch(`/api/zoo?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => !d.error && setView(d));
  }

  async function toggleDiamond() {
    if (!view) return;
    const res = await fetch("/api/zoo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "diamond", ownerId: view.ownerId }),
    });
    const d = await res.json();
    setView({ ...view, likedByMe: d.liked, diamondCount: d.count });
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!view || !comment.trim()) return;
    const res = await fetch("/api/zoo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", ownerId: view.ownerId, body: comment }),
    });
    const d = await res.json();
    if (d.comment) {
      setView({ ...view, comments: [...view.comments, d.comment] });
      setComment("");
    }
  }

  if (view) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setView(null);
            loadList();
          }}
          className="text-brand font-bold"
        >
          ← 回動物園列表
        </button>

        <div className="flex items-center justify-between bg-white rounded-2xl p-4 card-shadow">
          <span className="font-extrabold text-lg">{view.name} 的動物園</span>
          <button
            onClick={toggleDiamond}
            className={`rounded-full px-4 py-2 font-bold ${
              view.likedByMe ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-600"
            }`}
          >
            💎 {view.diamondCount}
          </button>
        </div>

        <Zoo
          collection={CREATURES.slice(0, view.unlockedCount)}
          positions={view.zooPositions}
          readOnly
          title={`🦁 ${view.name} 的動物園`}
        />

        <div className="bg-white rounded-2xl p-4 card-shadow space-y-3">
          <h3 className="font-bold text-brand">留言板 💬</h3>
          <div className="space-y-2 max-h-60 overflow-auto">
            {view.comments.length === 0 && (
              <p className="text-sm text-slate-400">還沒有留言，當第一個吧！</p>
            )}
            {view.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-violet-50 px-3 py-2 text-sm">
                <span className="font-bold text-brand">{c.author_name}</span>：{c.body}
              </div>
            ))}
          </div>
          <form onSubmit={sendComment} className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
              placeholder="留個言鼓勵一下…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-full bg-brand text-white px-5 py-2 font-bold"
            >
              送出
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {list.length === 0 && (
        <p className="text-slate-400 col-span-full">還沒有其他學生的動物園。</p>
      )}
      {list.map((z) => (
        <button
          key={z.userId}
          onClick={() => open(z.userId)}
          className="bg-white rounded-2xl p-4 card-shadow text-center hover:ring-2 hover:ring-brand"
        >
          <div className="text-3xl">
            {CREATURES.slice(0, Math.min(z.unlockedCount, 3)).map((c) => (
              <span key={c.emoji}>{c.emoji}</span>
            ))}
            {z.unlockedCount === 0 && "🏞️"}
          </div>
          <p className="font-bold mt-1 truncate">
            {z.name}
            {z.isMe && " (我)"}
          </p>
          <p className="text-xs text-slate-400">
            🦁 {z.unlockedCount}・💎 {z.diamondCount}
          </p>
        </button>
      ))}
    </div>
  );
}
