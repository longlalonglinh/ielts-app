import React, { useState } from 'react';
import { Database, ChevronDown, ChevronUp } from 'lucide-react';

interface DatabaseNoticeBannerProps {
  totalCards: number;
  isOnSheets: boolean;
  activeLearnerName: string;
}

export const DatabaseNoticeBanner: React.FC<DatabaseNoticeBannerProps> = ({
  totalCards,
  isOnSheets,
  activeLearnerName
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-purple-200/80 rounded-2xl p-3.5 shadow-sm text-xs text-[#3C2A63] transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-[#6B51A5] flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#3C2A63]">
                Cloud Synchronization
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                {isOnSheets ? 'Online (Sheets)' : 'Local Ready'}
              </span>
            </div>
            <p className="text-[11px] text-[#7C68A5] truncate">
              Progress saved for: <strong className="text-[#6B51A5]">{activeLearnerName}</strong> • {totalCards} practice items available
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 text-[#7C68A5] hover:text-[#6B51A5] hover:bg-purple-50 rounded-lg transition shrink-0 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
        >
          <span>{isExpanded ? 'Collapse' : 'Details'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-purple-100 space-y-2 text-[#503A7A] leading-relaxed animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-2.5 bg-[#F5F2F9] rounded-xl space-y-1">
              <span className="font-bold text-[#6B51A5] block">✓ Real-time Sync</span>
              <p className="text-[11px]">
                Attempts, mastery points, and vocabulary items automatically sync to the instructor&apos;s Google Sheets repository.
              </p>
            </div>
            <div className="p-2.5 bg-[#F5F2F9] rounded-xl space-y-1">
              <span className="font-bold text-[#6B51A5] block">⚡ Safe Offline Cache</span>
              <p className="text-[11px]">
                Your answers and session logs remain protected locally even during unstable network connections.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

