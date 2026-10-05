import { NextRequest, NextResponse } from "next/server";
import { readJson, requireAdmin } from "@/lib/adminApi";
import { createNote, listNotes, validateNote } from "@/lib/pastes";
import { getNowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const notes = await listNotes(getNowMs(req.headers));
    return NextResponse.json({ notes }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;

  const result = validateNote(parsed.body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const note = await createNote(result.value, getNowMs(req.headers));
    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}
