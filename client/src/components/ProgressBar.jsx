import React from 'react';
import { Loader2, Check } from 'lucide-react';

export function ProgressBar({ total, completed, failed, isPolling, keyword }) {
  if (!total || total === 0) return null;

  const finishedCount = completed + failed;
  const percent = Math.min(Math.round((finishedCount / total) * 100), 100);
  const isAllDone = finishedCount >= total;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
      {/* Card Header & Status */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">
          AUDIT PROGRESS
        </span>

        {isAllDone ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>All audits complete</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#007ba7] bg-[#007ba7]/10 px-2.5 py-1 rounded-full border border-[#007ba7]/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007ba7]" />
            <span>Auditing websites...</span>
          </div>
        )}
      </div>

      {/* Main Count & Description */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-[#0a0a0a]">
          {finishedCount} of {total} audited
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          {isAllDone
            ? `Finished auditing websites found for "${keyword || 'your search'}".`
            : `We're checking websites found for "${keyword || 'your search'}".`}
          {failed > 0 && (
            <span className="ml-2 text-[#ff2095] font-semibold">({failed} unreachable)</span>
          )}
        </p>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[#007ba7] transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
