import https from 'node:https';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { createClient, assertPublicUrl, fetchHtml, describeError } from './http.js';

const SKIP_SCHEMES = /^(mailto:|tel:|javascript:|sms:|data:|whatsapp:|#)/i;
const NON_HTML_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|rar|docx?|xlsx?|pptx?|mp3|mp4|avi|mov|css|js|json|xml)(\?.*)?$/i;
// Bot-blocking responses: the link probably works for humans, so don't call it broken.
const BLOCKED_STATUS = new Set([401, 403, 429, 999]);

function normalize(href, base) {
  if (!href || SKIP_SCHEMES.test(href.trim())) return null;
  try {
    const u = new URL(href.trim(), base);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

const bareHost = (u) => new URL(u).hostname.replace(/^www\./, '').toLowerCase();

// How sure are we that a link is really broken for a human visitor?
const CERTAIN_STATUS = new Set([404, 410]);
const CERTAIN_ERRORS = new Set(['DNS_FAILURE', 'REDIRECT_LOOP']);
const confidenceOf = (r) => (CERTAIN_STATUS.has(r.status) || CERTAIN_ERRORS.has(r.error) ? 'high' : 'medium');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT_STATUS = new Set([502, 503, 504]);
const TRANSIENT_ERRORS = new Set(['TIMEOUT', 'CONNECTION_RESET']);

/** HEAD first, GET fallback (many servers mishandle HEAD). */
async function checkUrl(client, url, allowPrivate) {
  try {
    assertPublicUrl(url, { allowPrivate });
  } catch (err) {
    return { kind: 'skipped', status: null, error: describeError(err) };
  }

  let status = null;
  try {
    const head = await client.head(url);
    status = head.status;
  } catch {
    status = null;
  }

  if (status === null || status >= 400) {
    try {
      const res = await client.get(url, { responseType: 'stream' });
      res.data?.destroy?.();
      status = res.status;
    } catch (err) {
      const error = describeError(err);
      if (error !== 'SSL_ERROR') return { kind: 'broken', status: null, error, detail: err.code || null };
      // Certificate problem. Browsers often cope (e.g. incomplete chain), Node does not.
      // Retry without verification to learn whether the page itself is reachable.
      try {
        const res = await client.get(url, {
          responseType: 'stream',
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
        res.data?.destroy?.();
        if (res.status < 400 || BLOCKED_STATUS.has(res.status)) {
          return { kind: 'ssl_issue', status: res.status, error: 'SSL_ERROR', detail: err.code || null };
        }
        return { kind: 'broken', status: res.status, error: `HTTP_${res.status}`, detail: err.code || null };
      } catch (err2) {
        return { kind: 'broken', status: null, error: describeError(err2), detail: err2.code || null };
      }
    }
  }

  if (status < 400) return { kind: 'ok', status, error: null };
  if (BLOCKED_STATUS.has(status)) return { kind: 'blocked', status, error: `HTTP_${status}` };
  return { kind: 'broken', status, error: `HTTP_${status}` };
}

/**
 * Crawl a site (same-domain, BFS) and check every discovered link.
 * @returns {{ pagesCrawled, linksChecked, truncated, broken: Row[], blocked: Row[], sslIssues: Row[] }}
 *   Row = { url, statusCode, error, detail, confidence: 'high'|'medium', type: 'internal'|'external', sourcePages: string[] }
 */
export async function checkSiteLinks(startUrl, opts = {}) {
  const {
    maxPages = 30,
    maxDepth = 2,
    maxLinks = 300,
    concurrency = 5,
    timeout = 10000,
    allowPrivate = false,
    retryDelayMs = 1500, // wait before re-checking timeouts and 502/503/504
    firstPage = null, // pass an already-fetched homepage to avoid fetching twice
    client = createClient({ timeout }),
  } = opts;

  const limit = pLimit(concurrency);
  const start = normalize(startUrl, startUrl);
  const siteHost = bareHost(start);

  const status = new Map(); // url -> { kind, status, error }
  const sources = new Map(); // url -> Set(sourcePage)
  const seenPages = new Set([start]);
  const crawled = new Set();
  let frontier = [[start, 0]];

  const crawlPage = async (url) => {
    let page = url === start && firstPage ? firstPage : await fetchHtml(url, { client, allowPrivate });
    if (!page.ok && (TRANSIENT_STATUS.has(page.status) || TRANSIENT_ERRORS.has(page.error))) {
      await sleep(retryDelayMs); // same one-retry rule as external links
      page = await fetchHtml(url, { client, allowPrivate });
    }
    if (!page.ok && page.error === 'NOT_HTML') {
      // Reachable but not a page (PDF, text, image without extension): fine, just don't crawl it.
      status.set(url, { kind: 'ok', status: page.status, error: null });
      return [];
    }
    if (!page.ok) {
      status.set(url, { kind: page.status === 403 || page.status === 429 ? 'blocked' : 'broken', status: page.status, error: page.error });
      return [];
    }
    status.set(url, { kind: 'ok', status: page.status, error: null });
    const $ = cheerio.load(page.html);
    const base = page.finalUrl || url;
    return $('a[href]')
      .toArray()
      .map((a) => normalize($(a).attr('href'), base))
      .filter(Boolean);
  };

  while (frontier.length && crawled.size < maxPages) {
    const batch = frontier.slice(0, maxPages - crawled.size);
    frontier = [];
    const results = await Promise.all(
      batch.map(([url, depth]) => limit(async () => ({ url, depth, links: await crawlPage(url) })))
    );
    for (const { url, depth, links } of results) {
      crawled.add(url);
      for (const link of links) {
        if (!sources.has(link)) sources.set(link, new Set());
        sources.get(link).add(url);
        const internal = bareHost(link) === siteHost;
        if (internal && depth + 1 <= maxDepth && !seenPages.has(link) && !NON_HTML_EXT.test(link)) {
          seenPages.add(link);
          frontier.push([link, depth + 1]);
        }
      }
    }
  }

  // Check every unique link we haven't already fetched while crawling.
  const allLinks = [...sources.keys()];
  const truncated = allLinks.length > maxLinks;
  const toCheck = allLinks.filter((l) => !status.has(l)).slice(0, maxLinks);
  await Promise.all(
    toCheck.map((url) =>
      limit(async () => {
        let result = await checkUrl(client, url, allowPrivate);
        if (result.kind === 'broken' && (TRANSIENT_STATUS.has(result.status) || TRANSIENT_ERRORS.has(result.error))) {
          await sleep(retryDelayMs); // probably a hiccup: one more try before calling it broken
          result = await checkUrl(client, url, allowPrivate);
        }
        status.set(url, result);
      })
    )
  );

  const broken = [];
  const blocked = [];
  const sslIssues = [];
  // One row per URL, with every page it was found on.
  const rowFor = (url, result) => ({
    url,
    statusCode: result.status,
    error: result.error,
    detail: result.detail || null,
    confidence: confidenceOf(result), // 'high': 404/410/DNS/loop. 'medium': 5xx, timeout (could be bot-blocking)
    type: bareHost(url) === siteHost ? 'internal' : 'external',
    sourcePages: [...(sources.get(url) || ['(start page)'])],
  });
  for (const [url, result] of status) {
    if (result.kind === 'broken') broken.push(rowFor(url, result));
    else if (result.kind === 'blocked') blocked.push(rowFor(url, result));
    else if (result.kind === 'ssl_issue') sslIssues.push(rowFor(url, result));
  }

  return { pagesCrawled: crawled.size, linksChecked: status.size, truncated, broken, blocked, sslIssues };
}
