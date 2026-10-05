import { redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign in · NoteShare" };

export default async function LoginPage() {
  if (await getAdminEmail()) redirect("/");
  return <LoginForm />;
}
