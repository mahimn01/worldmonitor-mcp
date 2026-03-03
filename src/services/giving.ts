import { ServiceDef } from '../types.js';

export const giving: ServiceDef = {
  name: 'giving',
  description:
    'Global humanitarian giving — donation trends, platform summaries, and category breakdowns from GiveWell and charity data aggregators',
  basePath: '/api/giving/v1',
  tools: [
    {
      name: 'get_giving_summary',
      description:
        'Get global humanitarian giving summary — total donations, top platforms, category breakdowns (health, education, disaster relief, etc.), and trend data.',
      params: {
        platform_limit: {
          type: 'number',
          description: 'Max platforms to return',
        },
        category_limit: {
          type: 'number',
          description: 'Max categories to return',
        },
      },
      endpoint: '/get-giving-summary',
    },
  ],
};
