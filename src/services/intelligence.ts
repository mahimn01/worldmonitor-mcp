import { ServiceDef } from '../types.js';

export const intelligence: ServiceDef = {
  name: 'intelligence',
  description:
    'Geopolitical intelligence — risk scoring, PIZZINT (Pentagon Pizza Index), event classification, country intel briefs, GDELT document search, and AI-powered situation deduction',
  basePath: '/api/intelligence/v1',
  tools: [
    {
      name: 'get_risk_scores',
      description:
        'Get real-time geopolitical risk scores for tier-1 nations. Scores are computed from ACLED protest/conflict data, keyword matching, and baseline risk profiles. Covers US, RU, CN, UA, IR, IL, TW, KP, SA, TR, and 13 other key nations.',
      params: {
        region: {
          type: 'string',
          description:
            'Filter by region (e.g. "europe", "middle-east", "asia-pacific")',
        },
      },
      endpoint: '/get-risk-scores',
    },
    {
      name: 'get_pizzint_status',
      description:
        'Get the PIZZINT (Pentagon Pizza Index) status — a humorous but real intelligence indicator that tracks late-night pizza deliveries to government buildings as a proxy for crisis activity.',
      params: {
        include_gdelt: {
          type: 'boolean',
          description: 'Include GDELT corroboration data',
        },
      },
      endpoint: '/get-pizzint-status',
    },
    {
      name: 'classify_event',
      description:
        'Classify a geopolitical event using AI. Takes a headline/description and returns event type, severity, affected regions, and confidence score.',
      params: {
        title: {
          type: 'string',
          description: 'Event headline or title',
          required: true,
        },
        description: {
          type: 'string',
          description: 'Detailed event description',
        },
        source: {
          type: 'string',
          description: 'News source name',
        },
        country: {
          type: 'string',
          description: 'Country code where event occurred',
        },
      },
      endpoint: '/classify-event',
    },
    {
      name: 'get_country_intel_brief',
      description:
        'Get an AI-generated intelligence briefing for a specific country — covers current threats, political stability, economic indicators, military posture, and regional dynamics.',
      params: {
        country_code: {
          type: 'string',
          description:
            'ISO 3166-1 alpha-2 country code (e.g. "US", "RU", "CN", "UA", "IR")',
          required: true,
        },
      },
      endpoint: '/get-country-intel-brief',
    },
    {
      name: 'search_gdelt_documents',
      description:
        'Search the GDELT 2.0 global events database for news articles and documents matching a query. Returns geo-tagged results with tone analysis.',
      params: {
        query: {
          type: 'string',
          description:
            'Search query (e.g. "Ukraine missile", "Taiwan strait", "oil embargo")',
          required: true,
        },
        max_records: {
          type: 'number',
          description: 'Max results to return (1-250, default 75)',
        },
        timespan: {
          type: 'string',
          description:
            'Time span (e.g. "15min", "1h", "24h", "7d")',
        },
        tone_filter: {
          type: 'string',
          description:
            'Filter by tone (e.g. "<-5" for very negative, ">5" for very positive)',
        },
        sort: {
          type: 'string',
          description:
            'Sort order: "DateDesc", "DateAsc", "ToneDesc", "ToneAsc"',
        },
      },
      endpoint: '/search-gdelt-documents',
    },
    {
      name: 'deduct_situation',
      description:
        'AI-powered situation analysis — provide a free-text query and get an intelligence deduction based on current headline context and geopolitical knowledge.',
      params: {
        query: {
          type: 'string',
          description:
            'Free-text intelligence query (e.g. "What is the likelihood of escalation in the South China Sea?")',
          required: true,
        },
        geo_context: {
          type: 'string',
          description:
            'Additional geographic/political context to include',
        },
      },
      endpoint: '/deduct-situation',
      method: 'POST',
    },
  ],
};
