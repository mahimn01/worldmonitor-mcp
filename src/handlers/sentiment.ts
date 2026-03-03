/**
 * Sentiment and flow direct handlers — social sentiment via Reddit,
 * Fear & Greed Index, and options flow from CBOE.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

interface RedditPost {
  data: {
    title: string;
    score: number;
    num_comments: number;
    selftext: string;
    link_flair_text: string | null;
    created_utc: number;
    author: string;
    permalink: string;
    upvote_ratio: number;
  };
}

const getSocialSentiment: DirectHandler = async (params) => {
  const symbol = (params.symbol as string).toUpperCase();

  // Primary: Reddit — free, reliable, no key needed
  // Map common tickers to their most active subreddits
  const subreddit = 'wallstreetbets';
  const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(symbol)}&restrict_sr=on&sort=hot&t=week&limit=25`;

  try {
    const data = await fetchJson<{
      data: { children: RedditPost[] };
    }>(searchUrl, {
      headers: { 'User-Agent': 'worldmonitor-mcp/1.0' },
    });

    const posts = data.data.children.map((p) => ({
      title: p.data.title,
      score: p.data.score,
      comments: p.data.num_comments,
      flair: p.data.link_flair_text,
      author: p.data.author,
      upvote_ratio: p.data.upvote_ratio,
      time: new Date(p.data.created_utc * 1000).toISOString(),
      url: `https://reddit.com${p.data.permalink}`,
    }));

    // Calculate aggregate sentiment signals
    const totalScore = posts.reduce((s, p) => s + p.score, 0);
    const totalComments = posts.reduce((s, p) => s + p.comments, 0);
    const avgUpvoteRatio = posts.length
      ? posts.reduce((s, p) => s + p.upvote_ratio, 0) / posts.length
      : 0;

    return {
      symbol,
      source: `r/${subreddit}`,
      period: 'past_week',
      summary: {
        post_count: posts.length,
        total_score: totalScore,
        total_comments: totalComments,
        avg_upvote_ratio: Math.round(avgUpvoteRatio * 100) / 100,
        buzz_level:
          posts.length >= 15
            ? 'very_high'
            : posts.length >= 8
              ? 'high'
              : posts.length >= 3
                ? 'moderate'
                : 'low',
      },
      posts: posts.slice(0, 15),
    };
  } catch {
    // Reddit occasionally rate-limits
  }

  // Fallback: Finnhub social sentiment (premium)
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      return await fetchJson(
        `https://finnhub.io/api/v1/stock/social-sentiment?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`,
      );
    } catch {
      // Premium endpoint
    }
  }

  return {
    symbol,
    message: 'Social sentiment data temporarily unavailable. Try again shortly.',
    alternative:
      'Use the Fear & Greed Index (get_fear_greed_detail) for broad market sentiment.',
  };
};

const getFearGreedDetail: DirectHandler = async (params) => {
  const days = (params.days as number) || 30;
  // alternative.me provides the Crypto Fear & Greed Index with history
  const data = await fetchJson<{
    data: { value: string; value_classification: string; timestamp: string }[];
  }>(`https://api.alternative.me/fng/?limit=${days}&format=json`);

  // Enrich with trend analysis
  const values = data.data.map((d) => Number(d.value));
  const latest = values[0];
  const avg7d = values.length >= 7
    ? Math.round(values.slice(0, 7).reduce((s, v) => s + v, 0) / 7)
    : latest;
  const avg30d = values.length >= 30
    ? Math.round(values.slice(0, 30).reduce((s, v) => s + v, 0) / 30)
    : avg7d;

  return {
    current: {
      value: latest,
      classification: data.data[0].value_classification,
    },
    trend: {
      avg_7d: avg7d,
      avg_30d: avg30d,
      direction: latest > avg7d ? 'improving' : latest < avg7d ? 'declining' : 'stable',
    },
    history: data.data,
  };
};

interface CboeOption {
  option: string;
  bid: number;
  ask: number;
  iv: number;
  open_interest: number;
  volume: number;
  delta: number;
}

const getOptionsFlow: DirectHandler = async (params) => {
  const symbol = ((params.symbol as string | undefined) ?? 'SPY').toUpperCase();

  // CBOE delayed quotes API — full options chain, free, no key needed
  try {
    const data = await fetchJson<{
      timestamp: string;
      data: { options: CboeOption[] };
    }>(`https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(symbol)}.json`);

    const options = data.data?.options || [];
    const calls = options.filter((o) => o.option?.includes('C'));
    const puts = options.filter((o) => o.option?.includes('P'));

    const callVolume = calls.reduce((s, o) => s + (o.volume || 0), 0);
    const putVolume = puts.reduce((s, o) => s + (o.volume || 0), 0);
    const callOI = calls.reduce((s, o) => s + (o.open_interest || 0), 0);
    const putOI = puts.reduce((s, o) => s + (o.open_interest || 0), 0);
    const pcRatioVol = callVolume > 0 ? Math.round((putVolume / callVolume) * 1000) / 1000 : 0;
    const pcRatioOI = callOI > 0 ? Math.round((putOI / callOI) * 1000) / 1000 : 0;

    // Top contracts by volume
    const topByVolume = [...options]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 20)
      .map((o) => ({
        contract: o.option,
        volume: o.volume,
        open_interest: o.open_interest,
        iv: Math.round((o.iv || 0) * 100) / 100,
        bid: o.bid,
        ask: o.ask,
      }));

    // Sentiment interpretation
    let sentiment: string;
    if (pcRatioVol > 1.5) sentiment = 'very_bearish';
    else if (pcRatioVol > 1.0) sentiment = 'bearish';
    else if (pcRatioVol > 0.7) sentiment = 'neutral';
    else if (pcRatioVol > 0.5) sentiment = 'bullish';
    else sentiment = 'very_bullish';

    return {
      symbol,
      source: 'CBOE',
      timestamp: data.timestamp,
      summary: {
        total_contracts: options.length,
        call_volume: callVolume,
        put_volume: putVolume,
        put_call_ratio_volume: pcRatioVol,
        call_open_interest: callOI,
        put_open_interest: putOI,
        put_call_ratio_oi: pcRatioOI,
        sentiment,
      },
      top_by_volume: topByVolume,
    };
  } catch {
    // CBOE may not have data for this symbol
  }

  return {
    symbol,
    message:
      `Options data for ${symbol} not available from CBOE. ` +
      'Try SPY, QQQ, IWM, or _SPX for index options.',
    tip: 'Use list_market_quotes with ^VIX for quick volatility check.',
  };
};

export const sentimentHandlers: Record<string, DirectHandler> = {
  get_social_sentiment: getSocialSentiment,
  get_fear_greed_detail: getFearGreedDetail,
  get_options_flow: getOptionsFlow,
};
