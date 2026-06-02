"use client";

import { useState } from "react";

export default function ParentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setLog("上傳並分析中…（首次可能數十秒）");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "分析失敗");
      setLog(
        `完成！${json.handout.class_code}・${json.handout.week_label}，共 ${json.handout.cards.length} 張卡片。`,
      );
      setFile(null);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setLog(err instanceof Error ? err.message : "發生錯誤");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={upload} className="bg-white rounded-2xl p-6 card-shadow space-y-3">
      <h2 className="font-bold text-lg">上傳講義</h2>
      <p className="text-sm text-slate-500">
        支援 JPG / PNG / PDF / WORD，一次上傳一個檔案，AI 會自動建立班級/週次/單字。
      </p>
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <button
        type="submit"
        disabled={!file || busy}
        className="rounded-full bg-brand text-white px-6 py-2 font-bold disabled:opacity-50"
      >
        {busy ? "分析中…" : "上傳並分析"}
      </button>
      {log && <p className="text-sm text-slate-600">{log}</p>}
    </form>
  );
}
