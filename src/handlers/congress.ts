/**
 * Congressional trading direct handlers — House and Senate stock trades
 * from public STOCK Act disclosures via Finnhub API.
 *
 * Requires FINNHUB_API_KEY environment variable.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error(
      'FINNHUB_API_KEY environment variable is required for congressional trading data. ' +
        'Get a free key at https://finnhub.io/register',
    );
  }
  return key;
}

const listCongressTrades: DirectHandler = async (params) => {
  const key = getApiKey();
  const symbol = (params.ticker as string) || '';
  const url = new URL(`${FINNHUB_BASE}/stock/congressional-trading`);
  url.searchParams.set('token', key);
  if (symbol) url.searchParams.set('symbol', symbol.toUpperCase());

  const fromDate =
    (params.from_date as string) ||
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const toDate =
    (params.to_date as string) || new Date().toISOString().slice(0, 10);
  url.searchParams.set('from', fromDate);
  url.searchParams.set('to', toDate);

  return fetchJson(url.toString());
};

const getCongressMemberTrades: DirectHandler = async (params) => {
  const key = getApiKey();
  // Finnhub doesn't have a per-member endpoint, so we fetch recent trades
  // and filter by name
  const member = (params.member as string).toLowerCase();
  const limit = (params.limit as number) || 50;

  const fromDate = new Date(Date.now() - 365 * 86400000)
    .toISOString()
    .slice(0, 10);
  const toDate = new Date().toISOString().slice(0, 10);

  const url = new URL(`${FINNHUB_BASE}/stock/congressional-trading`);
  url.searchParams.set('token', key);
  url.searchParams.set('from', fromDate);
  url.searchParams.set('to', toDate);

  const data = (await fetchJson(url.toString())) as {
    data?: Array<Record<string, unknown>>;
  };
  const trades = (data.data || []).filter((t) =>
    ((t.name as string) || '').toLowerCase().includes(member),
  );

  return {
    member: params.member,
    total: trades.length,
    trades: trades.slice(0, limit),
  };
};

export const congressHandlers: Record<string, DirectHandler> = {
  list_congress_trades: listCongressTrades,
  get_congress_member_trades: getCongressMemberTrades,
};
