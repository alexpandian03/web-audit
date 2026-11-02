/**
 * API client helper for communicating with the backend.
 * Uses import.meta.env.VITE_API_BASE (no trailing slash) when deployed (e.g. on Render),
 * falling back to "" to use the Vite dev proxy in local development.
 */

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const ACCESS_KEY_STORAGE = 'sitecheck_access_key';

export function getApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export function getStoredAccessKey() {
  try {
    return sessionStorage.getItem(ACCESS_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setStoredAccessKey(key) {
  try {
    if (key && key.trim()) {
      sessionStorage.setItem(ACCESS_KEY_STORAGE, key.trim());
    } else {
      sessionStorage.removeItem(ACCESS_KEY_STORAGE);
    }
  } catch {}
}

export function clearStoredAccessKey() {
  try {
    sessionStorage.removeItem(ACCESS_KEY_STORAGE);
  } catch {}
}

export async function checkServerHealth() {
  try {
    const res = await fetch(getApiUrl('/api/health'));
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

async function apiRequest(path, options = {}) {
  const url = getApiUrl(path);
  const accessKey = getStoredAccessKey();

  const headers = {
    'Content-Type': 'application/json',
    ...(accessKey ? { 'x-access-key': accessKey } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearStoredAccessKey();
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || 'Access key required or invalid');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error || errorData.detail || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.code = errorData.code;
    err.provider = errorData.provider;
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function createSearch(keyword, { refresh = false } = {}) {
  const path = refresh ? '/api/searches?refresh=true' : '/api/searches';
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify({ keyword, refresh }),
  });
}

export async function fetchSearch(id) {
  return apiRequest(`/api/searches/${id}`);
}

export async function fetchSite(id) {
  return apiRequest(`/api/sites/${id}`);
}

export async function reauditSite(id) {
  return apiRequest(`/api/sites/${id}/reaudit`, {
    method: 'POST',
  });
}

export function getExportCsvUrl(searchId) {
  return getApiUrl(`/api/searches/${searchId}/export.csv`);
}

export async function downloadExportCsv(searchId, keyword = 'export') {
  const url = getExportCsvUrl(searchId);
  const accessKey = getStoredAccessKey();
  const headers = accessKey ? { 'x-access-key': accessKey } : {};

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to download CSV export (${res.status})`);
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  const safeKeyword = (keyword || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `search-${safeKeyword}-${searchId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}
