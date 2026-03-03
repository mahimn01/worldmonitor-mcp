import { ServiceDef } from '../types.js';

export const prediction: ServiceDef = {
  name: 'prediction',
  description:
    'Prediction markets — real-time odds and probabilities from Polymarket and other prediction platforms for geopolitical, economic, and political events',
  basePath: '/api/prediction/v1',
  tools: [
    {
      name: 'list_prediction_markets',
      description:
        'Get prediction market data — current odds/probabilities for geopolitical events, elections, economic outcomes, and other forecasted events from Polymarket.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        category: {
          type: 'string',
          description:
            'Category filter (e.g. "politics", "crypto", "sports", "science")',
        },
        query: {
          type: 'string',
          description:
            'Search query to filter markets (e.g. "election", "bitcoin", "war")',
        },
      },
      endpoint: '/list-prediction-markets',
    },
  ],
};
