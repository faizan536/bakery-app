import { sql } from "@vercel/postgres";

export { sql };

export const SCHEMA = [
  sql`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
  )`,

  sql`CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 1000
  )`,

  sql`CREATE TABLE IF NOT EXISTS menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    available BOOLEAN DEFAULT TRUE,
    tag TEXT DEFAULT ''
  )`,

  sql`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    customer JSONB NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    total INTEGER NOT NULL DEFAULT 0,
    pickup_date TEXT,
    slot TEXT,
    notes TEXT DEFAULT '',
    cake JSONB,
    status TEXT DEFAULT 'new',
    stamp_awarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  sql`CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    total INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    customer_name TEXT DEFAULT '',
    customer_phone TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  sql`CREATE TABLE IF NOT EXISTS loyalty (
    phone TEXT PRIMARY KEY,
    stamps INTEGER DEFAULT 0,
    rewards_redeemed INTEGER DEFAULT 0,
    name TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  sql`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
];

export async function initSchema() {
  for (const statement of SCHEMA) {
    await statement;
  }
}
