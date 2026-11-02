import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, normalizeUrl } from '../../../app.js';

test('normalizeUrl', () => {
  assert.equal(normalizeUrl('nitt.edu'), 'https://nitt.edu/');
  assert.equal(normalizeUrl(' http://a.com/x '), 'http://a.com/x');
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('localhost'), null);
  assert.equal(normalizeUrl(42), null);
});

test('API: health, validation, GET and POST audit', async () => {
  const site = http.createServer((q, s) => {
    s.writeHead(200, { 'content-type': 'text/html' });
    s.end('<html><body><p>' + 'Hello world. '.repeat(40) + '</p><a href="/x">x</a><footer>© 2026 Acme | Designed by <a href="https://z.example">Zed Labs</a></footer></body></html>');
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const target = `http://127.0.0.1:${site.address().port}/`;

  const api = createApp({ allowPrivate: true }).listen(0);
  await new Promise((r) => api.once('listening', r));
  const base = `http://127.0.0.1:${api.address().port}`;

  try {
    assert.equal((await (await fetch(`${base}/api/health`)).json()).status, 'ok');

    const bad = await fetch(`${base}/api/audit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 400);
    const badJson = await fetch(`${base}/api/audit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    assert.equal(badJson.status, 400);

    const viaGet = await (await fetch(`${base}/api/audit?checkLinks=false&url=${encodeURIComponent(target)}`)).json();
    assert.equal(viaGet.copyright.status, 'current');
    assert.equal(viaGet.developer.name, 'Zed Labs');
    assert.equal(viaGet.links, null);

    const viaPost = await (await fetch(`${base}/api/audit`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: target, maxPages: 3 }),
    })).json();
    assert.equal(viaPost.reachable, true);
    assert.ok(viaPost.links.pagesCrawled >= 1);
  } finally {
    api.close(); site.close();
  }
});
