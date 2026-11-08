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
  CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, title TEXT NOT NULL, url TEXT, requested_by TEXT NOT NULL, played_at INTEGER NOT NULL, artist TEXT, artwork TEXT, duration_ms INTEGER NOT NULL DEFAULT 0, requester_name TEXT, requester_avatar TEXT);
  CREATE INDEX IF NOT EXISTS history_requester ON history (requested_by);
  CREATE TABLE IF NOT EXISTS listening_session (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at INTEGER NOT NULL, ended_at INTEGER);
`);

const historyColumns = new Set((db.prepare("PRAGMA table_info(history)").all() as { name: string }[]).map((column) => column.name));
for (const [name, type] of [["artist", "TEXT"], ["artwork", "TEXT"], ["duration_ms", "INTEGER NOT NULL DEFAULT 0"], ["requester_name", "TEXT"], ["requester_avatar", "TEXT"], ["session_id", "INTEGER"], ["picked_by", "TEXT"]] as const) {
  if (!historyColumns.has(name)) db.exec(`ALTER TABLE history ADD COLUMN ${name} ${type}`);
}

db.exec("CREATE INDEX IF NOT EXISTS history_session ON history (session_id)");

const SESSION_GAP_MS = 30 * 60_000;
const loose = db.prepare("SELECT id, played_at, duration_ms FROM history WHERE session_id IS NULL ORDER BY played_at").all() as { id: number; played_at: number; duration_ms: number }[];
if (loose.length) {
  const open = db.prepare("INSERT INTO listening_session (started_at, ended_at) VALUES (?, ?)");
  const close = db.prepare("UPDATE listening_session SET ended_at = ? WHERE id = ?");
  const assign = db.prepare("UPDATE history SET session_id = ? WHERE id = ?");
  let current: { id: number; end: number } | null = null;
  for (const row of loose) {
    const end = row.played_at + row.duration_ms;
    if (!current || row.played_at - current.end > SESSION_GAP_MS) current = { id: Number(open.run(row.played_at, end).lastInsertRowid), end };
    current.end = Math.max(current.end, end);
    close.run(current.end, current.id);
    assign.run(current.id, row.id);
  }
}

const read = db.prepare("SELECT value FROM kv WHERE key = ?");
const write = db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value");

export function getValue<T>(key: string): T | undefined {
  const row = read.get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setValue(key: string, value: unknown): void {
  write.run(key, JSON.stringify(value));
}
