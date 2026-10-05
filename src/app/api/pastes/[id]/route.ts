import { NextRequest, NextResponse } from "next/server";
import { consumePaste } from "@/lib/pastes";
import { getNowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const paste = await consumePaste(id, getNowMs(req.headers));
    if (!paste) {
      return NextResponse.json({ error: "Paste not found or unavailable" }, { status: 404 });
    }
    // Exactly the fields in the assignment contract.
    return NextResponse.json(
      { content: paste.content, remaining_views: paste.remaining_views, expires_at: paste.expires_at },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch paste" }, { status: 500 });
  }
}
