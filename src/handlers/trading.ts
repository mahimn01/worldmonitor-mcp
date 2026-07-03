/**
 * Composite trading-intelligence handlers.
 *
 * Each tool fans out to existing feeds (concurrency-limited + cached, retry-off),
 * fuses them into a transparent score with a factor breakdown + coverage, and
 * never throws on partial feed failure. Read-only; informational, not advice.
 *
 * Coverage semantics (deliberate):
 *  - A feed that FAILED or returned an unusable fallback payload → no factor,
 *    coverage ok:false, lowers confidence.
 *  - A feed that succeeded but shows NO notable activity → an explicit
 *    zero-intensity factor ("covered but quiet") — counts toward confidence,
 *    dilutes the score. Quiet ≠ unknown.
 */

import { createHash } from 'node:crypto';
import type { DirectHandler, ToolContext } from '../types.js';
import { loadConfig } from '../config.js';
import { compactJson, rankAndTruncate } from '../format.js';
import {
  WEIGHTS,
  BUZZ_INTENSITY,
  clamp,
  makeFactor,
  aggregate,
  usdIntensity,
  INSIDER_SELL_DISCOUNT,
  Factor,
  DISCLAIMER,
} from './_scoring.js';
import { cachedInvoke, ensureContext, mapLimit, settle, FeedResult } from './_invoke.js';
import { resolveCik } from './_tickers.js';
import { extractTicker } from './congress.js';

const MAX_CANDIDATES = 15;
const FANOUT = 4;
const nowIso = () => new Date().toISOString();
const nowSec = () => Math.floor(Date.now() / 1000);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function coverageOf(feeds: FeedResult[]): Array<{ name: string; ok: boolean; error?: string }> {
  return feeds.map((f) => ({ name: f.name, ok: f.ok, ...(f.error ? { error: f.error } : {}) }));
}

// ---------------------------------------------------------------------------
// Congress / earnings helpers (data is messy → all defensive)
// ---------------------------------------------------------------------------

/** Generic first-words of company titles that would false-positive as name matches. */
const TITLE_STOPWORDS = new Set([
  'FIRST', 'UNITED', 'AMERICAN', 'NATIONAL', 'GLOBAL', 'INTERNATIONAL',
  'GENERAL', 'STANDARD', 'FEDERAL', 'PACIFIC', 'CONTINENTAL', 'THE', 'NEW',
]);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function tradeTicker(trade: Any): string | null {
  if (trade?.ticker) return String(trade.ticker).toUpperCase();
  // Single source of truth for the ":US" tag grammar lives in congress.ts.
  return extractTicker(String(trade?.issuer ?? '').toUpperCase());
}

export function matchesTicker(trade: Any, symbol: string, title?: string): boolean {
  const sym = symbol.toUpperCase();
  // A ticker on the trade (parsed :US tag) is authoritative — match on it only.
  const tk = tradeTicker(trade);
  if (tk) return tk === sym;
  const issuer = String(trade?.issuer ?? '').toUpperCase();
  if (!issuer) return false;
  // Heuristics only when the trade carries no ticker at all:
  // word-boundary symbol match, ≥4 chars (short tickers like T/F/GM match everything).
  if (sym.length >= 4 && new RegExp(`\\b${escapeRe(sym)}\\b`).test(issuer)) return true;
  if (title) {
    const token = title.toUpperCase().split(/[\s,.]+/)[0];
    if (
      token &&
      token.length >= 5 &&
      !TITLE_STOPWORDS.has(token) &&
      new RegExp(`\\b${escapeRe(token)}\\b`).test(issuer)
    ) {
      return true;
    }
  }
  return false;
}

function netCongress(trades: Any[]): number {
  let net = 0;
  for (const t of trades) {
    const type = String(t?.type ?? '').toLowerCase();
    if (/buy|purchase/.test(type)) net += 1;
    else if (/sell|sale/.test(type)) net -= 1;
  }
  return net;
}

function normalizeEarnings(data: Any): Any[] {
  if (Array.isArray(data)) return data;
  return data?.earningsCalendar ?? data?.releases ?? data?.earnings ?? [];
}

function earningsDaysUntil(data: Any, symbol: string, now: number): number | null {
  const rows = normalizeEarnings(data);
  let best: number | null = null;
  for (const r of rows) {
    if (r?.symbol && String(r.symbol).toUpperCase() !== symbol.toUpperCase()) continue;
    const d = r?.reportDate ?? r?.date ?? r?.releaseDate;
    const t = d ? Date.parse(d) : NaN;
    if (Number.isNaN(t)) continue;
    const days = (t - now) / 86_400_000;
    if (days >= 0 && (best === null || days < best)) best = days;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Usability predicates — handlers often signal failure by RETURNING fallback
// payloads; these decide what counts as a real feed result.
// ---------------------------------------------------------------------------

const USABLE = {
  quote: (d: Any) =>
    Array.isArray(d?.quotes) && d.quotes.length > 0 && typeof d.quotes[0]?.change === 'number',
  options: (d: Any) => !!d?.summary,
  social: (d: Any) => !!d?.summary,
  earnings: (d: Any) => Array.isArray(normalizeEarnings(d)),
  congress: (d: Any) => Array.isArray(d?.trades) && d.trades.length > 0,
  insider: (d: Any) => !!d?.open_market,
  energyPrices: (d: Any) => Array.isArray(d?.prices) && d.prices.length > 0,
  commodityQuotes: (d: Any) => Array.isArray(d?.quotes) && d.quotes.length > 0,
  navWarnings: (d: Any) => Array.isArray(d?.warnings),
  theaters: (d: Any) => Array.isArray(d?.theaters) && d.theaters.length > 0,
  gdelt: (d: Any) => Array.isArray(d?.articles ?? d?.results),
  vessels: (d: Any) => d?.snapshot != null,
  acled: (d: Any) => Array.isArray(d?.events),
};

// ---------------------------------------------------------------------------
// get_ticker_intel
// ---------------------------------------------------------------------------

const getTickerIntel: DirectHandler = async (params, ctxArg) => {
  const ctx = ensureContext(ctxArg);
  const symbol = String(params.symbol ?? '').toUpperCase();
  if (!symbol) return { error: true, message: 'symbol is required' };
  const full = params.verbosity === 'full';

  // CIK resolution: distinguish "no issuer" (definitive) from "couldn't check".
  let cikInfo: { cik: string; title: string } | null = null;
  let cikLookupError: string | null = null;
  try {
    cikInfo = await resolveCik(ctx, symbol);
  } catch (e) {
    cikLookupError = e instanceof Error ? e.message : 'unknown';
  }

  const [quoteF, optionsF, socialF, earningsF, congressF, insiderF] = await Promise.all([
    cachedInvoke(ctx, 'list_market_quotes', { symbols: [symbol] }, 30, { usable: USABLE.quote }),
    cachedInvoke(ctx, 'get_options_flow', { symbol }, 60, { usable: USABLE.options }),
    cachedInvoke(ctx, 'get_social_sentiment', { symbol }, 300, { usable: USABLE.social }),
    cachedInvoke(ctx, 'get_earnings_calendar', { symbol, days: 30 }, 3600, { usable: USABLE.earnings }),
    // NO ticker param: the scrape can't filter server-side and a per-symbol
    // param would shard the cache into one scrape per ticker. Fetch the shared
    // recent list once, filter locally.
    cachedInvoke(ctx, 'list_congress_trades', { limit: 50 }, 600, { usable: USABLE.congress }),
    cikInfo
      ? cachedInvoke(ctx, 'get_insider_activity', { cik: cikInfo.cik, window_days: 90 }, 600, {
          usable: USABLE.insider,
        })
      : Promise.resolve<FeedResult>({
          name: 'get_insider_activity',
          ok: false,
          error: cikLookupError
            ? `CIK resolution unavailable (SEC fetch failed): ${cikLookupError}`
            : 'no issuer CIK (ETF/index/crypto)',
        }),
  ]);

  const W = WEIGHTS.ticker;
  const totalWeight = Object.values(W).reduce((a, b) => a + b, 0);
  const factors: Factor[] = [];
  const now = Date.now();

  // price momentum — usability guarantees quotes[0].change is a number
  if (quoteF.ok) {
    const pct = (quoteF.data as Any).quotes[0].change as number;
    factors.push(
      makeFactor('price_momentum', 'price momentum (intraday % change)', clamp(pct / 3), Math.abs(pct) / 3, W.price_momentum),
    );
  }

  // options P/C — put-only chains are max-bearish, zero-volume chains are quiet
  if (optionsF.ok) {
    const os = (optionsF.data as Any).summary;
    const callVol = os?.call_volume ?? 0;
    const putVol = os?.put_volume ?? 0;
    const total = callVol + putVol;
    if (total === 0) {
      factors.push(makeFactor('options_pc', 'options: no volume today (covered, quiet)', 0, 0, W.options_pc));
    } else {
      const turnover = total / ((os.call_open_interest + os.put_open_interest) || 1);
      const signal =
        callVol === 0
          ? -1 // all-put flow: ratio undefined, direction unambiguous
          : clamp((0.9 - putVol / callVol) / 0.6);
      factors.push(
        makeFactor('options_pc', 'options put/call ratio (delayed, CBOE)', signal, turnover / 0.5, W.options_pc),
      );
    }
  }

  // insider net — log-scaled $, sells discounted (routine 10b5-1 flow)
  if (insiderF.ok) {
    const im = (insiderF.data as Any).open_market;
    const activity = (im?.buy_count ?? 0) + (im?.sell_count ?? 0);
    if (activity === 0) {
      factors.push(
        makeFactor('insider_net', 'insider: no open-market Form-4 activity in window (covered, quiet)', 0, 0, W.insider_net),
      );
    } else {
      const netUsd = im.net_buy_usd ?? 0;
      const sign = Math.sign(netUsd || im.net_buy_shares || 0);
      const intensity = usdIntensity(netUsd) * (sign < 0 ? INSIDER_SELL_DISCOUNT : 1);
      factors.push(
        makeFactor('insider_net', 'insider net open-market $ (parsed Form 4; sells discounted)', sign, intensity, W.insider_net),
      );
    }
  }

  // congress net — trades carry parsed :US tickers; heuristics are fallback-only
  const trades = (congressF.ok && (congressF.data as Any)?.trades) || [];
  if (congressF.ok) {
    const tickerTrades = trades.filter((t: Any) => matchesTicker(t, symbol, cikInfo?.title));
    if (tickerTrades.length === 0) {
      factors.push(
        makeFactor('congress_net', 'congress: no trades in this name (covered, quiet)', 0, 0, W.congress_net),
      );
    } else {
      const net = netCongress(tickerTrades);
      factors.push(
        makeFactor('congress_net', 'congressional net trades', Math.sign(net), Math.abs(net) / 3, W.congress_net),
      );
    }
  }

  // social buzz — magnitude only, never directional
  if (socialF.ok) {
    const ss = (socialF.data as Any).summary;
    const intensity = (ss?.post_count ?? 0) === 0 ? 0 : (BUZZ_INTENSITY[ss.buzz_level] ?? 0);
    factors.push(
      makeFactor('social_buzz', 'social buzz volume (r/wallstreetbets, magnitude only)', 0, intensity, W.social_buzz),
    );
  }

  // earnings proximity — magnitude only
  if (earningsF.ok) {
    const eDays = earningsDaysUntil(earningsF.data, symbol, now);
    if (eDays !== null && eDays >= 0 && eDays <= 14) {
      factors.push(
        makeFactor('earnings_catalyst', `earnings in ~${Math.round(eDays)}d (magnitude only)`, 0, (14 - eDays) / 14, W.earnings_catalyst),
      );
    } else {
      factors.push(
        makeFactor('earnings_catalyst', 'earnings: none within 14d (covered, quiet)', 0, 0, W.earnings_catalyst),
      );
    }
  }

  factors.sort((a, b) => b.contribution - a.contribution);
  const agg = aggregate(factors, totalWeight);

  // Snapshot side-effects so the change-log fills over time (scoped feeds).
  if (trades.length) recordFeed(ctx, 'congress', 'congress', trades);
  const optContracts = optionsF.ok ? (optionsF.data as Any)?.top_by_volume : null;
  if (Array.isArray(optContracts)) {
    recordFeed(ctx, 'options', `options:${symbol}`, optContracts);
  }

  return {
    symbol,
    generated_at: nowIso(),
    conviction_score: agg.score,
    direction: agg.direction,
    direction_score: agg.direction_score,
    confidence: agg.confidence,
    factors,
    coverage: coverageOf([quoteF, optionsF, socialF, earningsF, congressF, insiderF]),
    disclaimer: DISCLAIMER,
    ...(full
      ? {
          components: {
            cik: cikInfo?.cik ?? null,
            quote: quoteF.ok ? (quoteF.data as Any).quotes[0] : null,
            options: optionsF.data ?? null,
            social: socialF.data ?? null,
            insider: insiderF.data ?? null,
            congress_for_ticker: trades.filter((t: Any) => matchesTicker(t, symbol, cikInfo?.title)),
            earnings_days: earningsF.ok ? earningsDaysUntil(earningsF.data, symbol, now) : null,
          },
        }
      : {}),
  };
};

// ---------------------------------------------------------------------------
// scan_convergence — reuses get_ticker_intel per candidate (cached fan-out)
// ---------------------------------------------------------------------------

const DIRECTIONAL_FAMILIES = ['price_momentum', 'options_pc', 'insider_net', 'congress_net'];

const scanConvergence: DirectHandler = async (params, ctxArg) => {
  const ctx = ensureContext(ctxArg);
  const minScore = typeof params.min_score === 'number' ? params.min_score : 40;
  const full = params.verbosity === 'full';

  let symbols = (params.symbols as string[] | undefined)?.map((s) => s.toUpperCase());
  let universeSource: string;
  if (!symbols || !symbols.length) {
    const congressF = await cachedInvoke(ctx, 'list_congress_trades', { limit: 50 }, 600, {
      usable: USABLE.congress,
    });
    const congressTrades = (congressF.ok && (congressF.data as Any)?.trades) || [];
    const fromCongress = Array.from(
      new Set(
        congressTrades
          .map((t: Any) => tradeTicker(t))
          .filter((x: string | null): x is string => !!x),
      ),
    ) as string[];
    // Honor the context's resolved config (injected watchlists/overrides);
    // fall back to env only when the context carries none.
    const watchlist = (ctx.config ?? loadConfig()).watchlist;
    // Indices/futures can never converge (no CIK, no congress, no CBOE chain) —
    // filter the WHOLE merged universe, not just the congress half.
    symbols = Array.from(new Set([...fromCongress, ...watchlist]))
      .filter((s) => !s.startsWith('^') && !s.includes('='))
      .slice(0, MAX_CANDIDATES);
    universeSource = `congress tickers (${fromCongress.length} resolved) ∪ watchlist (${watchlist.length})`;
  } else {
    symbols = Array.from(new Set(symbols)).slice(0, MAX_CANDIDATES);
    universeSource = 'caller-provided';
  }

  const briefs = await mapLimit(symbols, FANOUT, (sym) =>
    settle<Any>(ctx, 'get_ticker_intel', { symbol: sym }),
  );

  const results = briefs
    .map((b, i) => {
      const symbol = symbols![i];
      if (!b.ok || !b.data) return null;
      const factors: Factor[] = b.data.factors ?? [];
      const votes: Record<string, number> = {};
      let bull = 0;
      let bear = 0;
      for (const fam of DIRECTIONAL_FAMILIES) {
        const f = factors.find((x) => x.key === fam);
        // A vote needs direction AND substance — zero-intensity (quiet) factors don't vote.
        const vote =
          f && Math.abs(f.signal) >= 0.15 && f.intensity > 0 ? Math.sign(f.signal) : 0;
        votes[fam] = vote;
        if (vote > 0) bull += 1;
        else if (vote < 0) bear += 1;
      }
      const aligned = Math.max(bull, bear);
      const conflicted = Math.min(bull, bear) > 0;
      // NET alignment: opposing votes cancel — 2 bull vs 2 bear is a conflict,
      // not a convergence.
      const score = Math.round(((aligned - Math.min(bull, bear)) / DIRECTIONAL_FAMILIES.length) * 100);
      const net_direction = bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'mixed';
      return {
        symbol,
        convergence_score: score,
        net_direction,
        aligned_count: aligned,
        conflicted,
        votes,
        ...(full ? { factors } : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.convergence_score >= minScore);

  const ranked = rankAndTruncate(results, (r) => r.convergence_score, MAX_CANDIDATES, 60_000);

  return {
    generated_at: nowIso(),
    universe_source: universeSource,
    candidate_count: symbols.length,
    min_score: minScore,
    results: ranked.kept,
    dropped: ranked.dropped,
    truncated: ranked.truncated,
    disclaimer: DISCLAIMER,
  };
};

// ---------------------------------------------------------------------------
// get_energy_risk — dashboard-coupled; degrades gracefully via coverage flags
// ---------------------------------------------------------------------------

// Strait of Hormuz bounding box.
const HORMUZ = { ne_lat: 27, ne_lon: 57, sw_lat: 24, sw_lon: 54 };
const CHOKEPOINT_RE = /hormuz|bab.?el.?mandeb|red sea|suez|persian gulf|strait/i;

/** Backend TheaterPosture.postureLevel is an ordinal string. */
const POSTURE_INTENSITY: Record<string, number> = {
  minimal: 0.1,
  low: 0.2,
  baseline: 0.3,
  normal: 0.3,
  moderate: 0.5,
  elevated: 0.7,
  high: 0.85,
  critical: 1,
  severe: 1,
};

const getEnergyRisk: DirectHandler = async (params, ctxArg) => {
  const ctx = ensureContext(ctxArg);
  const commodity = (params.commodity as string) || 'all';
  const full = params.verbosity === 'full';
  const gdeltQuery =
    commodity === 'natgas' ? 'natural gas Europe supply' : 'Iran Strait of Hormuz oil tanker';

  const [pricesF, navF, theaterF, gdeltF, vesselF, acledF] = await Promise.all([
    // The backend's EIA series covers wti/brent only — natgas prices come from
    // the NG=F future instead so the price factor isn't structurally dead.
    commodity === 'natgas'
      ? cachedInvoke(ctx, 'list_commodity_quotes', { symbols: ['NG=F'] }, 300, {
          usable: USABLE.commodityQuotes,
        })
      : cachedInvoke(ctx, 'get_energy_prices', {}, 300, { usable: USABLE.energyPrices }),
    cachedInvoke(ctx, 'list_navigational_warnings', { page_size: 50 }, 300, {
      usable: USABLE.navWarnings,
    }),
    cachedInvoke(ctx, 'get_theater_posture', { theater: 'middle-east' }, 300, {
      usable: USABLE.theaters,
    }),
    cachedInvoke(
      ctx,
      'search_gdelt_documents',
      { query: gdeltQuery, timespan: '24h', max_records: 50 },
      300,
      { usable: USABLE.gdelt },
    ),
    cachedInvoke(ctx, 'get_vessel_snapshot', HORMUZ, 300, { usable: USABLE.vessels }),
    // 7-day window — an unbounded ACLED fetch pins the normalizer at 1.0.
    // Quantized to the hour so the cache key repeats (a raw Date.now() would
    // defeat the TTL cache and in-flight coalescing on every call).
    cachedInvoke(
      ctx,
      'list_acled_events',
      {
        country: 'Iran',
        start: Math.floor(Date.now() / 3_600_000) * 3_600_000 - 7 * 86_400_000,
      },
      300,
      { usable: USABLE.acled },
    ),
  ]);

  const W = WEIGHTS.energy;
  const totalWeight = Object.values(W).reduce((a, b) => a + b, 0);
  const factors: Factor[] = [];

  // price momentum
  if (pricesF.ok) {
    const rows: Any[] =
      commodity === 'natgas'
        ? (pricesF.data as Any).quotes
        : (pricesF.data as Any).prices;
    const want = commodity === 'natgas' ? /ng=f|gas/i : /wti|brent|crude|oil/i;
    const px = rows.find((p: Any) => want.test(String(p?.commodity ?? p?.name ?? p?.symbol ?? '')));
    if (px && typeof px.change === 'number') {
      factors.push(
        makeFactor('price_momentum', 'energy price momentum (% change)', clamp(px.change / 5), Math.abs(px.change) / 5, W.price_momentum),
      );
    }
  }

  // chokepoint navigational warnings — covered-quiet when none match
  if (navF.ok) {
    const warnings = (navF.data as Any).warnings as Any[];
    const chokeHits = warnings.filter((w: Any) =>
      CHOKEPOINT_RE.test(`${w?.text ?? ''} ${w?.title ?? ''} ${w?.description ?? ''} ${w?.location ?? ''}`),
    ).length;
    factors.push(
      makeFactor('chokepoint_warn', 'chokepoint navigational warnings (supply risk → bullish crude)', chokeHits > 0 ? 1 : 0, chokeHits / 5, W.chokepoint_warn),
    );
  }

  // middle-east theater posture — real backend fields: postureLevel/activeFlights.
  // Production theater IDs are e.g. 'iran-theater'/'baltic-theater', so match the
  // ME-relevant ID vocabulary; NEVER fall back to theaters[0] (that could score
  // the Taiwan theater into an energy read). No match → no factor.
  if (theaterF.ok) {
    const theaters = (theaterF.data as Any).theaters as Any[];
    const ME_THEATER_RE = /middle.?east|iran|israel|gaza|yemen|red.?sea|hormuz|persian|gulf|levant/i;
    const me = theaters.find((t: Any) =>
      ME_THEATER_RE.test(String(t?.theater ?? t?.name ?? '')),
    );
    const level = String(me?.postureLevel ?? me?.posture_level ?? '').toLowerCase();
    const mapped = POSTURE_INTENSITY[level];
    if (mapped !== undefined) {
      factors.push(
        makeFactor('theater_posture', `middle-east military posture (${level})`, mapped > 0.3 ? 1 : 0, mapped, W.theater_posture),
      );
    } else if (typeof me?.activeFlights === 'number') {
      factors.push(
        makeFactor('theater_posture', 'middle-east military air activity (flight count proxy)', 1, clamp(me.activeFlights / 150, 0, 1), W.theater_posture),
      );
    }
    // Unrecognized shape → no factor; the feed still counted as covered would
    // be dishonest, so leave it out of factors (confidence reflects the miss).
  }

  // GDELT tone — covered-quiet when no articles
  if (gdeltF.ok) {
    const articles = ((gdeltF.data as Any).articles ?? (gdeltF.data as Any).results) as Any[];
    const tones = articles.map((a: Any) => a?.tone).filter((t: Any) => typeof t === 'number');
    if (tones.length) {
      const avg = tones.reduce((s: number, t: number) => s + t, 0) / tones.length;
      factors.push(
        makeFactor('gdelt_tone', 'energy/geo news tone (negative → rising tension)', clamp(-avg / 5), Math.abs(avg) / 5, W.gdelt_tone),
      );
    } else {
      factors.push(
        makeFactor('gdelt_tone', 'energy/geo news tone: no scored articles (covered, quiet)', 0, 0, W.gdelt_tone),
      );
    }
  }

  // AIS chokepoint disruptions — real shape is {snapshot:{densityZones,disruptions}};
  // the factor only fires on data that exists. The backend snapshot is GLOBAL
  // (it ignores bbox params), so scope disruptions to chokepoint regions when
  // rows carry a region; rows without one are counted (can't scope).
  if (vesselF.ok) {
    const snapshot = (vesselF.data as Any).snapshot;
    const allDisruptions: Any[] = Array.isArray(snapshot?.disruptions) ? snapshot.disruptions : [];
    const disruptions = allDisruptions.filter((d: Any) => {
      const region = String(d?.region ?? d?.location ?? '');
      return !region || CHOKEPOINT_RE.test(region);
    }).length;
    factors.push(
      makeFactor('tanker_activity', 'chokepoint AIS disruption reports (region-filtered)', disruptions > 0 ? 1 : 0, clamp(disruptions / 3, 0, 1), W.tanker_activity),
    );
  }

  // ACLED events (7-day window)
  if (acledF.ok) {
    const events = (acledF.data as Any).events as Any[];
    factors.push(
      makeFactor('acled_events', 'Iran conflict/protest events (7d)', events.length > 0 ? 1 : 0, clamp(events.length / 15, 0, 1), W.acled_events),
    );
  }

  factors.sort((a, b) => b.contribution - a.contribution);
  const agg = aggregate(factors, totalWeight);
  const coverage = coverageOf([pricesF, navF, theaterF, gdeltF, vesselF, acledF]);
  const anyOk = coverage.some((c) => c.ok);

  return {
    generated_at: nowIso(),
    commodity,
    energy_risk_score: agg.score,
    direction: agg.direction, // crude bias: bullish = upward price risk
    direction_score: agg.direction_score,
    confidence: agg.confidence,
    factors,
    coverage,
    disclaimer:
      DISCLAIMER +
      (anyOk
        ? ''
        : ' NOTE: all feeds are proxied through the WorldMonitor backend (set WORLDMONITOR_BASE_URL); none were reachable.'),
    ...(full
      ? {
          detail: {
            commodity_source: commodity === 'natgas' ? 'NG=F (list_commodity_quotes)' : 'get_energy_prices',
          },
        }
      : {}),
  };
};

// ---------------------------------------------------------------------------
// Change-detection: feed registry + recordFeed side-effect + get_changes_since
// ---------------------------------------------------------------------------

interface FeedSpec {
  tool: string;
  list: (data: Any) => Any[];
  entityKey: (row: Any) => string;
  /**
   * Fields that participate in the change hash. Options rows carry volatile
   * intraday fields (volume/bid/ask/iv) that would mark EVERY contract as
   * 'changed' on every poll — hash only the stable identity + open interest.
   */
  hashOf: (row: Any) => string;
  passthrough?: (params: Record<string, unknown>) => Record<string, unknown>;
}

const FEEDS: Record<string, FeedSpec> = {
  congress: {
    tool: 'list_congress_trades',
    list: (d) => d?.trades ?? [],
    entityKey: (r) => `${r?.politician ?? ''}|${r?.issuer ?? ''}|${r?.traded ?? ''}|${r?.type ?? ''}|${r?.size ?? ''}`,
    hashOf: (r) => compactJson(r),
    passthrough: () => ({ limit: 50 }),
  },
  insider: {
    tool: 'get_insider_transactions',
    list: (d) => d?.transactions ?? [],
    entityKey: (r) => String(r?.accessionNumber ?? `${r?.filingDate}|${r?.description}`),
    hashOf: (r) => compactJson(r),
    passthrough: (p) => ({ cik: p.cik, limit: 50 }),
  },
  options: {
    tool: 'get_options_flow',
    list: (d) => d?.top_by_volume ?? [],
    entityKey: (r) => String(r?.contract ?? ''),
    hashOf: (r) => compactJson({ contract: r?.contract, open_interest: r?.open_interest }),
    passthrough: (p) => ({ symbol: p.symbol ?? 'SPY' }),
  },
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Side-effect: snapshot each row so getChangesSince has history to diff against.
 * `storeFeed` is the SCOPED namespace (e.g. 'insider:0000320193', 'options:NVDA')
 * so diffs for one cik/symbol never leak into another's results.
 */
export function recordFeed(ctx: ToolContext, specKey: string, storeFeed: string, rows: Any[]): void {
  const spec = FEEDS[specKey];
  if (!spec) return;
  const ts = nowSec();
  for (const row of rows) {
    try {
      ctx.store.snapshotPut(storeFeed, spec.entityKey(row), sha256(spec.hashOf(row)), compactJson(row), ts);
    } catch {
      /* store best-effort */
    }
  }
}

function resolveSince(since: unknown, now: number): number {
  if (typeof since === 'number') return since > 1e11 ? Math.floor(since / 1000) : since;
  if (typeof since === 'string') {
    const dur = since.match(/^(\d+)\s*([mhd])$/i);
    if (dur) {
      const n = Number(dur[1]);
      const unit = dur[2].toLowerCase();
      const secs = unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
      return now - secs;
    }
    // Bare numeric strings are unix timestamps (seconds, or ms if 12+ digits).
    if (/^\d+$/.test(since.trim())) {
      const n = Number(since.trim());
      return n > 1e11 ? Math.floor(n / 1000) : n;
    }
    const t = Date.parse(since);
    if (!Number.isNaN(t)) return Math.floor(t / 1000);
  }
  return now - 86400; // default: last 24h
}

const getChangesSince: DirectHandler = async (params, ctxArg) => {
  const ctx = ensureContext(ctxArg);
  const feedName = String(params.feed ?? '');
  const spec = FEEDS[feedName];
  if (!spec) {
    return { error: true, message: `Unknown feed '${feedName}'. Known: ${Object.keys(FEEDS).join(', ')}` };
  }
  // Scope the snapshot namespace by the feed's parameter so diffs for one
  // cik/symbol never include another's entities.
  let scope: string;
  if (feedName === 'insider') {
    if (!params.cik) {
      return { error: true, message: "feed 'insider' requires a cik parameter." };
    }
    scope = String(params.cik).replace(/^0+/, '').padStart(10, '0');
  } else if (feedName === 'options') {
    scope = String(params.symbol ?? 'SPY').toUpperCase();
  } else {
    scope = 'all';
  }
  const storeFeed = scope === 'all' ? feedName : `${feedName}:${scope}`;

  const now = nowSec();
  const since = resolveSince(params.since, now);

  // Fetch current state and fold it into the snapshot store.
  const fetched = await settle<Any>(ctx, spec.tool, spec.passthrough ? spec.passthrough(params) : {});
  if (fetched.ok) recordFeed(ctx, feedName, storeFeed, spec.list(fetched.data));

  const changes = ctx.store.getChangesSince(storeFeed, since);
  return {
    feed: feedName,
    scope,
    since,
    as_of: now,
    backend: ctx.store.backend,
    new_count: changes.filter((c) => c.change === 'new').length,
    changed_count: changes.filter((c) => c.change === 'changed').length,
    changes: changes.slice(0, 200),
    ...(changes.length > 200 ? { changes_truncated: changes.length - 200 } : {}),
    ...(fetched.ok ? {} : { fetch_error: fetched.error }),
  };
};

export const tradingHandlers: Record<string, DirectHandler> = {
  get_ticker_intel: getTickerIntel,
  scan_convergence: scanConvergence,
  get_energy_risk: getEnergyRisk,
  get_changes_since: getChangesSince,
};
