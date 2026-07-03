/**
 * Known-broken proxy endpoints (detected via audit). Shared between the MCP
 * server and the internal dispatcher so composite tools never fan out to them.
 */
export const KNOWN_BROKEN: Record<string, string> = {
  get_shipping_rates:
    'This endpoint is currently unavailable (404). ' +
    'For shipping/freight data, try get_commodity_quotes or search for "Baltic Dry Index" via list_market_quotes.',
  get_chokepoint_status:
    'This endpoint is currently unavailable (404). ' +
    'For maritime chokepoint intel, try list_navigational_warnings for NGA maritime advisories, ' +
    'or search_and_extract with query "Suez Canal Panama Canal shipping disruptions".',
  get_gps_jamming:
    'This endpoint is currently returning invalid data (deployment issue). ' +
    'For GPS/GNSS interference data, try search_gdelt_documents with query "GPS jamming spoofing" ' +
    'or list_navigational_warnings for related maritime warnings.',
};
