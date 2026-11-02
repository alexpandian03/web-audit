import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { checkSiteLinks } from '../index.js';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url));

test('bad certificate on a reachable page is "sslIssues", not "broken"', async () => {
  const tls = https.createServer({ key: fx('key.pem'), cert: fx('cert.pem') }, (req, res) => {
    if (req.url === '/dead') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end('ok');
  });
  await new Promise((r) => tls.listen(0, '127.0.0.1', r));
  const tlsPort = tls.address().port;

  const site = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<html><body><a href="https://127.0.0.1:${tlsPort}/fine">a</a>` +
            `<a href="https://127.0.0.1:${tlsPort}/dead">b</a></body></html>`);
  });
  await new Promise((r) => site.listen(0, 'localhost', r));

  try {
    const r = await checkSiteLinks(`http://localhost:${site.address().port}/`, { allowPrivate: true });
    assert.equal(r.sslIssues.length, 1);
    assert.match(r.sslIssues[0].url, /\/fine$/);
    assert.equal(r.sslIssues[0].detail, 'DEPTH_ZERO_SELF_SIGNED_CERT');
    assert.equal(r.broken.length, 1); // /dead is a real 404 even though the cert is bad
    assert.equal(r.broken[0].statusCode, 404);
  } finally {
    tls.close(); site.close();
  }
});
