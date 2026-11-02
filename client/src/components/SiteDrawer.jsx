import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  RotateCw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Code2,
  Calendar,
  Globe,
  Loader2,
  FileText,
  Copy,
  Check,
  Search,
  Hash,
} from 'lucide-react';

export function SiteDrawer({
  site,
  onClose,
  onReaudit,
  isReauditing,
  onPreviousSite,
  onNextSite,
  currentIndex = -1,
  totalSites = 0,
}) {
  const [expandedLinks, setExpandedLinks] = useState({});
  const [showBlocked, setShowBlocked] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Section refs for smooth scrolling to sections
  const contentContainerRef = useRef(null);
  const copyrightRef = useRef(null);
  const developerRef = useRef(null);
  const brokenLinksRef = useRef(null);
  const sslRef = useRef(null);
  const rawJsonRef = useRef(null);

  // Keyboard navigation: Escape to close, Left/Right arrow keys for prev/next
  useEffect(() => {
    if (!site) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPreviousSite) {
        onPreviousSite();
      } else if (e.key === 'ArrowRight' && onNextSite) {
        onNextSite();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [site, onClose, onPreviousSite, onNextSite]);

  if (!site) return null;

  const audit = site.audit || {};
  const copyright = audit.copyright || {};
  const developer = audit.developer || {};
  const links = audit.links || {};
  const brokenLinks = links.broken || [];
  const blockedLinks = links.blocked || [];
  const sslIssues = links.sslIssues || audit.sslIssues || [];

  const toggleLinkExpand = (index) => {
    setExpandedLinks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const scrollToSection = (ref, tabName) => {
    setActiveTab(tabName);
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(site, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop with smooth blur */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-2xl lg:max-w-3xl bg-white shadow-2xl flex flex-col h-full text-[#0a0a0a] border-l border-slate-200 animate-in slide-in-from-right duration-200">
          
          {/* 1. Header with Site Name and Pagination Navigation */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#ff2095]/10 text-[#ff2095] border border-[#ff2095]/20">
                  AUDIT LOG REPORT
                </span>
                {totalSites > 0 && currentIndex >= 0 && (
                  <span className="text-xs font-semibold text-slate-500">
                    Site {currentIndex + 1} of {totalSites}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0a0a0a] truncate mt-1" title={site.name}>
                {site.name}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate max-w-md">{site.url}</span>
              </div>
            </div>

            {/* Pagination Prev/Next + Close button */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {totalSites > 1 && (
                <div className="flex items-center gap-1 mr-2 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={onPreviousSite}
                    disabled={!onPreviousSite}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0a0a0a] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                    title="Previous site (Left arrow key)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextSite}
                    disabled={!onNextSite}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0a0a0a] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                    title="Next site (Right arrow key)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-[#0a0a0a] p-2 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                title="Close drawer (Escape key)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. Action Toolbar */}
          <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <a
                href={site.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs"
              >
                <span>Open Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
                title="Copy entire audit data as JSON"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => onReaudit(site._id)}
              disabled={isReauditing || site.auditStatus === 'running'}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#007ba7] hover:bg-[#006b92] disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              {isReauditing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Re-auditing...</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Re-audit Site</span>
                </>
              )}
            </button>
          </div>

          {/* 3. Quick Section Jump Pills (Smooth Scroll Navigation) */}
          <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
            <span className="text-slate-400 font-semibold text-[11px] uppercase mr-1">Jump to:</span>
            
            <button
              type="button"
              onClick={() => scrollToSection(copyrightRef, 'copyright')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeTab === 'copyright'
                  ? 'bg-[#007ba7] text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Copyright
            </button>

            <button
              type="button"
              onClick={() => scrollToSection(developerRef, 'developer')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeTab === 'developer'
                  ? 'bg-[#007ba7] text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Developer
            </button>

            <button
              type="button"
              onClick={() => scrollToSection(brokenLinksRef, 'broken')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'broken'
                  ? 'bg-[#ff2095] text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>Broken Links</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'broken' ? 'bg-white/30 text-white' : 'bg-[#ff2095]/10 text-[#ff2095]'
              }`}>
                {brokenLinks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => scrollToSection(sslRef, 'ssl')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'ssl'
                  ? 'bg-[#007ba7] text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>SSL</span>
              {sslIssues.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'ssl' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {sslIssues.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowRawJson(true);
                setTimeout(() => scrollToSection(rawJsonRef, 'raw'), 100);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeTab === 'raw'
                  ? 'bg-[#007ba7] text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Raw Logs
            </button>
          </div>

          {/* 4. Drawer Content with Smooth Scrolling */}
          <div
            ref={contentContainerRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth"
          >
            {/* Copyright Section */}
            <div
              ref={copyrightRef}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 scroll-mt-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0a0a0a] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#007ba7]" />
                  <span>Copyright Freshness Verification</span>
                </h3>
                <span className="text-xs capitalize font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Status: {copyright.status || 'unknown'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-medium">Detected Year:</span>
                  <span className="ml-1.5 font-bold text-[#0a0a0a]">{copyright.year || 'None detected'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Dynamic JS Rendered:</span>
                  <span className="ml-1.5 font-semibold text-[#0a0a0a]">
                    {copyright.dynamic ? 'Yes (JS injected)' : 'No (Static HTML)'}
                  </span>
                </div>
              </div>

              {copyright.text && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Footer Text Found:</span>
                  <p className="text-xs bg-slate-50 text-slate-700 p-3 rounded-xl border border-slate-200 font-mono break-words leading-relaxed">
                    {copyright.text}
                  </p>
                </div>
              )}
            </div>

            {/* Developer Credit Section */}
            <div
              ref={developerRef}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 scroll-mt-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0a0a0a] flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#007ba7]" />
                  <span>Website Developer & Agency Detection</span>
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-[#007ba7] border border-sky-200 uppercase">
                  {developer.kind || 'none'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-medium">Developer Name:</span>
                  <span className="font-bold text-[#0a0a0a]">{developer.name || 'None detected'}</span>
                </div>

                {developer.url && (
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium">Developer Link:</span>
                    <a
                      href={developer.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#007ba7] hover:underline flex items-center gap-1 font-semibold"
                    >
                      {developer.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {developer.rawText && (
                  <div className="space-y-1 pt-1">
                    <span className="text-xs font-semibold text-slate-500">Raw Credit Signature:</span>
                    <p className="text-xs bg-slate-50 text-slate-700 p-3 rounded-xl border border-slate-200 font-mono break-words">
                      {developer.rawText}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Broken Links Section */}
            <div
              ref={brokenLinksRef}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 scroll-mt-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0a0a0a] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#ff2095]" />
                  <span>Broken Links Audit ({brokenLinks.length})</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {site.brokenCertainCount || 0} high confidence
                </span>
              </div>

              {brokenLinks.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>No broken links detected! All crawled internal and external hyperlinks responded normally.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {brokenLinks.map((item, idx) => {
                    const isExpanded = expandedLinks[idx];
                    const sources = item.sourcePages || [];

                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 break-all">
                            <span className="font-bold text-[#0a0a0a]">{item.url}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#ff2095]/10 text-[#ff2095] border border-[#ff2095]/30">
                                HTTP {item.statusCode || item.error || 'Failed'}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                                  item.confidence === 'high'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {item.confidence === 'high' ? 'Certain Broken' : 'Potential Issue'}
                              </span>
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                                {item.type || 'link'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expandable source pages */}
                        {sources.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleLinkExpand(idx)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#007ba7] hover:text-[#005a7b] cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              <span>Found on {sources.length} page{sources.length > 1 ? 's' : ''}</span>
                            </button>

                            {isExpanded && (
                              <ul className="mt-2 pl-3 space-y-1 border-l-2 border-[#007ba7]">
                                {sources.map((srcUrl, sIdx) => (
                                  <li key={sIdx} className="text-[11px] text-slate-600 break-all">
                                    <a
                                      href={srcUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hover:underline hover:text-[#007ba7]"
                                    >
                                      {srcUrl}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SSL Issues Section */}
            <div
              ref={sslRef}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 scroll-mt-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0a0a0a] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>SSL & Security Certificate Audit ({sslIssues.length})</span>
                </h3>
              </div>

              {sslIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Valid SSL certificate detected. No handshake, hostname, or expiration errors.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {sslIssues.map((iss, idx) => (
                    <div
                      key={idx}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1"
                    >
                      <div className="font-semibold break-all">{iss.url || site.url}</div>
                      <div className="text-amber-800">{iss.error || iss.message || 'SSL verification failed'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blocked / Bot-restricted Links (Accordion) */}
            {blockedLinks.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowBlocked(!showBlocked)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-[#0a0a0a] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                    <span>Links ignored (bot check / 403 / Cloudflare): {blockedLinks.length}</span>
                  </span>
                  {showBlocked ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {showBlocked && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 max-h-48 overflow-y-auto">
                    {blockedLinks.map((blk, idx) => (
                      <div key={idx} className="text-[11px] text-slate-500 break-all font-mono">
                        {typeof blk === 'string' ? blk : blk.url || JSON.stringify(blk)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Raw Audit Log JSON Inspector */}
            <div
              ref={rawJsonRef}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs scroll-mt-4"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-[#007ba7] cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#007ba7]" />
                  <span>Technical Audit Log (Raw JSON)</span>
                  {showRawJson ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {showRawJson && (
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="text-xs font-medium text-[#007ba7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                )}
              </div>

              {showRawJson && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <pre className="text-[11px] bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto max-h-80 font-mono leading-relaxed">
                    {JSON.stringify(site, null, 2)}
                  </pre>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default SiteDrawer;
