"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    const res = await fetch("/api/auth/captcha");
    const data = await res.json();
    setCaptchaSvg(data.svg);
    setCaptchaToken(data.token);
    setCaptchaInput("");
  }, []);

  useEffect(() => {
    if (requireCaptcha && !captchaSvg) void loadCaptcha();
  }, [requireCaptcha, captchaSvg, loadCaptcha]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaToken, captchaInput }),
      });
      const data = await res.json();
      if (res.ok) {
        const next = params.get("next");
        router.push(data.role === "admin" ? "/admin" : next || "/study");
        router.refresh();
        return;
      }
      setMsg(data.error || "登入失敗");
      if (data.requireCaptcha) {
        setRequireCaptcha(true);
        await loadCaptcha();
      }
    } catch {
      setMsg("連線錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto py-10">
      <h1 className="text-2xl font-extrabold text-brand mb-6 text-center">登入</h1>
      <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl p-6 card-shadow">
        <input
          required
          placeholder="帳號"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="密碼"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />

        {requireCaptcha && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded-lg border border-slate-200 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: captchaSvg }}
              />
              <button
                type="button"
                onClick={loadCaptcha}
                className="text-sm text-brand underline"
              >
                換一張
              </button>
            </div>
            <input
              required
              placeholder="輸入上方驗證碼"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 uppercase"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand text-white py-2 font-bold disabled:opacity-50"
        >
          {loading ? "登入中…" : "登入"}
        </button>
        {msg && <p className="text-sm text-rose-500">{msg}</p>}
      </form>
      <p className="text-xs text-slate-400 text-center mt-4">
        帳號由管理員建立。連續輸入錯誤會要求驗證碼，錯誤 5 次將鎖定 10 分鐘。
      </p>
    </div>
  );
}
