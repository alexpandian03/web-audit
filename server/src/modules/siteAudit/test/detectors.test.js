import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCopyright, detectDeveloper } from '../index.js';

const page = (footer, body = '<h1>Hi</h1>') =>
  `<html><body>${body}<footer>${footer}</footer></body></html>`;

test('copyright: current year', () => {
  const r = detectCopyright(page('© 2026 Acme Hospital. All rights reserved.'), { currentYear: 2026 });
  assert.equal(r.status, 'current');
  assert.equal(r.year, 2026);
});

test('copyright: range ending in current year counts as current', () => {
  const r = detectCopyright(page('Copyright &copy; 2015 - 2026 Acme'), { currentYear: 2026 });
  assert.equal(r.status, 'current');
  assert.equal(r.year, 2026);
});

test('copyright: short range "2015-26"', () => {
  const r = detectCopyright(page('© 2015-26 Acme'), { currentYear: 2026 });
  assert.equal(r.year, 2026);
});

test('copyright: outdated', () => {
  const r = detectCopyright(page('Copyright © 2019 Foo College'), { currentYear: 2026 });
  assert.equal(r.status, 'outdated');
  assert.equal(r.year, 2019);
  assert.match(r.text, /2019/);
});

test('copyright: year before the symbol ("2026 © Acme")', () => {
  const r = detectCopyright(page('2026 © Acme'), { currentYear: 2026 });
  assert.equal(r.year, 2026);
});

test('copyright: missing', () => {
  const r = detectCopyright(page('Contact us at hello@acme.com'), { currentYear: 2026 });
  assert.equal(r.status, 'missing');
  assert.equal(r.year, null);
});

test('copyright: JS-injected year is flagged dynamic', () => {
  const r = detectCopyright(
    page('© <span id="y"></span> Acme <script>document.getElementById("y").textContent = new Date().getFullYear()</script>'),
    { currentYear: 2026 }
  );
  assert.equal(r.status, 'current');
  assert.equal(r.dynamic, true);
});

test('copyright: falls back to whole page when there is no footer', () => {
  const r = detectCopyright('<html><body><p>© 2023 Acme</p></body></html>', { currentYear: 2026 });
  assert.equal(r.year, 2023);
  assert.equal(r.source, 'page');
});

test('developer: linked agency with separators', () => {
  const r = detectDeveloper(
    page('© 2026 Acme | Designed &amp; Developed by <a href="https://zealous.example">Zealous Infotech</a> | All rights reserved')
  );
  assert.equal(r.kind, 'agency');
  assert.equal(r.name, 'Zealous Infotech');
  assert.equal(r.url, 'https://zealous.example');
});

test('developer: plain-text credit', () => {
  const r = detectDeveloper(page('Website by Pixel Studio © 2026'));
  assert.equal(r.name, 'Pixel Studio');
  assert.equal(r.kind, 'agency');
});

test('developer: platform credit is labelled platform', () => {
  const r = detectDeveloper(page('Proudly powered by WordPress'));
  assert.equal(r.kind, 'platform');
  assert.equal(r.name.toLowerCase(), 'wordpress');
});

test('developer: agency beats platform', () => {
  const r = detectDeveloper(page('Powered by WordPress. Designed by Acme Web'));
  assert.equal(r.kind, 'agency');
  assert.equal(r.name, 'Acme Web');
});

test('developer: none', () => {
  const r = detectDeveloper(page('© 2026 Acme. All rights reserved.'));
  assert.equal(r.kind, 'none');
  assert.equal(r.name, null);
});

import { detectWarnings } from '../index.js';

test('warnings: bot-check page is flagged', () => {
  const w = detectWarnings('<html><head><title>Robot Check</title></head><body><p>Enter the characters you see. CAPTCHA</p></body></html>');
  assert.ok(w.includes('POSSIBLE_BOT_CHALLENGE'));
  assert.ok(w.includes('LITTLE_CONTENT'));
});

test('warnings: JS-only shell is flagged', () => {
  const w = detectWarnings('<html><body><div id="root"></div><script src="/app.js"></script></body></html>');
  assert.ok(w.includes('LITTLE_CONTENT'));
});

test('warnings: normal page with a reCAPTCHA form is NOT flagged', () => {
  const body = '<p>' + 'Hospital services and doctors. '.repeat(120) + '</p><a href="/a">A</a><form>reCAPTCHA</form>';
  assert.deepEqual(detectWarnings(`<html><body>${body}</body></html>`), []);
});

test('copyright: statement without a year -> no_year (not missing)', () => {
  const r = detectCopyright(page('<p>Copyrights All Rights Reserved</p>'), { currentYear: 2026 });
  assert.equal(r.status, 'no_year');
  assert.equal(r.year, null);
  assert.match(r.text, /Copyrights All Rights Reserved/);
});

test('copyright: "(c)" in ordinary text is not a copyright statement', () => {
  const r = detectCopyright(page('See clause (c) of the policy'), { currentYear: 2026 });
  assert.equal(r.status, 'missing');
});

test('footer detection ignores a <body class="ehf-footer"> wrapper', () => {
  const filler = '<p>' + 'Welcome to our college. '.repeat(120) + '</p>';
  const html = `<html><body class="ehf-footer">${filler}<footer>© 2026 Acme</footer></body></html>`;
  const r = detectCopyright(html, { currentYear: 2026 });
  assert.equal(r.source, 'footer');
  assert.equal(r.status, 'current');
});

test('copyright: no_year text stops after "All Rights Reserved"', () => {
  const r = detectCopyright(page('<p>Copyrights All Rights Reserved</p><a>Facebook-f</a><a>Instagram</a>'), { currentYear: 2026 });
  assert.equal(r.text, 'Copyrights All Rights Reserved');
});
