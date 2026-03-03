import { ServiceDef } from '../types.js';

export const wildfire: ServiceDef = {
  name: 'wildfire',
  description:
    'Wildfire detection — satellite thermal hotspots from NASA FIRMS (VIIRS sensor) for global fire monitoring',
  basePath: '/api/wildfire/v1',
  tools: [
    {
      name: 'list_fire_detections',
      description:
        'Get active fire detections from NASA FIRMS (Fire Information for Resource Management System) using VIIRS satellite thermal hotspot data.',
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
      endpoint: '/list-fire-detections',
    },
  ],
};
