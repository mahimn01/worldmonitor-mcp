/**
 * Behavioral tests for the composite trading handlers (handlers/trading.ts).
 *
 * All feed calls are intercepted by a fake ToolContext whose callTool serves
 * canned fixtures (or throws to simulate a dead feed) — nothing touches the
 * network. The SEC ticker map is pre-seeded into the store under
 * 'sec:company_tickers' so resolveCik never fetches. Fixtures mirror the REAL
 * feed shapes accepted by the USABLE predicates in trading.ts.
 */

import { describe, it, expect } from 'vitest';
import { tradingHandlers } from '../../handlers/trading.js';
import { usdIntensity, INSIDER_SELL_DISCOUNT, Factor } from '../../handlers/_scoring.js';
import { MemoryStore } from '../../store.js';
import type { ToolContext } from '../../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/**
 * Real SEC company_tickers rows (post-buildMap shape). Seeded on EVERY ctx:
 * the _tickers module keeps a session-level memMap after its first load, so
 * whichever test runs first must already see the complete map.
 */
const TICKER_MAP: Record<string, { cik: string; title: string }> = {
  NVDA: { cik: '0001045810', title: 'NVIDIA CORP' },
  AAPL: { cik: '0000320193', title: 'Apple Inc.' },
  MSFT: { cik: '0000789019', title: 'MICROSOFT CORP' },
  AMZN: { cik: '0001018724', title: 'AMAZON COM INC' },
  TSLA: { cik: '0001318605', title: 'Tesla, Inc.' },
  META: { cik: '0001326801', title: 'Meta Platforms, Inc.' },
  ORCL: { cik: '0001341439', title: 'ORACLE CORP' },
};

interface CtxHarness {
  ctx: ToolContext;
  calls: Array<{ name: string; params: Record<string, unknown> }>;
}

/**
 * Fake ToolContext with a fresh MemoryStore per test (cachedInvoke caches per
 * (tool, params) key in the store — a shared store would leak fixtures across
 * tests). Tools without a fixture throw, i.e. read as failed feeds.
 */
function makeCtx(fixtures: Record<string, unknown>): CtxHarness {
  const store = new MemoryStore();
  store.cacheSet('sec:company_tickers', TICKER_MAP, 86_400);
  const calls: CtxHarness['calls'] = [];
  const ctx: ToolContext = {
    client: undefined as never, // unused: callTool is fully stubbed
    store,
    async callTool(name, params = {}) {
      calls.push({ name, params });
      // scan_convergence fans out to the real composite through the same ctx
      if (name === 'get_ticker_intel') return tradingHandlers.get_ticker_intel(params, ctx);
      if (!(name in fixtures)) throw new Error(`feed unavailable: ${name}`);
      return fixtures[name];
    },
  };
  return { ctx, calls };
}

const factorOf = (res: Any, key: string): Factor | undefined =>
  (res.factors as Factor[]).find((f) => f.key === key);

const coverageOf = (res: Any, name: string): Any =>
  (res.coverage as Any[]).find((c) => c.name === name);

// ---------------------------------------------------------------------------
// get_ticker_intel — options put/call factor
// ---------------------------------------------------------------------------

describe('get_ticker_intel options factor', () => {
  it('put-only chain (call_volume 0, ratio null) is max-bearish, not bullish', async () => {
    const { ctx } = makeCtx({
      list_market_quotes: { quotes: [{ symbol: 'NVDA', price: 172.4, change: 0 }] },
      get_options_flow: {
        summary: {
          call_volume: 0,
          put_volume: 5000,
          put_call_ratio_volume: null,
          call_open_interest: 100,
          put_open_interest: 9000,
        },
        top_by_volume: [{ contract: 'NVDA260116P00150000', volume: 5000, open_interest: 9000 }],
      },
    });
    const res = (await tradingHandlers.get_ticker_intel({ symbol: 'NVDA' }, ctx)) as Any;

    const f = factorOf(res, 'options_pc');
    expect(f).toBeDefined();
    expect(f!.signal).toBe(-1); // all-put flow: ratio undefined, direction unambiguous
    expect(f!.intensity).toBeGreaterThan(0);
    expect(res.direction).toBe('bearish');
  });

  it('zero-volume chain is covered-but-quiet: intensity 0 yet still counts toward confidence', async () => {
    const { ctx } = makeCtx({
      list_market_quotes: { quotes: [{ symbol: 'MSFT', price: 502.1, change: 0.5 }] },
      get_options_flow: {
        summary: {
          call_volume: 0,
          put_volume: 0,
          put_call_ratio_volume: null,
          call_open_interest: 1200,
          put_open_interest: 900,
        },
      },
    });
    const res = (await tradingHandlers.get_ticker_intel({ symbol: 'MSFT' }, ctx)) as Any;

    const f = factorOf(res, 'options_pc');
    expect(f).toBeDefined();
    expect(f!.signal).toBe(0);
    expect(f!.intensity).toBe(0);
    expect(coverageOf(res, 'get_options_flow').ok).toBe(true);
    // quote (0.2) + quiet options (0.25) — the quiet feed's weight IS counted
    expect(res.confidence).toBe(0.45);
    expect(typeof res.conviction_score).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// get_ticker_intel — insider factor (sell discount)
// ---------------------------------------------------------------------------

describe('get_ticker_intel insider factor', () => {
  it('net selling is discounted; net buying is not', async () => {
    const sellCtx = makeCtx({
      get_insider_activity: {
        open_market: { buy_count: 0, sell_count: 14, net_buy_usd: -87_000_000, net_buy_shares: -410_000 },
      },
    }).ctx;
    const sellRes = (await tradingHandlers.get_ticker_intel({ symbol: 'AAPL' }, sellCtx)) as Any;
    const sellF = factorOf(sellRes, 'insider_net');
    expect(sellF).toBeDefined();
    expect(sellF!.signal).toBe(-1);
    expect(sellF!.intensity).toBeCloseTo(usdIntensity(-87_000_000) * INSIDER_SELL_DISCOUNT, 2);

    const buyCtx = makeCtx({
      get_insider_activity: {
        open_market: { buy_count: 3, sell_count: 0, net_buy_usd: 87_000_000, net_buy_shares: 410_000 },
      },
    }).ctx;
    const buyRes = (await tradingHandlers.get_ticker_intel({ symbol: 'ORCL' }, buyCtx)) as Any;
    const buyF = factorOf(buyRes, 'insider_net');
    expect(buyF).toBeDefined();
    expect(buyF!.signal).toBe(1);
    expect(buyF!.intensity).toBeCloseTo(usdIntensity(87_000_000), 2); // no discount on buys
    expect(sellF!.intensity).toBeLessThan(buyF!.intensity);
  });
});

// ---------------------------------------------------------------------------
// get_ticker_intel — quiet vs missing (the quiet-vs-missing fix)
// ---------------------------------------------------------------------------

describe('get_ticker_intel quiet vs missing', () => {
  it('all six feeds usable but quiet → numeric low score with confidence 1, never withheld', async () => {
    const { ctx } = makeCtx({
      list_market_quotes: { quotes: [{ symbol: 'AMZN', price: 221.55, change: 0 }] },
      get_options_flow: {
        summary: { call_volume: 0, put_volume: 0, call_open_interest: 0, put_open_interest: 0 },
      },
      get_social_sentiment: { summary: { symbol: 'AMZN', post_count: 0, buzz_level: 'low' } },
      get_earnings_calendar: { earningsCalendar: [] },
      list_congress_trades: {
        trades: [
          // usable feed (non-empty) with zero trades in THIS name → quiet, not missing
          { politician: 'Ro Khanna', issuer: 'Oracle Corp ORCL:US', ticker: 'ORCL', type: 'buy', traded: '2026-06-18', size: '1K–15K' },
        ],
      },
      get_insider_activity: {
        open_market: { buy_count: 0, sell_count: 0, net_buy_usd: 0, net_buy_shares: 0 },
      },
    });
    const res = (await tradingHandlers.get_ticker_intel({ symbol: 'AMZN' }, ctx)) as Any;

    expect(typeof res.conviction_score).toBe('number'); // NOT null / withheld
    expect(res.conviction_score).toBe(0);
    expect(res.confidence).toBe(1);
    expect(res.direction).toBe('neutral');
    expect(res.factors as Factor[]).toHaveLength(6);
    expect((res.coverage as Any[]).every((c) => c.ok === true)).toBe(true);
  });

  it('all feeds failing → score withheld, insufficient_data, coverage all ok:false', async () => {
    const { ctx } = makeCtx({}); // every callTool throws
    const res = (await tradingHandlers.get_ticker_intel({ symbol: 'NVDA' }, ctx)) as Any;

    expect(res.conviction_score).toBeNull();
    expect(res.direction).toBe('insufficient_data');
    expect(res.confidence).toBe(0);
    expect(res.factors as Factor[]).toHaveLength(0);
    const cov = res.coverage as Any[];
    expect(cov).toHaveLength(6);
    expect(cov.every((c) => c.ok === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_ticker_intel — CIK routing for the insider feed
// ---------------------------------------------------------------------------

describe('get_ticker_intel insider CIK routing', () => {
  it('mapped symbol → get_insider_activity is called with the seeded CIK', async () => {
    const { ctx, calls } = makeCtx({
      get_insider_activity: {
        open_market: { buy_count: 1, sell_count: 0, net_buy_usd: 2_500_000, net_buy_shares: 12_000 },
      },
    });
    const res = (await tradingHandlers.get_ticker_intel({ symbol: 'AAPL' }, ctx)) as Any;

    const insiderCalls = calls.filter((c) => c.name === 'get_insider_activity');
    expect(insiderCalls).toHaveLength(1);
    expect(insiderCalls[0].params).toMatchObject({ cik: '0000320193', window_days: 90 });
    expect(coverageOf(res, 'get_insider_activity').ok).toBe(true);
  });

  it('unmapped symbol (not ^/=) → no insider call and coverage says no issuer CIK', async () => {
    const { ctx, calls } = makeCtx({});
    const res = (await tradingHandlers.get_ticker_intel({ symbol: 'ZZZQ' }, ctx)) as Any;

    expect(calls.some((c) => c.name === 'get_insider_activity')).toBe(false);
    const cov = coverageOf(res, 'get_insider_activity');
    expect(cov.ok).toBe(false);
    expect(cov.error).toContain('no issuer CIK');
  });
});

// ---------------------------------------------------------------------------
// scan_convergence — net alignment, conflicts, quiet feeds don't vote
// ---------------------------------------------------------------------------

describe('scan_convergence', () => {
  it('2 bull vs 2 bear votes → conflicted, convergence 0, mixed', async () => {
    const { ctx } = makeCtx({
      // bull: +3% intraday
      list_market_quotes: { quotes: [{ symbol: 'TSLA', price: 312.4, change: 3 }] },
      // bear: put-heavy chain (P/C = 3) with real turnover
      get_options_flow: {
        summary: { call_volume: 1000, put_volume: 3000, call_open_interest: 4000, put_open_interest: 4000 },
      },
      // bull: large net open-market buying
      get_insider_activity: {
        open_market: { buy_count: 4, sell_count: 0, net_buy_usd: 50_000_000, net_buy_shares: 180_000 },
      },
      // bear: two congressional sells in the name
      list_congress_trades: {
        trades: [
          { politician: 'Michael McCaul', issuer: 'Tesla Inc TSLA:US', ticker: 'TSLA', type: 'sell', traded: '2026-06-20', size: '15K–50K' },
          { politician: 'Josh Gottheimer', issuer: 'Tesla Inc TSLA:US', ticker: 'TSLA', type: 'sell', traded: '2026-06-22', size: '1K–15K' },
        ],
      },
    });
    const res = (await tradingHandlers.scan_convergence({ symbols: ['TSLA'], min_score: 0 }, ctx)) as Any;

    const row = (res.results as Any[]).find((r) => r.symbol === 'TSLA');
    expect(row).toBeDefined();
    // opposing votes CANCEL: 2v2 is a conflict, not a convergence
    expect(row.conflicted).toBe(true);
    expect(row.convergence_score).toBe(0);
    expect(row.net_direction).toBe('mixed');
    expect(row.votes).toEqual({ price_momentum: 1, options_pc: -1, insider_net: 1, congress_net: -1 });
  });

  it('3 aligned bulls + 1 quiet feed → score 75, bullish, quiet feed does not vote', async () => {
    const { ctx } = makeCtx({
      list_market_quotes: { quotes: [{ symbol: 'META', price: 731.8, change: 3 }] },
      // bull: call-heavy chain (P/C = 0.1)
      get_options_flow: {
        summary: { call_volume: 4000, put_volume: 400, call_open_interest: 4400, put_open_interest: 4400 },
      },
      get_insider_activity: {
        open_market: { buy_count: 2, sell_count: 0, net_buy_usd: 50_000_000, net_buy_shares: 70_000 },
      },
      // usable congress feed with NO trades in META → covered-quiet, votes 0
      list_congress_trades: {
        trades: [
          { politician: 'Ro Khanna', issuer: 'Oracle Corp ORCL:US', ticker: 'ORCL', type: 'buy', traded: '2026-06-18', size: '1K–15K' },
        ],
      },
    });
    const res = (await tradingHandlers.scan_convergence({ symbols: ['META'] }, ctx)) as Any;

    const row = (res.results as Any[]).find((r) => r.symbol === 'META');
    expect(row).toBeDefined();
    expect(row.convergence_score).toBe(75);
    expect(row.net_direction).toBe('bullish');
    expect(row.conflicted).toBe(false);
    expect(row.aligned_count).toBe(3);
    expect(row.votes.congress_net).toBe(0); // zero-intensity factors don't vote
  });
});

// ---------------------------------------------------------------------------
// get_energy_risk — vessel/theater factors (the fabrication fix)
// ---------------------------------------------------------------------------

describe('get_energy_risk', () => {
  it('real snapshot shape: 2 disruptions → tanker intensity 2/3; elevated posture → 0.7', async () => {
    const { ctx } = makeCtx({
      get_vessel_snapshot: {
        snapshot: {
          densityZones: [],
          disruptions: [
            { zone: 'Strait of Hormuz', type: 'ais_gap' },
            { zone: 'Bab el-Mandeb', type: 'rerouting' },
          ],
        },
      },
      get_theater_posture: {
        theaters: [{ theater: 'middle-east', postureLevel: 'elevated', activeFlights: 38 }],
      },
    });
    const res = (await tradingHandlers.get_energy_risk({}, ctx)) as Any;

    const tanker = factorOf(res, 'tanker_activity');
    expect(tanker).toBeDefined();
    expect(tanker!.signal).toBe(1);
    expect(tanker!.intensity).toBeCloseTo(2 / 3, 2);

    const posture = factorOf(res, 'theater_posture');
    expect(posture).toBeDefined();
    expect(posture!.signal).toBe(1);
    expect(posture!.intensity).toBe(0.7);

    expect(coverageOf(res, 'get_vessel_snapshot').ok).toBe(true);
    expect(coverageOf(res, 'get_theater_posture').ok).toBe(true);
  });

  it('vessel payload without a snapshot key → coverage ok:false and NO tanker factor', async () => {
    const { ctx } = makeCtx({ get_vessel_snapshot: {} });
    const res = (await tradingHandlers.get_energy_risk({}, ctx)) as Any;

    expect(factorOf(res, 'tanker_activity')).toBeUndefined(); // no fabricated factor
    const cov = coverageOf(res, 'get_vessel_snapshot');
    expect(cov.ok).toBe(false);
    expect(cov.error).toContain('no usable data');
  });
});
