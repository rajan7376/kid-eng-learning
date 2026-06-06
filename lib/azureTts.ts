import type { Speed } from "./types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(text: string, speed: Speed, voice: string): string {
  // rate="slow" 約 -46%；可改 -30% 微調
  const rate = speed === "slow" ? "-30%" : "0%";
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    <prosody rate="${rate}">${escapeXml(text)}</prosody>
  </voice>
</speak>`;
}

export function isAzureConfigured(): boolean {
  const key = process.env.AZURE_SPEECH_KEY;
  return Boolean(
    key &&
      key !== "YOUR-AZURE-SPEECH-KEY" &&
      process.env.AZURE_SPEECH_REGION,
  );
}

/** Synthesize speech and return mp3 bytes. Throws if not configured or request fails. */
export async function synthesizeSpeech(
  text: string,
  speed: Speed,
): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const voice = process.env.AZURE_TTS_VOICE || "en-US-AvaNeural";
  if (!key || !region) throw new Error("Azure Speech 未設定");

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "kid-eng-learning",
    },
    body: buildSsml(text, speed, voice),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Azure TTS 失敗 ${res.status}: ${detail.slice(0, 200)}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
