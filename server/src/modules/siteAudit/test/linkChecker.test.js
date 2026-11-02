import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { auditSite, checkSiteLinks } from '../index.js';

let server, port;
let flakyHits = 0;

test.before(async () => {
  server = http.createServer((req, res) => {
    const html = (body) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><body>${body}<footer>© 2020 Test Site. Developed by <a href="https://dev.example">Dev Co</a></footer></body></html>`);
    };
    switch (req.url) {
      case '/':
        return html(`
          <a href="/about">About</a>
          <a href="/missing">Missing</a>
          <a href="/server-error">Error</a>
          <a href="/forbidden">Forbidden</a>
          <a href="/head-405">Head 405</a>
          <a href="/flaky">Flaky</a>
          <a href="/loop">Loop</a>
          <a href="/old">Old (redirects to 404)</a>
          <a href="http://localhost:${port}/ext-404">External 404</a>
          <a href="mailto:a@b.com">mail</a><a href="tel:123">tel</a><a href="#top">top</a>`);
      case '/about':
        return html('<a href="/missing">Missing again</a><a href="/">Home</a>');
      case '/flaky':
        flakyHits += 1;
        if (flakyHits === 1) { res.writeHead(503); return res.end(); }
        res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok');
      case '/server-error':
        res.writeHead(500); return res.end();
      case '/forbidden':
        res.writeHead(403); return res.end();
      case '/head-405':
        if (req.method === 'HEAD') { res.writeHead(405); return res.end(); }
        res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok');
      case '/loop':
        res.writeHead(302, { location: '/loop' }); return res.end();
      case '/old':
        res.writeHead(301, { location: '/gone' }); return res.end();
      default:
        res.writeHead(404); return res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

test.after(() => server.close());

test('link checker finds broken links, ignores blocked/HEAD-405/mailto', async () => {
  const r = await checkSiteLinks(`http://127.0.0.1:${port}/`, { allowPrivate: true, retryDelayMs: 50 });
  const broken = new Map(r.broken.map((b) => [new URL(b.url).pathname, b]));

  assert.equal(broken.get('/missing').statusCode, 404);
  assert.equal(broken.get('/server-error').statusCode, 500);
  assert.equal(broken.get('/old').statusCode, 404); // linked URL redirects to a 404
  assert.equal(broken.get('/loop').error, 'REDIRECT_LOOP');
  assert.equal(broken.get('/ext-404').type, 'external');

  assert.ok(!broken.has('/head-405'), 'HEAD 405 must fall back to GET');
  assert.ok(!broken.has('/flaky'), 'a one-off 503 is retried, not reported');
  assert.equal(broken.get('/server-error').statusCode, 500, '500 is not retried');
  assert.equal(broken.get('/missing').confidence, 'high');
  assert.equal(broken.get('/server-error').confidence, 'medium');
  assert.equal(broken.get('/loop').confidence, 'high');
  assert.ok(!broken.has('/forbidden'), '403 is "blocked", not broken');
  assert.equal(r.blocked.length, 1);

  // /missing is linked from two pages -> ONE row listing both sources
  const missingRows = r.broken.filter((b) => new URL(b.url).pathname === '/missing');
  assert.equal(missingRows.length, 1);
  assert.equal(missingRows[0].sourcePages.length, 2);
  assert.equal(r.pagesCrawled, 9); // every internal link is fetched once
});

test('auditSite combines everything', async () => {
  const r = await auditSite(`http://127.0.0.1:${port}/`, { allowPrivate: true, currentYear: 2026 });
  assert.equal(r.reachable, true);
  assert.equal(r.copyright.status, 'outdated');
  assert.equal(r.developer.name, 'Dev Co');
  assert.ok(r.links.broken.length >= 5);
});

test('private hosts are blocked by default (SSRF guard)', async () => {
  const r = await auditSite(`http://127.0.0.1:${port}/`);
  assert.equal(r.reachable, false);
  assert.equal(r.error, 'URL_NOT_ALLOWED');
});

test('unreachable site is reported, not thrown', async () => {
  const r = await auditSite('http://127.0.0.1:1/', { allowPrivate: true, timeout: 2000 });
  assert.equal(r.reachable, false);
  assert.equal(r.error, 'CONNECTION_REFUSED');
});
