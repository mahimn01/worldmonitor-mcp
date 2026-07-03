/**
 * Real insider-activity signal — parses SEC Form 4 XML for actual open-market
 * buys vs sells (the submissions index only says a Form 4 was filed, which is
 * noise since sells/grants/exercises vastly outnumber open-market buys).
 *
 * Parsing rules (correctness-critical):
 *  - Every field is extracted from its OWN element block first, then the
 *    `<value>` matched INSIDE it. A lazy cross-element regex would bleed past
 *    footnote-only elements (`<transactionPricePerShare><footnoteId/></...>`)
 *    and capture the next numeric value (e.g. sharesOwnedFollowingTransaction)
 *    as the price — fabricating dollar amounts.
 *  - Only NON-DERIVATIVE P/S transactions count toward the open-market net;
 *    derivative-table P/S (options trades) are reported separately, never
 *    summed as if they were common shares.
 *  - Transactions are deduplicated by (owner, code, shares, price, date)
 *    signature so Form 4/A amendments that restate the original don't
 *    double-count. Corrected amendments with changed values may still overlap
 *    (noted in output).
 *
 * All SEC fetches go through the shared rate limiter in _sec.ts.
 */

import type { DirectHandler, ToolContext } from '../types.js';
import { secFetchText } from './_sec.js';
import { ensureContext, mapLimit, settle } from './_invoke.js';
import { resolveCik } from './_tickers.js';

const PARSE_CONCURRENCY = 3; // rides on top of the global SEC limiter
const MAX_FILINGS = 25;

interface TxnLine {
  code: string;
  shares: number;
  price: number | null;
  ad: 'A' | 'D' | null;
  date: string | null;
  derivative: boolean;
}

interface InsiderTxnRow {
  form?: string;
  filingDate?: string;
  documentUrl?: string;
  accessionNumber?: string;
}

function firstMatch(s: string, re: RegExp): string | null {
  const m = re.exec(s);
  return m ? m[1] : null;
}

function blocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/** Extract `<value>` from INSIDE the named element only — never bleeds past it. */
function elementValue(block: string, tag: string): string | null {
  const inner = firstMatch(block, new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (inner === null) return null;
  return firstMatch(inner, /<value>\s*([^<\s][^<]*?)\s*<\/value>/);
}

function numericValue(block: string, tag: string): number | null {
  const v = elementValue(block, tag);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseTxnBlock(b: string, derivative: boolean): TxnLine | null {
  const code = firstMatch(b, /<transactionCode>\s*([A-Z])\s*<\/transactionCode>/);
  if (!code) return null;
  const adRaw = elementValue(b, 'transactionAcquiredDisposedCode');
  return {
    code,
    shares: numericValue(b, 'transactionShares') ?? 0,
    price: numericValue(b, 'transactionPricePerShare'),
    ad: adRaw === 'A' || adRaw === 'D' ? adRaw : null,
    date: elementValue(b, 'transactionDate'),
    derivative,
  };
}

export function parseForm4Xml(xml: string): { owner: string | null; txns: TxnLine[] } {
  // Joint filings (10%+ owner groups) list multiple reportingOwner blocks —
  // capture ALL names so attribution and dedup keys don't collapse to the first.
  const owners: string[] = [];
  const ownerRe = /<rptOwnerName>([^<]+)<\/rptOwnerName>/g;
  let om: RegExpExecArray | null;
  while ((om = ownerRe.exec(xml)) !== null) owners.push(om[1].trim());
  const owner = owners.length ? [...new Set(owners)].sort().join('; ') : null;
  const txns: TxnLine[] = [];
  for (const b of blocks(xml, 'nonDerivativeTransaction')) {
    const t = parseTxnBlock(b, false);
    if (t) txns.push(t);
  }
  for (const b of blocks(xml, 'derivativeTransaction')) {
    const t = parseTxnBlock(b, true);
    if (t) txns.push(t);
  }
  return { owner: owner ? owner.trim() : null, txns };
}

function daysAgo(dateStr: string | undefined, now: number): number {
  if (!dateStr) return Infinity;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / 86_400_000;
}

/** Strip the XSLT render segment and use the www host (confirmed reachable). */
function rawXmlUrl(documentUrl: string): string {
  return documentUrl
    .replace(/\/xsl[^/]*\//, '/')
    .replace('://data.sec.gov/', '://www.sec.gov/');
}

export const getInsiderActivity: DirectHandler = async (params, ctxArg) => {
  const ctx: ToolContext = ensureContext(ctxArg);
  // Explicit finite-number validation — `|| default` would silently turn an
  // explicit 0 (or garbage) into the default instead of clamping/erroring.
  const wdRaw = Number(params.window_days);
  const windowDays =
    params.window_days === undefined || !Number.isFinite(wdRaw)
      ? 90
      : Math.max(1, Math.floor(wdRaw));
  const limRaw = Number(params.limit);
  // Clamp to [1, MAX_FILINGS] — a negative limit would bypass the cap via
  // Math.min and then slice(0, -1) most of the listing back in.
  const limit =
    params.limit === undefined || !Number.isFinite(limRaw)
      ? 15
      : Math.min(Math.max(1, Math.floor(limRaw)), MAX_FILINGS);
  const symbol = params.symbol ? String(params.symbol).toUpperCase() : undefined;

  // Resolve CIK (param wins; else from symbol). A resolver FAILURE is reported
  // distinctly from "this symbol has no issuer".
  let cik = params.cik ? String(params.cik) : undefined;
  let company: string | undefined;
  if (!cik && symbol) {
    let info;
    try {
      info = await resolveCik(ctx, symbol);
    } catch (e) {
      return {
        symbol,
        coverage: 'cik_lookup_failed',
        error: true,
        message: `CIK resolution unavailable (SEC ticker map fetch failed): ${e instanceof Error ? e.message : 'unknown'}`,
      };
    }
    if (!info) {
      return {
        symbol,
        coverage: 'no_cik',
        note: `No issuer CIK for ${symbol} (ETF/index/crypto or unlisted) — no Form 4 data.`,
      };
    }
    cik = info.cik;
    company = info.title;
  }
  if (!cik) {
    return { error: true, message: 'Provide a symbol or cik.' };
  }

  // Reuse the existing filing-list tool, then parse each raw XML.
  const listed = await settle<{
    company?: string;
    transactions?: InsiderTxnRow[];
  }>(ctx, 'get_insider_transactions', { cik, limit: Math.max(limit * 2, 30) });
  if (!listed.ok) {
    return { symbol, cik, coverage: 'list_failed', error: true, message: listed.error };
  }
  company = listed.data?.company ?? company;
  const now = Date.now();
  const recent = (listed.data?.transactions ?? [])
    .filter((t) => daysAgo(t.filingDate, now) <= windowDays)
    .slice(0, limit);

  const parsed = await mapLimit(recent, PARSE_CONCURRENCY, async (t) => {
    if (!t.documentUrl) return null;
    try {
      const xml = await secFetchText(rawXmlUrl(t.documentUrl), { timeout: 15_000 });
      return {
        ...parseForm4Xml(xml),
        filingDate: t.filingDate,
        form: t.form,
        accession: t.accessionNumber,
      };
    } catch {
      return null;
    }
  });

  let buyShares = 0,
    sellShares = 0,
    buyUsd = 0,
    sellUsd = 0,
    buyCount = 0,
    sellCount = 0,
    otherCount = 0,
    derivativePs = 0,
    dedupedCount = 0,
    parsedCount = 0;
  const buyers = new Set<string>();
  const sellers = new Set<string>();
  // sig → first filing seen. Dedup ONLY across DIFFERENT filings where one
  // side is a 4/A (amendment restating the original) — two identical lines in
  // the SAME filing (direct + via-trust lots) are legitimately distinct.
  const seenTxn = new Map<string, { accession?: string; form?: string }>();

  for (const f of parsed) {
    if (!f) continue;
    parsedCount++;
    for (const tx of f.txns) {
      if (tx.code !== 'P' && tx.code !== 'S') {
        otherCount++;
        continue;
      }
      if (tx.derivative) {
        // Options-table P/S — NOT common shares; count, don't sum.
        derivativePs++;
        continue;
      }
      const sig = `${f.owner ?? ''}|${tx.code}|${tx.shares}|${tx.price ?? ''}|${tx.date ?? ''}`;
      const prior = seenTxn.get(sig);
      if (
        prior &&
        prior.accession !== f.accession &&
        (prior.form === '4/A' || f.form === '4/A')
      ) {
        dedupedCount++;
        continue;
      }
      if (!prior) seenTxn.set(sig, { accession: f.accession, form: f.form });
      if (tx.code === 'P') {
        buyShares += tx.shares;
        if (tx.price) buyUsd += tx.shares * tx.price;
        buyCount++;
        if (f.owner) buyers.add(f.owner);
      } else {
        sellShares += tx.shares;
        if (tx.price) sellUsd += tx.shares * tx.price;
        sellCount++;
        if (f.owner) sellers.add(f.owner);
      }
    }
  }

  return {
    symbol,
    cik,
    company,
    window_days: windowDays,
    filings_found: recent.length,
    filings_parsed: parsedCount,
    open_market: {
      buy_count: buyCount,
      sell_count: sellCount,
      net_buy_shares: Math.round(buyShares - sellShares),
      net_buy_usd: Math.round(buyUsd - sellUsd),
      buy_usd: Math.round(buyUsd),
      sell_usd: Math.round(sellUsd),
      distinct_buyers: buyers.size,
      distinct_sellers: sellers.size,
    },
    derivative_open_market_txns: derivativePs,
    non_open_market_txns: otherCount,
    amendment_deduped_txns: dedupedCount,
    note:
      'Net = NON-DERIVATIVE open-market purchases (P) minus sales (S) only; ' +
      'derivative-table P/S counted separately; grants/exercises/gifts/tax (A/M/G/F/C) excluded. ' +
      'Footnote-only prices contribute $0 (shares still counted). 4/A restatements deduplicated by ' +
      'transaction signature; corrected amendments may still overlap. Informational, not advice.',
  };
};
