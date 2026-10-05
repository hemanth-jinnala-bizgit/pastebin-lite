import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Single-admin auth. Credentials come from env vars (never committed):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET (>= 16 chars)
 * The session is a stateless HMAC-signed cookie, so it works across
 * serverless instances without any shared memory.
 */
export const SESSION_COOKIE = "ns_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ characters)");
  return s;
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET?.length ?? 0) >= 16);
}

const mac = (data: string) => createHmac("sha256", secret()).update(data).digest();

/** Constant-time string compare (HMAC both sides so lengths always match). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(mac(a), mac(b));
}

export function checkCredentials(email: string, password: string): boolean {
  const okEmail = safeEqual(email.trim().toLowerCase(), (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase());
  const okPass = safeEqual(password, process.env.ADMIN_PASSWORD ?? "");
  return okEmail && okPass;
}

export function createSessionToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email, x: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url");
  return `${payload}.${mac(payload).toString("base64url")}`;
}

function verifySessionToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = mac(payload);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof e !== "string" || typeof x !== "number" || x < Date.now()) return null;
    return e;
  } catch {
    return null;
  }
}

/** Returns the signed-in admin email, or null. Never throws. */
export async function getAdminEmail(): Promise<string | null> {
  try {
    if (!isAuthConfigured()) return null;
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return token ? verifySessionToken(token) : null;
  } catch {
    return null;
  }
}
