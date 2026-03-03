import { ServiceDef } from '../types.js';

export const economic: ServiceDef = {
  name: 'economic',
  description:
    'Economic data — FRED series, World Bank indicators, energy prices (EIA), macro signals dashboard, BIS central bank rates, exchange rates, and credit data',
  basePath: '/api/economic/v1',
  tools: [
    {
      name: 'get_fred_series',
      description:
        'Get Federal Reserve Economic Data (FRED) time series — GDP, unemployment, CPI, interest rates, money supply, and 800k+ other indicators.',
      params: {
        series_id: {
          type: 'string',
          description:
            'FRED series ID (e.g. "GDP", "UNRATE", "CPIAUCSL", "DFF", "M2SL", "T10Y2Y")',
          required: true,
        },
        limit: {
          type: 'number',
          description: 'Max observations to return (default 100)',
        },
      },
      endpoint: '/get-fred-series',
    },
    {
      name: 'list_world_bank_indicators',
      description:
        'Get World Bank development indicators — GDP per capita, poverty rates, trade volumes, and other global development metrics.',
      params: {
        indicator_code: {
          type: 'string',
          description:
            'World Bank indicator code (e.g. "NY.GDP.PCAP.CD", "SI.POV.DDAY", "NE.TRD.GNFS.ZS")',
          required: true,
        },
        country_code: {
          type: 'string',
          description:
            'ISO country code or "WLD" for world aggregate',
        },
        year: {
          type: 'number',
          description: 'Filter by specific year',
        },
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
      },
      endpoint: '/list-world-bank-indicators',
    },
    {
      name: 'get_energy_prices',
      description:
        'Get energy commodity prices from the US Energy Information Administration (EIA) — WTI crude, Brent crude, natural gas, heating oil.',
      params: {
        commodities: {
          type: 'string[]',
          description:
            'Comma-separated energy commodities (e.g. "wti,brent,natgas")',
        },
      },
      endpoint: '/get-energy-prices',
    },
    {
      name: 'get_macro_signals',
      description:
        'Get the 7-signal macro dashboard — Bitcoin technicals, Fear & Greed Index, JPY liquidity proxy, QQQ/XLP regime, hash rate momentum, and composite scoring.',
      endpoint: '/get-macro-signals',
    },
    {
      name: 'get_energy_capacity',
      description:
        'Get renewable energy capacity data from EIA — solar, wind, hydro, nuclear generation capacity by year.',
      params: {
        energy_sources: {
          type: 'string[]',
          description:
            'Comma-separated energy sources (e.g. "solar,wind,nuclear")',
        },
        years: {
          type: 'number',
          description: 'Number of years of historical data',
        },
      },
      endpoint: '/get-energy-capacity',
    },
    {
      name: 'get_bis_policy_rates',
      description:
        'Get central bank policy interest rates from the Bank for International Settlements (BIS) — covers Fed, ECB, BoJ, BoE, PBoC, and 7 other major central banks.',
      endpoint: '/get-bis-policy-rates',
    },
    {
      name: 'get_bis_exchange_rates',
      description:
        'Get real effective exchange rates (REER) from BIS — trade-weighted currency strength for 12 major economies.',
      endpoint: '/get-bis-exchange-rates',
    },
    {
      name: 'get_bis_credit',
      description:
        'Get credit-to-GDP ratios from BIS — private sector credit levels relative to GDP, a key financial stability indicator.',
      endpoint: '/get-bis-credit',
    },
  ],
};
