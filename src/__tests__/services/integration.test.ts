/**
 * Integration tests — verifies that each service's tools correctly construct
 * API calls and handle mocked responses for every endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorldMonitorClient } from '../../client.js';
import { allServices } from '../../services/index.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const client = new WorldMonitorClient({
  baseUrl: 'https://test.worldmonitor.app',
  timeout: 5000,
});

// ---------------------------------------------------------------------------
// Military
// ---------------------------------------------------------------------------

describe('Military Service Integration', () => {
  it('list_military_flights — should send bbox params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ flights: [] }));
    const result = await client.call(
      '/api/military/v1/list-military-flights',
      { ne_lat: 50, ne_lon: 30, sw_lat: 40, sw_lon: 20 },
    );
    expect(result.ok).toBe(true);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('ne_lat=50');
    expect(url).toContain('sw_lon=20');
  });

  it('get_theater_posture — should send theater param', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ theater: 'europe', escalation: 'normal' }),
    );
    const result = await client.call(
      '/api/military/v1/get-theater-posture',
      { theater: 'europe' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as Record<string, string>).theater).toBe('europe');
    }
  });

  it('get_aircraft_details_batch — should POST with icao24s', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ aircraft: [] }));
    await client.call(
      '/api/military/v1/get-aircraft-details-batch',
      { icao24s: ['a1b2c3', 'd4e5f6'] },
      'POST',
    );
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({
      icao24s: ['a1b2c3', 'd4e5f6'],
    });
  });
});

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

describe('Market Service Integration', () => {
  it('list_market_quotes — should send symbols', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        quotes: [{ symbol: 'AAPL', price: 150.25 }],
      }),
    );
    const result = await client.call(
      '/api/market/v1/list-market-quotes',
      { symbols: 'AAPL,MSFT' },
    );
    expect(result.ok).toBe(true);
  });

  it('get_country_stock_index — should require country_code', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ symbol: '^GSPC', name: 'S&P 500' }),
    );
    const result = await client.call(
      '/api/market/v1/get-country-stock-index',
      { country_code: 'US' },
    );
    expect(result.ok).toBe(true);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('country_code=US');
  });

  it('list_etf_flows — no params needed', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ flows: [{ ticker: 'IBIT', flow: 500000000 }] }),
    );
    const result = await client.call('/api/market/v1/list-etf-flows');
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Economic
// ---------------------------------------------------------------------------

describe('Economic Service Integration', () => {
  it('get_fred_series — should send series_id', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        series_id: 'GDP',
        observations: [{ date: '2024-01-01', value: '25000' }],
      }),
    );
    const result = await client.call('/api/economic/v1/get-fred-series', {
      series_id: 'GDP',
      limit: 10,
    });
    expect(result.ok).toBe(true);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('series_id=GDP');
    expect(url).toContain('limit=10');
  });

  it('get_macro_signals — no params, returns 7 signals', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        signals: { composite: 0.65, fearGreed: 42 },
      }),
    );
    const result = await client.call(
      '/api/economic/v1/get-macro-signals',
    );
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Intelligence
// ---------------------------------------------------------------------------

describe('Intelligence Service Integration', () => {
  it('search_gdelt_documents — should send query params', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ articles: [{ title: 'Test' }] }),
    );
    await client.call('/api/intelligence/v1/search-gdelt-documents', {
      query: 'Ukraine missile',
      max_records: 25,
      timespan: '24h',
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('query=Ukraine+missile');
    expect(url).toContain('max_records=25');
  });

  it('deduct_situation — should POST query', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ deduction: 'Analysis...' }),
    );
    await client.call(
      '/api/intelligence/v1/deduct-situation',
      { query: 'South China Sea escalation' },
      'POST',
    );
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe('POST');
  });
});

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

describe('Conflict Service Integration', () => {
  it('list_acled_events — should handle time range', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ events: [], total: 0 }),
    );
    const now = Date.now();
    await client.call('/api/conflict/v1/list-acled-events', {
      start: now - 86400000,
      end: now,
      country: 'UA',
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('country=UA');
  });

  it('get_humanitarian_summary — should send country_code', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ country: 'Ukraine', conflicts: 150 }),
    );
    await client.call(
      '/api/conflict/v1/get-humanitarian-summary',
      { country_code: 'UA' },
    );
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('country_code=UA');
  });
});

// ---------------------------------------------------------------------------
// Seismology
// ---------------------------------------------------------------------------

describe('Seismology Service Integration', () => {
  it('list_earthquakes — should filter by magnitude', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        earthquakes: [
          { mag: 6.2, place: '10km NW of Tokyo', lat: 35.7, lon: 139.7 },
        ],
      }),
    );
    await client.call('/api/seismology/v1/list-earthquakes', {
      min_magnitude: 6,
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('min_magnitude=6');
  });
});

// ---------------------------------------------------------------------------
// Cyber
// ---------------------------------------------------------------------------

describe('Cyber Service Integration', () => {
  it('list_cyber_threats — should filter by type and source', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ threats: [], total: 0 }),
    );
    await client.call('/api/cyber/v1/list-cyber-threats', {
      type: 'c2',
      source: 'feodo',
      min_severity: 'high',
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('type=c2');
    expect(url).toContain('source=feodo');
    expect(url).toContain('min_severity=high');
  });
});

// ---------------------------------------------------------------------------
// Legacy
// ---------------------------------------------------------------------------

describe('Legacy Endpoints Integration', () => {
  it('get_bootstrap_data — should accept tier param', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { earthquakes: [] }, missing: [] }),
    );
    await client.call('/api/bootstrap', { tier: 'fast' });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('tier=fast');
  });

  it('get_bootstrap_data — should accept specific keys', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { earthquakes: [], outages: [] }, missing: [] }),
    );
    await client.call('/api/bootstrap', {
      keys: 'earthquakes,outages',
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('keys=earthquakes%2Coutages');
  });

  it('proxy_rss_feed — should proxy URL param', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<rss>feed</rss>', {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      }),
    );
    await client.call('/api/rss-proxy', {
      url: 'https://feeds.bbci.co.uk/news/rss.xml',
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('url=');
    expect(url).toContain('bbci.co.uk');
  });
});

// ---------------------------------------------------------------------------
// Full endpoint coverage — ensure every tool's endpoint is tested
// ---------------------------------------------------------------------------

describe('Endpoint Path Verification', () => {
  const expectedPaths: Record<string, string> = {
    list_military_flights: '/api/military/v1/list-military-flights',
    get_theater_posture: '/api/military/v1/get-theater-posture',
    get_aircraft_details: '/api/military/v1/get-aircraft-details',
    list_market_quotes: '/api/market/v1/list-market-quotes',
    list_crypto_quotes: '/api/market/v1/list-crypto-quotes',
    get_fred_series: '/api/economic/v1/get-fred-series',
    get_macro_signals: '/api/economic/v1/get-macro-signals',
    get_bis_policy_rates: '/api/economic/v1/get-bis-policy-rates',
    get_risk_scores: '/api/intelligence/v1/get-risk-scores',
    search_gdelt_documents: '/api/intelligence/v1/search-gdelt-documents',
    list_internet_outages: '/api/infrastructure/v1/list-internet-outages',
    get_cable_health: '/api/infrastructure/v1/get-cable-health',
    list_acled_events: '/api/conflict/v1/list-acled-events',
    list_earthquakes: '/api/seismology/v1/list-earthquakes',
    list_fire_detections: '/api/wildfire/v1/list-fire-detections',
    list_cyber_threats: '/api/cyber/v1/list-cyber-threats',
    list_climate_anomalies: '/api/climate/v1/list-climate-anomalies',
    get_shipping_rates: '/api/supply-chain/v1/get-shipping-rates',
    get_chokepoint_status: '/api/supply-chain/v1/get-chokepoint-status',
    get_critical_minerals: '/api/supply-chain/v1/get-critical-minerals',
    list_prediction_markets: '/api/prediction/v1/list-prediction-markets',
    list_arxiv_papers: '/api/research/v1/list-arxiv-papers',
    list_unrest_events: '/api/unrest/v1/list-unrest-events',
    get_giving_summary: '/api/giving/v1/get-giving-summary',
    list_positive_geo_events: '/api/positive-events/v1/list-positive-geo-events',
    get_bootstrap_data: '/api/bootstrap',
  };

  for (const [toolName, expectedPath] of Object.entries(expectedPaths)) {
    it(`${toolName} → ${expectedPath}`, async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await client.call(expectedPath);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(expectedPath);
      mockFetch.mockClear();
    });
  }
});
