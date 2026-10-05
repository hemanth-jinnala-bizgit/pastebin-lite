import { redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/auth";
import { Header } from "@/components/Header";
import NoteEditor from "@/components/NoteEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New note · NoteShare" };

export default async function NewNotePage() {
  const email = await getAdminEmail();
  if (!email) redirect("/login");
  return (
    <>
      <Header email={email} />
      <main className="page">
        <NoteEditor note={null} />
      </main>
    </>
  );
}
