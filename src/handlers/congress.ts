/**
 * Congressional trading direct handlers — House and Senate stock trades
 * from public STOCK Act disclosures.
 *
 * Primary: Scrapes Capitol Trades HTML table (free, no key needed).
 * Fallback: Finnhub premium tier if FINNHUB_API_KEY is set.
 */

import { DirectHandler } from '../types.js';
import { fetchJson, fetchText } from './_http.js';

const CAPITOL_TRADES_BASE = 'https://www.capitoltrades.com';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface ParsedTrade {
  politician: string;
  party: string;
  chamber: string;
  state: string;
  issuer: string;
  published: string;
  traded: string;
  filed_after: string;
  owner: string;
  type: string;
  size: string;
  price: string;
}

/**
 * Parse trade rows from Capitol Trades HTML table.
 */
function parseTradesTable(html: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];

  // Extract table body rows
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return trades;

  const rows = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rows) {
    // Extract text from each cell
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    const cellTexts = cells.map((c) =>
      c
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );

    if (cellTexts.length < 8) continue;

    // Cell order: Politician, Traded Issuer, Published, Traded, Filed After, Owner, Type, Size, Price
    const politicianText = cellTexts[0] || '';
    // Parse "Name Party Chamber State" pattern
    const partyMatch = politicianText.match(/(Democrat|Republican|Independent)/i);
    const chamberMatch = politicianText.match(/(House|Senate)/i);
    const stateMatch = politicianText.match(/\b([A-Z]{2})\s*$/);

    trades.push({
      politician: politicianText
        .replace(/(Democrat|Republican|Independent|House|Senate)/gi, '')
        .replace(/\b[A-Z]{2}\s*$/, '')
        .trim(),
      party: partyMatch?.[1] || '',
      chamber: chamberMatch?.[1] || '',
      state: stateMatch?.[1] || '',
      issuer: cellTexts[1] || '',
      published: cellTexts[2] || '',
      traded: cellTexts[3] || '',
      filed_after: cellTexts[4] || '',
      owner: cellTexts[5] || '',
      type: cellTexts[6] || '',
      size: cellTexts[7] || '',
      price: cellTexts[8] || '',
    });
  }

  return trades;
}

/**
 * Try Finnhub congressional trading (premium endpoint).
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
    return null;
  }
}

const listCongressTrades: DirectHandler = async (params) => {
  const pageSize = (params.limit as number) || 20;

  // Primary: scrape Capitol Trades HTML
  try {
    const url = `${CAPITOL_TRADES_BASE}/trades?pageSize=${pageSize}`;
    const html = await fetchText(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      timeout: 20_000,
    });

    const trades = parseTradesTable(html);
    if (trades.length > 0) {
      return {
        source: 'Capitol Trades',
        total: trades.length,
        trades,
        note: 'Recent congressional stock trades from STOCK Act disclosures',
        source_url: url,
      };
    }
  } catch {
    // Fall through
  }

  // Fallback: Finnhub premium
  const finnhubData = await tryFinnhub(params);
  if (finnhubData) return finnhubData;

  return {
    message:
      'Congressional trading data temporarily unavailable. ' +
      'Browse manually at https://www.capitoltrades.com/trades',
    sources: [
      { name: 'Capitol Trades', url: 'https://www.capitoltrades.com/trades' },
      { name: 'Senate EFD', url: 'https://efdsearch.senate.gov/search/' },
      {
        name: 'House EFD',
        url: 'https://disclosures-clerk.house.gov/FinancialDisclosure',
      },
    ],
  };
};

const getCongressMemberTrades: DirectHandler = async (params) => {
  const member = params.member as string;
  const pageSize = (params.limit as number) || 20;

  // Primary: scrape Capitol Trades with politician filter
  try {
    const url = `${CAPITOL_TRADES_BASE}/trades?politician=${encodeURIComponent(member)}&pageSize=${pageSize}`;
    const html = await fetchText(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      timeout: 20_000,
    });

    const trades = parseTradesTable(html);
    if (trades.length > 0) {
      return {
        source: 'Capitol Trades',
        member,
        total: trades.length,
        trades,
        source_url: url,
      };
    }

    // Even if no trades in table, may mean the search returned nothing
    return {
      source: 'Capitol Trades',
      member,
      total: 0,
      trades: [],
      note: `No recent trades found for "${member}". Try a different name spelling.`,
      source_url: url,
    };
  } catch {
    // Fall through
  }

  // Fallback: Finnhub premium
  const finnhubData = await tryFinnhub(params);
  if (finnhubData) {
    const data = finnhubData as { data?: Array<Record<string, unknown>> };
    const trades = (data.data || []).filter((t) =>
      ((t.name as string) || '').toLowerCase().includes(member.toLowerCase()),
    );
    return {
      member,
      total: trades.length,
      trades: trades.slice(0, pageSize),
    };
  }

  return {
    member,
    message: 'Congressional member trade lookup temporarily unavailable.',
    search_url: `${CAPITOL_TRADES_BASE}/trades?politician=${encodeURIComponent(member)}`,
  };
};

export const congressHandlers: Record<string, DirectHandler> = {
  list_congress_trades: listCongressTrades,
  get_congress_member_trades: getCongressMemberTrades,
};
