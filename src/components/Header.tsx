"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconDoc, IconLogOut } from "./icons";

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "logo logo-lg" : "logo"}>
      <span className="logo-mark"><IconDoc width={large ? 26 : 16} height={large ? 26 : 16} /></span>
      <span className="logo-text">NoteShare</span>
    </span>
  );
}

/** Header for signed-in admin pages. Pass email=null for the public viewer. */
export function Header({ email }: { email: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {email ? <Link href="/" aria-label="NoteShare home"><Logo /></Link> : <Logo />}
        {email && (
          <div className="header-right">
            <span className="header-email">{email}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={logout} disabled={busy}>
              <IconLogOut width={16} height={16} /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
