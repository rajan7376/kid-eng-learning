"use client";

import { useEffect, useState } from "react";

interface Entry {
  userId: string;
  name: string;
  value: number;
}
interface Data {
  points: Entry[];
  unlocked: Entry[];
  quiz: Entry[];
  boss: Entry[];
  me: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function Board({
  title,
  icon,
  unit,
  entries,
  me,
}: {
  title: string;
  icon: string;
  unit: string;
  entries: Entry[];
  me: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 card-shadow">
      <h3 className="font-bold text-brand mb-2">
        {icon} {title}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">還沒有資料</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li
              key={e.userId}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm ${
                e.userId === me ? "bg-violet-50 font-bold" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center">{MEDALS[i] ?? i + 1}</span>
                {e.name}
                {e.userId === me && " (我)"}
              </span>
              <span className="text-slate-500">
                {e.value} {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => !d.error && setData(d));
  }, []);

  if (!data) return <p className="text-slate-400">載入中…</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Board title="點數排行" icon="⭐" unit="點" entries={data.points} me={data.me} />
      <Board title="解鎖動物" icon="🦁" unit="隻" entries={data.unlocked} me={data.me} />
      <Board title="測驗次數" icon="📝" unit="次" entries={data.quiz} me={data.me} />
      <Board
        title="打敗大魔王"
        icon="👹"
        unit="次"
        entries={data.boss}
        me={data.me}
      />
    </div>
  );
}
