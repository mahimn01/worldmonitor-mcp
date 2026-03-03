/**
 * SEC EDGAR direct handlers — insider transactions, institutional holdings,
 * company filings, XBRL facts, and full-text search.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const SEC_EFTS = 'https://efts.sec.gov/LATEST';
const SEC_DATA = 'https://data.sec.gov';
const SEC_UA = 'worldmonitor-mcp/1.0 (worldmonitor@example.com)';
const SEC_HEADERS = { 'User-Agent': SEC_UA };

function padCik(cik: string): string {
  return cik.replace(/^0*/, '').padStart(10, '0');
}

interface SecSubmissions {
  cik: string;
  entityType: string;
  name: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

const searchSecFilings: DirectHandler = async (params) => {
  const q = params.q as string;
  const url = new URL(`${SEC_EFTS}/search-index`);
  url.searchParams.set('q', q);
  url.searchParams.set('dateRange', 'custom');
  if (params.forms) url.searchParams.set('forms', params.forms as string);
  if (params.start_date) url.searchParams.set('startdt', params.start_date as string);
  if (params.end_date) url.searchParams.set('enddt', params.end_date as string);
  if (params.from) url.searchParams.set('from', String(params.from));
  return fetchJson(url.toString(), { headers: SEC_HEADERS });
};

const getInsiderTransactions: DirectHandler = async (params) => {
  const cik = padCik(params.cik as string);
  const limit = (params.limit as number) || 20;

  const data = await fetchJson<SecSubmissions>(
    `${SEC_DATA}/submissions/CIK${cik}.json`,
    { headers: SEC_HEADERS },
  );

  const recent = data.filings.recent;
  const form4Indices: number[] = [];
  for (let i = 0; i < recent.form.length && form4Indices.length < limit; i++) {
    if (recent.form[i] === '4' || recent.form[i] === '4/A') {
      form4Indices.push(i);
    }
  }

  return {
    company: data.name,
    cik,
    total_form4_found: form4Indices.length,
    transactions: form4Indices.map((i) => ({
      form: recent.form[i],
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      description: recent.primaryDocDescription[i],
      accessionNumber: recent.accessionNumber[i],
      documentUrl: `${SEC_DATA}/Archives/edgar/data/${parseInt(cik, 10)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
    })),
  };
};

const getInstitutionalHoldings: DirectHandler = async (params) => {
  const cik = padCik(params.cik as string);
  const limit = (params.limit as number) || 50;

  const data = await fetchJson<SecSubmissions>(
    `${SEC_DATA}/submissions/CIK${cik}.json`,
    { headers: SEC_HEADERS },
  );

  const recent = data.filings.recent;
  const f13Indices: number[] = [];
  for (let i = 0; i < recent.form.length && f13Indices.length < limit; i++) {
    if (recent.form[i] === '13F-HR' || recent.form[i] === '13F-HR/A') {
      f13Indices.push(i);
    }
  }

  return {
    institution: data.name,
    cik,
    total_13f_found: f13Indices.length,
    filings: f13Indices.map((i) => ({
      form: recent.form[i],
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      accessionNumber: recent.accessionNumber[i],
      documentUrl: `${SEC_DATA}/Archives/edgar/data/${parseInt(cik, 10)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
    })),
  };
};

const getCompanyFilings: DirectHandler = async (params) => {
  const cik = padCik(params.cik as string);
  const limit = (params.limit as number) || 20;
  const typeFilter = params.type as string | undefined;

  const data = await fetchJson<SecSubmissions>(
    `${SEC_DATA}/submissions/CIK${cik}.json`,
    { headers: SEC_HEADERS },
  );

  const recent = data.filings.recent;
  const indices: number[] = [];
  for (let i = 0; i < recent.form.length && indices.length < limit; i++) {
    if (!typeFilter || recent.form[i] === typeFilter) {
      indices.push(i);
    }
  }

  return {
    company: data.name,
    cik,
    filings: indices.map((i) => ({
      form: recent.form[i],
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      description: recent.primaryDocDescription[i],
      accessionNumber: recent.accessionNumber[i],
      documentUrl: `${SEC_DATA}/Archives/edgar/data/${parseInt(cik, 10)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
    })),
  };
};

const getCompanyFacts: DirectHandler = async (params) => {
  const cik = padCik(params.cik as string);
  const fact = params.fact as string | undefined;

  const data = await fetchJson<Record<string, unknown>>(
    `${SEC_DATA}/api/xbrl/companyfacts/CIK${cik}.json`,
    { headers: SEC_HEADERS },
  );

  if (fact) {
    const [taxonomy, concept] = fact.split(':');
    const facts = data.facts as Record<string, Record<string, unknown>> | undefined;
    return facts?.[taxonomy]?.[concept] ?? { error: `Fact "${fact}" not found` };
  }

  return data;
};

export const secEdgarHandlers: Record<string, DirectHandler> = {
  search_sec_filings: searchSecFilings,
  get_insider_transactions: getInsiderTransactions,
  get_institutional_holdings: getInstitutionalHoldings,
  get_company_filings: getCompanyFilings,
  get_company_facts: getCompanyFacts,
};
