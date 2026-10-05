import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "./auth";

/** Returns a 401 response if the caller isn't the signed-in admin. */
export async function requireAdmin(): Promise<NextResponse | null> {
  return (await getAdminEmail())
    ? null
    : NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

/** Parse a JSON body; requires a JSON content type (blocks simple cross-site form posts). */
export async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, res: NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 }) };
  }
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }) };
  }
}
