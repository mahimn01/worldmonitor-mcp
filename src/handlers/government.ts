/**
 * Government and regulatory direct handlers — Federal Register, USAspending,
 * and trade.gov consolidated screening list (sanctions).
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const searchFederalRegister: DirectHandler = async (params) => {
  const url = new URL(
    'https://www.federalregister.gov/api/v1/documents.json',
  );
  url.searchParams.set('conditions[term]', params.q as string);
  if (params.document_type) {
    url.searchParams.set(
      'conditions[type][]',
      params.document_type as string,
    );
  }
  if (params.agency) {
    url.searchParams.set(
      'conditions[agencies][]',
      params.agency as string,
    );
  }
  url.searchParams.set('per_page', String((params.per_page as number) || 20));
  url.searchParams.set('order', 'newest');
  return fetchJson(url.toString());
};

const getGovernmentContracts: DirectHandler = async (params) => {
  const limit = (params.limit as number) || 25;
  const now = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

  const filters: Record<string, unknown> = {
    time_period: [{ start_date: yearAgo, end_date: now }],
    award_type_codes: ['A', 'B', 'C', 'D'],
  };

  if (params.keyword) {
    (filters as Record<string, unknown>).keywords = [params.keyword];
  }
  if (params.agency) {
    (filters as Record<string, unknown>).agencies = [
      { type: 'funding', tier: 'toptier', name: params.agency },
    ];
  }
  if (params.min_amount) {
    (filters as Record<string, unknown>).award_amounts = [
      { lower_bound: params.min_amount },
    ];
  }

  return fetchJson(
    'https://api.usaspending.gov/api/v2/search/spending_by_award/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters,
        limit,
        page: 1,
        sort: 'Award Amount',
        order: 'desc',
        subawards: false,
      }),
      tlsPermissive: true,
    },
  );
};

const getSanctionsSearch: DirectHandler = async (params) => {
  const url = new URL(
    'https://api.trade.gov/gateway/v1/consolidated_screening_list/search',
  );
  url.searchParams.set('api_key', process.env.TRADE_GOV_API_KEY || 'ii1PmMOz3cAkH3wy1O3VAvL0');
  url.searchParams.set('q', params.name as string);
  if (params.type) url.searchParams.set('type', params.type as string);
  url.searchParams.set('size', '25');
  return fetchJson(url.toString());
};

export const governmentHandlers: Record<string, DirectHandler> = {
  search_federal_register: searchFederalRegister,
  get_government_contracts: getGovernmentContracts,
  get_sanctions_search: getSanctionsSearch,
};
