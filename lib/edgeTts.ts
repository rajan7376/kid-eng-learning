import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Speed } from "./types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 用 Microsoft Edge「大聲朗讀」線上服務合成語音(免金鑰、免費，Neural 真人音)。
 * 回傳 mp3 bytes。
 */
export async function synthesizeEdge(text: string, speed: Speed): Promise<Buffer> {
  const voice =
    process.env.EDGE_TTS_VOICE ||
    process.env.AZURE_TTS_VOICE ||
    "en-US-AnaNeural"; // 童聲，適合兒童

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  // rate 為倍率：1.0 正常、< 1 變慢
  const { audioStream } = await tts.toStream(escapeXml(text), {
    rate: speed === "slow" ? 0.6 : 1.0,
  });

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    };
    audioStream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    audioStream.on("end", done);
    audioStream.on("close", done);
    audioStream.on("error", reject);
  });
}
