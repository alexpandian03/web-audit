import axios from 'axios';

/**
 * Custom error class for Search Provider error mapping.
 */
export class SearchProviderError extends Error {
  constructor(message, { status = 502, code = 'SEARCH_PROVIDER_ERROR' } = {}) {
    super(message);
    this.name = 'SearchProviderError';
    this.status = status;
    this.code = code;
  }
}

// Backwards compatibility alias
export const PlacesApiError = SearchProviderError;

/**
 * Normalizes keyword by lowercasing, trimming, and collapsing whitespace.
 * @param {string} keyword
 * @returns {string}
 */
export function normalizeKeyword(keyword) {
  if (!keyword || typeof keyword !== 'string') return '';
  return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Strips tracking query parameters (utm_*) from website URL and ensures valid protocol.
 * @param {string} rawUrl
 * @returns {string|null}
 */
export function cleanWebsiteUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    let clean = rawUrl.trim();
    if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    const parsed = new URL(clean);

    // Collect and remove all utm_* parameters
    const utmKeys = [];
    for (const key of parsed.searchParams.keys()) {
      if (/^utm_/i.test(key)) {
        utmKeys.push(key);
      }
    }
    for (const k of utmKeys) {
      parsed.searchParams.delete(k);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts normalized hostname ignoring leading "www." for deduplication.
 * @param {string} urlStr
 * @returns {string|null}
 */
export function getDedupeKey(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    let raw = urlStr.trim();
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Deduplicates site objects by hostname (ignoring "www.")
 * @param {Array<{ name: string, address: string, url: string }>} sites
 * @returns {Array<{ name: string, address: string, url: string }>}
 */
export function deduplicateSites(sites = []) {
  const seen = new Set();
  const deduped = [];

  for (const site of sites) {
    if (!site?.url) continue;
    const key = getDedupeKey(site.url);
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(site);
    }
  }

  return deduped;
}

/**
 * Maps Places API errors into SearchProviderError.
 * Never logs or returns the API key.
 * @param {Error} err
 * @returns {SearchProviderError}
 */
export function mapPlacesApiError(err) {
  if (err instanceof SearchProviderError) return err;

  const status = err.response?.status;
  const data = err.response?.data;
  const msg = data?.error?.message || err.message;

  if (status === 400) {
    return new SearchProviderError(msg || 'Invalid search request to Google Places API.', {
      status: 400,
      code: 'INVALID_REQUEST',
    });
  }

  if (status === 403) {
    return new SearchProviderError(
      'Google Places API key is invalid, lacks billing, or does not have Places API (New) enabled.',
      {
        status: 502,
        code: 'PLACES_AUTH_ERROR',
      }
    );
  }

  if (status === 429) {
    return new SearchProviderError('Google Places API quota or rate limit exceeded. Please try again later.', {
      status: 429,
      code: 'RATE_LIMITED',
    });
  }

  if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || !err.response) {
    return new SearchProviderError('Unable to connect to Google Places API. Network failure or timeout.', {
      status: 504,
      code: 'NETWORK_ERROR',
    });
  }

  return new SearchProviderError(msg || 'Google Places API encountered an unexpected error.', {
    status: status || 502,
    code: 'PLACES_API_ERROR',
  });
}

/**
 * Maps SerpApi errors into SearchProviderError.
 * Never logs or returns the API key.
 * @param {Error|object} err
 * @returns {SearchProviderError}
 */
export function mapSerpApiError(err) {
  if (err instanceof SearchProviderError) return err;

  const status = err.response?.status;
  const data = err.response?.data;
  const msg = (typeof data?.error === 'string' ? data.error : err.message) || '';

  if (status === 401 || status === 403 || /invalid api key/i.test(msg)) {
    return new SearchProviderError('SerpApi API key is invalid or unauthorized.', {
      status: 502,
      code: 'SERPAPI_AUTH_ERROR',
    });
  }

  if (status === 429 || /run out of searches|quota|monthly limit|rate limit/i.test(msg)) {
    return new SearchProviderError('SerpApi search quota exhausted or rate limit reached.', {
      status: 429,
      code: 'SERPAPI_QUOTA_EXCEEDED',
    });
  }

  if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || !err.response) {
    return new SearchProviderError('Unable to connect to SerpApi. Network failure or timeout.', {
      status: 504,
      code: 'NETWORK_ERROR',
    });
  }

  return new SearchProviderError(msg || 'SerpApi search encountered an error.', {
    status: status || 502,
    code: 'SERPAPI_API_ERROR',
  });
}

/**
 * Searches for websites using Google Places API (New) Text Search.
 *
 * Headers:
 *   X-Goog-Api-Key: <key>
 *   X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,nextPageToken
 *
 * Body:
 *   { textQuery: keyword, pageSize: 20, pageToken?: nextPageToken }
 *
 * Follows nextPageToken until MAX_SITES_PER_SEARCH (default 40) sites with a website are collected
 * or there are no more pages.
 *
 * @param {string} keyword
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {number} [opts.maxSites]
 * @param {Function} [opts.httpClient] - Injected HTTP client for unit/integration testing
 * @returns {Promise<Array<{ name: string, address: string, url: string, placeId?: string }>>}
 */
export async function searchPlacesWebsites(keyword, opts = {}) {
  const apiKey = opts.apiKey || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new SearchProviderError('Search is not configured (missing GOOGLE_PLACES_API_KEY).', {
      status: 503,
      code: 'SEARCH_NOT_CONFIGURED',
    });
  }

  const maxSites = opts.maxSites || parseInt(process.env.MAX_SITES_PER_SEARCH, 10) || 40;
  const endpoint = 'https://places.googleapis.com/v1/places:searchText';
  const httpClient = opts.httpClient || axios;

  const collectedSites = [];
  const seenHosts = new Set();
  let pageToken = undefined;

  try {
    do {
      const requestBody = {
        textQuery: keyword,
        pageSize: 20,
      };
      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const response = await httpClient.post(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,nextPageToken',
        },
        timeout: 10000,
      });

      const places = response.data?.places || [];

      for (const place of places) {
        if (!place.websiteUri) continue;

        // Clean tracking query params
        const cleanUrl = cleanWebsiteUrl(place.websiteUri);
        if (!cleanUrl) continue;

        // Deduplicate by hostname (ignoring "www.")
        const hostKey = getDedupeKey(cleanUrl);
        if (!hostKey || seenHosts.has(hostKey)) continue;

        seenHosts.add(hostKey);
        collectedSites.push({
          placeId: place.id || '',
          name: place.displayName?.text || place.displayName || cleanUrl,
          address: place.formattedAddress || '',
          url: cleanUrl,
        });

        if (collectedSites.length >= maxSites) {
          break;
        }
      }

      pageToken = response.data?.nextPageToken;
    } while (pageToken && collectedSites.length < maxSites);

    return collectedSites;
  } catch (err) {
    throw mapPlacesApiError(err);
  }
}

/**
 * Searches for websites using SerpApi Google Maps Engine.
 *
 * GET https://serpapi.com/search.json
 * Parameters:
 *   engine: 'google_maps'
 *   type: 'search'
 *   q: <keyword>
 *   hl: 'en'
 *   gl: 'in'
 *   api_key: <key>
 *   start: 0, 20, 40... (steps of 20)
 *
 * Reads results from local_results: name (title), address, website.
 * Skips entries without a website. Does NOT make extra per-place detail calls.
 * Paginates with `start` parameter until MAX_SITES_PER_SEARCH (default 40) sites
 * with a website are collected or results end.
 *
 * @param {string} keyword
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {number} [opts.maxSites]
 * @param {Function} [opts.httpClient] - Injected HTTP client for unit/integration testing
 * @returns {Promise<Array<{ name: string, address: string, url: string, placeId?: string }>>}
 */
export async function searchSerpApiWebsites(keyword, opts = {}) {
  const apiKey = opts.apiKey || process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new SearchProviderError('Search is not configured (missing SERPAPI_KEY).', {
      status: 503,
      code: 'SEARCH_NOT_CONFIGURED',
    });
  }

  const maxSites = opts.maxSites || parseInt(process.env.MAX_SITES_PER_SEARCH, 10) || 40;
  const endpoint = 'https://serpapi.com/search.json';
  const httpClient = opts.httpClient || axios;

  const collectedSites = [];
  const seenHosts = new Set();
  let start = 0;
  const PAGE_SIZE = 20;

  try {
    while (collectedSites.length < maxSites) {
      const response = await httpClient.get(endpoint, {
        params: {
          engine: 'google_maps',
          type: 'search',
          q: keyword,
          hl: 'en',
          gl: 'in',
          api_key: apiKey,
          start,
        },
        timeout: 10000,
      });

      // Check if SerpApi returned an error in body
      if (response.data?.error) {
        const errMsg = String(response.data.error);
        // If Google Maps has no results (or no further results for this page), break gracefully
        if (/hasn't returned any results|no results/i.test(errMsg)) {
          break;
        }
        throw mapSerpApiError({ response: { status: 400, data: response.data } });
      }

      const localResults = response.data?.local_results || [];
      if (!Array.isArray(localResults) || localResults.length === 0) {
        // No more results returned
        break;
      }

      for (const item of localResults) {
        if (!item.website) continue; // Skip entries without website

        const cleanUrl = cleanWebsiteUrl(item.website);
        if (!cleanUrl) continue;

        // Deduplicate by hostname (ignoring "www.")
        const hostKey = getDedupeKey(cleanUrl);
        if (!hostKey || seenHosts.has(hostKey)) continue;

        seenHosts.add(hostKey);
        collectedSites.push({
          placeId: item.place_id || item.data_id || '',
          name: item.title || cleanUrl,
          address: item.address || '',
          url: cleanUrl,
        });

        if (collectedSites.length >= maxSites) {
          break;
        }
      }

      // If fewer than PAGE_SIZE items were returned, we have reached the end of results
      if (localResults.length < PAGE_SIZE) {
        break;
      }

      start += PAGE_SIZE;
    }

    return collectedSites;
  } catch (err) {
    throw mapSerpApiError(err);
  }
}

/**
 * Returns the currently active search provider: 'serpapi' or 'places'.
 * Configured via SEARCH_PROVIDER env var (default: 'serpapi' if SERPAPI_KEY is present, else 'places').
 * @returns {'serpapi'|'places'}
 */
export function getActiveSearchProvider() {
  const p = (process.env.SEARCH_PROVIDER || '').toLowerCase().trim();
  if (p === 'serpapi') return 'serpapi';
  if (p === 'places') return 'places';
  if (process.env.SERPAPI_KEY && !process.env.GOOGLE_PLACES_API_KEY) {
    return 'serpapi';
  }
  return 'places';
}

/**
 * Main provider dispatcher. Routes to serpapi or places based on SEARCH_PROVIDER env var.
 * @param {string} keyword
 * @param {object} [opts]
 * @returns {Promise<{ provider: 'serpapi'|'places', sites: Array<{ name: string, address: string, url: string }> }>}
 */
export async function fetchWebsites(keyword, opts = {}) {
  const provider = opts.provider || getActiveSearchProvider();

  let sites = [];
  if (provider === 'serpapi') {
    sites = await searchSerpApiWebsites(keyword, opts);
  } else {
    sites = await searchPlacesWebsites(keyword, opts);
  }

  return { provider, sites };
}
