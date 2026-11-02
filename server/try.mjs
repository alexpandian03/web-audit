// Usage:  node try.mjs https://example.com          (short summary)
//         node try.mjs https://example.com --json   (full JSON)
import { auditSite } from './src/modules/siteAudit/index.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) { console.log('Usage: node try.mjs <url> [--json]'); process.exit(1); }

const r = await auditSite(url, {
  currentYear: 2026,
  allowPrivate: args.includes('--local'),
  links: { maxPages: 10 },
});

if (args.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

if (!r.reachable) { console.log(`Could not open ${url}: ${r.error}`); process.exit(0); }

console.log(`\nSite:       ${r.finalUrl}`);
console.log(`Copyright:  ${r.copyright.status}${r.copyright.year ? ` (${r.copyright.year})` : ''}${r.copyright.text ? `  "${r.copyright.text}"` : ''}`);
console.log(`Developer:  ${r.developer.name ?? '-'}  [${r.developer.kind}]`);
if (r.warnings.length) console.log(`Warnings:   ${r.warnings.join(', ')}`);

if (r.links) {
  const L = r.links;
  console.log(`\nLinks: ${L.pagesCrawled} pages crawled, ${L.linksChecked} links checked${L.truncated ? ' (capped)' : ''}`);
  console.log(`  broken: ${L.broken.length}   ssl issues: ${L.sslIssues.length}   blocked by site (ignored): ${L.blocked.length}`);
  if (L.broken.length) console.log('\nBroken links:');
  for (const b of L.broken) {
    console.log(`  ${String(b.statusCode ?? b.error).padEnd(16)} ${b.url}${b.confidence === 'medium' ? '   (not certain: server error/timeout)' : ''}`);
    console.log(`  ${''.padEnd(16)} found on ${b.sourcePages.length} page(s), e.g. ${b.sourcePages[0]}`);
  }
  if (L.sslIssues.length) console.log('\nCertificate problems (page opens, but cert is invalid):');
  for (const b of L.sslIssues) console.log(`  ${(b.detail || 'SSL').padEnd(34)} ${b.url}`);
}
console.log('');
