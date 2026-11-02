import pLimit from 'p-limit';
import { auditSite } from '../modules/siteAudit/index.js';
import Site from '../models/Site.js';
import { normalizeUrl } from '../app.js';

// Concurrency 2 for background audit tasks
const limit = pLimit(2);

// Map of normalized URL -> Promise<{ success: boolean, result?: any, error?: string }>
// Ensures identical URLs queued concurrently share the exact same audit work
const inFlightAudits = new Map();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Normalizes a URL for comparison and cache/dedupe key lookup.
 * @param {string} rawUrl
 * @returns {string}
 */
export function getAuditKey(rawUrl) {
  if (!rawUrl) return '';
  const clean = normalizeUrl(rawUrl, { allowPrivate: true }) || rawUrl.trim();
  return clean.toLowerCase();
}

/**
 * Enqueues a site audit job.
 * Handles:
 *  - 7-day cache reuse (unless reaudit: true)
 *  - Concurrency 2 limiting via pLimit
 *  - Sharing in-flight audits for identical URLs
 *  - Computing counts from full lists before trimming to at most 200 rows
 *  - Updating Site status to running, done, or failed
 *
 * @param {string} siteId
 * @param {object} [options]
 * @param {boolean} [options.reaudit=false]
 * @param {boolean} [options.allowPrivate=false]
 * @returns {Promise<object|null>} The updated Site document
 */
export async function enqueueSiteAudit(siteId, { reaudit = false, allowPrivate = false } = {}) {
  const site = await Site.findById(siteId);
  if (!site) return null;

  // 1. Check 7-day cache reuse if not an explicit reaudit
  if (!reaudit) {
    const cutoffDate = new Date(Date.now() - SEVEN_DAYS_MS);
    const cachedSite = await Site.findOne({
      url: site.url,
      _id: { $ne: site._id },
      auditStatus: 'done',
      auditedAt: { $gte: cutoffDate },
      audit: { $ne: null },
    }).sort({ auditedAt: -1 });

    if (cachedSite && cachedSite.audit) {
      site.audit = cachedSite.audit;
      site.brokenCertainCount = cachedSite.brokenCertainCount;
      site.brokenTotalCount = cachedSite.brokenTotalCount;
      site.sslIssueCount = cachedSite.sslIssueCount;
      site.auditedAt = cachedSite.auditedAt;
      site.auditStatus = 'done';
      await site.save();
      return site;
    }
  }

  // Mark status as running
  site.auditStatus = 'running';
  await site.save();

  // 2. Share in-flight audit if same URL is already running or queued
  const auditKey = getAuditKey(site.url);
  let auditPromise = inFlightAudits.get(auditKey);

  if (!auditPromise) {
    // Schedule through p-limit (concurrency 2)
    auditPromise = limit(async () => {
      try {
        const cleanTarget = normalizeUrl(site.url, { allowPrivate }) || site.url;
        const result = await auditSite(cleanTarget, {
          checkLinks: true,
          allowPrivate,
          timeout: 6000,
          links: {
            maxPages: 3,
            maxLinks: 60,
            timeout: 5000,
            concurrency: 10,
          },
        });
        return { success: true, result };
      } catch (err) {
        return { success: false, error: err.message || 'Audit execution failed' };
      }
    });

    inFlightAudits.set(auditKey, auditPromise);

    // Clean up from in-flight map when finished
    auditPromise.finally(() => {
      inFlightAudits.delete(auditKey);
    });
  }

  // 3. Await audit completion (either newly run or shared in-flight)
  try {
    const outcome = await auditPromise;

    if (outcome.success && outcome.result) {
      const result = outcome.result;
      const links = result.links || {};

      const fullBroken = Array.isArray(links.broken) ? links.broken : [];
      const fullBlocked = Array.isArray(links.blocked) ? links.blocked : [];
      const fullSsl = Array.isArray(links.sslIssues)
        ? links.sslIssues
        : Array.isArray(result.sslIssues)
        ? result.sslIssues
        : [];

      // Calculate counts from the FULL lists before trimming
      const brokenCertainCount = fullBroken.filter((b) => b.confidence === 'high').length;
      const brokenTotalCount = fullBroken.length;
      const sslIssueCount = fullSsl.length;

      // Deep clone result before trimming to keep at most 200 rows in each array
      const auditToStore = {
        ...result,
        links: result.links
          ? {
              ...result.links,
              broken: fullBroken.slice(0, 200),
              blocked: fullBlocked.slice(0, 200),
              sslIssues: fullSsl.slice(0, 200),
            }
          : null,
      };

      site.audit = auditToStore;
      site.brokenCertainCount = brokenCertainCount;
      site.brokenTotalCount = brokenTotalCount;
      site.sslIssueCount = sslIssueCount;
      site.auditStatus = 'done';
      site.auditedAt = new Date();
    } else {
      site.auditStatus = 'failed';
      site.audit = { error: outcome.error || 'Audit failed' };
      site.auditedAt = new Date();
    }
  } catch (err) {
    site.auditStatus = 'failed';
    site.audit = { error: err.message || 'Audit encountered an unexpected error' };
    site.auditedAt = new Date();
  }

  await site.save();
  return site;
}

/**
 * On server startup, recovers and re-queues all sites that were pending or running.
 * @param {object} [options]
 * @param {boolean} [options.allowPrivate=false]
 * @returns {Promise<number>} Number of recovered sites
 */
export async function recoverPendingAudits({ allowPrivate = false } = {}) {
  try {
    const uncompletedSites = await Site.find({
      auditStatus: { $in: ['pending', 'running'] },
    });

    if (!uncompletedSites || uncompletedSites.length === 0) {
      return 0;
    }

    console.log(`[Queue] Recovering ${uncompletedSites.length} unfinished site audits...`);

    // Reset running sites to pending and trigger audit in background
    for (const site of uncompletedSites) {
      site.auditStatus = 'pending';
      await site.save();
      enqueueSiteAudit(site._id, { allowPrivate }).catch((err) => {
        console.error(`[Queue] Background audit recovery error for site ${site._id}:`, err.message);
      });
    }

    return uncompletedSites.length;
  } catch (err) {
    console.error('[Queue] Error during recovery of pending audits:', err.message);
    return 0;
  }
}
