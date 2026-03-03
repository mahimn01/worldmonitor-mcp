import { ServiceDef } from '../types.js';

export const climate: ServiceDef = {
  name: 'climate',
  description:
    'Climate monitoring — temperature anomalies, extreme weather events, and climate indicators from NASA and NOAA',
  basePath: '/api/climate/v1',
  tools: [
    {
      name: 'list_climate_anomalies',
      description:
        'Get climate anomaly data — temperature deviations, extreme weather events, and notable climate patterns from NASA MODIS and NOAA.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        min_severity: {
          type: 'string',
          description:
            'Minimum anomaly severity: "minor", "moderate", "significant", "extreme"',
        },
      },
      endpoint: '/list-climate-anomalies',
    },
  ],
};
