"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StudentProgressRow {
  user_id: string;
  email: string;
  points: number;
  unlocked_count: number;
  care: any;
  updated_at: string;
}

interface Props {
  students: StudentProgressRow[];
}

export default function AdminClient({ students }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { diamonds: number; feed: number; broom: number; points: number }>>({});

  function getVal(s: StudentProgressRow, field: "diamonds" | "feed" | "broom" | "points") {
    if (editValues[s.user_id]?.[field] !== undefined) {
      return editValues[s.user_id][field];
    }
    if (field === "points") return s.points ?? 0;
    const care = s.care || {};
    if (field === "diamonds") return care.diamonds ?? 0;
    if (field === "feed") return care.feed ?? 3;
    if (field === "broom") return care.broom ?? 3;
    return 0;
  }

  function handleChange(userId: string, field: "diamonds" | "feed" | "broom" | "points", val: number) {
    const current = editValues[userId] || {
      diamonds: getVal(students.find(s => s.user_id === userId)!, "diamonds"),
      feed: getVal(students.find(s => s.user_id === userId)!, "feed"),
      broom: getVal(students.find(s => s.user_id === userId)!, "broom"),
      points: getVal(students.find(s => s.user_id === userId)!, "points"),
    };
    setEditValues({
      ...editValues,
      [userId]: { ...current, [field]: val }
    });
  }

  async function handleSave(userId: string) {
    const vals = editValues[userId];
    if (!vals) return;
    setLoadingId(userId);

    try {
      const res = await fetch("/api/admin/student-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          diamonds: vals.diamonds,
          feed: vals.feed,
          broom: vals.broom,
          points: vals.points
        })
      });
      const data = await res.json();
      if (data.error) {
        alert("更新失敗：" + data.error);
      } else {
        alert("更新成功！");
        router.refresh();
      }
    } catch (e) {
      alert("發生錯誤");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-700">學生資源與進度管理</h2>
      <div className="bg-white rounded-2xl p-4 card-shadow overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-sm text-slate-500">
              <th className="p-3">學生帳號 (Email)</th>
              <th className="p-3">學習點數</th>
              <th className="p-3">💎 鑽石</th>
              <th className="p-3">🥕 飼料</th>
              <th className="p-3">🧹 掃把</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {students.map((s) => {
              const userId = s.user_id;
              const isSaving = loadingId === userId;
              return (
                <tr key={userId} className="hover:bg-violet-50/50">
                  <td className="p-3 font-medium text-slate-700">{s.email}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={getVal(s, "points")}
                      onChange={(e) => handleChange(userId, "points", Number(e.target.value))}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-center"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={getVal(s, "diamonds")}
                      onChange={(e) => handleChange(userId, "diamonds", Number(e.target.value))}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-center font-bold text-violet-600"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={getVal(s, "feed")}
                      onChange={(e) => handleChange(userId, "feed", Number(e.target.value))}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-center"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={getVal(s, "broom")}
                      onChange={(e) => handleChange(userId, "broom", Number(e.target.value))}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-center"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleSave(userId)}
                      disabled={isSaving}
                      className="rounded-lg bg-brand text-white px-4 py-1.5 font-bold text-xs disabled:opacity-50"
                    >
                      {isSaving ? "儲存中..." : "儲存"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">目前沒有學生進度資料。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}