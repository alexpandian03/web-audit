// Usage: node debug-page.mjs https://example.com
// Shows what the detectors actually see, so you can tell WHY a footer was not read.
import { fetchHtml } from './src/modules/siteAudit/http.js';
import { parsePage } from './src/modules/siteAudit/text.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) { console.log('Usage: node debug-page.mjs <url>'); process.exit(1); }

const page = await fetchHtml(url, { allowPrivate: args.includes('--local') });
if (!page.ok) { console.log('Fetch failed:', page.error); process.exit(0); }

const { $, footerText, bodyText } = parsePage(page.html);
const footerCount = $('footer, [role="contentinfo"], [id*="footer" i], [class*="footer" i]').length;

console.log('\nRaw HTML length:      ', page.html.length);
console.log('Visible text length:  ', bodyText.length);
console.log('Links on page:        ', $('a[href]').length);
console.log('Footer elements found:', footerCount);
console.log('\nFooter text (first 500 chars):\n ', footerText.slice(0, 500) || '(none)');

const re = /copyright|©|&copy;|&#169;|&#xa9;|designed by|developed by|powered by|website by|site by/gi;
const hits = [...page.html.matchAll(re)].slice(0, 15);
console.log(`\nCopyright / credit text found in raw HTML: ${hits.length}`);
for (const m of hits) {
  const ctx = page.html.slice(Math.max(0, m.index - 100), m.index + 140).replace(/\s+/g, ' ');
  console.log(`  ...${ctx}...\n`);
}
if (!hits.length) {
  console.log('  Nothing in the raw HTML. The footer is probably added by JavaScript,');
  console.log('  so this module cannot see it (a headless browser would be needed).');
}
