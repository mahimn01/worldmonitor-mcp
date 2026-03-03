/**
 * Economic calendar direct handlers — upcoming economic events, earnings, IPOs.
 * Uses Finnhub (free tier) with FRED release calendar as fallback.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function finnhubKey(): string | undefined {
  return process.env.FINNHUB_API_KEY || undefined;
}

function dateStr(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const getEconomicCalendar: DirectHandler = async (params) => {
  const days = (params.days as number) || 7;
  const from = dateStr(0);
  const to = dateStr(days);
  const key = finnhubKey();

  if (key) {
    const url = new URL(`${FINNHUB_BASE}/calendar/economic`);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('token', key);
    return fetchJson(url.toString());
  }

  // Fallback: FRED release dates
  const fredKey = process.env.FRED_API_KEY || 'DEMO_KEY';
  return fetchJson(
    `https://api.stlouisfed.org/fred/releases/dates?api_key=${fredKey}&file_type=json&include_release_dates_with_no_data=true&realtime_start=${from}&realtime_end=${to}`,
  );
};

const getEarningsCalendar: DirectHandler = async (params) => {
  const days = (params.days as number) || 7;
  const from = dateStr(0);
  const to = dateStr(days);
  const key = finnhubKey();

  const url = new URL(`${FINNHUB_BASE}/calendar/earnings`);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  if (params.symbol) url.searchParams.set('symbol', params.symbol as string);
  if (key) url.searchParams.set('token', key);
  return fetchJson(url.toString());
};

const getIpoCalendar: DirectHandler = async (params) => {
  const days = (params.days as number) || 30;
  const from = dateStr(0);
  const to = dateStr(days);
  const key = finnhubKey();

  const url = new URL(`${FINNHUB_BASE}/calendar/ipo`);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  if (key) url.searchParams.set('token', key);
  return fetchJson(url.toString());
};

export const economicCalendarHandlers: Record<string, DirectHandler> = {
  get_economic_calendar: getEconomicCalendar,
  get_earnings_calendar: getEarningsCalendar,
  get_ipo_calendar: getIpoCalendar,
};
