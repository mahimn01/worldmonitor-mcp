import { ServiceDef } from '../types.js';

export const sentiment: ServiceDef = {
  name: 'sentiment',
  description:
    'Market sentiment and flow data — Reddit social sentiment, Fear & Greed Index with history, and CBOE options flow with put/call ratios',
  basePath: '/api/sentiment/v1',
  tools: [
    {
      name: 'get_social_sentiment',
      description:
        'Get social media sentiment for a stock symbol from Reddit r/wallstreetbets — post count, score, comments, buzz level, and top posts.',
      params: {
        symbol: {
          type: 'string',
          description:
            'Stock ticker symbol (e.g. "AAPL", "TSLA", "SPY", "GME")',
          required: true,
        },
      },
      endpoint: '/get-social-sentiment',
    },
    {
      name: 'get_fear_greed_detail',
      description:
        'Get the Fear & Greed Index with up to 30 days of history — current value, 7d/30d averages, trend direction, and daily values.',
      params: {
        days: {
          type: 'number',
          description:
            'Number of days of history to return (default: 30, max: 365)',
        },
      },
      endpoint: '/get-fear-greed-detail',
    },
    {
      name: 'get_options_flow',
      description:
        'Get full options chain data from CBOE — put/call ratio by volume and open interest, top contracts by volume, IV data, and sentiment classification.',
      params: {
        symbol: {
          type: 'string',
          description:
            'Stock/ETF ticker for options data (e.g. "SPY", "QQQ", "IWM", "AAPL"). Defaults to SPY.',
        },
      },
      endpoint: '/get-options-flow',
    },
  ],
};
