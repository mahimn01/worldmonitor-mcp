import { ServiceDef } from '../types.js';

export const weatherAgriculture: ServiceDef = {
  name: 'weather-agriculture',
  description:
    'Weather and agriculture data — NOAA 7-day forecasts, USDA crop reports, and US drought monitoring for commodity trading',
  basePath: '/api/weather-agriculture/v1',
  tools: [
    {
      name: 'get_weather_forecast',
      description:
        'Get 7-day weather forecast from NOAA for a location. Returns temperature, wind, precipitation probability, and detailed forecast text. Useful for agricultural commodity and energy demand analysis.',
      params: {
        lat: {
          type: 'number',
          description: 'Latitude (-90 to 90)',
          required: true,
        },
        lon: {
          type: 'number',
          description: 'Longitude (-180 to 180)',
          required: true,
        },
      },
      endpoint: '/get-weather-forecast',
    },
    {
      name: 'get_crop_report',
      description:
        'Get USDA crop production data — planted acreage, harvested acreage, yield, and production for major crops by state. Requires USDA_API_KEY env var.',
      params: {
        commodity: {
          type: 'string',
          description:
            'Crop commodity (e.g. "CORN", "SOYBEANS", "WHEAT", "COTTON", "RICE")',
          required: true,
        },
        year: {
          type: 'number',
          description: 'Year for data (default: current year)',
        },
        state: {
          type: 'string',
          description: 'State abbreviation filter (e.g. "IA", "IL", "TX")',
        },
      },
      endpoint: '/get-crop-report',
    },
    {
      name: 'get_drought_monitor',
      description:
        'Get current US drought conditions from the US Drought Monitor — drought severity levels (D0-D4) by state or nationally.',
      params: {
        state: {
          type: 'string',
          description:
            'State abbreviation (e.g. "CA", "TX"). Omit for national summary.',
        },
      },
      endpoint: '/get-drought-monitor',
    },
  ],
};
