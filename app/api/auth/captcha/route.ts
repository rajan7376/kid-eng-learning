import { NextResponse } from "next/server";
import { randomCaptchaCode, signCaptcha } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function captchaSvg(code: string): string {
  const w = 150;
  const h = 50;
  const chars = [...code]
    .map((c, i) => {
      const x = 18 + i * 26;
      const y = 32 + rand(-4, 4);
      const rot = rand(-18, 18);
      const fill = ["#6c5ce7", "#0984e3", "#e17055", "#00b894"][i % 4];
      return `<text x="${x}" y="${y}" font-size="28" font-weight="700" font-family="monospace" fill="${fill}" transform="rotate(${rot} ${x} 28)">${c}</text>`;
    })
    .join("");
  const lines = Array.from({ length: 5 })
    .map(
      () =>
        `<line x1="${rand(0, w)}" y1="${rand(0, h)}" x2="${rand(0, w)}" y2="${rand(0, h)}" stroke="#b2bec3" stroke-width="1"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f5f3ff" rx="8"/>${lines}${chars}</svg>`;
}

export async function GET() {
  const code = randomCaptchaCode();
  const token = await signCaptcha(code);
  return NextResponse.json({ token, svg: captchaSvg(code) });
}
