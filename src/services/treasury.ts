import { ServiceDef } from '../types.js';

export const treasury: ServiceDef = {
  name: 'treasury',
  description:
    'US Treasury data — yield curve rates, auction results, and national debt tracking from fiscal data APIs',
  basePath: '/api/treasury/v1',
  tools: [
    {
      name: 'get_treasury_rates',
      description:
        'Get daily Treasury yield curve interest rates — average rates across maturities (1mo through 30yr).',
      params: {
        days: {
          type: 'number',
          description: 'Number of recent days to return (default 30)',
        },
      },
      endpoint: '/get-treasury-rates',
    },
    {
      name: 'get_treasury_auctions',
      description:
        'Get recent Treasury auction results — security type, term, high rate, allotted amount, and bid-to-cover ratio.',
      params: {
        security_type: {
          type: 'string',
          description:
            'Filter by security type: "Bill", "Note", "Bond", "TIPS", "FRN"',
        },
        limit: {
          type: 'number',
          description: 'Max auctions to return (default 20)',
        },
      },
      endpoint: '/get-treasury-auctions',
    },
    {
      name: 'get_debt_to_penny',
      description:
        'Get the current US national debt — total public debt outstanding, intragovernmental holdings, and debt held by the public.',
      params: {
        days: {
          type: 'number',
          description: 'Number of recent days to return (default 30)',
        },
      },
      endpoint: '/get-debt-to-penny',
    },
  ],
};
