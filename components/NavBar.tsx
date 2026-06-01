"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Session {
  role: "admin" | "student";
  name: string;
}

export default function NavBar({ session }: { session: Session | null }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

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

  const links = session ? (
    <>
      <Link href="/study" className="hover:text-brand" onClick={() => setMenuOpen(false)}>
        學習
      </Link>
      {session.role === "admin" && (
        <Link href="/admin" className="hover:text-brand" onClick={() => setMenuOpen(false)}>
          管理後台
        </Link>
      )}
      <button
        onClick={() => {
          setPwOpen(true);
          setMenuOpen(false);
        }}
        className="hover:text-brand text-left"
      >
        改密碼
      </button>
      <button onClick={logout} className="hover:text-brand text-left">
        登出
      </button>
    </>
  ) : (
    <Link href="/login" className="hover:text-brand" onClick={() => setMenuOpen(false)}>
      登入
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-violet-100">
      <nav className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg sm:text-xl font-extrabold text-brand whitespace-nowrap"
        >
          🦊 美語單字本
        </Link>

        {/* 桌面：橫向 */}
        <div className="hidden sm:flex items-center gap-4 text-sm font-bold">
          {session && <span className="text-slate-400">{session.name}</span>}
          {links}
        </div>

        {/* 手機：漢堡 */}
        <div className="sm:hidden flex items-center gap-3">
          {session && (
            <span className="text-xs text-slate-400 max-w-[5rem] truncate">
              {session.name}
            </span>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="選單"
            className="text-2xl leading-none text-brand"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* 手機下拉面板 */}
      {menuOpen && (
        <div className="sm:hidden border-t border-violet-100 bg-white px-4 py-3 flex flex-col gap-3 text-sm font-bold">
          {links}
        </div>
      )}

      {pwOpen && (
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
                    setPwOpen(false);
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
    </header>
  );
}
