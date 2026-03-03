import { ServiceDef } from '../types.js';

export const aviation: ServiceDef = {
  name: 'aviation',
  description:
    'Aviation status — airport delays, closures, and NOTAMs (Notices to Airmen) from FAA, AviationStack, and ICAO',
  basePath: '/api/aviation/v1',
  tools: [
    {
      name: 'list_airport_delays',
      description:
        'Get airport delay and closure information — covers 128+ airports worldwide with FAA status, AviationStack flight delays, and ICAO NOTAM closures.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        region: {
          type: 'string',
          description:
            'Filter by region (e.g. "north-america", "europe", "asia-pacific", "middle-east")',
        },
        min_severity: {
          type: 'string',
          description:
            'Minimum delay severity: "minor", "moderate", "major", "closed"',
        },
      },
      endpoint: '/list-airport-delays',
    },
  ],
};
