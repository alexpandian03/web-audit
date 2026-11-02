import { parsePage } from './text.js';

const VERB =
  '(?:designed|developed|powered|created|crafted|built|made|maintained|hosted|managed|engineered|design|development|designing|developing)';

const CREDIT = new RegExp(
  `\\b(?:(?:web\\s*site|website|site|web)\\s+)?${VERB}(?:\\s*(?:,|&|and|\\+|/)\\s*${VERB})*\\s+by\\b\\s*[:\\-–—]?\\s*` +
    `|\\b(?:website|site|web)\\s+by\\b\\s*[:\\-–—]?\\s*`,
  'gi'
);

const PLATFORM =
  /^(wordpress|wix(?:\.com)?|shopify|squarespace|blogger|joomla|drupal|weebly|godaddy|webflow|elementor|google sites|ghost|magento|woocommerce|bigcommerce|duda|strikingly)\b/i;

const STOP =
  /\s*(?:[|•·©]|\s[-–—]\s|\bAll rights\b|\bPrivacy\b|\bTerms\b|\bCopyright\b|\bSitemap\b|\bContact\b|\bCookie|\bDisclaimer\b|\b(?:19|20)\d{2}\b).*$/i;

function cleanName(tail) {
  const cut = tail.replace(STOP, '').replace(/[\s.,;:!\-–—]+$/g, '').trim();
  return cut.split(/\s+/).slice(0, 6).join(' ');
}

/** Prefer the anchor text/href if the credit name is a link in the footer. */
function matchAnchor($, regions, tail) {
  const lowered = tail.toLowerCase();
  for (const region of regions) {
    for (const a of $(region).find('a[href]').toArray()) {
      const label = $(a).text().replace(/\s+/g, ' ').trim();
      if (label.length >= 2 && lowered.startsWith(label.toLowerCase())) {
        return { name: label, url: $(a).attr('href') };
      }
    }
  }
  return null;
}

function candidatesIn(text, $, regions) {
  const out = [];
  for (const m of text.matchAll(CREDIT)) {
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 90).trim();
    if (!tail) continue;

    const platform = tail.match(PLATFORM);
    if (platform) {
      out.push({ name: platform[1], kind: 'platform', rawText: (m[0] + tail).trim().slice(0, 120), url: null });
      continue;
    }
    const link = matchAnchor($, regions, tail);
    const name = link?.name || cleanName(tail);
    if (!name || name.length < 2) continue;
    out.push({
      name,
      kind: 'agency',
      rawText: `${m[0]}${name}`.trim(),
      url: link?.url || null,
    });
  }
  return out;
}

/**
 * Detect "Designed by / Developed by / Powered by" credits.
 * Agencies win over platforms (e.g. "Powered by WordPress. Designed by Acme").
 * @returns {{ name: string|null, kind: 'agency'|'platform'|'none',
 *             rawText: string|null, url: string|null, source: string|null }}
 */
export function detectDeveloper(html) {
  const { $, footers, footerText, bodyText } = parsePage(html);

  let candidates = candidatesIn(footerText, $, footers);
  let source = 'footer';
  if (!candidates.length) {
    candidates = candidatesIn(bodyText.slice(-4000), $, [$('body')[0]].filter(Boolean));
    source = 'page';
  }

  const pick = candidates.find((c) => c.kind === 'agency') || candidates[0];
  if (!pick) return { name: null, kind: 'none', rawText: null, url: null, source: null };
  return { ...pick, source };
}

/** Normalise for filtering/grouping: "XYZ Tech Pvt. Ltd." -> "xyz tech" */
export function normalizeDeveloperName(name) {
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|inc|llc|co|company)\b\.?/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
