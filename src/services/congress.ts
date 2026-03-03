import { ServiceDef } from '../types.js';

export const congress: ServiceDef = {
  name: 'congress',
  description:
    'Congressional stock trading disclosures — House and Senate member trades from public STOCK Act financial disclosures',
  basePath: '/api/congress/v1',
  tools: [
    {
      name: 'list_congress_trades',
      description:
        'Get recent stock trades by members of US Congress (House and Senate). Returns member name, ticker, transaction type, amount range, and disclosure date.',
      params: {
        chamber: {
          type: 'string',
          description:
            'Filter by chamber: "house", "senate", or "both" (default "both")',
        },
        ticker: {
          type: 'string',
          description:
            'Filter by stock ticker symbol (e.g. "AAPL", "NVDA")',
        },
        limit: {
          type: 'number',
          description: 'Max trades to return (default 50)',
        },
      },
      endpoint: '/list-congress-trades',
    },
    {
      name: 'get_congress_member_trades',
      description:
        'Get all stock trades by a specific member of Congress. Shows full trading history with amounts and dates.',
      params: {
        member: {
          type: 'string',
          description:
            'Member name to search for (e.g. "Nancy Pelosi", "Dan Crenshaw", "Tommy Tuberville")',
          required: true,
        },
        limit: {
          type: 'number',
          description: 'Max trades to return (default 50)',
        },
      },
      endpoint: '/get-congress-member-trades',
    },
  ],
};
