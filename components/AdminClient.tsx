"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  points?: number;
  unlockedCount?: number;
  feed?: number;
  broom?: number;
  diamonds?: number;
  mistakesCount?: number;
  testCount?: number;
}

interface Props {
  users: UserRow[];
}

export default function AdminClient({ users }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"accounts" | "data" | "pricing">("accounts");
  
  // 新增帳號表單狀態
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [loading, setLoading] = useState(false);

  // 建立帳號
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      alert("請填寫帳號與密碼");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, displayName: newDisplayName, role: newRole })
      });
      const data = await res.json();
      if (data.error) {
        alert("建立失敗：" + data.error);
      } else {
        alert("帳號建立成功！");
        setNewEmail("");
        setNewPassword("");
        setNewDisplayName("");
        router.refresh();
      }
    } catch (err) {
      alert("發生錯誤");
    } finally {
      setLoading(false);
    }
  }

  // 變更角色權限
  async function handleRoleChange(userId: string, newRoleVal: string) {
    try {
      const res = await fetch("/api/admin/user-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRoleVal })
      });
      const data = await res.json();
      if (data.error) {
        alert("權限修改失敗：" + data.error);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert("發生錯誤");
    }
  }

  // 快速調整道具 / 鑽石 / 進度
  async function handleQuickAction(userId: string, actionType: string) {
    let inputVal = prompt(
      actionType === "diamonds" ? "請輸入新的鑽石數量：" :
      actionType === "feed" ? "請輸入新的飼料數量：" :
      actionType === "broom" ? "請輸入新的掃把數量：" :
      actionType === "points" ? "請輸入新的學習點數：" : "請輸入數值："
    );
    if (inputVal === null) return;
    const num = Number(inputVal);
    if (isNaN(num)) {
      alert("請輸入有效的數字");
      return;
    }

    try {
      const res = await fetch("/api/admin/student-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          [actionType === "points" ? "points" : actionType === "feed" ? "feed" : actionType === "broom" ? "broom" : "diamonds"]: num
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
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("確定要刪除此帳號嗎？")) return;
    try {
      const res = await fetch("/api/admin/user-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.error) {
        alert("刪除失敗：" + data.error);
      } else {
        alert("帳號已刪除");
        router.refresh();
      }
    } catch (e) {
      alert("發生錯誤");
    }
  }

  return (
    <div className="space-y-6">
      {/* 頂端導覽列 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl card-shadow">
        <h1 className="text-xl font-extrabold text-slate-800">管理後台</h1>
        <div className="flex gap-4 text-sm font-bold">
          <button
            onClick={() => setActiveTab("data")}
            className={`px-4 py-2 rounded-xl transition ${activeTab === "data" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            資料管理
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 rounded-xl transition ${activeTab === "accounts" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            帳號管理
          </button>
          <button
            onClick={() => setActiveTab("pricing")}
            className={`px-4 py-2 rounded-xl transition ${activeTab === "pricing" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            商店定價
          </button>
        </div>
      </div>

      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* 新增帳號區塊 */}
          <div className="bg-white p-6 rounded-2xl card-shadow space-y-4">
            <h2 className="text-lg font-bold text-slate-700">新增帳號</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="帳號"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-violet-500"
              />
              <input
                type="password"
                placeholder="密碼"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-violet-500"
              />
              <input
                type="text"
                placeholder="顯示名稱(選填)"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-violet-500"
              />
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm bg-white flex-1"
                >
                  <option value="student">學生</option>
                  <option value="admin">管理員</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand text-white px-5 py-2 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "建立中..." : "建立"}
                </button>
              </div>
            </form>
          </div>

          {/* 帳號清單區塊 */}
          <div className="bg-white p-6 rounded-2xl card-shadow space-y-4 overflow-x-auto">
            <h2 className="text-lg font-bold text-slate-700">帳號清單</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="p-3">帳號</th>
                  <th className="p-3">角色</th>
                  <th className="p-3">點數</th>
                  <th className="p-3">解鎖</th>
                  <th className="p-3">🥕</th>
                  <th className="p-3">🧹</th>
                  <th className="p-3">💎</th>
                  <th className="p-3">錯字</th>
                  <th className="p-3">測驗次數</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-violet-50/30">
                    <td className="p-3 font-medium text-slate-700">
                      {u.email} {u.displayName ? `(${u.displayName})` : ""}
                    </td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
                      >
                        <option value="student">學生</option>
                        <option value="admin">管理員</option>
                      </select>
                    </td>
                    <td className="p-3">{u.points ?? "-"}</td>
                    <td className="p-3">{u.unlockedCount ?? "-"}</td>
                    <td className="p-3">{u.feed ?? "-"}</td>
                    <td className="p-3">{u.broom ?? "-"}</td>
                    <td className="p-3 font-bold text-violet-600">{u.diamonds ?? "-"}</td>
                    <td className="p-3">{u.mistakesCount ?? "-"}</td>
                    <td className="p-3">{u.testCount ?? "-"}</td>
                    <td className="p-3 space-x-2 whitespace-nowrap text-xs">
                      {u.role === "student" && (
                        <>
                          <button onClick={() => handleQuickAction(u.id, "points")} className="text-violet-600 hover:underline">改進度</button>
                          <button onClick={() => handleQuickAction(u.id, "diamonds")} className="text-violet-600 hover:underline">改鑽石</button>
                          <button onClick={() => handleQuickAction(u.id, "feed")} className="text-violet-600 hover:underline">改飼料</button>
                          <button onClick={() => handleQuickAction(u.id, "broom")} className="text-violet-600 hover:underline">改掃把</button>
                        </>
                      )}
                      <button onClick={() => handleDeleteUser(u.id)} className="text-rose-500 hover:underline">刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "data" && (
        <div className="bg-white p-6 rounded-2xl card-shadow text-slate-600">
          <h2 className="text-lg font-bold text-slate-700 mb-2">課程與講義資料管理</h2>
          <p className="text-sm">您可以在此上傳或管理課程講義內容（可前往頂端「上傳講義」頁面進行檔案處理）。</p>
        </div>
      )}

      {activeTab === "pricing" && (
        <div className="bg-white p-6 rounded-2xl card-shadow text-slate-600">
          <h2 className="text-lg font-bold text-slate-700 mb-2">商店商品定價管理</h2>
          <p className="text-sm">此處可調整 50 項裝飾品在商店中的鑽石售價。</p>
        </div>
      )}
    </div>
  );
}