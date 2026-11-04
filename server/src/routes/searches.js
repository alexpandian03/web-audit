import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import Search from '../models/Search.js';
import Site from '../models/Site.js';
import {
  fetchWebsites,
  normalizeKeyword,
  getActiveSearchProvider,
  SearchProviderError,
} from '../services/searchProvider.js';
import { enqueueSiteAudit } from '../services/auditQueue.js';
import { generateSitesCsv } from '../services/csvExporter.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Creates searches router.
 * Supports dependency injection of `searchWebsitesFn`, `provider`, and `apiKey` for automated tests.
 */
export function createSearchesRouter({
  allowPrivate = false,
  searchWebsitesFn = null,
  provider = null,
  apiKey = null,
} = {}) {
  const router = express.Router();

  // Rate limiter on search creation: max 60 searches per 15 minutes per IP
  const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many search requests, please try again later.', code: 'RATE_LIMITED' },
  });

  // POST /api/searches
  router.post('/', searchLimiter, async (req, res) => {
    // Reload environment variables so live changes to server/.env take effect immediately
    try {
      const serverEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
      dotenv.config({ path: serverEnvPath, override: true });
    } catch {}
    dotenv.config({ override: true });

    const activeProvider = provider || getActiveSearchProvider();

    // 1. Config validation: check required API key based on selected SEARCH_PROVIDER
    let effectiveKey = apiKey;
    if (effectiveKey === null || effectiveKey === undefined) {
      if (activeProvider === 'serpapi') {
        effectiveKey = process.env.SERPAPI_KEY;
      } else {
        effectiveKey = process.env.GOOGLE_PLACES_API_KEY;
      }
    }

    if (!effectiveKey && !searchWebsitesFn) {
      return res.status(503).json({
        error: 'Search is not configured',
        code: 'SEARCH_NOT_CONFIGURED',
        provider: activeProvider,
      });
    }

    const { keyword } = req.body || {};
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return res.status(400).json({ error: 'Please provide a non-empty "keyword" to search.', code: 'INVALID_INPUT' });
    }

    const cleanKeyword = keyword.trim();
    const normalizedKeyword = normalizeKeyword(cleanKeyword);
    const forceRefresh = req.query.refresh === 'true' || req.body?.refresh === true;

    try {
      // 2. Keyword Search Cache: if searched in the last 7 days, reuse site list unless refresh=true
      if (!forceRefresh) {
        const cutoffDate = new Date(Date.now() - SEVEN_DAYS_MS);
        const cachedSearch = await Search.findOne({
          normalizedKeyword,
          createdAt: { $gte: cutoffDate },
        }).sort({ createdAt: -1 });

        if (cachedSearch) {
          const cachedSites = await Site.find({ searchId: cachedSearch._id });
          if (cachedSites && cachedSites.length > 0) {
            // Create a new Search record for this session
            const search = await Search.create({
              keyword: cleanKeyword,
              normalizedKeyword,
              provider: activeProvider,
            });

            // Clone the site entries for this new search with pending status so they are audited live
            const siteDocs = cachedSites.map((s) => ({
              searchId: search._id,
              name: s.name,
              address: s.address || '',
              url: s.url,
              auditStatus: 'pending',
              audit: null,
              brokenCertainCount: 0,
              brokenTotalCount: 0,
              sslIssueCount: 0,
              auditedAt: null,
            }));

            const sites = await Site.insertMany(siteDocs);

            // Re-audit every site live from the website
            for (const site of sites) {
              enqueueSiteAudit(site._id, { allowPrivate, reaudit: true }).catch((err) => {
                console.error(`[Queue] Background audit error for cached site ${site._id}:`, err.message);
              });
            }

            return res.status(201).json({ search, sites, cached: true });
          }
        }
      }

      // 3. Fetch from provider (SerpApi or Google Places)
      let providerSites = [];
      if (searchWebsitesFn) {
        providerSites = await searchWebsitesFn(cleanKeyword);
      } else {
        const result = await fetchWebsites(cleanKeyword, {
          provider: activeProvider,
          apiKey: effectiveKey,
        });
        providerSites = result.sites;
      }

      // 4. Create Search document
      const search = await Search.create({
        keyword: cleanKeyword,
        normalizedKeyword,
        provider: activeProvider,
      });

      // 5. Create Site documents
      const siteDocs = providerSites.map((site) => ({
        searchId: search._id,
        name: site.name || site.url,
        address: site.address || '',
        url: site.url,
        auditStatus: 'pending',
      }));

      const sites = siteDocs.length > 0 ? await Site.insertMany(siteDocs) : [];

      // 6. Trigger background audits live from the actual websites
      for (const site of sites) {
        enqueueSiteAudit(site._id, { allowPrivate, reaudit: true }).catch((err) => {
          console.error(`[Queue] Error running audit for site ${site._id}:`, err.message);
        });
      }

      return res.status(201).json({ search, sites, cached: false });
    } catch (err) {
      if (err instanceof SearchProviderError) {
        return res.status(err.status || 502).json({ error: err.message, code: err.code });
      }

      console.error('[Searches] Unexpected search error:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to create search', code: 'INTERNAL_ERROR' });
    }
  });

  // GET /api/searches/:id
  router.get('/:id', async (req, res) => {
    try {
      const search = await Search.findById(req.params.id);
      if (!search) {
        return res.status(404).json({ error: 'Search not found', code: 'NOT_FOUND' });
      }

      const sites = await Site.find({ searchId: search._id }).sort({ createdAt: 1 });
      return res.json({ search, sites });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve search', detail: err.message });
    }
  });

  // GET /api/searches/:id/export.csv
  router.get('/:id/export.csv', async (req, res) => {
    try {
      const search = await Search.findById(req.params.id);
      if (!search) {
        return res.status(404).json({ error: 'Search not found', code: 'NOT_FOUND' });
      }

      const sites = await Site.find({ searchId: search._id }).sort({ createdAt: 1 });
      const csv = generateSitesCsv(sites);

      const safeKeyword = (search.keyword || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `search-${safeKeyword}-${search._id}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to export CSV', detail: err.message });
    }
  });

  return router;
}

export default createSearchesRouter;
