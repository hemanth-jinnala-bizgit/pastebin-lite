import { NextRequest, NextResponse } from "next/server";
import { createPaste, validateCreate } from "@/lib/pastes";
import { getNowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Build the public origin from the request so no URL is hardcoded. */
function originOf(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const result = validateCreate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const id = await createPaste(result.value, getNowMs(req.headers));
    return NextResponse.json({ id, url: `${originOf(req)}/p/${id}` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create paste" }, { status: 500 });
  }
}
