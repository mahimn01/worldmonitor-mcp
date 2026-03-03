import { ServiceDef } from '../types.js';

export const sentiment: ServiceDef = {
  name: 'sentiment',
  description:
    'Market sentiment and flow data — StockTwits social sentiment, Fear & Greed Index components, and options flow indicators',
  basePath: '/api/sentiment/v1',
  tools: [
    {
      name: 'get_social_sentiment',
      description:
        'Get social media sentiment for a stock symbol from StockTwits — bullish/bearish ratio, message volume, and trending status.',
      params: {
        symbol: {
          type: 'string',
          description:
            'Stock ticker symbol (e.g. "AAPL", "TSLA", "SPY", "BTC.X")',
          required: true,
        },
      },
      endpoint: '/get-social-sentiment',
    },
    {
      name: 'get_fear_greed_detail',
      description:
        'Get the Fear & Greed Index with historical values — current value, classification (Extreme Fear to Extreme Greed), and recent trend.',
      endpoint: '/get-fear-greed-detail',
    },
    {
      name: 'get_options_flow',
      description:
        'Get options market indicators — VIX data and related options sentiment data from CBOE.',
      params: {
        symbol: {
          type: 'string',
          description:
            'Stock ticker for options data (e.g. "SPY", "QQQ"). Defaults to broad market.',
        },
      },
      endpoint: '/get-options-flow',
    },
  ],
};
