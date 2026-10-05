import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    await getSql()`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Persistence layer unavailable" }, { status: 503 });
  }
}
