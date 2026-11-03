import React, { useState } from 'react';
import { Search, Loader2, ShieldCheck, Zap, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Hospitals in Trichy',
  'Best cafes in Austin',
  'Lawyers in Denver',
  'Colleges in Tamil Nadu',
];

export function SearchBar({ onSearch, isLoading }) {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim() || isLoading) return;
    onSearch(keyword.trim());
  };

  const handleSuggestionClick = (text) => {
    setKeyword(text);
    onSearch(text);
  };

  return (
    <div className="w-full pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left Column: Heading, Search Form & Suggestion Chips */}
        <div className="lg:col-span-7 space-y-6">
          {/* Hero Header */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2095]/10 border border-[#ff2095]/20 text-[#ff2095] text-[11px] font-bold tracking-[0.2em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff2095] animate-pulse"></span>
              <span>WEBSITE AUDIT</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0a0a0a] tracking-tight leading-[1.12]">
              Find what&apos;s holding a website back.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              Search any business or topic to discover public websites, then get a clear instant view of their accessibility, copyright freshness, agency detection, and broken links.
            </p>
          </div>

          {/* Search Input Bar */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Hospitals in Trichy"
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007ba7] focus:border-transparent text-[#0a0a0a] transition placeholder-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={!keyword.trim() || isLoading}
              className="px-7 py-3.5 bg-[#007ba7] hover:bg-[#006b92] text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Auditing...</span>
                </>
              ) : (
                <span>Audit websites</span>
              )}
            </button>
          </form>

          {/* "Try:" Suggestion Pills */}
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap pt-1">
            <span className="font-medium text-slate-400">Try:</span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 hover:border-[#ff2095] hover:text-[#ff2095] border border-slate-200 rounded-full transition text-[#0a0a0a] cursor-pointer disabled:opacity-50 text-xs font-medium shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Trust Highlights */}
          <div className="flex flex-wrap items-center gap-6 pt-3 text-xs text-slate-500 border-t border-slate-200/70">
            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <Zap className="w-4 h-4 text-[#007ba7]" />
              <span>Real-time Maps Search</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>SSL &amp; Deep Link Crawler</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <Sparkles className="w-4 h-4 text-[#ff2095]" />
              <span>Agency &amp; Freshness AI</span>
            </div>
          </div>
        </div>

        {/* Right Column: Normal Balanced 3D Showcase Card */}
        <div className="lg:col-span-5 hidden lg:flex items-center justify-end relative">
          {/* Ambient Glow */}
          <div className="absolute -top-6 -right-6 w-60 h-60 bg-[#007ba7]/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-6 -left-6 w-60 h-60 bg-[#ff2095]/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Showcase Browser Frame */}
          <div className="relative w-full max-w-[490px] bg-white rounded-3xl border border-slate-200 p-3 shadow-xl hover:shadow-2xl transition duration-500 overflow-hidden group">
            {/* Window Topbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/90 rounded-t-2xl">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-mono text-slate-500 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>sitecheck-inspector.ai</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">v2.4</div>
            </div>

            {/* 3D Audit Illustration */}
            <div className="relative overflow-hidden rounded-2xl mt-2 bg-gradient-to-br from-slate-50 to-slate-100 aspect-[4/3]">
              <img
                src="/hero-audit-graphic.jpg"
                alt="Website Audit 3D Scanner"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-700 ease-out"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
