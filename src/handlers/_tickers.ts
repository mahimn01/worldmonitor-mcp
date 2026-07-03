/**
 * Ticker → CIK resolver, backed by SEC's company_tickers.json.
 *
 * The SEC map uses DASH format for share classes (BRK-B, BF-B, LEN-B, ~545
 * hyphenated tickers) — hyphens are legitimate and resolvable. Dots are
 * normalized to dashes (users type BRK.B). Indices (^VIX) and futures (GC=F)
 * never have an issuer CIK → null.
 *
 * Failure semantics: an UNKNOWN symbol resolves to null; a FAILED map fetch
 * THROWS — callers must distinguish "no issuer" from "couldn't check" so a
 * transient SEC outage isn't reported as "this is an ETF/index".
 *
 * The ~800KB map changes daily → cached 24h (store + session memory, expiry
 * anchored to the store's fetchedAt so restarts don't compound staleness).
 */

import { secFetchJson } from './_sec.js';
import type { ToolContext } from '../types.js';

const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const TTL_SECONDS = 24 * 60 * 60;
const CACHE_KEY = 'sec:company_tickers';

interface SecTickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

export interface CikInfo {
  cik: string; // 10-digit zero-padded
  title: string;
}

let memMap: Map<string, CikInfo> | undefined;
let memExpiresSec = 0;
// Cold-start coalescing: concurrent resolvers share one ~800KB map download
// instead of each occupying a SEC limiter slot with a duplicate fetch.
let loading: Promise<Map<string, CikInfo>> | undefined;

function padCik(n: number | string): string {
  return String(n).replace(/^0+/, '').padStart(10, '0');
}

function buildMap(raw: Record<string, SecTickerRow>): Record<string, CikInfo> {
  const obj: Record<string, CikInfo> = {};
  for (const row of Object.values(raw)) {
    if (!row?.ticker) continue;
    obj[row.ticker.toUpperCase()] = { cik: padCik(row.cik_str), title: row.title };
  }
  return obj;
}

async function loadMap(ctx: ToolContext): Promise<Map<string, CikInfo>> {
  const now = Math.floor(Date.now() / 1000);
  if (memMap && now < memExpiresSec) return memMap;
  if (loading) return loading;

  loading = (async () => {
    let cached: { value: unknown; fetchedAt: number } | null = null;
    try {
      cached = ctx.store.cacheGet(CACHE_KEY);
    } catch {
      // store is best-effort
    }
    if (cached) {
      const map = new Map(Object.entries(cached.value as Record<string, CikInfo>));
      // Anchor session expiry to when the map was actually FETCHED, not now —
      // otherwise store-hit + memory TTL compounds staleness to ~48h.
      const expires = cached.fetchedAt + TTL_SECONDS;
      if (now < expires) {
        memMap = map;
        memExpiresSec = expires;
        return map;
      }
    }

    const raw = await secFetchJson<Record<string, SecTickerRow>>(SEC_TICKERS_URL);
    const obj = buildMap(raw);
    try {
      ctx.store.cacheSet(CACHE_KEY, obj, TTL_SECONDS);
    } catch {
      // store is best-effort
    }
    memMap = new Map(Object.entries(obj));
    memExpiresSec = now + TTL_SECONDS;
    return memMap;
  })();

  try {
    return await loading;
  } finally {
    loading = undefined;
  }
}

/**
 * Resolve a ticker to its issuer CIK.
 * Returns null for symbols with no issuer (indices, futures, crypto pairs,
 * unknown tickers). THROWS if the SEC ticker map cannot be loaded.
 */
export async function resolveCik(
  ctx: ToolContext,
  symbol: string,
): Promise<CikInfo | null> {
  const sym = symbol.trim().toUpperCase();
  // Indices (^GSPC) and futures/FX (GC=F) never have an issuer CIK. Dashes are
  // NOT excluded — SEC lists share classes as BRK-B/BF-B.
  if (!sym || sym.startsWith('^') || sym.includes('=')) return null;
  const map = await loadMap(ctx);
  // Exact match first, then dot→dash (BRK.B → BRK-B, SEC's format).
  return map.get(sym) ?? map.get(sym.replace(/\./g, '-')) ?? null;
}
