import { ServiceDef } from '../types.js';

export const conflict: ServiceDef = {
  name: 'conflict',
  description:
    'Armed conflict data — ACLED battles/protests/violence, UCDP armed conflict events, humanitarian summaries, and Iran-specific conflict events',
  basePath: '/api/conflict/v1',
  tools: [
    {
      name: 'list_acled_events',
      description:
        'Get Armed Conflict Location & Event Data (ACLED) — battles, explosions/remote violence, violence against civilians, protests, and riots worldwide.',
      params: {
        start: {
          type: 'number',
          description: 'Start timestamp (Unix ms)',
        },
        end: {
          type: 'number',
          description: 'End timestamp (Unix ms)',
        },
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        country: {
          type: 'string',
          description:
            'Filter by country name or code (e.g. "Ukraine", "UA")',
        },
      },
      endpoint: '/list-acled-events',
    },
    {
      name: 'list_ucdp_events',
      description:
        'Get Uppsala Conflict Data Program (UCDP) events — armed conflict events from the leading academic conflict dataset.',
      params: {
        start: {
          type: 'number',
          description: 'Start timestamp (Unix ms)',
        },
        end: {
          type: 'number',
          description: 'End timestamp (Unix ms)',
        },
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        country: {
          type: 'string',
          description: 'Filter by country name or code',
        },
      },
      endpoint: '/list-ucdp-events',
    },
    {
      name: 'get_humanitarian_summary',
      description:
        'Get humanitarian crisis summary for a country — conflict event counts, displacement data, and aid requirements from HAPI/HDX.',
      params: {
        country_code: {
          type: 'string',
          description:
            'ISO 3166-1 alpha-2 country code (e.g. "UA", "SY", "YE", "SD")',
          required: true,
        },
      },
      endpoint: '/get-humanitarian-summary',
    },
    {
      name: 'list_iran_events',
      description:
        'Get curated Iran-specific conflict and tension events — missile tests, proxy actions, nuclear program updates, and regional activities.',
      endpoint: '/list-iran-events',
    },
  ],
};
