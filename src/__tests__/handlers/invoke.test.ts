import { describe, it, expect } from 'vitest';
import { cachedInvoke, mapLimit, settle } from '../../handlers/_invoke.js';
import { MemoryStore, Store } from '../../store.js';
import type { ToolContext } from '../../types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeCtx(
  callTool: ToolContext['callTool'],
  store: Store = new MemoryStore(),
): ToolContext {
  return { client: undefined as never, store, callTool };
}

describe('mapLimit', () => {
  it('never exceeds the concurrency bound and preserves result order', async () => {
    let live = 0;
    let maxLive = 0;
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const results = await mapLimit(items, 3, async (item, index) => {
      live++;
      maxLive = Math.max(maxLive, live);
      // Later items finish sooner — order must still follow the input.
      await sleep((items.length - index) * 2);
      live--;
      return item * 10;
    });
    expect(maxLive).toBeLessThanOrEqual(3);
    expect(maxLive).toBeGreaterThan(1); // it actually ran in parallel
    expect(results).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('handles an empty array', async () => {
    let calls = 0;
    const results = await mapLimit([], 4, async () => {
      calls++;
      return 1;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe('cachedInvoke', () => {
  it('serves a second identical call from cache — stub fires exactly once', async () => {
    let calls = 0;
    const ctx = makeCtx(async () => {
      calls++;
      return { summary: 'fresh' };
    });

    const first = await cachedInvoke(ctx, 'feed_cache_hit', { a: 1 }, 60);
    expect(first.ok).toBe(true);
    expect(first.cached).toBeUndefined();
    expect(first.data).toEqual({ summary: 'fresh' });

    const second = await cachedInvoke(ctx, 'feed_cache_hit', { a: 1 }, 60);
    expect(second.ok).toBe(true);
    expect(second.cached).toBe(true);
    expect(second.data).toEqual({ summary: 'fresh' });
    expect(calls).toBe(1);
  });

  it('usable predicate rejects fallback payloads without poisoning the cache', async () => {
    let calls = 0;
    let payload: Record<string, unknown> = { message: 'unavailable' };
    const ctx = makeCtx(async () => {
      calls++;
      return payload;
    });
    const usable = (d: { summary?: string }) => !!d.summary;

    const bad = await cachedInvoke(ctx, 'feed_usable', {}, 60, { usable });
    expect(bad.ok).toBe(false);
    expect(bad.cached).toBeUndefined();
    expect(bad.error).toMatch(/no usable data/);

    // The unusable result was NOT cached — the retry reaches the stub and
    // returns the now-good payload.
    payload = { summary: 'recovered' };
    const good = await cachedInvoke(ctx, 'feed_usable', {}, 60, { usable });
    expect(good.ok).toBe(true);
    expect(good.cached).toBeUndefined();
    expect(good.data).toEqual({ summary: 'recovered' });
    expect(calls).toBe(2);
  });

  it('coalesces identical in-flight calls onto one upstream fetch', async () => {
    let calls = 0;
    const ctx = makeCtx(async () => {
      calls++;
      await sleep(50);
      return { summary: 'shared' };
    });

    const [a, b] = await Promise.all([
      cachedInvoke(ctx, 'feed_inflight', { t: 'X' }, 60),
      cachedInvoke(ctx, 'feed_inflight', { t: 'X' }, 60),
    ]);
    expect(calls).toBe(1);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.data).toEqual({ summary: 'shared' });
    expect(b.data).toEqual({ summary: 'shared' });
  });

  it('tolerates a store whose cacheGet/cacheSet throw', async () => {
    const brokenStore = {
      cacheGet(): never {
        throw new Error('store exploded on read');
      },
      cacheSet(): never {
        throw new Error('store exploded on write');
      },
    } as unknown as Store;
    const ctx = makeCtx(async () => ({ summary: 'still works' }), brokenStore);

    const res = await cachedInvoke(ctx, 'feed_broken_store', {}, 60);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ summary: 'still works' });
  });
});

describe('settle', () => {
  it('truncates huge upstream error messages', async () => {
    const ctx = makeCtx(async () => {
      throw new Error('x'.repeat(10_000));
    });

    const res = await settle(ctx, 'feed_huge_error');
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.length).toBeLessThanOrEqual(320);
    expect(res.error!.endsWith('[truncated]')).toBe(true);
  });
});
