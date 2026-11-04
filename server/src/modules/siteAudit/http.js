import axios from 'axios';
import net from 'node:net';

const USER_AGENT = 'SiteAuditBot/1.0 (+https://web-audit-three.vercel.app/bot)';

/** Shared axios client. Never throws on HTTP status; only on network errors. */
export function createClient({ timeout = 10000 } = {}) {
  return axios.create({
    timeout,
    maxRedirects: 5,
    maxContentLength: 5 * 1024 * 1024,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    },
  });
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

/**
 * SSRF guard: the server fetches URLs that come from search results,
 * so refuse non-http(s) and obviously private/internal hosts.
 * (Does not defend against DNS rebinding; add a resolver check in production.)
 */
export function assertPublicUrl(raw, { allowPrivate = false } = {}) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }
  if (allowPrivate) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error(`Blocked private host: ${host}`);
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new Error(`Blocked private IP: ${host}`);
  }
  return url;
}

/** Fetch a page as HTML. Returns { ok, status, finalUrl, html, error }. */
export async function fetchHtml(url, { client = createClient(), allowPrivate = false } = {}) {
  try {
    assertPublicUrl(url, { allowPrivate });
    const res = await client.get(url, { responseType: 'text' });
    const finalUrl = res.request?.res?.responseUrl || url;
    const type = String(res.headers['content-type'] || '');
    if (res.status >= 400) {
      return { ok: false, status: res.status, finalUrl, html: '', error: `HTTP_${res.status}` };
    }
    if (type && !/html|xml/i.test(type)) {
      return { ok: false, status: res.status, finalUrl, html: '', error: 'NOT_HTML' };
    }
    return { ok: true, status: res.status, finalUrl, html: String(res.data) };
  } catch (err) {
    return { ok: false, status: null, finalUrl: url, html: '', error: describeError(err) };
  }
}

export function describeError(err) {
  const code = err.code || '';
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'TIMEOUT';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_FAILURE';
  if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (code === 'ECONNRESET') return 'CONNECTION_RESET';
  if (code === 'ERR_FR_TOO_MANY_REDIRECTS') return 'REDIRECT_LOOP';
  if (/CERT|SSL|TLS|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER|SELF_SIGNED/i.test(code)) return 'SSL_ERROR';
  if (/Blocked|Unsupported/.test(err.message || '')) return 'URL_NOT_ALLOWED';
  return code || 'NETWORK_ERROR';
}
