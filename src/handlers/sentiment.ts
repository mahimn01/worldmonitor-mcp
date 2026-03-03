/**
 * Sentiment and flow direct handlers — social sentiment, Fear & Greed Index,
 * and options flow indicators.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const getSocialSentiment: DirectHandler = async (params) => {
  const symbol = (params.symbol as string).toUpperCase();

  // Try Finnhub social sentiment if key available
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      return await fetchJson(
        `https://finnhub.io/api/v1/stock/social-sentiment?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`,
      );
    } catch {
      // Fall through
    }
  }

  // Try StockTwits (may be blocked by Cloudflare)
  try {
    return await fetchJson(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      },
    );
  } catch {
    // StockTwits blocked by Cloudflare
  }

  return {
    symbol,
    message:
      'Social sentiment requires FINNHUB_API_KEY for reliable access. ' +
      'Get a free key at https://finnhub.io/register. ' +
      'StockTwits is blocked by Cloudflare anti-bot protection.',
    alternative:
      'Use the Fear & Greed Index (get_fear_greed_detail) for broad market sentiment.',
  };
};

const getFearGreedDetail: DirectHandler = async () => {
  // alternative.me provides the Crypto Fear & Greed Index
  const data = await fetchJson<{
    data: { value: string; value_classification: string; timestamp: string }[];
  }>('https://api.alternative.me/fng/?limit=10&format=json');
  return data;
};

const getOptionsFlow: DirectHandler = async (params) => {
  const _symbol = (params.symbol as string | undefined) ?? 'SPY';

  // Try CBOE delayed quotes API for VIX data
  try {
    const data = await fetchJson(
      'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX.json',
    );
    return {
      source: 'CBOE',
      note: 'VIX and related options data from CBOE delayed quotes',
      data,
    };
  } catch {
    // CBOE CDN may be unavailable
  }

  // Fallback: use Yahoo Finance VIX quote
  try {
    const data = await fetchJson(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d',
    );
    return {
      source: 'Yahoo Finance',
      note: 'VIX historical data as options sentiment proxy',
      data,
    };
  } catch {
    return {
      source: 'unavailable',
      message:
        'Options flow data currently unavailable. Use VIX from market quotes (list_market_quotes --symbols=^VIX) as a proxy.',
    };
  }
};

export const sentimentHandlers: Record<string, DirectHandler> = {
  get_social_sentiment: getSocialSentiment,
  get_fear_greed_detail: getFearGreedDetail,
  get_options_flow: getOptionsFlow,
};
