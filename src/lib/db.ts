import { neon, NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Returns a Neon HTTP query function. Created lazily so builds work
 * without DATABASE_URL. Neon's HTTP driver is stateless per query,
 * which suits serverless (no pooled connections held across requests).
 */
export function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/**
 * Idempotent schema setup so the deployed app needs no manual migration.
 * Safe to run on every cold start; the memo is only a per-instance
 * optimisation, correctness never depends on it.
 */
let schemaReady: Promise<void> | null = null;

async function migrate(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS pastes (
      id          TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      created_at  BIGINT NOT NULL,
      expires_at  BIGINT,
      max_views   INTEGER,
      view_count  INTEGER NOT NULL DEFAULT 0
    )
  `;
  // Columns added for the admin notes UI. API-created pastes keep defaults.
  await sql`ALTER TABLE pastes ADD COLUMN IF NOT EXISTS title TEXT`;
  await sql`ALTER TABLE pastes ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'text'`;
  await sql`ALTER TABLE pastes ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
}

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = migrate().catch((err) => {
      schemaReady = null; // allow retry on next request
      throw err;
    });
  }
  return schemaReady;
}
