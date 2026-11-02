/**
 * Resilient in-memory fallback store when local MongoDB daemon is not running.
 * Ensures the application runs seamlessly out-of-the-box.
 */

let searchIdCounter = 1;
let siteIdCounter = 1;

export const memorySearches = new Map();
export const memorySites = new Map();

export function makeSearchDoc(data) {
  const norm =
    data.normalizedKeyword ||
    (data.keyword ? data.keyword.toLowerCase().trim().replace(/\s+/g, ' ') : '');

  const doc = {
    _id: data._id ? String(data._id) : `search_${Date.now()}_${searchIdCounter++}`,
    keyword: data.keyword,
    normalizedKeyword: norm,
    provider: data.provider || 'places',
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
  };

  doc.save = async function () {
    memorySearches.set(doc._id.toString(), { ...doc });
    return doc;
  };

  memorySearches.set(doc._id.toString(), doc);
  return doc;
}

export function makeSiteDoc(data) {
  const doc = {
    _id: data._id ? String(data._id) : `site_${Date.now()}_${siteIdCounter++}`,
    searchId: data.searchId ? String(data.searchId) : null,
    name: data.name,
    address: data.address || '',
    url: data.url,
    auditStatus: data.auditStatus || 'pending',
    audit: data.audit || null,
    brokenCertainCount: data.brokenCertainCount ?? 0,
    brokenTotalCount: data.brokenTotalCount ?? 0,
    sslIssueCount: data.sslIssueCount ?? 0,
    auditedAt: data.auditedAt ? new Date(data.auditedAt) : null,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
  };

  doc.save = async function () {
    memorySites.set(doc._id.toString(), { ...doc });
    return doc;
  };

  memorySites.set(doc._id.toString(), doc);
  return doc;
}

export const fallbackSearchModel = {
  create: async (data) => {
    return makeSearchDoc(data);
  },
  findById: async (id) => {
    if (!id) return null;
    return memorySearches.get(id.toString()) || null;
  },
  find: (query = {}) => {
    let results = Array.from(memorySearches.values());
    return {
      sort: () => Promise.resolve(results),
      then: (resolve, reject) => Promise.resolve(results).then(resolve, reject),
      catch: (reject) => Promise.resolve(results).catch(reject),
    };
  },
  findOne: (query = {}) => {
    let results = Array.from(memorySearches.values());

    if (query.normalizedKeyword) {
      results = results.filter((s) => s.normalizedKeyword === query.normalizedKeyword);
    }
    if (query.createdAt && query.createdAt.$gte) {
      results = results.filter((s) => s.createdAt && s.createdAt >= query.createdAt.$gte);
    }

    results.sort((a, b) => b.createdAt - a.createdAt);
    const match = results[0] || null;

    return {
      sort: () => Promise.resolve(match),
      then: (resolve, reject) => Promise.resolve(match).then(resolve, reject),
      catch: (reject) => Promise.resolve(match).catch(reject),
    };
  },
};

export const fallbackSiteModel = {
  create: async (data) => {
    return makeSiteDoc(data);
  },
  insertMany: async (docs = []) => {
    return docs.map(makeSiteDoc);
  },
  findById: async (id) => {
    if (!id) return null;
    return memorySites.get(id.toString()) || null;
  },
  find: (query = {}) => {
    let results = Array.from(memorySites.values());

    if (query.searchId) {
      const qSid = query.searchId.toString();
      results = results.filter((s) => s.searchId?.toString() === qSid);
    }
    if (query.auditStatus) {
      if (query.auditStatus.$in) {
        results = results.filter((s) => query.auditStatus.$in.includes(s.auditStatus));
      } else {
        results = results.filter((s) => s.auditStatus === query.auditStatus);
      }
    }

    return {
      sort: (sortObj = {}) => {
        if (sortObj.createdAt) {
          results.sort((a, b) => (sortObj.createdAt === 1 ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
        }
        return Promise.resolve(results);
      },
      then: (resolve, reject) => Promise.resolve(results).then(resolve, reject),
      catch: (reject) => Promise.resolve(results).catch(reject),
    };
  },
  findOne: (query = {}) => {
    let results = Array.from(memorySites.values());

    if (query.url) {
      results = results.filter((s) => s.url === query.url);
    }
    if (query._id && query._id.$ne) {
      const neId = query._id.$ne.toString();
      results = results.filter((s) => s._id.toString() !== neId);
    }
    if (query.auditStatus) {
      results = results.filter((s) => s.auditStatus === query.auditStatus);
    }
    if (query.auditedAt && query.auditedAt.$gte) {
      results = results.filter((s) => s.auditedAt && s.auditedAt >= query.auditedAt.$gte);
    }
    if (query.audit && query.audit.$ne) {
      results = results.filter((s) => s.audit !== null);
    }

    const match = results[0] || null;

    return {
      sort: () => Promise.resolve(match),
      then: (resolve, reject) => Promise.resolve(match).then(resolve, reject),
      catch: (reject) => Promise.resolve(match).catch(reject),
    };
  },
};
