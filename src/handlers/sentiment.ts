/**
 * Sentiment and flow direct handlers — social sentiment, Fear & Greed Index,
 * and options flow indicators.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const getSocialSentiment: DirectHandler = async (params) => {
  const symbol = (params.symbol as string).toUpperCase();
  return fetchJson(
    `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`,
  );
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

  // Try CBOE delayed quotes API for put/call data
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
    return {
      source: 'unavailable',
      message: 'CBOE options data currently unavailable. Use VIX from market quotes as a proxy.',
    };
  }
};

export const sentimentHandlers: Record<string, DirectHandler> = {
  get_social_sentiment: getSocialSentiment,
  get_fear_greed_detail: getFearGreedDetail,
  get_options_flow: getOptionsFlow,
};
