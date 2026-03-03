/**
 * Congressional trading direct handlers — House and Senate stock trades
 * from public STOCK Act disclosures.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const HOUSE_URL =
  'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json';
const SENATE_URL =
  'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json';

// In-memory cache to avoid re-downloading large JSON files every call
let houseCache: Record<string, unknown>[] | null = null;
let senateCache: Record<string, unknown>[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function loadTrades(): Promise<{
  house: Record<string, unknown>[];
  senate: Record<string, unknown>[];
}> {
  const now = Date.now();
  if (houseCache && senateCache && now - cacheTime < CACHE_TTL) {
    return { house: houseCache, senate: senateCache };
  }
  const [house, senate] = await Promise.all([
    fetchJson<Record<string, unknown>[]>(HOUSE_URL, { timeout: 20_000 }),
    fetchJson<Record<string, unknown>[]>(SENATE_URL, { timeout: 20_000 }),
  ]);
  houseCache = house;
  senateCache = senate;
  cacheTime = now;
  return { house, senate };
}

const listCongressTrades: DirectHandler = async (params) => {
  const chamber = ((params.chamber as string) || 'both').toLowerCase();
  const ticker = params.ticker as string | undefined;
  const limit = (params.limit as number) || 50;

  const { house, senate } = await loadTrades();
  let trades: Record<string, unknown>[] = [];

  if (chamber === 'house' || chamber === 'both') trades.push(...house);
  if (chamber === 'senate' || chamber === 'both') trades.push(...senate);

  if (ticker) {
    const upper = ticker.toUpperCase();
    trades = trades.filter(
      (t) => (t.ticker as string)?.toUpperCase() === upper,
    );
  }

  // Sort by disclosure_date descending
  trades.sort((a, b) =>
    ((b.disclosure_date as string) || '').localeCompare(
      (a.disclosure_date as string) || '',
    ),
  );

  return { total: trades.length, trades: trades.slice(0, limit) };
};

const getCongressMemberTrades: DirectHandler = async (params) => {
  const member = (params.member as string).toLowerCase();
  const limit = (params.limit as number) || 50;

  const { house, senate } = await loadTrades();
  const all = [...house, ...senate];

  const memberTrades = all.filter((t) =>
    ((t.representative as string) || (t.senator as string) || '')
      .toLowerCase()
      .includes(member),
  );

  memberTrades.sort((a, b) =>
    ((b.disclosure_date as string) || '').localeCompare(
      (a.disclosure_date as string) || '',
    ),
  );

  return {
    member: params.member,
    total: memberTrades.length,
    trades: memberTrades.slice(0, limit),
  };
};

export const congressHandlers: Record<string, DirectHandler> = {
  list_congress_trades: listCongressTrades,
  get_congress_member_trades: getCongressMemberTrades,
};
