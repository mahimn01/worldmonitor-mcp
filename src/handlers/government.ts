/**
 * Government and regulatory direct handlers — Federal Register, USAspending,
 * and trade.gov consolidated screening list (sanctions).
 */

import { DirectHandler } from '../types.js';
import { fetchJson, fetchText } from './_http.js';

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
        fields: [
          'Award ID',
          'Recipient Name',
          'Award Amount',
          'Awarding Agency',
          'Awarding Sub Agency',
          'Award Type',
          'Start Date',
          'End Date',
          'Description',
        ],
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
  const name = params.name as string;
  const nameLower = name.toLowerCase();

  // Use OpenSanctions API if key is available (best structured data)
  const osKey = process.env.OPENSANCTIONS_API_KEY;
  if (osKey) {
    const url = new URL('https://api.opensanctions.org/search/default');
    url.searchParams.set('q', name);
    if (params.type) url.searchParams.set('schema', params.type as string);
    url.searchParams.set('limit', '25');
    return fetchJson(url.toString(), {
      headers: { Authorization: `ApiKey ${osKey}` },
    });
  }

  // Primary free source: OFAC SDN CSV (public download, no key needed)
  // Downloads the full SDN list and searches locally
  try {
    const csv = await fetchText(
      'https://www.treasury.gov/ofac/downloads/sdn.csv',
      { tlsPermissive: true, timeout: 30_000 },
    );

    const lines = csv.split('\n');
    const matches: {
      sdn_id: string;
      name: string;
      type: string;
      country: string;
      program: string;
      remarks: string;
    }[] = [];

    for (const line of lines) {
      if (!line.toLowerCase().includes(nameLower)) continue;

      // SDN CSV format: id,"name","type","country","program",...,"remarks"
      // Parse CSV properly handling quoted fields with commas inside
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      fields.push(current.trim());

      const clean = (s: string) => s.replace(/-0-/g, '').trim();

      matches.push({
        sdn_id: clean(fields[0] || ''),
        name: clean(fields[1] || ''),
        type: clean(fields[2] || ''),
        country: clean(fields[3] || ''),
        program: clean(fields[4] || ''),
        remarks: clean(fields[11] || fields[fields.length - 1] || ''),
      });

      if (matches.length >= 25) break;
    }

    return {
      source: 'OFAC SDN List (US Treasury)',
      query: name,
      total_matches: matches.length,
      results: matches,
      note: 'Searched the official OFAC Specially Designated Nationals list',
      list_date: 'Current as of latest Treasury publication',
    };
  } catch {
    return {
      query: name,
      message:
        'Sanctions search temporarily unavailable. ' +
        'Set OPENSANCTIONS_API_KEY for reliable access (https://opensanctions.org).',
      manual_search_url: 'https://sanctionssearch.ofac.treas.gov/',
    };
  }
};

export const governmentHandlers: Record<string, DirectHandler> = {
  search_federal_register: searchFederalRegister,
  get_government_contracts: getGovernmentContracts,
  get_sanctions_search: getSanctionsSearch,
};
