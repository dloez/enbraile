import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const path = process.env.DATA_PATH ?? "data/dj.db";
mkdirSync(dirname(path), { recursive: true });

export const db = new DatabaseSync(path);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS playlist (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS playlist_track (id TEXT PRIMARY KEY, playlist_id TEXT NOT NULL, position INTEGER NOT NULL, query TEXT NOT NULL, title TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS playlist_track_order ON playlist_track (playlist_id, position);
  CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, title TEXT NOT NULL, url TEXT, requested_by TEXT NOT NULL, played_at INTEGER NOT NULL);
`);

const read = db.prepare("SELECT value FROM kv WHERE key = ?");
const write = db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value");

export function getValue<T>(key: string): T | undefined {
  const row = read.get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setValue(key: string, value: unknown): void {
  write.run(key, JSON.stringify(value));
}
