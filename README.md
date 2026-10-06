# Pastebin Lite (NoteShare)

A small Pastebin-style app built with Next.js. Anyone can create a text paste through the API and share a link. Pastes can expire by time (TTL), by number of views, or both. An admin UI ("NoteShare") lets a single admin write rich-text notes and edit, delete, search and share them, with view counts and time left shown for each one.

**Live demo:** https://pastebin-lite-seven-zeta.vercel.app

## Run locally

Requirements: Node.js 18.18+ and a Postgres database (a free [Neon](https://neon.tech) database works).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open the URL printed by `npm run dev` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. For a production build: `npm run build && npm start`.

The table is created and updated automatically on first request (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), so no migration step is needed.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `TEST_MODE` | When `1`, the `x-test-now-ms` header is used as the current time for expiry logic |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credentials for the admin UI |
| `SESSION_SECRET` | 16+ character secret used to sign the session cookie |

## Persistence layer

**Neon Postgres** via `@neondatabase/serverless` (HTTP driver). Serverless functions on Vercel don't share memory, so all state lives in Postgres and sessions are stateless signed cookies. The HTTP driver needs no long-lived connection pool, which fits the serverless model.

## Routes

Public, no login (the assignment contract):

| Route | Description |
|---|---|
| `GET /api/healthz` | `{ "ok": true }` when the database is reachable, otherwise 503 |
| `POST /api/pastes` | Body `{ content, ttl_seconds?, max_views? }` → `201 { id, url }`; invalid input → `400 { error }` |
| `GET /api/pastes/:id` | `{ content, remaining_views, expires_at }`; counts as a view; unavailable → `404 { error }` |
| `GET /p/:id` | HTML view of the paste or note; counts as a view; unavailable → 404 |

Admin only (session cookie required, otherwise 401):

| Route | Description |
|---|---|
| `POST /api/admin/login`, `POST /api/admin/logout` | Start / end the session |
| `GET /api/admin/notes`, `POST /api/admin/notes` | List all notes with stats / create a note |
| `GET`, `PUT`, `DELETE /api/admin/notes/:id` | Read, edit or delete a note. Reading here never counts as a view |

UI pages: `/login`, `/` (dashboard), `/notes/new`, `/notes/:id/edit`, `/p/:id`.

## Design decisions

- **Atomic view counting.** Fetching a paste runs one `UPDATE ... WHERE id = $1 AND not expired AND view_count < max_views RETURNING ...`. The check and increment happen together in the database, so concurrent requests can never serve a paste beyond its limit or produce negative remaining views.
- **Both API and HTML views count.** Each successful `/api/pastes/:id` fetch or `/p/:id` page view consumes one view, since both reveal the content. Admin pages read without consuming views.
- **Uniform 404.** Missing, expired, view-exhausted and deleted pastes are indistinguishable to callers.
- **Public API stays open.** Login only protects the admin UI and `/api/admin/*`, so the grader's contract is unchanged.
- **Single admin, stateless sessions.** Credentials come from env vars and are compared in constant time. The session is an HMAC-signed, httpOnly, SameSite=Lax cookie that expires after 8 hours. Admin write endpoints require a JSON content type, which together with SameSite blocks cross-site form posts. There is no login rate limiting.
- **Editing changes what a link shows.** The share link stays the same and shows the latest saved version. Saving with a new expiry restarts the countdown from that moment; leaving it blank keeps the current one.
- **Safe rendering.** Plain-text pastes render as escaped React text. Rich-text notes (Tiptap editor) are cleaned with an allow-list sanitizer (`sanitize-html`) when saved and again when displayed, so no scripts, styles, event handlers or `javascript:` links get through.
- **Time stored as epoch ms (`BIGINT`).** Makes comparison with the `x-test-now-ms` header straightforward. The test header is honored only when `TEST_MODE=1`.
- **Unguessable IDs.** 16 random bytes, base64url encoded.
- **No hardcoded origins.** Share URLs are built from the request host / forwarded headers or the browser's origin.
- **No secrets in the repo.** `.env*.local` is gitignored; `.env.example` documents the variables.
