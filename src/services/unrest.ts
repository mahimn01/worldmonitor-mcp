import { ServiceDef } from '../types.js';

export const unrest: ServiceDef = {
  name: 'unrest',
  description:
    'Social unrest monitoring — protests, riots, strikes, and demonstrations from ACLED and GDELT with deduplication and severity scoring',
  basePath: '/api/unrest/v1',
  tools: [
    {
      name: 'list_unrest_events',
      description:
        'Get social unrest events — protests, riots, strikes, and demonstrations worldwide from ACLED and GDELT. Events are deduplicated using spatial/temporal binning.',
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
        min_severity: {
          type: 'string',
          description:
            'Minimum severity: "low", "medium", "high", "critical"',
        },
        ne_lat: {
          type: 'number',
          description: 'Northeast latitude of bounding box',
        },
        ne_lon: {
          type: 'number',
          description: 'Northeast longitude of bounding box',
        },
        sw_lat: {
          type: 'number',
          description: 'Southwest latitude of bounding box',
        },
        sw_lon: {
          type: 'number',
          description: 'Southwest longitude of bounding box',
        },
      },
      endpoint: '/list-unrest-events',
    },
  ],
};
