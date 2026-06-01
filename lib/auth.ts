import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "kel_session";
export type Role = "admin" | "student";

export interface SessionPayload {
  sub: string; // user id
  username: string;
  role: Role;
  name: string; // display name (fallback to username)
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET 未設定");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: String(payload.sub),
      username: String(payload.username),
      role: payload.role as Role,
      name: payload.name ? String(payload.name) : String(payload.username),
    };
  } catch {
    return null;
  }
}

// ---- Captcha：用短效 JWT 攜帶答案，免存 DB ----
export async function signCaptcha(code: string): Promise<string> {
  return new SignJWT({ code: code.toUpperCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());
}

export async function verifyCaptcha(
  token: string | undefined,
  input: string | undefined,
): Promise<boolean> {
  if (!token || !input) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return String(payload.code) === input.trim().toUpperCase();
  } catch {
    return false;
  }
}

export function randomCaptchaCode(len = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆字
  let s = "";
  for (let i = 0; i < len; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
