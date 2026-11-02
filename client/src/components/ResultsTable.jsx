import React from 'react';
import {
  ExternalLink,
  Loader2,
  Check,
  HelpCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
} from 'lucide-react';

function getInitialLetter(name = '') {
  const clean = name.trim();
  return clean ? clean.charAt(0).toUpperCase() : '?';
}

function getCopyrightDisplay(copyright = {}) {
  const status = copyright.status || 'unknown';
  const year = copyright.year;

  let badge = null;
  switch (status) {
    case 'current':
      badge = (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          Current
        </span>
      );
      break;
    case 'outdated':
      badge = (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff2095]/10 text-[#ff2095] border border-[#ff2095]/30 whitespace-nowrap">
          Outdated
        </span>
      );
      break;
    case 'no_year':
      badge = (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          No year
        </span>
      );
      break;
    case 'missing':
      badge = (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
          Missing
        </span>
      );
      break;
    default:
      badge = (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
          Unknown
        </span>
      );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {badge}
      {year && <span className="text-xs text-slate-500 font-semibold pl-0.5">{year}</span>}
    </div>
  );
}

function getDeveloperDisplay(developer = {}) {
  const name = developer.name;
  const kind = developer.kind || 'unknown';

  if (!name || kind === 'none') {
    return (
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 italic">None found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      <span className="text-xs font-bold text-[#0a0a0a] line-clamp-1 break-words" title={name}>
        {name}
      </span>
      <span className="text-[11px] text-slate-400 capitalize">{kind}</span>
    </div>
  );
}

export function ResultsTable({ sites = [], onSelectSite, selectedSiteId, isLoading }) {
  if (isLoading && sites.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-slate-100">
              <div className="h-5 bg-slate-200 rounded w-1/4"></div>
              <div className="h-5 bg-slate-200 rounded w-1/6"></div>
              <div className="h-5 bg-slate-200 rounded w-1/6"></div>
              <div className="h-5 bg-slate-200 rounded w-1/12"></div>
              <div className="h-5 bg-slate-200 rounded w-1/12"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-2">
        <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-slate-200">
          <HelpCircle className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-[#0a0a0a]">No websites match your filter criteria</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Try resetting the filters or modifying your search keyword to view more sites.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table responsive container with self-contained scroll to eliminate external overlaps */}
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          {/* Sticky Header stays pinned to top of table only */}
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
            <tr className="text-[11px] font-bold text-slate-500 tracking-wider uppercase select-none">
              <th className="py-3.5 px-4 sm:px-6 font-bold w-[30%] min-w-[200px]">WEBSITE</th>
              <th className="py-3.5 px-4 font-bold w-[14%] min-w-[105px]">COPYRIGHT</th>
              <th className="py-3.5 px-4 font-bold w-[18%] min-w-[130px]">DEVELOPER</th>
              <th className="py-3.5 px-4 font-bold w-[12%] min-w-[95px]">BROKEN LINKS</th>
              <th className="py-3.5 px-4 font-bold w-[11%] min-w-[95px]">LINK SSL ISSUES</th>
              <th className="py-3.5 px-4 sm:px-6 text-right font-bold w-[15%] min-w-[135px]">AUDIT LOGS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {sites.map((site) => {
              const audit = site.audit || {};
              const isSelected = selectedSiteId === site._id;
              const isRunning = site.auditStatus === 'running';
              const isPending = site.auditStatus === 'pending';
              const isDone = site.auditStatus === 'done';

              return (
                <tr
                  key={site._id}
                  onClick={() => onSelectSite(site)}
                  className={`group transition-colors duration-150 cursor-pointer ${
                    isSelected ? 'bg-sky-50/70 border-l-4 border-[#007ba7]' : 'hover:bg-slate-50/80'
                  }`}
                  title={isDone ? 'Click to inspect complete audit logs' : isRunning ? 'Auditing in background...' : 'Queued for audit'}
                >
                  {/* WEBSITE: Avatar + Name + URL */}
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl border font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-2xs transition ${
                        isRunning
                          ? 'bg-[#007ba7] text-white border-[#007ba7] animate-pulse'
                          : 'bg-slate-100 border-slate-200 text-[#007ba7] group-hover:bg-[#007ba7] group-hover:text-white'
                      }`}>
                        {getInitialLetter(site.name)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[#0a0a0a] group-hover:text-[#007ba7] transition truncate max-w-[220px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                          {site.name}
                        </span>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 mt-0.5 truncate max-w-[220px] sm:max-w-xs"
                          title={`Open ${site.url} in new tab`}
                        >
                          <span className="truncate">{site.url.replace(/^https?:\/\//i, '')}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                    </div>
                  </td>

                  {/* COPYRIGHT */}
                  <td className="py-4 px-4">
                    {isRunning && !audit.copyright ? (
                      <span className="text-xs text-[#007ba7] font-semibold animate-pulse">Checking...</span>
                    ) : isPending ? (
                      <span className="text-xs text-slate-400">In queue</span>
                    ) : (
                      getCopyrightDisplay(audit.copyright)
                    )}
                  </td>

                  {/* DEVELOPER */}
                  <td className="py-4 px-4">
                    {isRunning && !audit.developer ? (
                      <span className="text-xs text-[#007ba7] font-semibold animate-pulse">Checking...</span>
                    ) : isPending ? (
                      <span className="text-xs text-slate-400">In queue</span>
                    ) : (
                      getDeveloperDisplay(audit.developer)
                    )}
                  </td>

                  {/* BROKEN LINKS */}
                  <td className="py-4 px-4 text-xs">
                    {isRunning ? (
                      <span className="text-[#007ba7] font-semibold animate-pulse">Scanning...</span>
                    ) : isPending ? (
                      <span className="text-slate-400">Queued</span>
                    ) : site.brokenCertainCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[#ff2095] font-bold">{site.brokenCertainCount}</span>
                        <span className="text-slate-400">/ {site.brokenTotalCount}</span>
                      </span>
                    ) : site.brokenTotalCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                        <span>0</span>
                        <span className="text-slate-400">/ {site.brokenTotalCount}</span>
                      </span>
                    ) : site.auditStatus === 'done' ? (
                      <span className="text-slate-400 font-medium">None found</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* LINK SSL ISSUES */}
                  <td className="py-4 px-4 text-xs">
                    {isRunning || isPending ? (
                      <span className="text-slate-300">—</span>
                    ) : site.sslIssueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{site.sslIssueCount}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">None found</span>
                    )}
                  </td>

                  {/* STATUS & AUDIT LOGS ACTION */}
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isRunning ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-50 text-[#007ba7] border border-sky-200 shadow-2xs whitespace-nowrap">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007ba7]" />
                          <span>Auditing now</span>
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>In queue</span>
                        </span>
                      ) : site.auditStatus === 'done' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSite(site);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-[#007ba7] group-hover:text-white bg-sky-50 group-hover:bg-[#007ba7] border border-sky-200 group-hover:border-[#007ba7] transition-all duration-150 cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Logs</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-rose-600">Failed</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ResultsTable;
