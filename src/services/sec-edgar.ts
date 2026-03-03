import { ServiceDef } from '../types.js';

export const secEdgar: ServiceDef = {
  name: 'sec-edgar',
  description:
    'SEC EDGAR filings — full-text search, insider transactions (Form 4), institutional holdings (13F), company filings, and XBRL financial facts',
  basePath: '/api/sec-edgar/v1',
  tools: [
    {
      name: 'search_sec_filings',
      description:
        'Full-text search across all SEC filings via EDGAR EFTS. Returns filing type, company name, date, and document links.',
      params: {
        q: {
          type: 'string',
          description:
            'Search query (e.g. "artificial intelligence", "stock buyback")',
          required: true,
        },
        forms: {
          type: 'string',
          description:
            'Comma-separated form types to filter (e.g. "10-K,10-Q,8-K")',
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        from: {
          type: 'number',
          description: 'Pagination offset (default 0)',
        },
      },
      endpoint: '/search-sec-filings',
    },
    {
      name: 'get_insider_transactions',
      description:
        'Get insider trading transactions (Form 4 filings) for a company by CIK number. Shows buys, sells, and option exercises by officers and directors.',
      params: {
        cik: {
          type: 'string',
          description:
            'SEC CIK number (e.g. "0000320193" for Apple, "789019" for Microsoft)',
          required: true,
        },
        limit: {
          type: 'number',
          description: 'Max transactions to return (default 20)',
        },
      },
      endpoint: '/get-insider-transactions',
    },
    {
      name: 'get_institutional_holdings',
      description:
        'Get institutional holdings from 13F filings. Shows which funds hold the stock and when filings were made.',
      params: {
        cik: {
          type: 'string',
          description:
            'SEC CIK number of the institution filing 13F (e.g. "1067983" for Berkshire Hathaway)',
          required: true,
        },
        limit: {
          type: 'number',
          description: 'Max filings to return (default 50)',
        },
      },
      endpoint: '/get-institutional-holdings',
    },
    {
      name: 'get_company_filings',
      description:
        'Get recent SEC filings for a company by CIK. Returns filing type, date, description, and document links.',
      params: {
        cik: {
          type: 'string',
          description: 'SEC CIK number (e.g. "0000320193" for Apple)',
          required: true,
        },
        type: {
          type: 'string',
          description: 'Filing type filter (e.g. "10-K", "10-Q", "8-K")',
        },
        limit: {
          type: 'number',
          description: 'Max filings to return (default 20)',
        },
      },
      endpoint: '/get-company-filings',
    },
    {
      name: 'get_company_facts',
      description:
        'Get XBRL financial facts for a company — revenue, net income, EPS, total assets, and other standardized financial data points from SEC filings.',
      params: {
        cik: {
          type: 'string',
          description: 'SEC CIK number (e.g. "0000320193" for Apple)',
          required: true,
        },
        fact: {
          type: 'string',
          description:
            'Specific XBRL fact to retrieve (e.g. "us-gaap:Revenue", "us-gaap:NetIncomeLoss", "us-gaap:EarningsPerShareBasic")',
        },
      },
      endpoint: '/get-company-facts',
    },
  ],
};
