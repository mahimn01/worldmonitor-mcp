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
  // Default to previous year since crop production data is reported retroactively
  const year = (params.year as number) || new Date().getFullYear() - 1;
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
  if (params.state) {
    url.searchParams.set('agg_level_desc', 'STATE');
    url.searchParams.set('state_alpha', (params.state as string).toUpperCase());
  } else {
    url.searchParams.set('agg_level_desc', 'NATIONAL');
  }
  return fetchJson(url.toString());
};

const getDroughtMonitor: DirectHandler = async (params) => {
  const state = params.state as string | undefined;

  // USDA NASS drought-related crop condition data (free, no key needed for NASS web API)
  // Uses the NASS "Crop Progress" data which includes drought-affected conditions
  const apiKey = process.env.USDA_API_KEY;

  if (apiKey) {
    // Try current year first, fall back to previous year (crop data starts in spring)
    for (const year of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
      const url = new URL('https://quickstats.nass.usda.gov/api/api_GET/');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('source_desc', 'SURVEY');
      url.searchParams.set('sector_desc', 'CROPS');
      url.searchParams.set('statisticcat_desc', 'CONDITION');
      url.searchParams.set('commodity_desc', 'CORN');
      url.searchParams.set('year', String(year));
      url.searchParams.set('freq_desc', 'WEEKLY');
      if (state) {
        url.searchParams.set('agg_level_desc', 'STATE');
        url.searchParams.set('state_alpha', state.toUpperCase());
      } else {
        url.searchParams.set('agg_level_desc', 'NATIONAL');
      }

      try {
        const data = await fetchJson<{ data: Record<string, unknown>[] }>(url.toString());
        if (data.data && data.data.length > 0) {
          return {
            source: 'USDA NASS Crop Progress',
            area: state?.toUpperCase() || 'US National',
            year,
            note: 'Crop condition ratings (Very Poor to Excellent) reflect drought impact on agriculture',
            data: data.data.slice(0, 50),
          };
        }
      } catch {
        // Try previous year
      }
    }
  }

  // Fallback: NOAA Climate Prediction Center drought outlook (GeoJSON, free)
  try {
    const data = await fetchJson(
      'https://www.cpc.ncep.noaa.gov/products/expert_assessment/month_drought.png',
    ).catch(() => null);

    // CPC provides forecast data as JSON too
    const cpcUrl = 'https://www.cpc.ncep.noaa.gov/products/predictions/tools/edb/drought_blend_table.html';
    return {
      source: 'NOAA Climate Prediction Center + USDA',
      area: state?.toUpperCase() || 'US National',
      drought_outlook_url: 'https://www.cpc.ncep.noaa.gov/products/expert_assessment/month_drought.png',
      drought_monitor_url: 'https://droughtmonitor.unl.edu/',
      usda_crop_conditions_url: 'https://www.nass.usda.gov/Charts_and_Maps/Crop_Progress_&_Condition/',
      note: state
        ? `Check drought conditions for ${state.toUpperCase()} at the URLs above`
        : 'Current US drought data available at the URLs above',
      tip: 'Set USDA_API_KEY for detailed crop condition data that reflects drought impact',
      _cpc_data: data,
    };
  } catch {
    return {
      source: 'US Drought Monitor',
      area: state?.toUpperCase() || 'US National',
      url: 'https://droughtmonitor.unl.edu/',
      note: 'Visit the source URL for the latest drought data',
      tip: 'Set USDA_API_KEY for automated drought-related crop condition data',
    };
  }
};

export const weatherAgricultureHandlers: Record<string, DirectHandler> = {
  get_weather_forecast: getWeatherForecast,
  get_crop_report: getCropReport,
  get_drought_monitor: getDroughtMonitor,
};
