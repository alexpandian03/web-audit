/**
 * Helper to escape CSV values according to RFC 4180
 * @param {any} val
 * @returns {string}
 */
export function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If string contains quotes, commas, or newlines, escape quotes and wrap in quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates CSV content from an array of Site documents.
 * @param {Array<object>} sites
 * @returns {string} CSV formatted string
 */
export function generateSitesCsv(sites = []) {
  const headers = [
    'Website Name',
    'Website URL',
    'Address',
    'Audit Status',
    'Copyright Status',
    'Copyright Year',
    'Developer Name',
    'Developer Type',
    'Broken Links (High Confidence)',
    'Broken Links (Total)',
    'SSL Issues',
    'Audited At',
  ];

  const rows = sites.map((site) => {
    const audit = site.audit || {};
    const copyright = audit.copyright || {};
    const developer = audit.developer || {};

    return [
      escapeCsvCell(site.name || ''),
      escapeCsvCell(site.url || ''),
      escapeCsvCell(site.address || ''),
      escapeCsvCell(site.auditStatus || 'pending'),
      escapeCsvCell(copyright.status || 'unknown'),
      escapeCsvCell(copyright.year || ''),
      escapeCsvCell(developer.name || ''),
      escapeCsvCell(developer.kind || 'unknown'),
      escapeCsvCell(site.brokenCertainCount ?? 0),
      escapeCsvCell(site.brokenTotalCount ?? 0),
      escapeCsvCell(site.sslIssueCount ?? 0),
      escapeCsvCell(site.auditedAt ? new Date(site.auditedAt).toISOString() : ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}
