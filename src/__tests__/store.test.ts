import { describe, it, expect, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { openStore, MemoryStore, Store } from '../store.js';

const createdDirs: string[] = [];

function freshSqliteDir(): string {
  const dir = join(
    tmpdir(),
    `wmtest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  );
  createdDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const nowSec = () => Math.floor(Date.now() / 1000);

function runStoreContract(name: string, make: () => Store) {
  describe(`Store contract: ${name}`, () => {
    it('cache round-trips a value with fetchedAt', () => {
      const s = make();
      s.cacheSet('k', { v: 42 }, 60);
      const hit = s.cacheGet('k');
      expect(hit).not.toBeNull();
      expect(hit!.value).toEqual({ v: 42 });
      // fetchedAt must be a real past-or-present unix-seconds stamp, never a
      // future one (memory/sqlite parity — memory used to stamp the future).
      expect(hit!.fetchedAt).toBeGreaterThan(0);
      expect(hit!.fetchedAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
      s.close();
    });

    it('cache honors TTL', () => {
      const s = make();
      s.cacheSet('k', 1, 0); // expires immediately
      expect(s.cacheGet('k')).toBeNull();
      expect(s.cacheGet('missing')).toBeNull();
      s.close();
    });

    it('snapshotPut returns new / unchanged / changed', () => {
      const s = make();
      const ts = nowSec();
      expect(s.snapshotPut('congress', 'e1', 'h1', '{"a":1}', ts)).toBe('new');
      expect(s.snapshotPut('congress', 'e1', 'h1', '{"a":1}', ts)).toBe('unchanged');
      expect(s.snapshotPut('congress', 'e1', 'h2', '{"a":2}', ts + 1)).toBe('changed');
      s.close();
    });

    it('getChangesSince returns rows after the cutoff, newest first, deduped', () => {
      const s = make();
      const base = nowSec();
      s.snapshotPut('insider', 'a', 'h1', '{"x":1}', base + 1);
      s.snapshotPut('insider', 'b', 'h1', '{"x":2}', base + 2);
      s.snapshotPut('insider', 'a', 'h2', '{"x":3}', base + 3); // a changed

      const all = s.getChangesSince('insider', base);
      expect(all.length).toBe(2); // a (latest) + b
      expect(all[0].entity).toBe('a'); // newest first
      expect(all[0].change).toBe('changed');
      expect(all[0].payload).toEqual({ x: 3 });

      const none = s.getChangesSince('insider', base + 100);
      expect(none.length).toBe(0);
      s.close();
    });

    it('dedupes same-second writes to the LATEST write', () => {
      const s = make();
      const ts = nowSec();
      s.snapshotPut('cot', 'e1', 'h1', '{"v":1}', ts);
      s.snapshotPut('cot', 'e1', 'h2', '{"v":2}', ts); // same ts, new hash

      const rows = s.getChangesSince('cot', ts - 1);
      expect(rows.length).toBe(1);
      expect(rows[0].entity).toBe('e1');
      expect(rows[0].hash).toBe('h2');
      expect(rows[0].payload).toEqual({ v: 2 });
      s.close();
    });

    it('pruneExpired drops history older than 30 days but keeps fresh rows', () => {
      const s = make();
      const now = nowSec();
      s.snapshotPut('etf', 'old', 'h1', '{"v":"old"}', now - 31 * 86_400);
      s.snapshotPut('etf', 'fresh', 'h2', '{"v":"fresh"}', now);

      const before = s.getChangesSince('etf', 0).map((r) => r.entity);
      expect(before).toContain('old');
      expect(before).toContain('fresh');

      s.pruneExpired();

      const after = s.getChangesSince('etf', 0).map((r) => r.entity);
      expect(after).not.toContain('old');
      expect(after).toContain('fresh');
      s.close();
    });
  });
}

runStoreContract('memory', () => new MemoryStore());

// SQLite leg — skipped automatically when node:sqlite is unavailable.
const sqliteStore = openStore(freshSqliteDir());
const sqliteAvailable = sqliteStore.backend === 'sqlite';
sqliteStore.close();
if (sqliteAvailable) {
  runStoreContract('sqlite', () => openStore(freshSqliteDir()));
} else {
  describe.skip('Store contract: sqlite (node:sqlite unavailable)', () => {
    it('skipped', () => {});
  });
}

describe('openStore', () => {
  it('never throws and reports a valid backend', () => {
    const s = openStore(freshSqliteDir());
    expect(['sqlite', 'memory']).toContain(s.backend);
    s.close();
  });
});
