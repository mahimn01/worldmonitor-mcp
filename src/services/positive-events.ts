import { ServiceDef } from '../types.js';

export const positiveEvents: ServiceDef = {
  name: 'positive-events',
  description:
    'Positive global events — uplifting news, peace agreements, environmental wins, and humanitarian achievements from GDELT positive event filters',
  basePath: '/api/positive-events/v1',
  tools: [
    {
      name: 'list_positive_geo_events',
      description:
        'Get positive global events — peace agreements, humanitarian achievements, environmental wins, scientific breakthroughs, and other uplifting news. Used by the "Happy Monitor" variant.',
      endpoint: '/list-positive-geo-events',
    },
  ],
};
