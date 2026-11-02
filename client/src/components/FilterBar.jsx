import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Download,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { INITIAL_FILTERS } from '../utils/filterHelpers';

export function FilterBar({
  filters,
  onChange,
  onReset,
  counts,
  availableDevelopers = [],
  matchingCount = 0,
  totalCount = 0,
  onExportCsv,
}) {
  const [showFilters, setShowFilters] = useState(true);

  const isFiltered =
    filters.searchTerm !== '' ||
    filters.copyright !== 'all' ||
    filters.developer !== 'all' ||
    filters.developerSearch !== '' ||
    filters.hidePlatforms ||
    filters.brokenLinks !== 'all' ||
    filters.sort !== 'most_broken';

  const activeFiltersCount =
    (filters.copyright !== 'all' ? 1 : 0) +
    (filters.brokenLinks !== 'all' ? 1 : 0) +
    (filters.developer !== 'all' ? 1 : 0) +
    (filters.developerSearch ? 1 : 0) +
    (filters.hidePlatforms ? 1 : 0);

  const update = (key, val) => {
    onChange({ ...filters, [key]: val });
  };

  const copyrightCounts = counts?.copyright || {};
  const brokenCounts = counts?.brokenLinks || {};

  return (
    <div className="w-full space-y-4">
      {/* 1. Results Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Left: Title, Counts & Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#007ba7]" />
            <h2 className="text-base sm:text-lg font-bold text-[#0a0a0a]">Results</h2>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
              {matchingCount} of {totalCount}
            </span>
          </div>

          {/* Quick Filter Pills right in toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => update('brokenLinks', filters.brokenLinks === 'has_broken' ? 'all' : 'has_broken')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
                filters.brokenLinks === 'has_broken'
                  ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>Broken Links</span>
              {brokenCounts.has_broken !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filters.brokenLinks === 'has_broken' ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {brokenCounts.has_broken}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => update('copyright', filters.copyright === 'outdated' ? 'all' : 'outdated')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
                filters.copyright === 'outdated'
                  ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>Outdated</span>
              {copyrightCounts.outdated !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filters.copyright === 'outdated' ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {copyrightCounts.outdated}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => update('brokenLinks', filters.brokenLinks === 'has_ssl' ? 'all' : 'has_ssl')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
                filters.brokenLinks === 'has_ssl'
                  ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>SSL Issues</span>
              {brokenCounts.has_ssl !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filters.brokenLinks === 'has_ssl' ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {brokenCounts.has_ssl}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Search + Sort + Toggle Filter Panel + Reset + Export CSV */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search inside results */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              value={filters.searchTerm || ''}
              onChange={(e) => update('searchTerm', e.target.value)}
              placeholder="Search results..."
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#0a0a0a] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007ba7] w-full sm:w-44 shadow-2xs"
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

          {/* Toggle Advanced Filters Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs font-medium border px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs flex items-center gap-1.5 ${
              showFilters
                ? 'bg-slate-100 text-[#0a0a0a] border-slate-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-[#007ba7]" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#007ba7] text-white rounded-full text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          {/* Reset Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-slate-600 hover:text-[#0a0a0a] bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs flex items-center gap-1"
              title="Reset all filters"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#007ba7] hover:bg-[#006b92] rounded-xl transition shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Structured Filter Panel (Collapsible & Fully Responsive) */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 divide-y sm:divide-y-0 lg:divide-x divide-slate-200">
            {/* Section 1: COPYRIGHT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 block">
                  COPYRIGHT STATUS
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All', count: copyrightCounts.all },
                  { id: 'current', label: 'Current', count: copyrightCounts.current },
                  { id: 'outdated', label: 'Outdated', count: copyrightCounts.outdated },
                  { id: 'no_year', label: 'No Year', count: copyrightCounts.no_year },
                  { id: 'missing', label: 'Missing', count: copyrightCounts.missing },
                  { id: 'unknown', label: "Couldn't Check", count: copyrightCounts.unknown },
                ].map((pill) => {
                  const active = filters.copyright === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => update('copyright', pill.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                          : 'bg-white hover:bg-slate-50 text-[#0a0a0a] border border-slate-200'
                      }`}
                    >
                      <span>{pill.label}</span>
                      {pill.count !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          active ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {pill.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: BROKEN LINKS */}
            <div className="space-y-3 pt-4 sm:pt-0 sm:pl-0 lg:pl-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 block">
                  BROKEN LINKS & SSL
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All', count: brokenCounts.all },
                  { id: 'has_broken', label: 'Has broken', count: brokenCounts.has_broken },
                  { id: 'no_broken', label: 'None found', count: brokenCounts.no_broken },
                  { id: 'certain_only', label: 'Certain only', count: brokenCounts.certain_only },
                  { id: 'has_ssl', label: 'Has SSL issues', count: brokenCounts.has_ssl },
                ].map((pill) => {
                  const active = filters.brokenLinks === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => update('brokenLinks', pill.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-[#007ba7] text-white shadow-xs font-semibold'
                          : 'bg-white hover:bg-slate-50 text-[#0a0a0a] border border-slate-200'
                      }`}
                    >
                      <span>{pill.label}</span>
                      {pill.count !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          active ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {pill.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: DEVELOPER */}
            <div className="space-y-3 pt-4 sm:pt-0 sm:col-span-2 lg:col-span-1 lg:pl-6">
              <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 block">
                DEVELOPER ATTRIBUTION
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
                    placeholder="Filter by agency or developer name..."
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#0a0a0a] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007ba7] shadow-2xs"
                  />
                </div>

                {/* Hide platforms switch toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-slate-600">Hide generic platforms (WordPress, Shopify)</span>
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
      )}
    </div>
  );
}

export default FilterBar;
