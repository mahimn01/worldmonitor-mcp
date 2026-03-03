import { ServiceDef } from '../types.js';

export const displacement: ServiceDef = {
  name: 'displacement',
  description:
    'Displacement and refugee data — UNHCR/IDMC refugee populations, IDP counts, displacement flows, and population exposure analysis',
  basePath: '/api/displacement/v1',
  tools: [
    {
      name: 'get_displacement_summary',
      description:
        'Get global displacement summary — top countries by refugees, internally displaced persons (IDPs), displacement flows with year-over-year trends from IDMC.',
      params: {
        year: {
          type: 'number',
          description:
            'Year for data (default: latest available)',
        },
        country_limit: {
          type: 'number',
          description: 'Max countries to return',
        },
        flow_limit: {
          type: 'number',
          description: 'Max displacement flows to return',
        },
      },
      endpoint: '/get-displacement-summary',
    },
    {
      name: 'get_population_exposure',
      description:
        'Get population exposure analysis for a geographic point — shows how many people live within a given radius, useful for assessing humanitarian impact of events.',
      params: {
        mode: {
          type: 'string',
          description: 'Analysis mode',
        },
        lat: {
          type: 'number',
          description: 'Latitude (-90 to 90)',
          required: true,
        },
        lon: {
          type: 'number',
          description: 'Longitude (-180 to 180)',
          required: true,
        },
        radius: {
          type: 'number',
          description: 'Radius in kilometers',
        },
      },
      endpoint: '/get-population-exposure',
    },
  ],
};
