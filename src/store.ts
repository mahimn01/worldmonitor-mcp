/**
 * Cache + snapshot state layer.
 *
 * Memory-first: MemoryStore always works and is the default. SqliteStore is an
 * opportunistic upgrade — used only when `node:sqlite` is available (Node ≥22.5)
 * AND opening the DB succeeds. `openStore` NEVER throws; on any failure it
 * returns the in-memory backend so the MCP server always starts (public-grade).
 *
 * stdout is reserved for MCP JSON-RPC framing — all diagnostics go to stderr.
 */

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface CacheEntry {
  value: unknown;
  fetchedAt: number; // unix seconds
}

export type ChangeStatus = 'new' | 'changed' | 'unchanged';

export interface ChangeRow {
  entity: string;
  hash: string;
  payload: unknown;
  ts: number; // unix seconds
  change: 'new' | 'changed';
}

export interface Store {
  readonly backend: 'sqlite' | 'memory';
  /** TTL-aware get; returns null if missing or expired. */
  cacheGet(key: string): CacheEntry | null;
  cacheSet(key: string, value: unknown, ttlSeconds: number): void;
  /** Upsert a feed entity; returns whether it was new / changed / unchanged. */
  snapshotPut(
    feed: string,
    entity: string,
    hash: string,
    payloadJson: string,
    ts: number,
  ): ChangeStatus;
  /** New/changed entities for a feed since `sinceTs` (unix seconds), newest first. */
  getChangesSince(feed: string, sinceTs: number): ChangeRow[];
  pruneExpired(): void;
  close(): void;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// In-memory backend (always available)
// ---------------------------------------------------------------------------

interface MemSnapshot {
  hash: string;
  payload: string;
  ts: number;
}

/** Cap on the in-memory change-history log (FIFO once exceeded). */
const MEM_HISTORY_MAX = 20_000;
/** History rows older than this are pruned (both backends). */
const HISTORY_KEEP_DAYS = 30;

export class MemoryStore implements Store {
  readonly backend = 'memory' as const;
  private cache = new Map<
    string,
    { value: string; fetchedAt: number; expiresAt: number }
  >();
  private snapshots = new Map<string, Map<string, MemSnapshot>>();
  private history: Array<{
    feed: string;
    entity: string;
    hash: string;
    payload: string; // raw JSON
    ts: number;
    change: 'new' | 'changed';
  }> = [];

  cacheGet(key: string): CacheEntry | null {
    const row = this.cache.get(key);
    if (!row) return null;
    if (row.expiresAt <= nowSec()) {
      this.cache.delete(key);
      return null;
    }
    return { value: safeParse(row.value), fetchedAt: row.fetchedAt };
  }

  cacheSet(key: string, value: unknown, ttlSeconds: number): void {
    const now = nowSec();
    this.cache.set(key, {
      value: JSON.stringify(value),
      fetchedAt: now,
      expiresAt: now + ttlSeconds,
    });
  }

  snapshotPut(
    feed: string,
    entity: string,
    hash: string,
    payloadJson: string,
    ts: number,
  ): ChangeStatus {
    let feedMap = this.snapshots.get(feed);
    if (!feedMap) {
      feedMap = new Map();
      this.snapshots.set(feed, feedMap);
    }
    const prev = feedMap.get(entity);
    if (prev && prev.hash === hash) return 'unchanged';
    const change: 'new' | 'changed' = prev ? 'changed' : 'new';
    feedMap.set(entity, { hash, payload: payloadJson, ts });
    this.history.push({ feed, entity, hash, payload: payloadJson, ts, change });
    // FIFO cap so a long-lived session can't grow the log without bound.
    if (this.history.length > MEM_HISTORY_MAX) {
      this.history.splice(0, this.history.length - MEM_HISTORY_MAX);
    }
    return change;
  }

  getChangesSince(feed: string, sinceTs: number): ChangeRow[] {
    // Iterate newest-insertion-first so equal-ts rows resolve to the LATEST
    // write (matches SQLite's ORDER BY ts DESC, id DESC).
    const seen = new Set<string>();
    const out: ChangeRow[] = [];
    for (let i = this.history.length - 1; i >= 0; i--) {
      const r = this.history[i];
      if (r.feed !== feed || r.ts <= sinceTs) continue;
      if (seen.has(r.entity)) continue;
      seen.add(r.entity);
      out.push({
        entity: r.entity,
        hash: r.hash,
        payload: safeParse(r.payload),
        ts: r.ts,
        change: r.change,
      });
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }

  pruneExpired(): void {
    const now = nowSec();
    for (const [k, v] of this.cache) if (v.expiresAt <= now) this.cache.delete(k);
    const cutoff = now - HISTORY_KEEP_DAYS * 86_400;
    this.history = this.history.filter((r) => r.ts > cutoff);
  }

  close(): void {
    /* no-op */
  }
}

// ---------------------------------------------------------------------------
// SQLite backend (opportunistic)
// ---------------------------------------------------------------------------

const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS cache (
  key        TEXT PRIMARY KEY,
  value      TEXT    NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

CREATE TABLE IF NOT EXISTS snapshots (
  feed    TEXT    NOT NULL,
  entity  TEXT    NOT NULL,
  hash    TEXT    NOT NULL,
  payload TEXT    NOT NULL,
  ts      INTEGER NOT NULL,
  PRIMARY KEY (feed, entity)
);

CREATE TABLE IF NOT EXISTS snapshot_history (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  feed    TEXT    NOT NULL,
  entity  TEXT    NOT NULL,
  hash    TEXT    NOT NULL,
  payload TEXT    NOT NULL,
  ts      INTEGER NOT NULL,
  change  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hist_feed_ts ON snapshot_history(feed, ts);
`;

// Minimal structural typing for the node:sqlite surface we use.
interface SqliteStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): unknown;
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

class SqliteStore implements Store {
  readonly backend = 'sqlite' as const;
  constructor(private db: SqliteDb) {}

  cacheGet(key: string): CacheEntry | null {
    const row = this.db
      .prepare('SELECT value, fetched_at, expires_at FROM cache WHERE key = ?')
      .get(key);
    if (!row) return null;
    if ((row.expires_at as number) <= nowSec()) {
      this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
      return null;
    }
    return {
      value: safeParse(row.value as string),
      fetchedAt: row.fetched_at as number,
    };
  }

  cacheSet(key: string, value: unknown, ttlSeconds: number): void {
    const now = nowSec();
    this.db
      .prepare(
        'INSERT OR REPLACE INTO cache (key, value, fetched_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(key, JSON.stringify(value), now, now + ttlSeconds);
  }

  snapshotPut(
    feed: string,
    entity: string,
    hash: string,
    payloadJson: string,
    ts: number,
  ): ChangeStatus {
    // The existence check runs INSIDE the transaction so a concurrent process
    // can't interleave between check and write (IMMEDIATE takes the write lock
    // up front; busy_timeout handles contention).
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prev = this.db
        .prepare('SELECT hash FROM snapshots WHERE feed = ? AND entity = ?')
        .get(feed, entity);
      if (prev && (prev.hash as string) === hash) {
        this.db.exec('COMMIT');
        return 'unchanged';
      }
      const change: 'new' | 'changed' = prev ? 'changed' : 'new';
      this.db
        .prepare(
          'INSERT OR REPLACE INTO snapshots (feed, entity, hash, payload, ts) VALUES (?, ?, ?, ?, ?)',
        )
        .run(feed, entity, hash, payloadJson, ts);
      this.db
        .prepare(
          'INSERT INTO snapshot_history (feed, entity, hash, payload, ts, change) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(feed, entity, hash, payloadJson, ts, change);
      this.db.exec('COMMIT');
      return change;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  getChangesSince(feed: string, sinceTs: number): ChangeRow[] {
    const rows = this.db
      .prepare(
        // id DESC tiebreaks equal timestamps to the LATEST write (memory parity)
        'SELECT entity, hash, payload, ts, change FROM snapshot_history WHERE feed = ? AND ts > ? ORDER BY ts DESC, id DESC',
      )
      .all(feed, sinceTs);
    const seen = new Set<string>();
    const out: ChangeRow[] = [];
    for (const r of rows) {
      const entity = r.entity as string;
      if (seen.has(entity)) continue;
      seen.add(entity);
      out.push({
        entity,
        hash: r.hash as string,
        payload: safeParse(r.payload as string),
        ts: r.ts as number,
        change: r.change as 'new' | 'changed',
      });
    }
    return out;
  }

  pruneExpired(): void {
    const now = nowSec();
    this.db.prepare('DELETE FROM cache WHERE expires_at <= ?').run(now);
    // Bound the append-only change log (matches MemoryStore semantics).
    this.db
      .prepare('DELETE FROM snapshot_history WHERE ts <= ?')
      .run(now - HISTORY_KEEP_DAYS * 86_400);
  }

  close(): void {
    this.db.close();
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Open the best available store. Never throws — falls back to in-memory on any
 * failure (missing node:sqlite on older Node, unwritable data dir, locked DB).
 */
export function openStore(dataDir: string): Store {
  try {
    mkdirSync(dataDir, { recursive: true });
    const require = createRequire(import.meta.url);
    // Resolved at call time, not module load — a missing builtin on Node <22.5
    // is a caught exception here rather than a fatal import error.
    const sqlite = require('node:sqlite') as {
      DatabaseSync: new (path: string) => SqliteDb;
    };
    const db = new sqlite.DatabaseSync(join(dataDir, 'state.db'));
    db.exec(DDL);
    return new SqliteStore(db);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[store] SQLite unavailable (${msg}); using in-memory store — ` +
        'cache and change-history will not persist between sessions.',
    );
    return new MemoryStore();
  }
}
