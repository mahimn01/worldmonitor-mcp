import { ServiceDef } from '../types.js';

export const trade: ServiceDef = {
  name: 'trade',
  description:
    'International trade data from WTO — trade restrictions, tariff trends, bilateral trade flows, and SPS/TBT trade barriers',
  basePath: '/api/trade/v1',
  tools: [
    {
      name: 'get_trade_restrictions',
      description:
        'Get active trade restrictions and sanctions from WTO data — export controls, import bans, tariff surcharges by country.',
      params: {
        countries: {
          type: 'string[]',
          description:
            'Comma-separated country codes (e.g. "US,CN,RU")',
        },
        limit: {
          type: 'number',
          description: 'Max results to return',
        },
      },
      endpoint: '/get-trade-restrictions',
    },
    {
      name: 'get_tariff_trends',
      description:
        'Get historical tariff trend data — simple average MFN applied tariff rates over time for a country pair.',
      params: {
        reporting_country: {
          type: 'string',
          description:
            'Reporting country code (e.g. "US", "CN")',
        },
        partner_country: {
          type: 'string',
          description: 'Partner country code',
        },
        product_sector: {
          type: 'string',
          description:
            'Product sector filter (e.g. "agricultural", "industrial")',
        },
        years: {
          type: 'number',
          description: 'Number of years of data',
        },
      },
      endpoint: '/get-tariff-trends',
    },
    {
      name: 'get_trade_flows',
      description:
        'Get bilateral trade flow data — merchandise exports and imports between two countries over time.',
      params: {
        reporting_country: {
          type: 'string',
          description: 'Reporting country code',
        },
        partner_country: {
          type: 'string',
          description: 'Partner country code',
        },
        years: {
          type: 'number',
          description: 'Number of years of data',
        },
      },
      endpoint: '/get-trade-flows',
    },
    {
      name: 'get_trade_barriers',
      description:
        'Get SPS (Sanitary and Phytosanitary) and TBT (Technical Barriers to Trade) measures from WTO.',
      params: {
        countries: {
          type: 'string[]',
          description: 'Comma-separated country codes',
        },
        measure_type: {
          type: 'string',
          description: 'Barrier type: "sps" or "tbt"',
        },
        limit: {
          type: 'number',
          description: 'Max results to return',
        },
      },
      endpoint: '/get-trade-barriers',
    },
  ],
};
