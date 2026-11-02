import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  AlertCircle,
  Globe2,
  RotateCw,
  SearchX,
  KeyRound,
  ArrowUp,
  Loader2,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import SearchBar from './components/SearchBar';
import ProgressBar from './components/ProgressBar';
import FilterBar from './components/FilterBar';
import ResultsTable from './components/ResultsTable';
import SiteDrawer from './components/SiteDrawer';
import {
  createSearch,
  fetchSearch,
  reauditSite,
  downloadExportCsv,
  checkServerHealth,
  getStoredAccessKey,
  setStoredAccessKey,
  clearStoredAccessKey,
} from './utils/api';
import {
  INITIAL_FILTERS,
  extractUniqueDevelopers,
  calculateFilterCounts,
  applyFiltersAndSort,
} from './utils/filterHelpers';

export function App() {
  const [currentSearch, setCurrentSearch] = useState(null);
  const [sites, setSites] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchErrorCode, setSearchErrorCode] = useState(null);
  const [searchErrorProvider, setSearchErrorProvider] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Access key gate state (when APP_ACCESS_KEY is set on the server)
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [accessKeyError, setAccessKeyError] = useState(null);

  // Filters state
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // Drawer state
  const [selectedSite, setSelectedSite] = useState(null);
  const [isReauditing, setIsReauditing] = useState(false);

  // Polling & Scroll refs
  const pollingTimerRef = useRef(null);
  const resultsRef = useRef(null);

  // Check on initial load if server requires an access key
  useEffect(() => {
    checkServerHealth().then((health) => {
      if (health?.authRequired) {
        const storedKey = getStoredAccessKey();
        if (!storedKey) {
          setShowAccessGate(true);
        }
      }
    });
  }, []);

  // Track window scroll for "Back to top" button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 350) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAccessKeySubmit = (e) => {
    e.preventDefault();
    if (!accessKeyInput.trim()) return;
    setStoredAccessKey(accessKeyInput.trim());
    setShowAccessGate(false);
    setAccessKeyError(null);
  };

  // Start search
  const handleSearch = async (keyword, forceRefresh = false) => {
    setIsSearching(true);
    setSearchError(null);
    setSearchErrorCode(null);
    setSearchErrorProvider(null);
    setSelectedSite(null);
    setFilters(INITIAL_FILTERS);

    try {
      const data = await createSearch(keyword, { refresh: forceRefresh });
      setCurrentSearch(data.search);
      setSites(data.sites || []);
      if (data.sites && data.sites.length > 0) {
        setIsPolling(true);
      } else {
        setIsPolling(false);
      }

      // Smooth scroll down to results section
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        clearStoredAccessKey();
        setAccessKeyError('Access key is invalid or required. Please enter the correct access key.');
        setShowAccessGate(true);
      } else {
        setSearchError(err.message || 'Failed to initiate website audit search');
        setSearchErrorCode(err.code || null);
        setSearchErrorProvider(err.provider || null);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Poll search progress every 1.5 seconds until all sites are done or failed
  useEffect(() => {
    if (!currentSearch?._id || !isPolling) {
      return;
    }

    let isMounted = true;

    const poll = async () => {
      try {
        const data = await fetchSearch(currentSearch._id);
        if (!isMounted) return;

        const updatedSites = data.sites || [];
        setSites(updatedSites);

        setSelectedSite((prevSelected) => {
          if (!prevSelected) return null;
          return updatedSites.find((s) => s._id === prevSelected._id) || prevSelected;
        });

        const hasUnfinished = updatedSites.some(
          (s) => s.auditStatus === 'pending' || s.auditStatus === 'running'
        );

        if (!hasUnfinished) {
          setIsPolling(false);
          return;
        }
      } catch (err) {
        if (err.status === 401 || err.code === 'UNAUTHORIZED') {
          clearStoredAccessKey();
          setShowAccessGate(true);
          setIsPolling(false);
          return;
        }
        console.error('Polling error:', err);
      }

      if (isMounted) {
        pollingTimerRef.current = setTimeout(poll, 1500);
      }
    };

    pollingTimerRef.current = setTimeout(poll, 1500);

    return () => {
      isMounted = false;
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, [currentSearch?._id, isPolling]);

  // Handle re-audit click inside drawer
  const handleReaudit = async (siteId) => {
    setIsReauditing(true);
    try {
      const { site: updatedSite } = await reauditSite(siteId);
      setSites((prev) =>
        prev.map((s) => (s._id === updatedSite._id ? updatedSite : s))
      );
      setSelectedSite(updatedSite);
      setIsPolling(true);
    } catch (err) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        clearStoredAccessKey();
        setShowAccessGate(true);
      } else {
        alert(`Re-audit error: ${err.message}`);
      }
    } finally {
      setIsReauditing(false);
    }
  };

  // Derived filter and stats data
  const totalSitesCount = sites.length;
  const completedCount = sites.filter((s) => s.auditStatus === 'done').length;
  const failedCount = sites.filter((s) => s.auditStatus === 'failed').length;

  const availableDevelopers = extractUniqueDevelopers(sites);
  const filterCounts = calculateFilterCounts(sites);
  const displayedSites = applyFiltersAndSort(sites, filters);

  // Pagination navigation inside SiteDrawer
  const currentSiteIndex = displayedSites.findIndex(
    (s) => s._id === selectedSite?._id
  );
  const handlePreviousSite =
    currentSiteIndex > 0
      ? () => setSelectedSite(displayedSites[currentSiteIndex - 1])
      : null;
  const handleNextSite =
    currentSiteIndex >= 0 && currentSiteIndex < displayedSites.length - 1
      ? () => setSelectedSite(displayedSites[currentSiteIndex + 1])
      : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0a0a0a] pb-16 selection:bg-[#ff2095] selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1536px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#007ba7] text-white flex items-center justify-center shadow-sm">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-extrabold text-[#0a0a0a] tracking-tight leading-none">
                sitecheck
              </div>
              <div className="text-[10px] font-bold text-[#ff2095] tracking-[0.2em] uppercase mt-0.5">
                WEBSITE AUDIT
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isPolling && totalSitesCount > 0 && (
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 text-[#007ba7] rounded-full text-xs font-semibold shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007ba7]" />
                <span>Auditing: {completedCount}/{totalSitesCount} ({Math.round((completedCount / totalSitesCount) * 100) || 0}%)</span>
              </div>
            )}

            {currentSearch && totalSitesCount > 0 && (
              <button
                type="button"
                onClick={() => handleSearch(currentSearch.keyword, true)}
                disabled={isSearching}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-[#0a0a0a] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer shadow-2xs"
                title="Bypass 7-day keyword cache and fetch fresh search results"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Force Refresh</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-slate-400 font-normal">
                A calmer way to check the web
              </span>
              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-[#ff2095] font-bold">
                •
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-[1536px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-8 space-y-6">
        {/* Search Bar */}
        <section>
          <SearchBar onSearch={(kw) => handleSearch(kw, false)} isLoading={isSearching} />
        </section>

        {/* API Error Alert */}
        {searchError && (
          <div className="w-full max-w-4xl mx-auto bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            {searchErrorCode === 'SEARCH_NOT_CONFIGURED' ? (
              <KeyRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-rose-900">
                {searchErrorCode === 'SEARCH_NOT_CONFIGURED' ? 'Search Not Configured' : 'Search Error'}
              </h4>
              <p className="text-xs text-rose-700 leading-relaxed">{searchError}</p>
              {searchErrorCode === 'SEARCH_NOT_CONFIGURED' && (
                <p className="text-xs text-amber-800 font-medium pt-1">
                  Please configure{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">
                    {searchErrorProvider === 'serpapi' ? 'SERPAPI_KEY' : 'GOOGLE_PLACES_API_KEY'}
                  </code>{' '}
                  in your <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">server/.env</code> file.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Target anchor for smooth scrolling to results */}
        <div ref={resultsRef} className="scroll-mt-20"></div>

        {/* Progress Bar while audits run */}
        {currentSearch && totalSitesCount > 0 && (
          <section>
            <ProgressBar
              total={totalSitesCount}
              completed={completedCount}
              failed={failedCount}
              isPolling={isPolling}
              keyword={currentSearch.keyword}
            />
          </section>
        )}

        {/* Filter Bar */}
        {totalSitesCount > 0 && (
          <section>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(INITIAL_FILTERS)}
              counts={filterCounts}
              availableDevelopers={availableDevelopers}
              matchingCount={displayedSites.length}
              totalCount={totalSitesCount}
              onExportCsv={async () => {
                if (currentSearch?._id) {
                  try {
                    await downloadExportCsv(currentSearch._id, currentSearch.keyword);
                  } catch (err) {
                    if (err.status === 401 || err.code === 'UNAUTHORIZED') {
                      clearStoredAccessKey();
                      setShowAccessGate(true);
                    } else {
                      alert(err.message || 'Failed to download CSV export');
                    }
                  }
                }
              }}
            />
          </section>
        )}

        {/* Results Table */}
        {totalSitesCount > 0 && (
          <section>
            <ResultsTable
              sites={displayedSites}
              onSelectSite={setSelectedSite}
              selectedSiteId={selectedSite?._id}
              isLoading={isSearching}
            />
          </section>
        )}

        {/* Empty State: No websites found for keyword */}
        {currentSearch && totalSitesCount === 0 && !isSearching && !searchError && (
          <div className="w-full max-w-xl mx-auto py-12 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-200">
              <SearchX className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#0a0a0a]">No websites found for this keyword</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              The search returned places without websites or no matching establishments were found. Try searching with a broader keyword or including a city name.
            </p>
          </div>
        )}

        {/* Initial Empty State before any search */}
        {!currentSearch && !isSearching && !searchError && (
          <div className="w-full max-w-2xl mx-auto py-16 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-[#007ba7] flex items-center justify-center mx-auto shadow-xs">
              <Globe2 className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-[#0a0a0a]">Ready to audit websites</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Enter any establishment keyword above (e.g. &ldquo;Hospitals in Trichy&rdquo;) to fetch verified business websites, audit copyright freshness, discover developer credits, and identify broken links.
            </p>
          </div>
        )}
      </main>

      {/* Access Key Gate Modal (Requirement 13) */}
      {showAccessGate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#007ba7] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#0a0a0a] tracking-tight">Access Key Required</h3>
                <p className="text-xs text-slate-500">This deployment is protected to manage search API quotas.</p>
              </div>
            </div>

            {accessKeyError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{accessKeyError}</span>
              </div>
            )}

            <form onSubmit={handleAccessKeySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Enter Access Key
                </label>
                <input
                  type="password"
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  placeholder="Enter secret APP_ACCESS_KEY"
                  autoFocus
                  className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007ba7] text-[#0a0a0a] transition placeholder-slate-400 shadow-2xs"
                />
              </div>

              <button
                type="submit"
                disabled={!accessKeyInput.trim()}
                className="w-full py-3 bg-[#007ba7] hover:bg-[#006b92] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Unlock Audit Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Smooth Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 bg-white hover:bg-slate-50 text-[#007ba7] hover:text-[#ff2095] border border-slate-200 rounded-full shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
          title="Smooth scroll to top"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Right-Side Detail Drawer */}
      <SiteDrawer
        site={selectedSite}
        onClose={() => setSelectedSite(null)}
        onReaudit={handleReaudit}
        isReauditing={isReauditing}
        onPreviousSite={handlePreviousSite}
        onNextSite={handleNextSite}
        currentIndex={currentSiteIndex}
        totalSites={displayedSites.length}
      />
    </div>
  );
}

export default App;
