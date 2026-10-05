import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { consumePaste } from "@/lib/pastes";
import { sanitizeNoteHtml } from "@/lib/sanitize";
import { getNowMs } from "@/lib/time";
import { formatDate } from "@/lib/format";
import { Header } from "@/components/Header";
import CopyLinkButton from "./CopyLinkButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared note · NoteShare", robots: { index: false } };

export default async function PastePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paste = await consumePaste(id, getNowMs(await headers()));
  if (!paste) notFound(); // renders not-found.tsx with HTTP 404

  return (
    <>
      <Header email={null} />
      <main className="page page-narrow">
        <article className="card public-note">
          <div className="public-head">
            <div>
              {paste.title && <h1>{paste.title}</h1>}
              <p className="muted small">Last updated {formatDate(paste.updated_at)}</p>
            </div>
            <CopyLinkButton />
          </div>

          {paste.format === "html" ? (
            // Sanitized on write and again here (allow-list: no scripts, styles or event handlers).
            <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(paste.content) }} />
          ) : (
            // Plain text: React escapes it, so it can never execute.
            <pre className="plain">{paste.content}</pre>
          )}
        </article>
        <p className="public-foot muted small">Shared with NoteShare · Read only</p>
      </main>
    </>
  );
}
