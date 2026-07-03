/**
 * Internal dispatcher + concurrency/caching helpers for composite tools.
 *
 * Composite handlers compose other tools through a shared ToolContext. The
 * context's `callTool` is the single routing primitive (direct handler → else
 * proxy via the client with retry OFF, so fan-out can't amplify load). When a
 * handler is invoked outside the MCP server (e.g. via the CLI) and no context
 * is supplied, a lazily-built default context is used so composites still work.
 */

import { WorldMonitorClient } from '../client.js';
import { loadConfig } from '../config.js';
import { findTool } from '../services/index.js';
import { openStore, Store } from '../store.js';
import { KNOWN_BROKEN } from '../known-broken.js';
import type { ApiError, ApiResponse, ClientConfig, ToolContext } from '../types.js';
import { directHandlers } from './index.js';

/** Build a full ToolContext. Reused by the MCP server (passing its store). */
export function createContext(store?: Store, config?: ClientConfig): ToolContext {
  const cfg = config ?? loadConfig();
  const client = new WorldMonitorClient(cfg);
  const st = store ?? openStore(cfg.dataDir);
  const ctx: ToolContext = {
    client,
    store: st,
    config: cfg,
    async callTool(name, params = {}) {
      const broken = KNOWN_BROKEN[name];
      if (broken) throw new Error(broken);
      // Reference directHandlers at call time (avoids ESM init-order issues).
      const direct = directHandlers[name];
      if (direct) return direct(params, ctx);
      const def = findTool(name);
      if (!def) throw new Error(`Unknown tool: ${name}`);
      const res = await client.call(
        def.fullEndpoint,
        Object.keys(params).length ? params : undefined,
        def.method ?? 'GET',
        { retries: 0 },
      );
      if (!res.ok) throw new Error((res as ApiError).message);
      return (res as ApiResponse).data;
    },
  };
  return ctx;
}

let _defaultCtx: ToolContext | undefined;

/** Return the supplied context, or a process-wide default (CLI/standalone). */
export function ensureContext(ctx?: ToolContext): ToolContext {
  if (ctx) return ctx;
  if (!_defaultCtx) _defaultCtx = createContext();
  return _defaultCtx;
}

export interface FeedResult<T = unknown> {
  name: string;
  ok: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

/** Bound upstream error text so a proxied HTML error page can't flood output. */
function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? 'unknown');
  return msg.length > 300 ? `${msg.slice(0, 300)}… [truncated]` : msg;
}

/** Invoke a tool without ever throwing — one bad feed can't fail a composite. */
export async function settle<T = unknown>(
  ctx: ToolContext,
  name: string,
  params: Record<string, unknown> = {},
): Promise<FeedResult<T>> {
  try {
    return { name, ok: true, data: (await ctx.callTool(name, params)) as T };
  } catch (e) {
    return { name, ok: false, error: shortError(e) };
  }
}

function stableKey(params: Record<string, unknown>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${JSON.stringify(params[k])}`).join('&');
}

export interface CachedInvokeOpts<T> {
  /**
   * Usability predicate. Many handlers signal failure by RETURNING a fallback
   * payload ({message: 'unavailable…'}) instead of throwing — without this
   * check those would count as coverage and get cached for the full TTL.
   * Unusable results are reported ok:false and never cached.
   */
  usable?: (data: T) => boolean;
}

// In-flight coalescing: identical concurrent feed calls share one promise
// (a cold scan_convergence would otherwise fire duplicate upstream fetches
// before the first response lands in the cache).
const inFlight = new Map<string, Promise<FeedResult<unknown>>>();

/**
 * Failed/unusable feed results are NEVER cached as data, but they ARE
 * negative-cached briefly so repeated composite calls don't hammer a dead or
 * rate-limited upstream on every invocation. The cached failure is served as
 * ok:false with cached:true — honest, short-lived, and self-healing.
 */
const NEGATIVE_TTL_SECONDS = 45;

/** settle() with a TTL cache + usability check layered on top via ctx.store. */
export async function cachedInvoke<T = unknown>(
  ctx: ToolContext,
  name: string,
  params: Record<string, unknown>,
  ttlSeconds: number,
  opts: CachedInvokeOpts<T> = {},
): Promise<FeedResult<T>> {
  const key = `feed:${name}:${stableKey(params)}`;
  const negKey = `feedfail:${name}:${stableKey(params)}`;
  try {
    const hit = ctx.store.cacheGet(key);
    if (hit) return { name, ok: true, data: hit.value as T, cached: true };
    const neg = ctx.store.cacheGet(negKey);
    if (neg) {
      return {
        name,
        ok: false,
        error: String((neg.value as { error?: unknown })?.error ?? 'recent feed failure'),
        cached: true,
      };
    }
  } catch {
    // Store is best-effort — a broken store must not fail the feed.
  }

  const existing = inFlight.get(key);
  if (existing) return (await existing) as FeedResult<T>;

  const run = (async (): Promise<FeedResult<T>> => {
    const res = await settle<T>(ctx, name, params);
    let out: FeedResult<T> = res;
    if (res.ok && opts.usable && !opts.usable(res.data as T)) {
      out = {
        name,
        ok: false,
        error: 'feed returned no usable data (fallback/unavailable payload)',
      };
    }
    try {
      if (out.ok) {
        ctx.store.cacheSet(key, out.data, ttlSeconds);
      } else {
        ctx.store.cacheSet(negKey, { error: out.error }, NEGATIVE_TTL_SECONDS);
      }
    } catch {
      // best-effort
    }
    return out;
  })();

  inFlight.set(key, run as Promise<FeedResult<unknown>>);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

/** Concurrency-limited map — bounds fan-out so we don't trip upstream rate limits. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
