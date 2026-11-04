import path from "node:path";
import pg from "pg";

// One small wrapper so the store works the same against a hosted Postgres
// (Vercel/Neon, via DATABASE_URL) and an embedded Postgres (PGlite) used for
// local development and tests.

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rb_kv (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rb_counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rb_menu (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    data JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rb_orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rb_orders_created_idx ON rb_orders (created_at DESC);
  CREATE TABLE IF NOT EXISTS rb_bills (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rb_bills_created_idx ON rb_bills (created_at DESC);
  CREATE TABLE IF NOT EXISTS rb_loyalty (
    phone TEXT PRIMARY KEY,
    data JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rb_uploads (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    bytes BYTEA NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function normalize(result) {
  return {
    rows: result.rows || [],
    rowCount: result.rowCount ?? result.affectedRows ?? 0,
  };
}

async function openRemote(url) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (error) => {
    console.error("[db] idle client error:", error.message);
  });
  return {
    kind: "postgres",
    async query(text, params = []) {
      return normalize(await pool.query(text, params));
    },
    async exec(text) {
      await pool.query(text);
    },
    async close() {
      await pool.end();
    },
  };
}

async function openEmbedded(dir) {
  let PGlite;
  try {
    ({ PGlite } = await import("@electric-sql/pglite"));
  } catch {
    throw new Error(
      "No DATABASE_URL is set and the embedded database is not installed. Run `npm install` or set DATABASE_URL.",
    );
  }
  const db = dir ? new PGlite(dir) : new PGlite();
  await db.waitReady;
  return {
    kind: "pglite",
    async query(text, params = []) {
      return normalize(await db.query(text, params));
    },
    async exec(text) {
      await db.exec(text);
    },
    async close() {
      await db.close();
    },
  };
}

export async function openDatabase({ url = databaseUrl(), dataDir } = {}) {
  let db;
  if (url) {
    db = await openRemote(url);
  } else {
    if (process.env.VERCEL) {
      const error = new Error(
        "DATABASE_URL is not set. Connect a Postgres database to this Vercel project.",
      );
      error.publicMessage =
        "The database isn't connected yet. Add a Postgres database in Vercel → Storage, then redeploy.";
      throw error;
    }
    db = await openEmbedded(dataDir ? path.join(dataDir, "pglite") : null);
  }

  // The advisory lock keeps two cold starts from racing on CREATE TABLE.
  await db.exec(`SELECT pg_advisory_xact_lock(727274); ${SCHEMA}`);
  return db;
}
