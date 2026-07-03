/**
 * Shared SEC access layer — one User-Agent, one global rate limiter.
 *
 * SEC requires an EMAIL-shaped User-Agent (URL-style UAs get 403'd) and
 * throttles above ~10 req/s per IP. Every SEC fetch in this codebase goes
 * through secFetchJson/secFetchText so concurrent fan-out (e.g.
 * scan_convergence × get_insider_activity Form-4 XML pulls) shares ONE
 * budget instead of each call site rolling its own.
 *
 * The UA is resolved lazily (not at module load) so dotenv timing and
 * empty-string env values ('SEC_USER_AGENT=' from a copied .env.example)
 * can't produce a blank UA.
 */

import { fetchJson, fetchText, FetchOptions } from './_http.js';
import { envStr } from '../config.js';

const DEFAULT_SEC_UA = 'worldmonitor-mcp/1.0 (admin@worldmonitor.app)';

export function secUserAgent(): string {
  return envStr('SEC_USER_AGENT') ?? DEFAULT_SEC_UA;
}

export function secHeaders(): Record<string, string> {
  return { 'User-Agent': secUserAgent() };
}

// ---------------------------------------------------------------------------
// Global limiter: max N in flight + minimum spacing between request starts.
// 3 concurrent × ~150ms spacing ≈ 6-7 req/s worst case — inside SEC's budget
// even when several composites fan out at once.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3;
const MIN_SPACING_MS = 150;

let inFlight = 0;
let lastStart = 0;
const waiters: Array<() => void> = [];

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquire(): Promise<void> {
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inFlight++;
  const now = Date.now();
  const wait = lastStart + MIN_SPACING_MS - now;
  lastStart = Math.max(now, lastStart + MIN_SPACING_MS);
  if (wait > 0) await delay(wait);
}

function release(): void {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

export function secFetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  return limited(() =>
    fetchJson<T>(url, { ...opts, headers: { ...secHeaders(), ...opts.headers } }),
  );
}

export function secFetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return limited(() =>
    fetchText(url, { ...opts, headers: { ...secHeaders(), ...opts.headers } }),
  );
}
