/**
 * Weather and agriculture direct handlers — NOAA forecasts, USDA crop data,
 * and US Drought Monitor.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const NOAA_HEADERS = {
  'User-Agent': 'worldmonitor-mcp/1.0 (worldmonitor@example.com)',
  Accept: 'application/geo+json',
};

const getWeatherForecast: DirectHandler = async (params) => {
  const lat = params.lat as number;
  const lon = params.lon as number;

  // Step 1: Resolve grid point from lat/lon
  const point = await fetchJson<{
    properties: { forecast: string; forecastHourly: string; relativeLocation: unknown };
  }>(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: NOAA_HEADERS,
  });

  // Step 2: Fetch the 7-day forecast from the grid endpoint
  const forecast = await fetchJson(point.properties.forecast, {
    headers: NOAA_HEADERS,
  });

  return forecast;
};

const getCropReport: DirectHandler = async (params) => {
  const commodity = (params.commodity as string).toUpperCase();
  const year = (params.year as number) || new Date().getFullYear();
  const apiKey = process.env.USDA_API_KEY;

  if (!apiKey) {
    return {
      error: true,
      message:
        'USDA_API_KEY environment variable not set. Get a free key at https://quickstats.nass.usda.gov/api',
    };
  }

  const url = new URL('https://quickstats.nass.usda.gov/api/api_GET/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('commodity_desc', commodity);
  url.searchParams.set('year', String(year));
  url.searchParams.set('statisticcat_desc', 'PRODUCTION');
  url.searchParams.set('agg_level_desc', 'STATE');
  if (params.state) url.searchParams.set('state_alpha', params.state as string);
  return fetchJson(url.toString());
};

const getDroughtMonitor: DirectHandler = async (params) => {
  const state = params.state as string | undefined;
  // US Drought Monitor comprehensive statistics endpoint
  const areaType = state ? 'state' : 'national';
  const area = state ? state.toUpperCase() : 'conus';
  const url = `https://usdm.unl.edu/DmData/TimeSeries.aspx/GetDroughtSeverityStatisticsByAreaPercent?areatype=${areaType}&areaid=${area}&statisticstype=1`;
  try {
    return await fetchJson(url);
  } catch {
    // Fallback: return a structured message
    return {
      message: `Drought Monitor data for ${state || 'national'}`,
      source: 'https://droughtmonitor.unl.edu/',
      note: 'Visit the source URL for the latest drought data',
    };
  }
};

export const weatherAgricultureHandlers: Record<string, DirectHandler> = {
  get_weather_forecast: getWeatherForecast,
  get_crop_report: getCropReport,
  get_drought_monitor: getDroughtMonitor,
};
