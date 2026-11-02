/**
 * Filter and sort utilities for the Website Audit results
 */

export const INITIAL_FILTERS = {
  searchTerm: '', // General text filter for website name / URL
  copyright: 'all', // 'all', 'current', 'outdated', 'no_year', 'missing', 'unknown'
  developer: 'all', // 'all', '__none__', or developer name
  developerSearch: '',
  hidePlatforms: false,
  brokenLinks: 'all', // 'all', 'has_broken', 'no_broken', 'certain_only', 'has_ssl'
  sort: 'most_broken', // 'most_broken', 'oldest_copyright', 'name'
};

/**
 * Extracts unique developer names from the given sites list.
 * @param {Array<object>} sites
 * @returns {Array<string>} Unique developer names
 */
export function extractUniqueDevelopers(sites = []) {
  const devs = new Set();
  for (const site of sites) {
    const devName = site.audit?.developer?.name;
    if (devName && devName.trim() && devName !== 'Unknown') {
      devs.add(devName.trim());
    }
  }
  return Array.from(devs).sort((a, b) => a.localeCompare(b));
}

/**
 * Calculates live counts for filter pill badges.
 * @param {Array<object>} sites
 * @returns {object} Counts map
 */
export function calculateFilterCounts(sites = []) {
  const counts = {
    copyright: {
      all: sites.length,
      current: 0,
      outdated: 0,
      no_year: 0,
      missing: 0,
      unknown: 0,
    },
    brokenLinks: {
      all: sites.length,
      has_broken: 0,
      no_broken: 0,
      certain_only: 0,
      has_ssl: 0,
    },
  };

  for (const site of sites) {
    const status = site.audit?.copyright?.status || 'unknown';
    if (counts.copyright[status] !== undefined) {
      counts.copyright[status]++;
    } else {
      counts.copyright.unknown++;
    }

    const brokenTotal = site.brokenTotalCount ?? 0;
    const brokenCertain = site.brokenCertainCount ?? 0;
    const sslCount = site.sslIssueCount ?? 0;

    if (brokenTotal > 0) counts.brokenLinks.has_broken++;
    if (brokenTotal === 0 && site.auditStatus === 'done') counts.brokenLinks.no_broken++;
    if (brokenCertain > 0) counts.brokenLinks.certain_only++;
    if (sslCount > 0) counts.brokenLinks.has_ssl++;
  }

  return counts;
}

/**
 * Filters and sorts sites based on active filter state.
 * @param {Array<object>} sites
 * @param {typeof INITIAL_FILTERS} filters
 * @returns {Array<object>}
 */
export function applyFiltersAndSort(sites = [], filters = INITIAL_FILTERS) {
  let result = sites.filter((site) => {
    const audit = site.audit || {};
    const copyright = audit.copyright || {};
    const developer = audit.developer || {};

    // 0. Search term (matches website name or URL)
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const q = filters.searchTerm.trim().toLowerCase();
      const name = (site.name || '').toLowerCase();
      const url = (site.url || '').toLowerCase();
      if (!name.includes(q) && !url.includes(q)) {
        return false;
      }
    }

    // 1. Copyright filter
    if (filters.copyright !== 'all') {
      const cStatus = copyright.status || 'unknown';
      if (cStatus !== filters.copyright) {
        return false;
      }
    }

    // 2. Hide platform-only credits toggle
    if (filters.hidePlatforms && developer.kind === 'platform') {
      return false;
    }

    // 3. Developer select filter
    if (filters.developer !== 'all') {
      if (filters.developer === '__none__') {
        if (developer.name && developer.kind !== 'none') {
          return false;
        }
      } else {
        const devName = developer.name || '';
        const devNorm = developer.normalizedName || '';
        if (devName !== filters.developer && devNorm !== filters.developer) {
          return false;
        }
      }
    }

    // 4. Developer text search
    if (filters.developerSearch && filters.developerSearch.trim()) {
      const q = filters.developerSearch.trim().toLowerCase();
      const devName = (developer.name || '').toLowerCase();
      const devRaw = (developer.rawText || '').toLowerCase();
      if (!devName.includes(q) && !devRaw.includes(q)) {
        return false;
      }
    }

    // 5. Broken links filter
    if (filters.brokenLinks !== 'all') {
      const brokenTotal = site.brokenTotalCount ?? 0;
      const brokenCertain = site.brokenCertainCount ?? 0;
      const sslIssues = site.sslIssueCount ?? 0;

      if (filters.brokenLinks === 'has_broken' && brokenTotal === 0) return false;
      if (filters.brokenLinks === 'no_broken' && (brokenTotal > 0 || site.auditStatus !== 'done')) return false;
      if (filters.brokenLinks === 'certain_only' && brokenCertain === 0) return false;
      if (filters.brokenLinks === 'has_ssl' && sslIssues === 0) return false;
    }

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    if (filters.sort === 'most_broken') {
      const diff = (b.brokenTotalCount ?? 0) - (a.brokenTotalCount ?? 0);
      if (diff !== 0) return diff;
      return (b.brokenCertainCount ?? 0) - (a.brokenCertainCount ?? 0);
    }

    if (filters.sort === 'oldest_copyright') {
      const yearA = a.audit?.copyright?.year;
      const yearB = b.audit?.copyright?.year;
      if (!yearA && !yearB) return 0;
      if (!yearA) return 1;
      if (!yearB) return -1;
      return yearA - yearB;
    }

    if (filters.sort === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }

    return 0;
  });

  return result;
}
