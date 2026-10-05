import { NextRequest, NextResponse } from "next/server";
import { readJson, requireAdmin } from "@/lib/adminApi";
import { deleteNote, getNote, updateNote, validateNote } from "@/lib/pastes";
import { getNowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Note not found" }, { status: 404 });

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const note = await getNote((await params).id, getNowMs(req.headers));
    return note ? NextResponse.json({ note }, { headers: { "Cache-Control": "no-store" } }) : notFound();
  } catch {
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;

  const result = validateNote(parsed.body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const note = await updateNote((await params).id, result.value, getNowMs(req.headers));
    return note ? NextResponse.json({ note }) : notFound();
  } catch {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return (await deleteNote((await params).id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
