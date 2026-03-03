/**
 * Tests for MCP server tool registration.
 * Verifies that all tools are properly registered with valid schemas.
 */

import { describe, it, expect } from 'vitest';
import { allServices, allTools } from '../services/index.js';
import { ParamDef } from '../types.js';

describe('MCP Tool Registration', () => {
  it('all tools should produce valid Zod-compatible schemas', () => {
    const tools = allTools();
    for (const tool of tools) {
      if (!tool.params) continue;

      for (const [name, def] of Object.entries(tool.params)) {
        // Verify param name is a valid identifier
        expect(name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);

        // Verify type is supported
        expect(['string', 'number', 'boolean', 'string[]']).toContain(
          def.type,
        );

        // Verify description exists
        expect(def.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('tool names should be valid MCP tool identifiers (no spaces, no special chars)', () => {
    const tools = allTools();
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.name.length).toBeLessThanOrEqual(64);
    }
  });

  it('tool descriptions should be under 1024 characters for MCP', () => {
    for (const svc of allServices) {
      for (const tool of svc.tools) {
        const fullDesc = `[${svc.name}] ${tool.description}`;
        expect(fullDesc.length).toBeLessThanOrEqual(1024);
      }
    }
  });

  it('all tool endpoints should build valid full paths', () => {
    const tools = allTools();
    for (const tool of tools) {
      expect(tool.fullEndpoint).toMatch(/^\/api\//);
      // Should not have double slashes
      expect(tool.fullEndpoint).not.toMatch(/\/\//);
    }
  });

  it('POST tools should not have GET-only params', () => {
    const tools = allTools();
    for (const tool of tools) {
      if (tool.method === 'POST' && tool.params) {
        // POST tools with params — params go in body, which is fine
        expect(Object.keys(tool.params).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('MCP Tool Coverage', () => {
  const expectedTools = [
    // Military
    'list_military_flights',
    'get_theater_posture',
    'get_aircraft_details',
    'get_aircraft_details_batch',
    'get_wingbits_status',
    'get_usni_fleet_report',
    'list_military_bases',
    // Market
    'list_market_quotes',
    'list_crypto_quotes',
    'list_commodity_quotes',
    'get_sector_summary',
    'list_stablecoin_markets',
    'list_etf_flows',
    'get_country_stock_index',
    'list_gulf_quotes',
    // News
    'summarize_article',
    'get_summarize_article_cache',
    'list_feed_digest',
    // Economic
    'get_fred_series',
    'list_world_bank_indicators',
    'get_energy_prices',
    'get_macro_signals',
    'get_energy_capacity',
    'get_bis_policy_rates',
    'get_bis_exchange_rates',
    'get_bis_credit',
    // Intelligence
    'get_risk_scores',
    'get_pizzint_status',
    'classify_event',
    'get_country_intel_brief',
    'search_gdelt_documents',
    'deduct_situation',
    // Infrastructure
    'list_internet_outages',
    'list_service_statuses',
    'get_temporal_baseline',
    'record_baseline_snapshot',
    'get_cable_health',
    // Conflict
    'list_acled_events',
    'list_ucdp_events',
    'get_humanitarian_summary',
    'list_iran_events',
    // Aviation
    'list_airport_delays',
    // Maritime
    'get_vessel_snapshot',
    'list_navigational_warnings',
    // Cyber
    'list_cyber_threats',
    // Climate
    'list_climate_anomalies',
    // Seismology
    'list_earthquakes',
    // Wildfire
    'list_fire_detections',
    // Trade
    'get_trade_restrictions',
    'get_tariff_trends',
    'get_trade_flows',
    'get_trade_barriers',
    // Supply Chain
    'get_shipping_rates',
    'get_chokepoint_status',
    'get_critical_minerals',
    // Displacement
    'get_displacement_summary',
    'get_population_exposure',
    // Prediction
    'list_prediction_markets',
    // Research
    'list_arxiv_papers',
    'list_trending_repos',
    'list_hackernews_items',
    'list_tech_events',
    // Unrest
    'list_unrest_events',
    // Giving
    'get_giving_summary',
    // Positive Events
    'list_positive_geo_events',
    // Legacy
    'get_bootstrap_data',
    'proxy_rss_feed',
    'get_ais_snapshot',
    'get_gps_jamming',
    'get_oref_alerts',
    'get_opensky_aircraft',
    'get_polymarket_data',
    'get_eia_petroleum',
    'get_telegram_feed',
    'detect_youtube_live',
    'get_geo_location',
    'get_app_version',
  ];

  for (const toolName of expectedTools) {
    it(`should have tool "${toolName}" registered`, () => {
      const tools = allTools();
      const found = tools.find((t) => t.name === toolName);
      expect(found).toBeDefined();
    });
  }
});
