import { ServiceDef } from '../types.js';

export const cftc: ServiceDef = {
  name: 'cftc',
  description:
    'CFTC Commitments of Traders (COT) reports — futures market positioning data from the Commodity Futures Trading Commission',
  basePath: '/api/cftc/v1',
  tools: [
    {
      name: 'get_cot_report',
      description:
        'Get the latest Commitments of Traders (COT) report from CFTC. Shows commercial, non-commercial, and non-reportable positions across futures markets.',
      params: {
        market: {
          type: 'string',
          description:
            'Market name filter (e.g. "GOLD", "CRUDE OIL", "E-MINI S&P 500", "EURO FX")',
        },
        limit: {
          type: 'number',
          description: 'Max records to return (default 25)',
        },
      },
      endpoint: '/get-cot-report',
    },
    {
      name: 'get_cot_positions',
      description:
        'Get historical COT positioning data for a specific futures contract — long/short/spread positions by trader category over time.',
      params: {
        contract_code: {
          type: 'string',
          description:
            'CFTC contract market code (e.g. "088691" for gold, "067651" for crude oil, "13874A" for E-mini S&P)',
          required: true,
        },
        weeks: {
          type: 'number',
          description: 'Number of weeks of historical data (default 12)',
        },
      },
      endpoint: '/get-cot-positions',
    },
  ],
};
