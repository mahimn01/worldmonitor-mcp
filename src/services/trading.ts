import { ServiceDef } from '../types.js';

export const trading: ServiceDef = {
  name: 'trading',
  description:
    'Composite trading intelligence — fuses options flow, social buzz, parsed insider (Form 4) ' +
    'and congressional activity, earnings proximity, and macro/geo feeds into transparent, scored, ' +
    'ranked briefs with factor breakdowns and coverage/confidence. Read-only; informational, not advice.',
  basePath: '/api/trading/v1',
  tools: [
    {
      name: 'get_ticker_intel',
      description:
        'Fused single-ticker brief. Fans out (cached, concurrency-limited) to quote, options flow, ' +
        'social buzz, earnings, congressional trades, and parsed SEC insider activity; returns a 0-100 ' +
        'conviction score with directional read, factor breakdown, and coverage/confidence. Degrades ' +
        'gracefully for ETFs/indices/crypto (no issuer CIK). Informational, not investment advice.',
      params: {
        symbol: {
          type: 'string',
          description: 'Stock ticker (e.g. "NVDA", "AAPL")',
          required: true,
        },
        verbosity: {
          type: 'string',
          description: 'summary = scores + factors only; full = include raw component detail',
          enum: ['summary', 'full'],
          default: 'summary',
        },
      },
      endpoint: '/get-ticker-intel',
    },
    {
      name: 'scan_convergence',
      description:
        'Rank tickers by how many INDEPENDENT directional signals (price momentum, options P/C, insider ' +
        'net, congressional net) align. If symbols are omitted, the universe is derived from recent ' +
        'congressional tickers plus the configured watchlist. Returns a ranked, score-filtered list with ' +
        'per-ticker vote breakdown. Informational, not advice.',
      params: {
        symbols: {
          type: 'string[]',
          description: 'Tickers to scan; omit to auto-derive a universe',
        },
        min_score: {
          type: 'number',
          description: 'Minimum convergence score 0-100 to include (default 40)',
        },
        verbosity: {
          type: 'string',
          description: 'summary | full (full includes per-ticker factor detail)',
          enum: ['summary', 'full'],
          default: 'summary',
        },
      },
      endpoint: '/scan-convergence',
    },
    {
      name: 'get_energy_risk',
      description:
        'Energy supply-risk gauge. Fuses energy prices, chokepoint navigational warnings, middle-east ' +
        'theater posture, Iran/energy news tone (GDELT), Hormuz vessel density, and ACLED events into a ' +
        '0-100 risk score with a directional crude bias. Feeds are proxied through the WorldMonitor ' +
        'backend and degrade gracefully (coverage flags) when unreachable. Informational, not advice.',
      params: {
        commodity: {
          type: 'string',
          description: 'oil | natgas | all',
          enum: ['oil', 'natgas', 'all'],
          default: 'all',
        },
        verbosity: {
          type: 'string',
          description: 'summary | full',
          enum: ['summary', 'full'],
          default: 'summary',
        },
      },
      endpoint: '/get-energy-risk',
    },
    {
      name: 'get_changes_since',
      description:
        'What changed since you last looked. Fetches a feed (congress | insider | options), diffs it ' +
        'against stored snapshots, and returns new/changed entities. Persists across sessions when SQLite ' +
        'is available, otherwise within-session. Note: persistent background watching is out of scope — ' +
        'this answers the point-in-time query only.',
      params: {
        feed: {
          type: 'string',
          description: 'Feed to diff',
          enum: ['congress', 'insider', 'options'],
          required: true,
        },
        since: {
          type: 'string',
          description:
            'ISO date, unix timestamp (seconds or ms, as a string), or duration like "24h"/"7d"/"30m" (default 24h)',
        },
        cik: {
          type: 'string',
          description:
            'REQUIRED when feed=insider — scopes the diff to this issuer (feeds are namespaced per CIK)',
        },
        symbol: {
          type: 'string',
          description:
            'Underlying when feed=options (default SPY) — scopes the diff to this symbol',
        },
      },
      endpoint: '/get-changes-since',
    },
  ],
};
