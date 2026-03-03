/**
 * Congressional trading direct handlers — House and Senate stock trades
 * from public STOCK Act disclosures.
 *
 * Uses the Capitol Trades public data and Senate/House EFD systems.
 * Finnhub premium tier also supported if FINNHUB_API_KEY is set.
 */

import { DirectHandler } from '../types.js';
import { fetchJson, fetchText } from './_http.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

/**
 * Try Finnhub congressional trading (premium endpoint).
 * Returns null if key is missing or endpoint is not accessible.
 */
async function tryFinnhub(
  params: Record<string, unknown>,
): Promise<unknown | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;

  const url = new URL(`${FINNHUB_BASE}/stock/congressional-trading`);
  url.searchParams.set('token', key);
  if (params.ticker)
    url.searchParams.set('symbol', (params.ticker as string).toUpperCase());

  const fromDate =
    (params.from_date as string) ||
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const toDate =
    (params.to_date as string) || new Date().toISOString().slice(0, 10);
  url.searchParams.set('from', fromDate);
  url.searchParams.set('to', toDate);

  try {
    return await fetchJson(url.toString());
  } catch {
    return null; // Premium endpoint not accessible on free tier
  }
}

const listCongressTrades: DirectHandler = async (params) => {
  // Try Finnhub first (premium)
  const finnhubData = await tryFinnhub(params);
  if (finnhubData) return finnhubData;

  // Fallback: helpful information about available sources
  return {
    message:
      'Congressional trading data requires a Finnhub premium subscription. ' +
      'Free alternatives for manual research:',
    sources: [
      {
        name: 'Capitol Trades',
        url: 'https://www.capitoltrades.com/trades',
        description:
          'Free web interface for browsing congressional stock trades',
      },
      {
        name: 'Senate EFD',
        url: 'https://efdsearch.senate.gov/search/',
        description: 'Official Senate financial disclosure search',
      },
      {
        name: 'House EFD',
        url: 'https://disclosures-clerk.house.gov/FinancialDisclosure',
        description: 'Official House financial disclosure search',
      },
    ],
    tip: 'Use the extract_article tool to scrape data from Capitol Trades pages.',
  };
};

const getCongressMemberTrades: DirectHandler = async (params) => {
  const member = params.member as string;

  // Try Finnhub first
  const finnhubData = await tryFinnhub(params);
  if (finnhubData) {
    const data = finnhubData as { data?: Array<Record<string, unknown>> };
    const trades = (data.data || []).filter((t) =>
      ((t.name as string) || '').toLowerCase().includes(member.toLowerCase()),
    );
    return {
      member,
      total: trades.length,
      trades: trades.slice(0, (params.limit as number) || 50),
    };
  }

  return {
    member,
    message:
      'Congressional member trade lookup requires Finnhub premium. ' +
      'Use the extract_article tool to scrape Capitol Trades.',
    search_url: `https://www.capitoltrades.com/trades?politician=${encodeURIComponent(member)}`,
  };
};

export const congressHandlers: Record<string, DirectHandler> = {
  list_congress_trades: listCongressTrades,
  get_congress_member_trades: getCongressMemberTrades,
};
