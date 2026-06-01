"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountMenu({ name }: { name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "更新失敗");
      return;
    }
    setMsg("密碼已更新！");
    setOldPw("");
    setNewPw("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-500">{name}</span>
      <button onClick={() => setOpen(true)} className="hover:text-brand">
        改密碼
      </button>
      <button onClick={logout} className="hover:text-brand">
        登出
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow space-y-3">
            <h3 className="font-bold text-lg text-brand">修改密碼</h3>
            <form onSubmit={changePw} className="space-y-3">
              <input
                type="password"
                required
                placeholder="舊密碼"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="password"
                required
                placeholder="新密碼"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              {msg && <p className="text-sm text-slate-600">{msg}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMsg(null);
                  }}
                  className="rounded-full px-4 py-2 text-slate-500"
                >
                  關閉
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brand text-white px-5 py-2 font-bold"
                >
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
