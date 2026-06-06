"use client";

import type { AudioTarget, Speed } from "./types";

function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
}

const voiceCache = new Map<string, Promise<SpeechSynthesisVoice | null>>();

// 依語言挑最自然的語音：Natural/Neural(Edge 微軟線上) > Google > Online > 完全符合語系
function pickBestVoice(lang = "en-US"): Promise<SpeechSynthesisVoice | null> {
  const key = lang.toLowerCase().slice(0, 2);
  const cached = voiceCache.get(key);
  if (cached) return cached;
  const promise = new Promise<SpeechSynthesisVoice | null>((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve(null);
      return;
    }
    const synth = window.speechSynthesis;
    const score = (v: SpeechSynthesisVoice) => {
      const n = v.name.toLowerCase();
      let s = 0;
      if (n.includes("natural") || n.includes("neural")) s += 6;
      if (n.includes("google")) s += 4;
      if (n.includes("online")) s += 3;
      if (v.lang?.toLowerCase() === lang.toLowerCase()) s += 2;
      return s;
    };
    const choose = (): boolean => {
      const voices = synth.getVoices();
      if (!voices.length) return false;
      const matched = voices.filter((v) =>
        v.lang?.toLowerCase().startsWith(key),
      );
      const pool = matched.length ? matched : voices;
      resolve([...pool].sort((a, b) => score(b) - score(a))[0] ?? null);
      return true;
    };
    if (choose()) return;
    synth.onvoiceschanged = () => choose();
    setTimeout(() => resolve(synth.getVoices()[0] ?? null), 1000);
  });
  voiceCache.set(key, promise);
  return promise;
}

async function browserSpeak(
  text: string,
  speed: Speed,
  lang = "en-US",
): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voice = await pickBestVoice(lang);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = speed === "slow" ? 0.45 : 1.0;
    u.pitch = 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

/** 直接用瀏覽器語音念任意文字(含中文)。lang 例: "zh-TW"、"en-US" */
export async function speakText(
  text: string,
  lang = "en-US",
  speed: Speed = "normal",
): Promise<void> {
  if (!text) return;
  await browserSpeak(text, speed, lang);
}

/** 背景預先生成並快取音檔(不播放)，讓之後點發音可以秒播。 */
export async function prefetchAudio(
  cardId: string,
  target: AudioTarget,
  speed: Speed,
): Promise<void> {
  try {
    await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, target, speed }),
    });
  } catch {
    /* 預抓失敗忽略，點擊時再處理 */
  }
}

/**
 * 播放英文發音：優先用後端 Azure 快取音檔，失敗則降級為瀏覽器內建語音。
 * 在 Edge 上瀏覽器語音會自動使用微軟 Neural 真人語音。
 */
export async function speak(
  cardId: string,
  target: AudioTarget,
  speed: Speed,
  fallbackText: string,
): Promise<void> {
  try {
    // 只查快取，立刻回應
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, target, speed, cacheOnly: true }),
    });
    const data = await res.json().catch(() => ({}) as Record<string, string>);
    if (res.ok && data.url) {
      await playUrl(data.url); // 命中快取：真人語音
      return;
    }
    // 未命中：先用瀏覽器語音秒發聲，背景生成真人快取，下次就秒播真人
    void prefetchAudio(cardId, target, speed);
    await browserSpeak(data.text ?? fallbackText, speed, "en-US");
  } catch {
    await browserSpeak(fallbackText, speed, "en-US");
  }
}
