import { ServiceDef } from '../types.js';

export const economicCalendar: ServiceDef = {
  name: 'economic-calendar',
  description:
    'Economic and financial calendars — upcoming economic events (FOMC, CPI, GDP, NFP), earnings releases, and IPO schedules',
  basePath: '/api/economic-calendar/v1',
  tools: [
    {
      name: 'get_economic_calendar',
      description:
        'Get upcoming economic events — FOMC meetings, CPI releases, Non-Farm Payrolls, GDP, PMI, and other market-moving data releases.',
      params: {
        days: {
          type: 'number',
          description: 'Days ahead to look (default 7, max 90)',
        },
        country: {
          type: 'string',
          description: 'Filter by country code (e.g. "US", "EU", "GB", "JP")',
        },
        importance: {
          type: 'string',
          description: 'Filter by importance: "high", "medium", "low"',
        },
      },
      endpoint: '/get-economic-calendar',
    },
    {
      name: 'get_earnings_calendar',
      description:
        'Get upcoming earnings release dates — company name, ticker, expected report date, and estimated EPS.',
      params: {
        days: {
          type: 'number',
          description: 'Days ahead to look (default 7)',
        },
        symbol: {
          type: 'string',
          description: 'Filter by specific ticker symbol',
        },
      },
      endpoint: '/get-earnings-calendar',
    },
    {
      name: 'get_ipo_calendar',
      description:
        'Get upcoming IPO dates — company name, expected price range, shares offered, and exchange listing.',
      params: {
        days: {
          type: 'number',
          description: 'Days ahead to look (default 30)',
        },
      },
      endpoint: '/get-ipo-calendar',
    },
  ],
};
