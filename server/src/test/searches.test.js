import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';
import Search from '../models/Search.js';
import Site from '../models/Site.js';
import {
  cleanWebsiteUrl,
  getDedupeKey,
  deduplicateSites,
  normalizeKeyword,
  searchPlacesWebsites,
  searchSerpApiWebsites,
  mapPlacesApiError,
  mapSerpApiError,
  SearchProviderError,
} from '../services/searchProvider.js';
import { generateSitesCsv } from '../services/csvExporter.js';
import { recoverPendingAudits, enqueueSiteAudit } from '../services/auditQueue.js';

// Setup in-memory mock for Search and Site models
function setupMockModels() {
  const searchStore = new Map();
  const siteStore = new Map();
  let idCounter = 1;

  function makeSearchDoc(data) {
    const doc = {
      _id: data._id || `search_${idCounter++}`,
      keyword: data.keyword,
      normalizedKeyword: data.normalizedKeyword || normalizeKeyword(data.keyword),
      provider: data.provider || 'serpapi',
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    };
    searchStore.set(doc._id.toString(), doc);
    return doc;
  }

  function makeSiteDoc(data) {
    const doc = {
      _id: data._id || `site_${idCounter++}`,
      searchId: data.searchId,
      name: data.name,
      address: data.address || '',
      url: data.url,
      auditStatus: data.auditStatus || 'pending',
      audit: data.audit || null,
      brokenCertainCount: data.brokenCertainCount ?? 0,
      brokenTotalCount: data.brokenTotalCount ?? 0,
      sslIssueCount: data.sslIssueCount ?? 0,
      auditedAt: data.auditedAt ? new Date(data.auditedAt) : null,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    };

    doc.save = async function () {
      siteStore.set(doc._id.toString(), { ...doc });
      return doc;
    };

    siteStore.set(doc._id.toString(), doc);
    return doc;
  }

  Search.create = async (data) => makeSearchDoc(data);
  Search.findById = async (id) => searchStore.get(id?.toString()) || null;
  Search.findOne = (query = {}) => {
    let results = Array.from(searchStore.values());
    if (query.normalizedKeyword) {
      results = results.filter((s) => s.normalizedKeyword === query.normalizedKeyword);
    }
    if (query.createdAt && query.createdAt.$gte) {
      results = results.filter((s) => s.createdAt && s.createdAt >= query.createdAt.$gte);
    }
    results.sort((a, b) => b.createdAt - a.createdAt);
    const match = results[0] || null;
    return {
      sort: () => Promise.resolve(match),
      then: (resolve, reject) => Promise.resolve(match).then(resolve, reject),
    };
  };

  Site.insertMany = async (docs) => docs.map(makeSiteDoc);
  Site.findById = async (id) => siteStore.get(id?.toString()) || null;

  Site.find = (query = {}) => {
    let results = Array.from(siteStore.values());
    if (query.searchId) {
      results = results.filter((s) => s.searchId?.toString() === query.searchId?.toString());
    }
    if (query.auditStatus) {
      if (query.auditStatus.$in) {
        results = results.filter((s) => query.auditStatus.$in.includes(s.auditStatus));
      } else {
        results = results.filter((s) => s.auditStatus === query.auditStatus);
      }
    }
    return {
      sort: () => Promise.resolve(results),
      then: (resolve, reject) => Promise.resolve(results).then(resolve, reject),
    };
  };

  Site.findOne = (query = {}) => {
    let results = Array.from(siteStore.values());
    if (query.url) {
      results = results.filter((s) => s.url === query.url);
    }
    if (query._id && query._id.$ne) {
      results = results.filter((s) => s._id.toString() !== query._id.$ne.toString());
    }
    if (query.auditStatus) {
      results = results.filter((s) => s.auditStatus === query.auditStatus);
    }
    if (query.auditedAt && query.auditedAt.$gte) {
      results = results.filter((s) => s.auditedAt && s.auditedAt >= query.auditedAt.$gte);
    }
    if (query.audit && query.audit.$ne) {
      results = results.filter((s) => s.audit !== null);
    }
    const match = results[0] || null;
    return {
      sort: () => Promise.resolve(match),
      then: (resolve, reject) => Promise.resolve(match).then(resolve, reject),
    };
  };

  return { searchStore, siteStore, makeSearchDoc, makeSiteDoc };
}

test('URL Cleaning: strips tracking params (utm_*) and normalizes', () => {
  const urlWithUtm = 'https://kauveryhospital.com/branch?utm_source=google&utm_medium=cpc&utm_campaign=brand&id=123';
  const cleaned = cleanWebsiteUrl(urlWithUtm);
  assert.equal(cleaned, 'https://kauveryhospital.com/branch?id=123');
  assert.ok(!cleaned.includes('utm_source'));

  assert.equal(cleanWebsiteUrl('nitt.edu/admissions'), 'https://nitt.edu/admissions');
});

test('Keyword Normalization: lowercases, trims, and collapses internal spaces', () => {
  assert.equal(normalizeKeyword('  Hospitals   in   Trichy  '), 'hospitals in trichy');
  assert.equal(normalizeKeyword('COLLEGES   IN TAMIL NADU'), 'colleges in tamil nadu');
});

test('Deduplication: hostname deduplication ignoring leading www', () => {
  assert.equal(getDedupeKey('https://www.nitt.edu/'), 'nitt.edu');
  assert.equal(getDedupeKey('http://nitt.edu/dept/cse'), 'nitt.edu');
  assert.equal(getDedupeKey('https://WWW.Srmist.edu.in'), 'srmist.edu.in');

  const sites = [
    { name: 'NITT 1', url: 'https://www.nitt.edu' },
    { name: 'NITT 2', url: 'http://nitt.edu/about' },
    { name: 'SRM', url: 'https://www.srmist.edu.in' },
  ];

  const deduped = deduplicateSites(sites);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].name, 'NITT 1');
  assert.equal(deduped[1].name, 'SRM');
});

test('SerpApi: reads local_results, skips missing website, paginates with start parameter', async () => {
  let callStarts = [];
  const mockHttpClient = {
    get: async (url, config) => {
      assert.equal(url, 'https://serpapi.com/search.json');
      assert.equal(config.params.engine, 'google_maps');
      assert.equal(config.params.type, 'search');
      assert.equal(config.params.hl, 'en');
      assert.equal(config.params.gl, 'in');

      callStarts.push(config.params.start);

      if (config.params.start === 0) {
        // Page 1: returns 20 items (2 with websites, 1 duplicate of A, 17 without websites)
        const local_results = [
          { title: 'Kauvery Hospital', address: 'Tennur', website: 'https://kauveryhospital.com?utm_source=serp' },
          { title: 'Apollo Hospital', address: 'Cantonment', website: 'https://www.apollohospitals.com' },
          { title: 'Kauvery Branch', address: 'Kanthaloor', website: 'http://kauveryhospital.com/branch' },
        ];
        // fill up to 20 with places without websites
        for (let i = 0; i < 17; i++) {
          local_results.push({ title: `Clinic ${i}`, address: `Street ${i}` }); // No website
        }
        return { data: { local_results } };
      } else if (config.params.start === 20) {
        // Page 2: returns 1 site with website
        return {
          data: {
            local_results: [
              { title: 'Frontier Lifeline', address: 'Anna Nagar', website: 'https://frontierlifeline.com' },
            ],
          },
        };
      }
    },
  };

  const results = await searchSerpApiWebsites('hospitals in trichy', {
    apiKey: 'fake-serpapi-key',
    maxSites: 10,
    httpClient: mockHttpClient,
  });

  assert.deepEqual(callStarts, [0, 20]);
  assert.equal(results.length, 3);
  assert.equal(results[0].name, 'Kauvery Hospital');
  assert.equal(results[0].url, 'https://kauveryhospital.com/'); // utm stripped
  assert.equal(results[1].name, 'Apollo Hospital');
  assert.equal(results[2].name, 'Frontier Lifeline');
});

test('SerpApi: error mapping (401/403, 429 quota, network failure)', () => {
  const authErr = mapSerpApiError({ response: { status: 401 } });
  assert.equal(authErr.status, 502);
  assert.equal(authErr.code, 'SERPAPI_AUTH_ERROR');

  const quotaErr = mapSerpApiError({ response: { status: 200, data: { error: 'Your account has run out of searches.' } } });
  assert.equal(quotaErr.status, 429);
  assert.equal(quotaErr.code, 'SERPAPI_QUOTA_EXCEEDED');

  const netErr = mapSerpApiError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' });
  assert.equal(netErr.status, 504);
  assert.equal(netErr.code, 'NETWORK_ERROR');
});

test('Google Places: handles pagination (nextPageToken) and skips missing websites', async () => {
  let callCount = 0;
  const mockHttpClient = {
    post: async (url, body) => {
      callCount++;
      if (!body.pageToken) {
        return {
          data: {
            places: [
              { id: 'p1', displayName: { text: 'Hospital A' }, websiteUri: 'https://hosp-a.com?utm_source=g' },
              { id: 'p2', displayName: { text: 'Clinic No Site' } },
              { id: 'p3', displayName: { text: 'Hospital B' }, websiteUri: 'https://www.hosp-b.com' },
            ],
            nextPageToken: 'token_page_2',
          },
        };
      } else if (body.pageToken === 'token_page_2') {
        return {
          data: {
            places: [
              { id: 'p4', displayName: { text: 'Hospital C' }, websiteUri: 'https://hosp-c.com' },
              { id: 'p5', displayName: { text: 'Hospital A Duplicate' }, websiteUri: 'http://hosp-a.com/sub' },
            ],
          },
        };
      }
    },
  };

  const results = await searchPlacesWebsites('hospitals', {
    apiKey: 'fake-test-key',
    maxSites: 10,
    httpClient: mockHttpClient,
  });

  assert.equal(callCount, 2);
  assert.equal(results.length, 3);
  assert.equal(results[0].name, 'Hospital A');
  assert.equal(results[0].url, 'https://hosp-a.com/');
  assert.equal(results[1].name, 'Hospital B');
  assert.equal(results[2].name, 'Hospital C');
});

test('Google Places: error mapping (400, 403, 429, network failure)', () => {
  const err400 = mapPlacesApiError({ response: { status: 400, data: { error: { message: 'Invalid field mask' } } } });
  assert.equal(err400.status, 400);
  assert.equal(err400.code, 'INVALID_REQUEST');

  const err403 = mapPlacesApiError({ response: { status: 403, data: { error: { message: 'Billing not enabled' } } } });
  assert.equal(err403.status, 502);
  assert.equal(err403.code, 'PLACES_AUTH_ERROR');

  const err429 = mapPlacesApiError({ response: { status: 429 } });
  assert.equal(err429.status, 429);
  assert.equal(err429.code, 'RATE_LIMITED');

  const netErr = mapPlacesApiError({ code: 'ECONNREFUSED', message: 'connection refused' });
  assert.equal(netErr.status, 504);
  assert.equal(netErr.code, 'NETWORK_ERROR');
});

test('API POST /api/searches: returns 503 if required provider API key is missing', async () => {
  setupMockModels();

  // 1. Missing SERPAPI_KEY when SEARCH_PROVIDER=serpapi
  const appSerp = createApp({ allowPrivate: true, provider: 'serpapi', apiKey: '' });
  const serverSerp = http.createServer(appSerp);
  await new Promise((r) => serverSerp.listen(0, '127.0.0.1', r));
  const baseSerp = `http://127.0.0.1:${serverSerp.address().port}`;

  try {
    const res = await fetch(`${baseSerp}/api/searches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword: 'hospitals' }),
    });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.error, 'Search is not configured');
    assert.equal(data.provider, 'serpapi');
  } finally {
    serverSerp.close();
  }

  // 2. Missing GOOGLE_PLACES_API_KEY when SEARCH_PROVIDER=places
  const appPlaces = createApp({ allowPrivate: true, provider: 'places', apiKey: '' });
  const serverPlaces = http.createServer(appPlaces);
  await new Promise((r) => serverPlaces.listen(0, '127.0.0.1', r));
  const basePlaces = `http://127.0.0.1:${serverPlaces.address().port}`;

  try {
    const res = await fetch(`${basePlaces}/api/searches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword: 'hospitals' }),
    });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.error, 'Search is not configured');
    assert.equal(data.provider, 'places');
  } finally {
    serverPlaces.close();
  }
});

test('API Searches: keyword cache reuse within 7 days vs ?refresh=true bypass', async () => {
  setupMockModels();
  let providerCalls = 0;

  const mockSearchFn = async (kw) => {
    providerCalls++;
    return [
      { name: 'Trichy General Hospital', url: 'https://trichyhospital.org', address: 'Main Rd' },
      { name: 'Kauvery Hospital', url: 'https://kauveryhospital.com', address: 'Tennur' },
    ];
  };

  const app = createApp({
    allowPrivate: true,
    searchWebsitesFn: mockSearchFn,
    provider: 'serpapi',
    apiKey: 'fake-test-key',
  });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Initial Search: calls mock provider
    const res1 = await fetch(`${base}/api/searches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword: 'Hospitals in Trichy' }),
    });
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    assert.equal(providerCalls, 1);
    assert.equal(data1.cached, false);
    assert.equal(data1.sites.length, 2);

    // 2. Second Search with variations in spacing & case: hits 7-day cache, NO provider call
    const res2 = await fetch(`${base}/api/searches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword: '  hospitals   IN   trichy  ' }),
    });
    assert.equal(res2.status, 201);
    const data2 = await res2.json();
    assert.equal(providerCalls, 1, 'Provider was NOT called again; used 7-day cache');
    assert.equal(data2.cached, true);
    assert.equal(data2.sites.length, 2);

    // 3. Third Search with ?refresh=true: forces fresh search, calls provider
    const res3 = await fetch(`${base}/api/searches?refresh=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword: 'hospitals in trichy' }),
    });
    assert.equal(res3.status, 201);
    const data3 = await res3.json();
    assert.equal(providerCalls, 2, 'Provider was invoked due to ?refresh=true');
    assert.equal(data3.cached, false);
  } finally {
    server.close();
  }
});

test('CSV Exporter: formats headers and escaped cells', () => {
  const sites = [
    {
      name: 'Sample "Hospital", Trichy',
      url: 'https://sample.org',
      address: '123 Main St, Trichy',
      auditStatus: 'done',
      audit: {
        copyright: { status: 'current', year: 2026 },
        developer: { name: 'Acme Dev', kind: 'agency' },
      },
      brokenCertainCount: 2,
      brokenTotalCount: 5,
      sslIssueCount: 0,
      auditedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  const csv = generateSitesCsv(sites);
  assert.ok(csv.includes('Website Name,Website URL,Address,Audit Status'));
  assert.ok(csv.includes('"Sample ""Hospital"", Trichy"'));
  assert.ok(csv.includes('"current"'));
  assert.ok(csv.includes('"Acme Dev"'));
});

test('Audit recovery on server restart: resets running to pending and re-queues', async () => {
  const { siteStore, makeSiteDoc } = setupMockModels();

  const site1 = makeSiteDoc({
    searchId: 's1',
    name: 'Pending Site',
    url: 'https://www.nitt.edu',
    auditStatus: 'pending',
  });
  const site2 = makeSiteDoc({
    searchId: 's1',
    name: 'Running Site',
    url: 'https://www.srmist.edu.in',
    auditStatus: 'running',
  });
  const site3 = makeSiteDoc({
    searchId: 's1',
    name: 'Done Site',
    url: 'https://done.example',
    auditStatus: 'done',
  });

  const recoveredCount = await recoverPendingAudits({ allowPrivate: true });
  assert.equal(recoveredCount, 2);
  assert.equal(site2.auditStatus, 'pending');
});

test('Queue: 7-day cache reuse copies audit results without re-auditing', async () => {
  const { makeSiteDoc } = setupMockModels();

  const existingAudit = {
    copyright: { status: 'current', year: 2026 },
    developer: { name: 'Existing Dev', kind: 'agency' },
    links: { broken: [], blocked: [], sslIssues: [] },
  };

  const oldSite = makeSiteDoc({
    searchId: 's1',
    name: 'Original Site',
    url: 'https://www.cached-example.org',
    auditStatus: 'done',
    audit: existingAudit,
    brokenCertainCount: 1,
    brokenTotalCount: 3,
    sslIssueCount: 0,
    auditedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old (< 7 days)
  });

  const newSite = makeSiteDoc({
    searchId: 's2',
    name: 'New Site with Same URL',
    url: 'https://www.cached-example.org',
    auditStatus: 'pending',
  });

  const result = await enqueueSiteAudit(newSite._id, { reaudit: false, allowPrivate: true });
  assert.equal(result.auditStatus, 'done');
  assert.equal(result.brokenCertainCount, 1);
  assert.equal(result.brokenTotalCount, 3);
  assert.equal(result.audit.developer.name, 'Existing Dev');
});
