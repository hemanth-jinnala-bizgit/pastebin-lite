"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "@/lib/pastes";
import { copyText, formatDate, formatTimeLeft, shareUrl } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { IconDoc, IconLink, IconPencil, IconPlus, IconSearch, IconTrash } from "@/components/icons";

const STATUS_LABEL: Record<NoteSummary["status"], string> = {
  active: "Active",
  expired: "Expired",
  view_limit_reached: "View limit reached",
};

export default function Dashboard({ initialNotes, loadError }: { initialNotes: NoteSummary[]; loadError: string | null }) {
  const [notes, setNotes] = useState(initialNotes);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<number | null>(null); // null until mounted, avoids hydration mismatch
  const [pendingDelete, setPendingDelete] = useState<NoteSummary | null>(null);
  const [error, setError] = useState(loadError);
  const toast = useToast();

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => (n.title ?? "").toLowerCase().includes(q) || n.preview.toLowerCase().includes(q));
  }, [notes, query]);

  async function copyLink(id: string) {
    toast.show((await copyText(shareUrl(id))) ? "Link copied to clipboard" : "Couldn't copy the link");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/admin/notes/${encodeURIComponent(target.id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      setNotes((list) => list.filter((n) => n.id !== target.id));
      toast.show("Note deleted");
    } catch {
      setError("Couldn't delete the note. Please try again.");
    }
  }

  return (
    <>
      <div className="dash-head">
        <h1>
          My notes <span className="count-pill" aria-label={`${notes.length} notes`}>{notes.length}</span>
        </h1>
        {notes.length > 0 && (
          <div className="dash-actions">
            <div className="search">
              <IconSearch width={16} height={16} />
              <input
                type="search"
                placeholder="Search notes..."
                aria-label="Search notes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Link href="/notes/new" className="btn btn-primary btn-sm hide-mobile">
              <IconPlus width={16} height={16} /> New note
            </Link>
          </div>
        )}
      </div>

      {error && <div className="alert-error" role="alert">{error}</div>}

      {notes.length === 0 && !loadError && (
        <div className="empty">
          <div className="empty-art" aria-hidden="true"><IconDoc width={40} height={40} /></div>
          <h2>No notes yet</h2>
          <p className="muted">Create your first note and share<br />it with a link.</p>
          <Link href="/notes/new" className="btn btn-primary"><IconPlus width={16} height={16} /> New note</Link>
        </div>
      )}

      {notes.length > 0 && filtered.length === 0 && (
        <p className="muted no-match">No notes match &ldquo;{query}&rdquo;.</p>
      )}

      <ul className="note-grid">
        {filtered.map((n) => {
          const msLeft = n.expires_at && now !== null ? new Date(n.expires_at).getTime() - now : null;
          const status = n.status === "active" && msLeft !== null && msLeft <= 0 ? "expired" : n.status;
          const title = n.title || "Untitled note";
          return (
            <li key={n.id} className="note-card">
              <Link href={`/notes/${n.id}/edit`} className="note-title">{title}</Link>
              <p className="note-preview">{n.preview}</p>
              <div className="note-stats">
                <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
                <span>{n.view_count}{n.max_views !== null ? ` / ${n.max_views}` : ""} views</span>
                {n.expires_at && <span suppressHydrationWarning>{msLeft === null ? "" : formatTimeLeft(msLeft)}</span>}
              </div>
              <div className="note-foot">
                <span className="muted small" suppressHydrationWarning>Updated {formatDate(n.updated_at)}</span>
                <div className="note-icons">
                  <button type="button" className="icon-btn" aria-label={`Copy link to ${title}`} onClick={() => copyLink(n.id)}>
                    <IconLink width={16} height={16} />
                  </button>
                  <Link href={`/notes/${n.id}/edit`} className="icon-btn" aria-label={`Edit ${title}`}>
                    <IconPencil width={16} height={16} />
                  </Link>
                  <button type="button" className="icon-btn danger" aria-label={`Delete ${title}`} onClick={() => setPendingDelete(n)}>
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {notes.length > 0 && (
        <Link href="/notes/new" className="fab show-mobile" aria-label="New note"><IconPlus width={24} height={24} /></Link>
      )}

      {pendingDelete && (
        <DeleteDialog title={pendingDelete.title || "Untitled note"} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
      )}
      {toast.node}
    </>
  );
}

function DeleteDialog({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="del-title"
        aria-describedby="del-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon" aria-hidden="true"><IconTrash width={28} height={28} /></div>
        <h2 id="del-title">Delete this note?</h2>
        <p id="del-desc" className="muted">
          &lsquo;{title}&rsquo; will be permanently deleted and its share link will stop working.
        </p>
        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>Delete note</button>
        </div>
      </div>
    </div>
  );
}
