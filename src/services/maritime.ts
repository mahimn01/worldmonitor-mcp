import { ServiceDef } from '../types.js';

export const maritime: ServiceDef = {
  name: 'maritime',
  description:
    'Maritime intelligence — vessel positions from AIS tracking and NGA navigational warnings for shipping lanes and submarine cables',
  basePath: '/api/maritime/v1',
  tools: [
    {
      name: 'get_vessel_snapshot',
      description:
        'Get a snapshot of vessel positions in a geographic area from AIS (Automatic Identification System) tracking via AISStream.',
      params: {
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
      endpoint: '/get-vessel-snapshot',
    },
    {
      name: 'list_navigational_warnings',
      description:
        'Get active navigational warnings from the National Geospatial-Intelligence Agency (NGA) — submarine cable work, military exercises, piracy zones, and other maritime hazards.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        area: {
          type: 'string',
          description:
            'Filter by maritime area (e.g. "NAVAREA_IV", "HYDROLANT", "HYDROPAC")',
        },
      },
      endpoint: '/list-navigational-warnings',
    },
  ],
};
