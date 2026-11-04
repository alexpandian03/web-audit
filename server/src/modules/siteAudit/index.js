import { fetchHtml, createClient } from './http.js';
import { detectCopyright } from './copyright.js';
import { detectDeveloper, normalizeDeveloperName } from './developer.js';
import { checkSiteLinks } from './linkChecker.js';
import { inspectSpa } from './spaAudit.js';
import { parsePage } from './text.js';

export { detectCopyright, detectDeveloper, normalizeDeveloperName, checkSiteLinks, inspectSpa };


const CHALLENGE = /captcha|robot check|are you a (?:human|robot)|verify (?:that )?you are (?:a )?human|access denied|just a moment|enable javascript and cookies|attention required|continue shopping/i;

/**
 * Detect pages we probably could not read properly (bot walls, JS-only shells).
 * Without this, an unreadable page looks identical to a page with no copyright.
 */
export function detectWarnings(html) {
  const { $, bodyText } = parsePage(html);
  const title = $('title').text();
  const warnings = [];
  const linkCount = $('a[href]').length;

  if (bodyText.length < 2000 && CHALLENGE.test(`${title} ${bodyText}`)) {
    warnings.push('POSSIBLE_BOT_CHALLENGE');
  }
  if (bodyText.length < 300 || linkCount === 0) {
    warnings.push('LITTLE_CONTENT'); // blocked, or JavaScript-rendered (needs a headless browser)
  }
  return warnings;
}

/**
 * Audit one website.
 * @param {string} url
 * @param {{ currentYear?: number, checkLinks?: boolean, allowPrivate?: boolean,
 *           timeout?: number, links?: object }} opts
 */
export async function auditSite(url, opts = {}) {
  const {
    currentYear = new Date().getFullYear(),
    checkLinks = true,
    allowPrivate = false,
    timeout = 10000,
    links: linkOpts = {},
  } = opts;

  const client = createClient({ timeout });
  const page = await fetchHtml(url, { client, allowPrivate });

  if (!page.ok) {
    return { url, reachable: false, httpStatus: page.status, error: page.error, auditedAt: new Date() };
  }

  let copyright = detectCopyright(page.html, { currentYear });
  let developer = detectDeveloper(page.html);
  developer.normalizedName = normalizeDeveloperName(developer.name);

  let warnings = detectWarnings(page.html);

  // If the static HTML returned little content or missing copyright, attempt SPA introspection
  if (warnings.includes('LITTLE_CONTENT') || copyright.status === 'missing') {
    const spaInfo = await inspectSpa(page, { client, currentYear, timeout: Math.min(timeout, 5000) });
    if (spaInfo?.isSpa) {
      if (spaInfo.copyright && spaInfo.copyright.status !== 'missing') {
        copyright = spaInfo.copyright;
        warnings = warnings.filter((w) => w !== 'LITTLE_CONTENT');
      }
      if (spaInfo.developer && spaInfo.developer.kind !== 'none') {
        developer = spaInfo.developer;
      }
      if (spaInfo.discoveredLinks?.length) {
        page.extraLinks = spaInfo.discoveredLinks;
      }
    }
  }

  // An unreadable page must not be reported as "missing".
  if (warnings.length) {
    if (copyright.status === 'missing') copyright.status = 'unknown';
    if (developer.kind === 'none') developer.kind = 'unknown';
  }

  const result = {
    url,
    finalUrl: page.finalUrl,
    reachable: true,
    httpStatus: page.status,
    copyright,
    developer,
    warnings,
    links: null,
    auditedAt: new Date(),
  };

  if (checkLinks) {
    result.links = await checkSiteLinks(page.finalUrl || url, { ...linkOpts, client, allowPrivate, firstPage: page });
  }
  return result;
}
