/**
 * structuredContent contract tests for the composite trading tools.
 *
 * The MCP SDK validates a tool's structuredContent against its registered
 * output schema at runtime and THROWS on mismatch — so every success payload
 * (happy path AND graceful-degradation path) must parse against the shape in
 * OUTPUT_SCHEMAS. Only error:true results are exempt (they go out as isError
 * text and are never validated).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { OUTPUT_SCHEMAS } from '../schemas.js';
import { tradingHandlers } from '../handlers/trading.js';
import { MemoryStore } from '../store.js';
import type { ToolContext } from '../types.js';

const COMPOSITES = [
  'get_ticker_intel',
  'scan_convergence',
  'get_energy_risk',
  'get_changes_since',
];

const inDays = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

// One fixture per feed the four composites fan out to — all pass the handlers'
// USABLE predicates so every coverage entry is ok:true on the happy path.
const FIXTURES: Record<string, unknown> = {
  list_market_quotes: { quotes: [{ symbol: 'AAPL', price: 211.16, change: 1.8 }] },
  get_options_flow: {
    summary: {
      call_volume: 1200,
      put_volume: 600,
      call_open_interest: 9000,
      put_open_interest: 7000,
    },
    top_by_volume: [{ contract: 'AAPL260117C00220000', volume: 450, open_interest: 3100 }],
  },
  get_social_sentiment: { summary: { post_count: 14, buzz_level: 'moderate' } },
  get_earnings_calendar: { earningsCalendar: [{ symbol: 'AAPL', reportDate: inDays(5) }] },
  list_congress_trades: {
    trades: [
      {
        politician: 'Josh Gottheimer',
        issuer: 'Apple Inc AAPL:US',
        type: 'buy',
        traded: '2026-06-24',
        size: '1K-15K',
      },
    ],
  },
  get_insider_activity: {
    open_market: { buy_count: 2, sell_count: 0, net_buy_usd: 1_500_000, net_buy_shares: 7100 },
  },
  get_energy_prices: { prices: [{ commodity: 'WTI Crude', price: 78.4, change: 2.1 }] },
  list_navigational_warnings: {
    warnings: [{ title: 'NAVAREA IX 210/26', text: 'Live fire exercise, Strait of Hormuz approaches' }],
  },
  get_theater_posture: {
    theaters: [{ theater: 'middle-east', postureLevel: 'elevated', activeFlights: 42 }],
  },
  search_gdelt_documents: { articles: [{ tone: -4.2 }, { tone: -1.5 }] },
  get_vessel_snapshot: {
    snapshot: { densityZones: [], disruptions: [{ zone: 'hormuz', kind: 'ais_gap' }] },
  },
  list_acled_events: { events: [{ event_type: 'Battles' }, { event_type: 'Protests' }] },
};

/** Seed the SEC ticker map so resolveCik never hits the network. */
function seedTickers(store: MemoryStore): void {
  store.cacheSet(
    'sec:company_tickers',
    { AAPL: { cik: '0000320193', title: 'Apple Inc.' } },
    3600,
  );
}

/** Fake ctx: fresh store, feed calls answered from fixtures, composites routed
 *  back through the real handlers (so scan_convergence exercises the real
 *  get_ticker_intel fan-out). */
function makeCtx(): ToolContext {
  const store = new MemoryStore();
  seedTickers(store);
  const ctx: ToolContext = {
    client: undefined as never, // unused — callTool is fully stubbed
    store,
    callTool: async (name, params = {}) => {
      const composite = tradingHandlers[name];
      if (composite) return composite(params, ctx);
      if (name in FIXTURES) return FIXTURES[name];
      throw new Error(`no fixture for ${name}`);
    },
  };
  return ctx;
}

/** Fake ctx where EVERY feed call throws (total upstream outage). */
function makeFailingCtx(): ToolContext {
  const store = new MemoryStore();
  seedTickers(store);
  return {
    client: undefined as never,
    store,
    callTool: async (name) => {
      throw new Error(`simulated outage: ${name} unreachable`);
    },
  };
}

function parseWith(name: string, result: unknown): Record<string, unknown> {
  return z.object(OUTPUT_SCHEMAS[name]).parse(result) as Record<string, unknown>;
}

describe('OUTPUT_SCHEMAS registry', () => {
  it('declares schemas for exactly the four composite tools', () => {
    expect(Object.keys(OUTPUT_SCHEMAS).sort()).toEqual([...COMPOSITES].sort());
    expect(Object.keys(OUTPUT_SCHEMAS).sort()).toEqual(Object.keys(tradingHandlers).sort());
  });
});

describe('schema conformance — happy path', () => {
  it('get_ticker_intel (verbosity full) parses against its output schema', async () => {
    const result = await tradingHandlers.get_ticker_intel(
      { symbol: 'AAPL', verbosity: 'full' },
      makeCtx(),
    );
    const parsed = parseWith('get_ticker_intel', result);
    expect(parsed.symbol).toBe('AAPL');
    expect(parsed.conviction_score).not.toBeNull();
    const coverage = parsed.coverage as Array<{ ok: boolean }>;
    expect(coverage).toHaveLength(6);
    expect(coverage.every((c) => c.ok)).toBe(true);
    expect((parsed.factors as unknown[]).length).toBeGreaterThan(0);
    expect(parsed.components).toBeDefined();
  });

  it('scan_convergence parses with a non-empty results array', async () => {
    const result = await tradingHandlers.scan_convergence(
      { symbols: ['AAPL'], min_score: 0 },
      makeCtx(),
    );
    const parsed = parseWith('scan_convergence', result);
    expect(parsed.universe_source).toBe('caller-provided');
    const results = parsed.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('AAPL');
  });

  it('get_energy_risk parses against its output schema', async () => {
    const result = await tradingHandlers.get_energy_risk({}, makeCtx());
    const parsed = parseWith('get_energy_risk', result);
    expect(parsed.energy_risk_score).not.toBeNull();
    const coverage = parsed.coverage as Array<{ ok: boolean }>;
    expect(coverage).toHaveLength(6);
    expect(coverage.every((c) => c.ok)).toBe(true);
  });

  it('get_changes_since parses with recorded changes and no fetch_error', async () => {
    const result = await tradingHandlers.get_changes_since(
      { feed: 'congress', since: 0 },
      makeCtx(),
    );
    const parsed = parseWith('get_changes_since', result);
    expect(parsed.backend).toBe('memory');
    expect(parsed.new_count).toBe(1);
    expect(parsed.fetch_error).toBeUndefined();
  });
});

describe('schema conformance — graceful degradation (all feeds throwing)', () => {
  const FAIL_PARAMS: Record<string, Record<string, unknown>> = {
    get_ticker_intel: { symbol: 'AAPL' },
    scan_convergence: { symbols: ['AAPL'] },
    get_energy_risk: {},
    get_changes_since: { feed: 'congress', since: 0 },
  };

  for (const name of COMPOSITES) {
    it(`${name} degraded payload still parses (unless error:true)`, async () => {
      const result = await tradingHandlers[name](FAIL_PARAMS[name], makeFailingCtx());
      if ((result as Record<string, unknown>)?.error === true) return; // isError path — never validated
      parseWith(name, result);
    });
  }

  it('get_changes_since with a throwing fetch parses WITH fetch_error (regression)', async () => {
    const result = await tradingHandlers.get_changes_since(
      { feed: 'congress', since: 0 },
      makeFailingCtx(),
    );
    const parsed = parseWith('get_changes_since', result);
    expect(typeof parsed.fetch_error).toBe('string');
    expect(parsed.new_count).toBe(0);
    expect(parsed.changes).toEqual([]);
  });

  it('get_ticker_intel with all feeds down withholds the score but stays schema-valid', async () => {
    const result = await tradingHandlers.get_ticker_intel({ symbol: 'AAPL' }, makeFailingCtx());
    const parsed = parseWith('get_ticker_intel', result);
    expect(parsed.conviction_score).toBeNull();
    expect(parsed.direction).toBe('insufficient_data');
    const coverage = parsed.coverage as Array<{ ok: boolean }>;
    expect(coverage.every((c) => !c.ok)).toBe(true);
  });
});

describe('error:true payloads (exempt from output-schema validation)', () => {
  it("get_changes_since feed 'insider' without a cik returns error:true", async () => {
    const result = (await tradingHandlers.get_changes_since(
      { feed: 'insider' },
      makeCtx(),
    )) as Record<string, unknown>;
    expect(result.error).toBe(true);
    expect(String(result.message)).toMatch(/cik/i);
  });
});
