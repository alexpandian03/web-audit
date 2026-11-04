import { parsePage } from './text.js';
import { detectCopyright } from './copyright.js';
import { detectDeveloper, normalizeDeveloperName } from './developer.js';

const TRACKERS = /googletagmanager|google-analytics|facebook|hotjar|clarity|recaptcha|sentry|datadog/i;
const API_CANDIDATE_REGEX = /["'](\/api\/[\w\-/]*(?:common|layout|footer|setting|config|site|home)[\w\-/]*)["']/gi;
const BUNDLE_COPYRIGHT_REGEX = /(?:©|&copy;|\bcopyright\b)[^"'\n\r;]{0,100}/gi;

/**
 * Recursively extract all string values from an arbitrary JSON payload.
 */
function extractStrings(obj, max = 1500) {
  const strings = [];
  function walk(val) {
    if (strings.length >= max) return;
    if (typeof val === 'string') {
      const s = val.trim();
      if (s.length > 0) strings.push(s);
    } else if (Array.isArray(val)) {
      for (const item of val) walk(item);
    } else if (val && typeof val === 'object') {
      for (const k of Object.keys(val)) walk(val[k]);
    }
  }
  walk(obj);
  return strings;
}

/**
 * Inspect a Single Page Application (React / Vue / Vite / CRA / Angular) that renders client-side.
 * When the initial HTML shell is empty or has little content, this checks script bundles
 * and common layout/footer API endpoints for copyright notices and developer credits.
 */
export async function inspectSpa(page, { client, currentYear = new Date().getFullYear(), timeout = 4000 } = {}) {
  if (!page?.html) return { isSpa: false };

  const { $, bodyText } = parsePage(page.html);
  const linkCount = $('a[href]').length;
  const isSpaContainer = $('#root, #app, #__next, #__nuxt, [id*="root"], [id*="app"]').length > 0;

  // If the page already has ample body text and links, it is likely server-rendered
  if (!isSpaContainer && bodyText.length >= 500 && linkCount > 2) {
    return { isSpa: false };
  }

  // Find script bundle sources
  const scripts = $('script[src]')
    .map((_, el) => $(el).attr('src'))
    .get()
    .filter((src) => src && !TRACKERS.test(src));

  if (!scripts.length) {
    return { isSpa: isSpaContainer };
  }

  // Prioritize scripts likely to be application bundles
  const prioritized = scripts.sort((a, b) => {
    const aScore = /assets|bundle|main|app|index/i.test(a) ? -1 : 1;
    const bScore = /assets|bundle|main|app|index/i.test(b) ? -1 : 1;
    return aScore - bScore;
  });

  const targetScripts = prioritized.slice(0, 3);
  let bestCopyright = null;
  let bestDeveloper = null;
  const discoveredLinks = [];

  for (const src of targetScripts) {
    let scriptUrl;
    try {
      scriptUrl = new URL(src, page.finalUrl || page.url).href;
    } catch {
      continue;
    }

    let js = '';
    try {
      const res = await client.get(scriptUrl, { timeout });
      js = typeof res.data === 'string' ? res.data : '';
    } catch {
      continue;
    }

    if (!js) continue;

    // 1. Check for API endpoints called in the bundle (e.g. /api/common-data, /api/settings)
    const apiMatches = [...new Set(
      js.match(API_CANDIDATE_REGEX) || []
    )].map((m) => m.replace(/["']/g, ''));

    // Check for API base URLs in the bundle (e.g. https://api.domain.com/)
    const baseMatches = js.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s"']*)?/g) || [];
    const apiBase = baseMatches.find((u) => u.includes('api.')) || page.finalUrl || page.url;

    for (const endpoint of apiMatches.slice(0, 3)) {
      try {
        const fullApiUrl = new URL(endpoint, apiBase).href;
        const aRes = await client.get(fullApiUrl, { timeout });
        if (aRes.data && typeof aRes.data === 'object') {
          const strings = extractStrings(aRes.data);

          // Collect internal links discovered from API
          for (const s of strings) {
            if (s.startsWith('/') && s.length > 1 && !s.includes(' ') && !s.startsWith('/api')) {
              discoveredLinks.push(s);
            }
          }

          // Search strings for copyright
          for (const s of strings) {
            if (/©|&copy;|\(c\)|copyright/i.test(s)) {
              const c = detectCopyright(`<footer>${s}</footer>`, { currentYear });
              if (c && c.status !== 'missing') {
                if (!bestCopyright || (c.year && !bestCopyright.year) || (c.year && c.year > (bestCopyright.year || 0))) {
                  bestCopyright = { ...c, source: 'footer', dynamic: true };
                }
              }
            }
          }

          // Search strings for developer credits
          for (const s of strings) {
            const d = detectDeveloper(`<footer>${s}</footer>`);
            if (d && d.kind !== 'none') {
              bestDeveloper = { ...d, source: 'footer' };
              break;
            }
          }
        }
      } catch {
        // Skip failed API calls
      }
    }

    // 2. If no copyright found via API, scan static copyright strings in the JS bundle
    if (!bestCopyright || bestCopyright.status === 'missing') {
      const bundleMatches = js.match(BUNDLE_COPYRIGHT_REGEX) || [];
      for (const bm of bundleMatches) {
        const c = detectCopyright(`<footer>${bm}</footer>`, { currentYear });
        if (c && c.status !== 'missing') {
          if (!bestCopyright || (c.year && !bestCopyright.year) || (c.year && c.year > (bestCopyright.year || 0))) {
            bestCopyright = { ...c, source: 'page', dynamic: true };
          }
        }
      }
    }

    // 3. Scan bundle for developer credit
    if (!bestDeveloper || bestDeveloper.kind === 'none') {
      const d = detectDeveloper(`<footer>${js.slice(-15000)}</footer>`);
      if (d && d.kind !== 'none') {
        bestDeveloper = { ...d, source: 'page' };
      }
    }

    if (bestCopyright && bestCopyright.status === 'current') {
      break;
    }
  }

  if (bestDeveloper?.name) {
    bestDeveloper.normalizedName = normalizeDeveloperName(bestDeveloper.name);
  }

  return {
    isSpa: true,
    copyright: bestCopyright,
    developer: bestDeveloper,
    discoveredLinks: [...new Set(discoveredLinks)],
  };
}
