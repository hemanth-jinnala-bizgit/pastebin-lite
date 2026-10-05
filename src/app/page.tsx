import { redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/auth";
import { listNotes, type NoteSummary } from "@/lib/pastes";
import { Header } from "@/components/Header";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "My notes · NoteShare" };

export default async function HomePage() {
  const email = await getAdminEmail();
  if (!email) redirect("/login");

  let notes: NoteSummary[] = [];
  let error: string | null = null;
  try {
    notes = await listNotes(Date.now());
  } catch {
    error = "Couldn't load your notes. Check the database connection and try again.";
  }

  return (
    <>
      <Header email={email} />
      <main className="page">
        <Dashboard initialNotes={notes} loadError={error} />
      </main>
    </>
  );
}
