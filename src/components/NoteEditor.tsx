"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { NoteDetail } from "@/lib/pastes";
import { copyText, formatTimeLeft, shareUrl } from "@/lib/format";
import { useToast } from "./Toast";
import {
  IconArrowLeft, IconBold, IconCode, IconItalic, IconLink, IconList, IconListOrdered,
} from "./icons";

const STATUS_LABEL: Record<NoteDetail["status"], string> = {
  active: "Active",
  expired: "Expired",
  view_limit_reached: "View limit reached",
};

function relative(savedAt: number, now: number): string {
  const s = Math.floor((now - savedAt) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

export default function NoteEditor({ note: initial }: { note: NoteDetail | null }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState<NoteDetail | null>(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [ttl, setTtl] = useState("");
  const [removeExpiry, setRemoveExpiry] = useState(false);
  const [maxViews, setMaxViews] = useState(initial?.max_views?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
    ],
    content: initial?.content ?? "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "prose editor-body", "aria-label": "Note content", role: "textbox", "aria-multiline": "true" } },
    onUpdate: () => setDirty(true),
  });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save() {
    if (!editor) return;
    setError(null);

    const body: Record<string, unknown> = { title, content: editor.getHTML() };
    if (ttl.trim()) body.ttl_seconds = Number(ttl);
    else if (!note || removeExpiry) body.ttl_seconds = null; // new: no expiry; edit: explicit removal
    // (edit + blank + not removing => omit, keeps current expiry)
    body.max_views = maxViews.trim() ? Number(maxViews) : null;

    setSaving(true);
    try {
      const res = await fetch(note ? `/api/admin/notes/${encodeURIComponent(note.id)}` : "/api/admin/notes", {
        method: note ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Couldn't save the note.");
        return;
      }
      const saved: NoteDetail = data.note;
      setNote(saved);
      setTtl("");
      setRemoveExpiry(false);
      setDirty(false);
      setSavedAt(Date.now());
      if (!note) router.replace(`/notes/${saved.id}/edit`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!note) return;
    toast.show((await copyText(shareUrl(note.id))) ? "Link copied to clipboard" : "Couldn't copy the link");
  }

  const msLeft = note?.expires_at && now !== null ? new Date(note.expires_at).getTime() - now : null;
  const status = note && note.status === "active" && msLeft !== null && msLeft <= 0 ? "expired" : note?.status;
  const saveLabel = saving ? "Saving..." : dirty ? "Unsaved changes" : savedAt && now ? `Saved · ${relative(savedAt, now)}` : note ? "Saved" : "Not saved yet";

  return (
    <>
      <Link href="/" className="back-link"><IconArrowLeft width={16} height={16} /> Back to my notes</Link>

      <div className="editor-layout">
        <div className="editor-main">
          <div className="title-row">
            <input
              className="title-input"
              placeholder="Untitled note"
              aria-label="Note title"
              value={title}
              maxLength={200}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            />
            <span className="muted small save-state" aria-live="polite">{saveLabel}</span>
          </div>

          <div className="editor-box">
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
          {error && <div className="alert-error" role="alert">{error}</div>}
        </div>

        <aside className="sharing card" aria-labelledby="sharing-h">
          <h2 id="sharing-h">Sharing</h2>
          <p className="muted small">Anyone with the link can view this note.</p>

          {note ? (
            <div className="share-row">
              <input readOnly aria-label="Share link" value={origin ? `${origin.replace(/^https?:\/\//, "")}/p/${note.id}` : ""} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-outline btn-sm" onClick={copy}>Copy</button>
            </div>
          ) : (
            <p className="muted small">Save the note to get a share link.</p>
          )}
          <p className="muted small">Viewers don&rsquo;t need an account.</p>

          <hr />

          <label htmlFor="ttl">Expire after (seconds)</label>
          <input id="ttl" type="number" min={1} step={1} inputMode="numeric" placeholder={note?.expires_at ? "Keep current" : "Never"} value={ttl}
            onChange={(e) => { setTtl(e.target.value); setDirty(true); }} />
          {note?.expires_at && (
            <label className="check">
              <input type="checkbox" checked={removeExpiry} disabled={!!ttl.trim()}
                onChange={(e) => { setRemoveExpiry(e.target.checked); setDirty(true); }} />
              Remove expiry
            </label>
          )}

          <label htmlFor="maxv">Max views</label>
          <input id="maxv" type="number" min={1} step={1} inputMode="numeric" placeholder="Unlimited" value={maxViews}
            onChange={(e) => { setMaxViews(e.target.value); setDirty(true); }} />

          {note && status && (
            <dl className="share-stats">
              <div><dt>Status</dt><dd><span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span></dd></div>
              <div><dt>Views</dt><dd>{note.view_count}{note.max_views !== null ? ` / ${note.max_views}` : ""}</dd></div>
              <div><dt>Time left</dt><dd>{note.expires_at ? (msLeft === null ? "" : formatTimeLeft(msLeft)) : "No expiry"}</dd></div>
            </dl>
          )}
        </aside>
      </div>

      <div className="editor-actions">
        <Link href="/" className="btn btn-outline">Cancel</Link>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !editor}>
          {saving ? "Saving..." : "Save note"}
        </button>
      </div>
      {toast.node}
    </>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="toolbar" aria-hidden="true" />;

  const heading = [1, 2, 3].find((l) => editor.isActive("heading", { level: l }));
  const btn = (label: string, active: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button type="button" className={`tool ${active ? "active" : ""}`} aria-label={label} aria-pressed={active} title={label}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {icon}
    </button>
  );

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://...)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "" ) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:|mailto:)/i.test(url.trim())) {
      window.alert("Links must start with http://, https:// or mailto:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {btn("Bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <IconBold width={16} height={16} />)}
      {btn("Italic", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <IconItalic width={16} height={16} />)}
      <select
        className="tool-select"
        aria-label="Text style"
        value={heading ? `h${heading}` : "p"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
      >
        <option value="p">Text</option>
        <option value="h1">H1</option>
        <option value="h2">H2</option>
        <option value="h3">H3</option>
      </select>
      <span className="tool-sep" aria-hidden="true" />
      {btn("Bulleted list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <IconList width={16} height={16} />)}
      {btn("Numbered list", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <IconListOrdered width={16} height={16} />)}
      <span className="tool-sep" aria-hidden="true" />
      {btn("Link", editor.isActive("link"), setLink, <IconLink width={16} height={16} />)}
      {btn("Code block", editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), <IconCode width={16} height={16} />)}
    </div>
  );
}
