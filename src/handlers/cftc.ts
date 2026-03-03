/**
 * CFTC Commitments of Traders direct handlers — trader positioning in futures markets.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

// CFTC Disaggregated Futures-Only COT via Socrata/SODA API
const CFTC_API = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

const getCotReport: DirectHandler = async (params) => {
  const limit = (params.limit as number) || 25;
  const url = new URL(CFTC_API);
  url.searchParams.set('$limit', String(limit));
  url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  if (params.market) {
    url.searchParams.set(
      '$where',
      `upper(market_and_exchange_names) like upper('%${(params.market as string).replace(/'/g, "''")}%')`,
    );
  }
  return fetchJson(url.toString());
};

const getCotPositions: DirectHandler = async (params) => {
  const code = params.contract_code as string;
  const weeks = (params.weeks as number) || 12;
  const url = new URL(CFTC_API);
  url.searchParams.set('cftc_contract_market_code', code);
  url.searchParams.set('$limit', String(weeks));
  url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  return fetchJson(url.toString());
};

export const cftcHandlers: Record<string, DirectHandler> = {
  get_cot_report: getCotReport,
  get_cot_positions: getCotPositions,
};
