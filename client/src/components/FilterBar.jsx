import React from 'react';
import { SlidersHorizontal, Download, RotateCcw, Search, ChevronDown } from 'lucide-react';
import { INITIAL_FILTERS } from '../utils/filterHelpers';

export function FilterBar({
  filters,
  onChange,
  onReset,
  counts,
  availableDevelopers,
  matchingCount,
  totalCount,
  onExportCsv,
}) {
  const isFiltered =
    filters.searchTerm !== '' ||
    filters.copyright !== 'all' ||
    filters.developer !== 'all' ||
    filters.developerSearch !== '' ||
    filters.hidePlatforms ||
    filters.brokenLinks !== 'all' ||
    filters.sort !== 'most_broken';

  const update = (key, val) => {
    onChange({ ...filters, [key]: val });
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. Results Action Toolbar (Matching Image 2 top row) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Results Title & Counts */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#007ba7]" />
            <h2 className="text-lg font-bold text-[#0a0a0a]">Results</h2>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
              {totalCount}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Showing {matchingCount} of {totalCount}
          </p>
        </div>

        {/* Right: Search Results + Sort + Reset + Export CSV */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search inside results */}
          <div className="relative">
            <input
              type="text"
              value={filters.searchTerm || ''}
              onChange={(e) => update('searchTerm', e.target.value)}
              placeholder="Search results"
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#0a0a0a] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007ba7] w-40 sm:w-52 shadow-2xs"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={filters.sort}
              onChange={(e) => update('sort', e.target.value)}
              className="appearance-none text-xs font-medium bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#007ba7] cursor-pointer shadow-2xs"
            >
              <option value="most_broken">Most broken links</option>
              <option value="oldest_copyright">Oldest copyright year</option>
              <option value="name">Website name (A-Z)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Reset Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-slate-600 hover:text-[#0a0a0a] bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {/* Export CSV Button */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007ba7] hover:bg-[#006b92] rounded-xl transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Structured Filter Card (Matching Image 2 Filter Box) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Section 1: COPYRIGHT */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 block">
              COPYRIGHT
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'current', label: 'Current' },
                { id: 'outdated', label: 'Outdated' },
                { id: 'no_year', label: 'No Year' },
                { id: 'missing', label: 'Missing' },
              ].map((pill) => {
                const active = filters.copyright === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => update('copyright', pill.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer ${
                      active
                        ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                        : 'bg-white hover:bg-slate-50 text-[#0a0a0a] border border-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
            <div>
              <button
                type="button"
                onClick={() => update('copyright', 'unknown')}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer ${
                  filters.copyright === 'unknown'
                    ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                    : 'bg-white hover:bg-slate-50 text-[#0a0a0a] border border-slate-200'
                }`}
              >
                Couldn&apos;t Check
              </button>
            </div>
          </div>

          {/* Section 2: BROKEN LINKS */}
          <div className="space-y-3 md:pl-6 pt-4 md:pt-0">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 block">
              BROKEN LINKS
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'has_broken', label: 'Has broken' },
                { id: 'no_broken', label: 'None found' },
                { id: 'certain_only', label: 'Certain only' },
              ].map((pill) => {
                const active = filters.brokenLinks === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => update('brokenLinks', pill.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer ${
                      active
                        ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                        : 'bg-white hover:bg-slate-50 text-[#0a0a0a] border border-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
            <div>
              <button
                type="button"
                onClick={() => update('brokenLinks', 'has_ssl')}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer ${
                  filters.brokenLinks === 'has_ssl'
                    ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                    : 'bg-white hover:bg-slate-50 text-[#0a0a0a] border border-slate-200'
                }`}
              >
                Has SSL issues
              </button>
            </div>
          </div>

          {/* Section 3: DEVELOPER */}
          <div className="space-y-3 md:pl-6 pt-4 md:pt-0">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 block">
              DEVELOPER
            </span>
            <div className="space-y-2.5">
              {/* Dropdown */}
              <div className="relative">
                <select
                  value={filters.developer}
                  onChange={(e) => update('developer', e.target.value)}
                  className="w-full appearance-none text-xs bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#007ba7] cursor-pointer shadow-2xs"
                >
                  <option value="all">All developers</option>
                  <option value="__none__">No developer credit</option>
                  {availableDevelopers.map((dev) => (
                    <option key={dev} value={dev}>
                      {dev}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Developer text search */}
              <div className="relative">
                <input
                  type="text"
                  value={filters.developerSearch}
                  onChange={(e) => update('developerSearch', e.target.value)}
                  placeholder="Find a developer"
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#0a0a0a] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007ba7] shadow-2xs"
                />
              </div>

              {/* Hide platforms switch toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-slate-600">Hide platforms</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hidePlatforms}
                    onChange={(e) => update('hidePlatforms', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#007ba7]"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FilterBar;
