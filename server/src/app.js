import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { auditSite } from './modules/siteAudit/index.js';
import { createSearchesRouter } from './routes/searches.js';
import { createSitesRouter } from './routes/sites.js';

/** Accepts "nitt.edu", "http://nitt.edu" etc. Returns a clean URL string or null. */
export function normalizeUrl(input, { allowPrivate = false } = {}) {
  if (typeof input !== 'string' || !input.trim()) return null;
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (!allowPrivate && !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function createApp({
  allowPrivate = false,
  searchWebsitesFn = null,
  provider = null,
  apiKey = null,
} = {}) {
  const app = express();

  // Render runs behind a reverse proxy; needed for accurate client IPs and express-rate-limit
  app.set('trust proxy', 1);

  // Configure strict CORS based on CLIENT_ORIGIN
  const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const allowedOrigins = new Set(configuredOrigins);
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://localhost:3000');
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server-to-server, unit tests, curl)
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.has(cleanOrigin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin rejected: ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json());

  // Root endpoint: returns { service, status }
  app.get('/', (req, res) => {
    res.json({
      service: 'website-audit-api',
      status: 'ok',
    });
  });

  // Health check endpoint: returns { status, db, uptime }
  app.get('/api/health', (req, res) => {
    const isDbUp = mongoose.connection.readyState === 1;
    res.json({
      status: 'ok',
      service: 'website-audit-api',
      db: isDbUp ? 'up' : 'down',
      uptime: Math.floor(process.uptime()),
      time: new Date().toISOString(),
      authRequired: Boolean(process.env.APP_ACCESS_KEY),
    });
  });

  // Access key gate: if APP_ACCESS_KEY is configured, protect all other /api routes
  app.use((req, res, next) => {
    const accessKey = process.env.APP_ACCESS_KEY;
    if (!accessKey) {
      return next();
    }
    // Exempt /api/health, /, and OPTIONS preflight
    if (req.path === '/api/health' || req.path === '/' || req.method === 'OPTIONS') {
      return next();
    }
    if (!req.path.startsWith('/api')) {
      return next();
    }

    const providedKey = req.headers['x-access-key'] || req.query.access_key;
    if (!providedKey || providedKey !== accessKey) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing access key',
        code: 'UNAUTHORIZED',
      });
    }

    next();
  });

  // Mount search and site routes
  app.use('/api/searches', createSearchesRouter({ allowPrivate, searchWebsitesFn, provider, apiKey }));
  app.use('/api/sites', createSitesRouter({ allowPrivate }));

  // Works for both:  GET /api/audit?url=nitt.edu&checkLinks=false
  //             and  POST /api/audit  { "url": "nitt.edu", "checkLinks": true, "maxPages": 10 }
  const handleAudit = async (req, res) => {
    const src = req.method === 'GET' ? req.query : req.body || {};
    const url = normalizeUrl(src.url, { allowPrivate });
    if (!url) {
      return res.status(400).json({ error: 'Send a valid website in "url", e.g. https://www.nitt.edu' });
    }
    const checkLinks = !['false', '0', false].includes(src.checkLinks);
    const maxPages = Math.min(Math.max(parseInt(src.maxPages, 10) || 10, 1), 30);

    try {
      const result = await auditSite(url, { checkLinks, allowPrivate, links: { maxPages } });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Audit failed', detail: err.message });
    }
  };
  app.get('/api/audit', handleAudit);
  app.post('/api/audit', handleAudit);

  // JSON errors and CORS rejection handling
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.message && err.message.includes('CORS origin rejected')) {
      return res.status(403).json({ error: err.message, code: 'CORS_FORBIDDEN' });
    }
    res.status(err.status || 500).json({ error: err.message });
  });

  return app;
}
