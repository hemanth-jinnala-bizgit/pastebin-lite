import { notFound, redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/auth";
import { getNote } from "@/lib/pastes";
import { Header } from "@/components/Header";
import NoteEditor from "@/components/NoteEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit note · NoteShare" };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const email = await getAdminEmail();
  if (!email) redirect("/login");

  const note = await getNote((await params).id, Date.now());
  if (!note) notFound();

  // Plain-text pastes (created via the API) become paragraphs for the rich editor.
  const content =
    note.format === "html"
      ? note.content
      : note.content.split(/\r?\n/).map((line) => `<p>${escapeHtml(line)}</p>`).join("");

  return (
    <>
      <Header email={email} />
      <main className="page">
        <NoteEditor note={{ ...note, content }} />
      </main>
    </>
  );
}
