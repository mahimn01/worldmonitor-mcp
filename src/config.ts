/**
 * Configuration loading — reads from environment variables and .env files.
 *
 * Empty-string env values are treated as UNSET: `cp .env.example .env` leaves
 * bare `KEY=` lines, which dotenv injects as '' — those must fall through to
 * defaults, not silently disable SQLite / SEC requests.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { ClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://worldmonitor.app';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_DATA_DIR = join(homedir(), '.cache', 'worldmonitor');
const DEFAULT_WATCHLIST = ['SPY', 'QQQ', '^VIX'];
const DEFAULT_CACHE_TTL = 900; // 15 minutes

/** Read an env var, treating empty/whitespace-only values as unset. */
export function envStr(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function envInt(name: string): number | undefined {
  const v = envStr(name);
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Resolve the watchlist with precedence: WORLDMONITOR_WATCHLIST (csv) →
 * <dataDir>/watchlist.json ({ "symbols": [...] }) → built-in default.
 */
function resolveWatchlist(dataDir: string): {
  watchlist: string[];
  source: 'env' | 'file' | 'default';
} {
  const env = envStr('WORLDMONITOR_WATCHLIST');
  if (env) {
    const symbols = env
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length) return { watchlist: symbols, source: 'env' };
  }
  try {
    const raw = readFileSync(join(dataDir, 'watchlist.json'), 'utf8');
    const parsed = JSON.parse(raw) as { symbols?: unknown };
    if (Array.isArray(parsed.symbols)) {
      const symbols = parsed.symbols
        .map((s) => String(s).trim().toUpperCase())
        .filter(Boolean);
      if (symbols.length) return { watchlist: symbols, source: 'file' };
    }
  } catch {
    // No file or invalid — fall through to default.
  }
  return { watchlist: DEFAULT_WATCHLIST, source: 'default' };
}

export function loadConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  const dataDir =
    overrides?.dataDir ?? envStr('WORLDMONITOR_DATA_DIR') ?? DEFAULT_DATA_DIR;
  const resolved = resolveWatchlist(dataDir);
  return {
    baseUrl:
      overrides?.baseUrl ?? envStr('WORLDMONITOR_BASE_URL') ?? DEFAULT_BASE_URL,
    apiKey: overrides?.apiKey ?? envStr('WORLDMONITOR_API_KEY'),
    timeout: overrides?.timeout ?? envInt('WORLDMONITOR_TIMEOUT') ?? DEFAULT_TIMEOUT,
    dataDir,
    watchlist: overrides?.watchlist ?? resolved.watchlist,
    watchlistSource: overrides?.watchlist ? 'override' : resolved.source,
    cacheTtlSeconds:
      overrides?.cacheTtlSeconds ??
      envInt('WORLDMONITOR_CACHE_TTL') ??
      DEFAULT_CACHE_TTL,
  };
}
