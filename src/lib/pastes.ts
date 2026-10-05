import { randomBytes } from "crypto";
import { ensureSchema, getSql } from "./db";
import { htmlToText, sanitizeNoteHtml } from "./sanitize";

export type PasteFormat = "text" | "html";
export type PasteStatus = "active" | "expired" | "view_limit_reached";

interface Row {
  id: string;
  title: string | null;
  content: string;
  format: PasteFormat;
  created_at: string | number;
  updated_at: string | number | null;
  expires_at: string | number | null;
  max_views: number | null;
  view_count: number;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function isObject(b: unknown): b is Record<string, unknown> {
  return typeof b === "object" && b !== null && !Array.isArray(b);
}

export interface CreateInput {
  content: string;
  ttl_seconds?: number;
  max_views?: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validation for the public POST /api/pastes contract. */
export function validateCreate(body: unknown): Result<CreateInput> {
  if (!isObject(body)) return { ok: false, error: "Request body must be a JSON object" };

  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return { ok: false, error: "content is required and must be a non-empty string" };
  }
  if (body.ttl_seconds != null && !isPositiveInt(body.ttl_seconds)) {
    return { ok: false, error: "ttl_seconds must be an integer >= 1" };
  }
  if (body.max_views != null && !isPositiveInt(body.max_views)) {
    return { ok: false, error: "max_views must be an integer >= 1" };
  }
  return {
    ok: true,
    value: {
      content: body.content,
      ttl_seconds: (body.ttl_seconds as number | null | undefined) ?? undefined,
      max_views: (body.max_views as number | null | undefined) ?? undefined,
    },
  };
}

export interface NoteInput {
  title: string | null;
  content: string; // sanitized HTML
  /** undefined = keep current (edit only), null = no expiry, number = expire after N seconds from now */
  ttl_seconds: number | null | undefined;
  /** null = unlimited */
  max_views: number | null;
}

const MAX_TITLE = 200;
const MAX_CONTENT = 200_000;

/** Validation for admin-created rich-text notes. */
export function validateNote(body: unknown): Result<NoteInput> {
  if (!isObject(body)) return { ok: false, error: "Request body must be a JSON object" };

  const title = body.title;
  if (title != null && (typeof title !== "string" || title.length > MAX_TITLE)) {
    return { ok: false, error: `title must be a string up to ${MAX_TITLE} characters` };
  }
  if (typeof body.content !== "string" || body.content.length > MAX_CONTENT) {
    return { ok: false, error: "content is required" };
  }
  const clean = sanitizeNoteHtml(body.content);
  if (htmlToText(clean).trim().length === 0) {
    return { ok: false, error: "Note content can't be empty" };
  }
  if (body.ttl_seconds !== undefined && body.ttl_seconds !== null && !isPositiveInt(body.ttl_seconds)) {
    return { ok: false, error: "Expiry must be a whole number of seconds (1 or more)" };
  }
  if (body.max_views != null && !isPositiveInt(body.max_views)) {
    return { ok: false, error: "Max views must be a whole number (1 or more)" };
  }

  return {
    ok: true,
    value: {
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      content: clean,
      ttl_seconds: body.ttl_seconds as number | null | undefined,
      max_views: (body.max_views as number | null | undefined) ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function newId(): string {
  // 16 random bytes -> 22 char URL-safe id; unguessable.
  return randomBytes(16).toString("base64url");
}

const toIso = (v: string | number | null): string | null =>
  v === null ? null : new Date(Number(v)).toISOString();

function statusOf(r: Row, nowMs: number): PasteStatus {
  if (r.expires_at !== null && Number(r.expires_at) <= nowMs) return "expired";
  if (r.max_views !== null && r.view_count >= r.max_views) return "view_limit_reached";
  return "active";
}

const remaining = (r: Row) => (r.max_views === null ? null : Math.max(0, r.max_views - r.view_count));

/* ------------------------------------------------------------------ */
/* Public paste API                                                    */
/* ------------------------------------------------------------------ */

export async function createPaste(input: CreateInput, nowMs: number): Promise<string> {
  await ensureSchema();
  const id = newId();
  const expiresAt = input.ttl_seconds ? nowMs + input.ttl_seconds * 1000 : null;
  await getSql()`
    INSERT INTO pastes (id, content, format, created_at, updated_at, expires_at, max_views, view_count)
    VALUES (${id}, ${input.content}, 'text', ${nowMs}, ${nowMs}, ${expiresAt}, ${input.max_views ?? null}, 0)
  `;
  return id;
}

export interface PasteView {
  content: string;
  remaining_views: number | null;
  expires_at: string | null;
  title: string | null;
  format: PasteFormat;
  updated_at: string;
}

/**
 * Atomically consumes one view. The validity checks and the increment
 * happen in a single UPDATE, so concurrent requests can never push
 * view_count past max_views. Returns null when unavailable.
 */
export async function consumePaste(id: string, nowMs: number): Promise<PasteView | null> {
  await ensureSchema();
  const rows = (await getSql()`
    UPDATE pastes
       SET view_count = view_count + 1
     WHERE id = ${id}
       AND (expires_at IS NULL OR expires_at > ${nowMs})
       AND (max_views IS NULL OR view_count < max_views)
    RETURNING *
  `) as Row[];

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    content: r.content,
    remaining_views: remaining(r),
    expires_at: toIso(r.expires_at),
    title: r.title,
    format: r.format,
    updated_at: toIso(r.updated_at ?? r.created_at)!,
  };
}

/* ------------------------------------------------------------------ */
/* Admin notes (never consume views)                                   */
/* ------------------------------------------------------------------ */

export interface NoteSummary {
  id: string;
  title: string | null;
  preview: string;
  format: PasteFormat;
  updated_at: string;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  remaining_views: number | null;
  status: PasteStatus;
}

export interface NoteDetail extends NoteSummary {
  content: string;
}

function toSummary(r: Row, nowMs: number): NoteSummary {
  const text = r.format === "html" ? htmlToText(r.content) : r.content;
  return {
    id: r.id,
    title: r.title,
    preview: text.replace(/\s+/g, " ").trim().slice(0, 160),
    format: r.format,
    updated_at: toIso(r.updated_at ?? r.created_at)!,
    expires_at: toIso(r.expires_at),
    max_views: r.max_views,
    view_count: r.view_count,
    remaining_views: remaining(r),
    status: statusOf(r, nowMs),
  };
}

export async function listNotes(nowMs: number): Promise<NoteSummary[]> {
  await ensureSchema();
  const rows = (await getSql()`
    SELECT * FROM pastes ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 500
  `) as Row[];
  return rows.map((r) => toSummary(r, nowMs));
}

export async function getNote(id: string, nowMs: number): Promise<NoteDetail | null> {
  await ensureSchema();
  const rows = (await getSql()`SELECT * FROM pastes WHERE id = ${id}`) as Row[];
  if (rows.length === 0) return null;
  return { ...toSummary(rows[0], nowMs), content: rows[0].content };
}

export async function createNote(input: NoteInput, nowMs: number): Promise<NoteDetail> {
  await ensureSchema();
  const id = newId();
  const expiresAt = input.ttl_seconds ? nowMs + input.ttl_seconds * 1000 : null;
  const rows = (await getSql()`
    INSERT INTO pastes (id, title, content, format, created_at, updated_at, expires_at, max_views, view_count)
    VALUES (${id}, ${input.title}, ${input.content}, 'html', ${nowMs}, ${nowMs}, ${expiresAt}, ${input.max_views}, 0)
    RETURNING *
  `) as Row[];
  return { ...toSummary(rows[0], nowMs), content: rows[0].content };
}

export async function updateNote(id: string, input: NoteInput, nowMs: number): Promise<NoteDetail | null> {
  await ensureSchema();
  const keepExpiry = input.ttl_seconds === undefined;
  const newExpiry = input.ttl_seconds ? nowMs + input.ttl_seconds * 1000 : null;
  const rows = (await getSql()`
    UPDATE pastes
       SET title = ${input.title},
           content = ${input.content},
           format = 'html',
           updated_at = ${nowMs},
           expires_at = CASE WHEN ${keepExpiry}::BOOLEAN THEN expires_at ELSE ${newExpiry}::BIGINT END,
           max_views = ${input.max_views}
     WHERE id = ${id}
    RETURNING *
  `) as Row[];
  if (rows.length === 0) return null;
  return { ...toSummary(rows[0], nowMs), content: rows[0].content };
}

export async function deleteNote(id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await getSql()`DELETE FROM pastes WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
