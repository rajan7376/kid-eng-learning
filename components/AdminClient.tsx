"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ClassRow, WeekRow, WordCardRow } from "@/lib/types";

interface Props {
  classes: ClassRow[];
  weeks: WeekRow[];
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
  display_name: string | null;
  points: number;
  unlockedCount: number;
  feed: number;
  broom: number;
  mistakeCount: number;
  testCount: number;
  lastTest: string | null;
}

async function dataOp(op: string, id?: string, values?: Record<string, unknown>) {
  await fetch("/api/admin/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, id, values }),
  });
}

export default function AdminClient({ classes, weeks }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"data" | "users">("data");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand">管理後台</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("data")}
            className={`rounded-full px-4 py-1 font-bold text-sm ${
              tab === "data" ? "bg-brand text-white" : "bg-violet-50 text-brand"
            }`}
          >
            資料管理
          </button>
          <button
            onClick={() => setTab("users")}
            className={`rounded-full px-4 py-1 font-bold text-sm ${
              tab === "users" ? "bg-brand text-white" : "bg-violet-50 text-brand"
            }`}
          >
            帳號管理
          </button>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
            className="rounded-full px-4 py-1 font-bold text-sm bg-slate-100 text-slate-600"
          >
            登出
          </button>
        </div>
      </div>

      {tab === "data" ? (
        <DataPanel supabase={supabase} classes={classes} weeks={weeks} />
      ) : (
        <UsersPanel />
      )}
    </div>
  );
}

function DataPanel({
  supabase,
  classes,
  weeks,
}: {
  supabase: ReturnType<typeof createClient>;
  classes: ClassRow[];
  weeks: WeekRow[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [cards, setCards] = useState<WordCardRow[]>([]);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classEditForm, setClassEditForm] = useState({ code: "", name: "" });

  // 週次與日期編輯狀態
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [weekEditForm, setWeekEditForm] = useState({ week_label: "", date_range: "" });

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setLog([]);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setLog((l) => [...l, `(${i + 1}/${files.length}) ${f.name}：分析中…`]);
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/analyze", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "分析失敗");
        setLog((l) => [
          ...l.slice(0, -1),
          `(${i + 1}/${files.length}) ${f.name}：✅ ${json.handout.class_code}・${json.handout.week_label}，${json.handout.cards.length} 張卡片`,
        ]);
      } catch (err) {
        setLog((l) => [
          ...l.slice(0, -1),
          `(${i + 1}/${files.length}) ${f.name}：❌ ${err instanceof Error ? err.message : "發生錯誤"}`,
        ]);
      }
    }
    setBusy(false);
    setFiles([]);
    router.refresh();
  }

  async function loadCards(weekId: string) {
    if (openWeek === weekId) {
      setOpenWeek(null);
      return;
    }
    setOpenWeek(weekId);
    const { data } = await supabase
      .from("word_cards")
      .select("*")
      .eq("week_id", weekId)
      .order("sort_order", { ascending: true });
    setCards((data ?? []) as WordCardRow[]);
  }

  function startEditClass(c: ClassRow) {
    setEditingClassId(c.id);
    setClassEditForm({ code: c.code, name: c.name ?? "" });
  }

  async function saveClass(id: string) {
    if (!classEditForm.code.trim()) {
      alert("班級代碼不能為空");
      return;
    }
    await dataOp("updateClass", id, {
      code: classEditForm.code.trim(),
      name: classEditForm.name.trim() || null,
    });
    setEditingClassId(null);
    router.refresh();
  }

  function startEditWeek(w: WeekRow, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingWeekId(w.id);
    setWeekEditForm({
      week_label: w.week_label,
      date_range: w.date_range ?? "",
    });
  }

  async function saveWeek(id: string) {
    if (!weekEditForm.week_label.trim()) {
      alert("週次名稱不能為空");
      return;
    }
    await dataOp("updateWeek", id, {
      week_label: weekEditForm.week_label.trim(),
      date_range: weekEditForm.date_range.trim() || null,
    });
    setEditingWeekId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="bg-white rounded-2xl p-6 card-shadow space-y-3">
        <h2 className="font-bold text-lg">上傳講義</h2>
        <p className="text-sm text-slate-500">
          支援 JPG / PNG / PDF / WORD，可一次選多個檔案，AI 逐一分析建立班級/週次/單字。
        </p>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm"
        />
        {files.length > 0 && (
          <p className="text-xs text-slate-400">已選 {files.length} 個檔案</p>
        )}
        <button
          type="submit"
          disabled={files.length === 0 || busy}
          className="rounded-full bg-brand text-white px-6 py-2 font-bold disabled:opacity-50"
        >
          {busy ? "分析中…" : `上傳並分析${files.length > 1 ? ` (${files.length})` : ""}`}
        </button>
        {log.length > 0 && (
          <ul className="text-sm text-slate-600 space-y-1">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </form>

      <div className="bg-white rounded-2xl p-6 card-shadow space-y-4">
        <h2 className="font-bold text-lg">班級 / 週次 / 單字</h2>
        {classes.length === 0 && (
          <p className="text-sm text-slate-400">尚無資料，先上傳一份講義。</p>
        )}
        {classes.map((c) => (
          <div key={c.id} className="border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {editingClassId === c.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={classEditForm.code}
                    placeholder="代碼 (例: 3A)"
                    onChange={(e) =>
                      setClassEditForm({ ...classEditForm, code: e.target.value })
                    }
                    className="rounded border border-slate-200 px-2 py-1 text-sm w-24 font-bold"
                  />
                  <input
                    value={classEditForm.name}
                    placeholder="名稱 (選填)"
                    onChange={(e) =>
                      setClassEditForm({ ...classEditForm, name: e.target.value })
                    }
                    className="rounded border border-slate-200 px-2 py-1 text-sm w-32"
                  />
                  <button
                    onClick={() => saveClass(c.id)}
                    className="rounded bg-brand text-white px-3 py-1 text-xs font-bold"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => setEditingClassId(null)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand">{c.code}</span>
                  {c.name && (
                    <span className="text-xs text-slate-500">（{c.name}）</span>
                  )}
                  <button
                    onClick={() => startEditClass(c)}
                    className="text-xs text-slate-400 hover:text-brand underline"
                  >
                    編輯班名
                  </button>
                </div>
              )}

              <button
                onClick={async () => {
                  if (!confirm(`刪除班級 ${c.code} 及其所有週次/單字？`)) return;
                  await dataOp("deleteClass", c.id);
                  router.refresh();
                }}
                className="text-xs text-rose-400 hover:underline"
              >
                刪除班級
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {weeks
                .filter((w) => w.class_id === c.id)
                .map((w) => (
                  <div key={w.id} className="rounded-lg bg-violet-50 p-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {editingWeekId === w.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            value={weekEditForm.week_label}
                            placeholder="週次 (例: W1)"
                            onChange={(e) =>
                              setWeekEditForm({ ...weekEditForm, week_label: e.target.value })
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-sm w-28 font-bold"
                          />
                          <input
                            value={weekEditForm.date_range}
                            placeholder="日期 (例: 08/31-09/04)"
                            onChange={(e) =>
                              setWeekEditForm({ ...weekEditForm, date_range: e.target.value })
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-sm w-44"
                          />
                          <button
                            onClick={() => saveWeek(w.id)}
                            className="rounded bg-brand text-white px-3 py-1 text-xs font-bold"
                          >
                            儲存
                          </button>
                          <button
                            onClick={() => setEditingWeekId(null)}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadCards(w.id)}
                            className="font-bold text-slate-700 hover:text-brand"
                          >
                            {w.week_label}
                            {w.date_range ? ` (${w.date_range})` : ""}{" "}
                            {openWeek === w.id ? "▲" : "▼"}
                          </button>
                          <button
                            onClick={(e) => startEditWeek(w, e)}
                            className="text-xs text-slate-400 hover:text-brand underline"
                          >
                            編輯日期/週次
                          </button>
                        </div>
                      )}

                      <button
                        onClick={async () => {
                          if (!confirm("刪除此週次及其單字？")) return;
                          await dataOp("deleteWeek", w.id);
                          if (openWeek === w.id) setOpenWeek(null);
                          router.refresh();
                        }}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        刪除週次
                      </button>
                    </div>

                    {openWeek === w.id && (
                      <div className="mt-2 space-y-2">
                        {cards.map((card) => (
                          <CardEditor
                            key={card.id}
                            card={card}
                            onDeleted={() =>
                              setCards((cs) => cs.filter((x) => x.id !== card.id))
                            }
                          />
                        ))}
                        {cards.length === 0 && (
                          <p className="text-xs text-slate-400">此週次沒有單字。</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardEditor({
  card,
  onDeleted,
}: {
  card: WordCardRow;
  onDeleted: () => void;
}) {
  const [v, setV] = useState({
    english_word: card.english_word,
    part_of_speech: card.part_of_speech ?? "",
    word_meaning_zh: card.word_meaning_zh ?? "",
    sentence: card.sentence ?? "",
    sentence_zh: card.sentence_zh ?? "",
  });
  const [saved, setSaved] = useState(false);

  const field = (k: keyof typeof v, ph: string) => (
    <input
      value={v[k]}
      placeholder={ph}
      onChange={(e) => {
        setV({ ...v, [k]: e.target.value });
        setSaved(false);
      }}
      className="rounded border border-slate-200 px-2 py-1 text-sm"
    />
  );

  return (
    <div className="bg-white rounded-lg p-2 flex flex-wrap items-center gap-2">
      {field("english_word", "單字")}
      {field("part_of_speech", "詞性")}
      {field("word_meaning_zh", "詞義")}
      {field("sentence", "例句")}
      {field("sentence_zh", "翻譯")}
      <button
        onClick={async () => {
          await dataOp("updateCard", card.id, v);
          setSaved(true);
        }}
        className="rounded-full bg-brand text-white px-3 py-1 text-xs font-bold"
      >
        {saved ? "已存✓" : "儲存"}
      </button>
      <button
        onClick={async () => {
          if (!confirm("刪除這個單字？")) return;
          await dataOp("deleteCard", card.id);
          onDeleted();
        }}
        className="text-xs text-rose-400 hover:underline"
      >
        刪除
      </button>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "student",
    display_name: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "建立失敗");
      return;
    }
    setForm({ username: "", password: "", role: "student", display_name: "" });
    void load();
  }

  async function changeRole(u: AdminUser, newRole: string) {
    if (u.role === newRole) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "更新角色失敗");
      return;
    }
    void load();
  }

  async function resetPw(u: AdminUser) {
    const pw = prompt(`為「${u.username}」設定新密碼：`);
    if (!pw) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, password: pw }),
    });
    alert("已更新密碼");
  }

  async function remove(u: AdminUser) {
    if (!confirm(`刪除帳號 ${u.username}？其學習紀錄也會一併刪除。`)) return;
    await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    void load();
  }

  async function editProgress(u: AdminUser) {
    const pStr = prompt(`設定「${u.username}」的點數：`, String(u.points));
    if (pStr === null) return;
    const points = parseInt(pStr, 10);
    if (Number.isNaN(points)) return;
    const uStr = prompt(
      `設定解鎖動物數(0~∞，留空=依點數自動 ${Math.floor(points / 5)})：`,
      "",
    );
    const body: Record<string, unknown> = { op: "setProgress", userId: u.id, points };
    if (uStr && uStr.trim() !== "") body.unlockedCount = parseInt(uStr, 10);
    await fetch("/api/admin/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    void load();
  }

  async function editTestCount(u: AdminUser) {
    const s = prompt(`設定「${u.username}」的測驗次數：`, String(u.testCount));
    if (s === null) return;
    const count = parseInt(s, 10);
    if (Number.isNaN(count)) return;
    await fetch("/api/admin/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "setTestCount", userId: u.id, count }),
    });
    void load();
  }

  async function editItems(u: AdminUser) {
    const fStr = prompt(`設定「${u.username}」的飼料 🥕 數量：`, String(u.feed));
    if (fStr === null) return;
    const bStr = prompt(`設定「${u.username}」的掃把 🧹 數量：`, String(u.broom));
    if (bStr === null) return;
    const body: Record<string, unknown> = { op: "setItems", userId: u.id };
    if (fStr.trim() !== "") body.feed = parseInt(fStr, 10);
    if (bStr.trim() !== "") body.broom = parseInt(bStr, 10);
    await fetch("/api/admin/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    void load();
  }

  async function clearMistakes(u: AdminUser) {
    if (!confirm(`清空「${u.username}」的所有錯字記錄？`)) return;
    await fetch("/api/admin/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "clearMistakes", userId: u.id }),
    });
    void load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="bg-white rounded-2xl p-6 card-shadow space-y-3">
        <h2 className="font-bold text-lg">新增帳號</h2>
        <div className="flex flex-wrap gap-2">
          <input
            required
            placeholder="帳號"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="rounded border border-slate-200 px-3 py-2"
          />
          <input
            required
            placeholder="密碼"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded border border-slate-200 px-3 py-2"
          />
          <input
            placeholder="顯示名稱(選填)"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="rounded border border-slate-200 px-3 py-2"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded border border-slate-200 px-3 py-2"
          >
            <option value="student">學生</option>
            <option value="parent">家長</option>
            <option value="admin">管理員</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-brand text-white px-6 py-2 font-bold"
          >
            建立
          </button>
        </div>
        {msg && <p className="text-sm text-rose-500">{msg}</p>}
      </form>

      <div className="bg-white rounded-2xl p-6 card-shadow">
        <h2 className="font-bold text-lg mb-3">帳號清單</h2>
        {loading ? (
          <p className="text-slate-400">載入中…</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-1">帳號</th>
                  <th>角色</th>
                  <th>點數</th>
                  <th>解鎖</th>
                  <th>🥕</th>
                  <th>🧹</th>
                  <th>錯字</th>
                  <th>測驗次數</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-2 font-semibold">
                      {u.username}
                      {u.display_name ? `（${u.display_name}）` : ""}
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="rounded border border-slate-200 px-2 py-0.5 text-xs bg-white"
                      >
                        <option value="student">學生</option>
                        <option value="parent">家長</option>
                        <option value="admin">管理員</option>
                      </select>
                    </td>
                    <td>{u.role === "student" ? u.points : "—"}</td>
                    <td>{u.role === "student" ? u.unlockedCount : "—"}</td>
                    <td>{u.role === "student" ? u.feed : "—"}</td>
                    <td>{u.role === "student" ? u.broom : "—"}</td>
                    <td>{u.role === "student" ? u.mistakeCount : "—"}</td>
                    <td>{u.role === "student" ? u.testCount : "—"}</td>
                    <td className="space-x-2 whitespace-nowrap">
                      {u.role === "student" && (
                        <>
                          <button
                            onClick={() => editProgress(u)}
                            className="text-emerald-500 hover:underline"
                          >
                            改進度
                          </button>
                          <button
                            onClick={() => editTestCount(u)}
                            className="text-sky-500 hover:underline"
                          >
                            改次數
                          </button>
                          <button
                            onClick={() => editItems(u)}
                            className="text-orange-500 hover:underline"
                          >
                            改道具
                          </button>
                          <button
                            onClick={() => clearMistakes(u)}
                            className="text-amber-500 hover:underline"
                          >
                            清錯字
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => resetPw(u)}
                        className="text-brand hover:underline"
                      >
                        改密碼
                      </button>
                      <button
                        onClick={() => remove(u)}
                        className="text-rose-400 hover:underline"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}