/**
 * US Treasury direct handlers — yield curve rates, auction results, national debt.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const FISCAL_API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

const getTreasuryRates: DirectHandler = async (params) => {
  const days = (params.days as number) || 30;
  const url = new URL(`${FISCAL_API}/v2/accounting/od/avg_interest_rates`);
  url.searchParams.set('sort', '-record_date');
  url.searchParams.set('page[size]', String(days));
  url.searchParams.set(
    'fields',
    'record_date,security_desc,avg_interest_rate_amt',
  );
  return fetchJson(url.toString(), { tlsPermissive: true });
};

const getTreasuryAuctions: DirectHandler = async (params) => {
  const limit = (params.limit as number) || 20;
  const url = new URL(`${FISCAL_API}/v1/accounting/od/auctions_query`);
  url.searchParams.set('sort', '-auction_date');
  url.searchParams.set('page[size]', String(limit));
  if (params.security_type) {
    url.searchParams.set(
      'filter',
      `security_type:eq:${params.security_type}`,
    );
  }
  return fetchJson(url.toString(), { tlsPermissive: true });
};

const getDebtToPenny: DirectHandler = async (params) => {
  const days = (params.days as number) || 30;
  const url = new URL(`${FISCAL_API}/v2/accounting/od/debt_to_penny`);
  url.searchParams.set('sort', '-record_date');
  url.searchParams.set('page[size]', String(days));
  return fetchJson(url.toString(), { tlsPermissive: true });
};

export const treasuryHandlers: Record<string, DirectHandler> = {
  get_treasury_rates: getTreasuryRates,
  get_treasury_auctions: getTreasuryAuctions,
  get_debt_to_penny: getDebtToPenny,
};
