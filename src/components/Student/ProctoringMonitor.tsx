import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Lock, Maximize2, Radio, Clock, ShieldCheck } from 'lucide-react';
import { CheatLog } from '../../types';
import { 
  saveCheatLogToIndexedDB, 
  saveCumulativeProctoringData, 
  getCumulativeProctoringData 
} from '../../services/indexedDb';

interface ProctoringMonitorProps {
  submissionId: string;
  sbd: string;
  examCode: string;
  testMode: 'TEST' | 'PRACTICE';
  onViolationCountChange?: (count: number) => void;
  onProctoringMetricsChange?: (metrics: { violationCount: number; cumulativeOffScreenSeconds: number; rapidSwitchCount: number }) => void;
}

export const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({
  submissionId,
  sbd,
  examCode,
  testMode,
  onViolationCountChange,
  onProctoringMetricsChange
}) => {
  const [violationCount, setViolationCount] = useState(0);
  const [isLocked30s, setIsLocked30s] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(30);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blurGraceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlurViolationTimeRef = useRef<number>(0);
  const lastRapidSwitchWarningTimeRef = useRef<number>(0);
  const lastCumulativeWarningTimeRef = useRef<number>(0);
  const offScreenStartTimeRef = useRef<number>(0);
  const cumulativeOffScreenMsRef = useRef<number>(0);
  const rapidSwitchTimestampsRef = useRef<number[]>([]);

  // Restore cumulative data from IndexedDB / Storage on mount
  useEffect(() => {
    getCumulativeProctoringData(examCode, sbd).then((data) => {
      if (data && typeof data.totalOffScreenMs === 'number') {
        cumulativeOffScreenMsRef.current = data.totalOffScreenMs;
      }
    }).catch(() => {});
  }, [examCode, sbd]);

  // Monitor Fullscreen Status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const requestFullscreenMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    }
  };

  const trigger30sLock = () => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
    }

    setIsLocked30s(true);
    setLockCountdown(30);

    let current = 30;
    lockTimerRef.current = setInterval(() => {
      current -= 1;
      if (current <= 0) {
        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        setIsLocked30s(false);
        setLockCountdown(30);
      } else {
        setLockCountdown(current);
      }
    }, 1000);
  };

  // Record Violation directly to LocalStorage and IndexedDB
  const recordViolation = (reason: string) => {
    if (testMode !== 'TEST') return; // Only strictly record in TEST mode

    const newLog: CheatLog = {
      log_id: 'log_' + Date.now(),
      submission_id: submissionId,
      sbd: sbd,
      exam_code: examCode,
      violation_type: reason,
      timestamp: new Date().toISOString()
    };

    // Save to LocalStorage
    try {
      const existing = localStorage.getItem('ielts_cheat_logs');
      const logsArr: CheatLog[] = existing ? JSON.parse(existing) : [];
      logsArr.push(newLog);
      localStorage.setItem('ielts_cheat_logs', JSON.stringify(logsArr));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }

    // Save to IndexedDB backup vault
    saveCheatLogToIndexedDB(newLog).catch(() => {});

    setViolationCount((prev) => prev + 1);

    setWarningMsg(`⚠️ PROCTORING VIOLATION: ${reason}`);
    setTimeout(() => {
      setWarningMsg(null);
    }, 4000);
  };

  // Safely notify parent component and handle lock after render when violationCount updates
  useEffect(() => {
    if (violationCount > 0) {
      if (onViolationCountChange) {
        onViolationCountChange(violationCount);
      }

      if (violationCount >= 3 && !isLocked30s) {
        trigger30sLock();
      }
    }
  }, [violationCount]);

  // Clean up lock and blur timers on unmount
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
      if (blurGraceTimerRef.current) {
        clearTimeout(blurGraceTimerRef.current);
      }
    };
  }, []);

  // Attach Security Listeners (Right Click, F12, Tab Change / Blur with 3s Grace Period & Debounce)
  useEffect(() => {
    if (testMode !== 'TEST') return;

    // Disable Right Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordViolation('Right Click action (Context Menu)');
    };

    // Disable F12 and DevTools Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        recordViolation('Developer Shortcut / F12 Inspect');
      }
    };

    // Tab Blur / Switch Window with 3s Grace Period & Debounce
    const cancelBlurGraceTimer = () => {
      if (blurGraceTimerRef.current) {
        clearTimeout(blurGraceTimerRef.current);
        blurGraceTimerRef.current = null;
      }
    };

    const triggerBlurGracePeriod = () => {
      if (blurGraceTimerRef.current) return; // Grace period already ticking

      blurGraceTimerRef.current = setTimeout(() => {
        blurGraceTimerRef.current = null;
        // Verify candidate is still unfocused after full 3-second grace period
        const isStillUnfocused = (typeof document.hasFocus === 'function' && !document.hasFocus()) || document.hidden;
        if (isStillUnfocused) {
          const now = Date.now();
          // Debounce: prevent duplicate violation spam within 5 seconds
          if (now - lastBlurViolationTimeRef.current >= 5000) {
            lastBlurViolationTimeRef.current = now;
            recordViolation('Tab switched / Left exam window (exceeded 3-second grace period)');
          }
        }
      }, 3000); // 3-second grace period
    };

    const handleWindowBlur = () => {
      const now = Date.now();
      if (offScreenStartTimeRef.current === 0) {
        offScreenStartTimeRef.current = now;
      }

      // Track micro-switch timestamp in sliding 30-second window
      rapidSwitchTimestampsRef.current = rapidSwitchTimestampsRef.current
        .filter(t => now - t < 30000)
        .concat(now);

      // Rapid Micro-Switching Detection: >= 3 switches in 30 seconds
      if (rapidSwitchTimestampsRef.current.length >= 3) {
        if (now - lastRapidSwitchWarningTimeRef.current >= 8000) {
          lastRapidSwitchWarningTimeRef.current = now;
          recordViolation(`Repeated micro-tab switching detected (${rapidSwitchTimestampsRef.current.length} times / 30s)`);
        }
      }

      if (onProctoringMetricsChange) {
        onProctoringMetricsChange({
          violationCount,
          cumulativeOffScreenSeconds: Math.round(cumulativeOffScreenMsRef.current / 1000),
          rapidSwitchCount: rapidSwitchTimestampsRef.current.length
        });
      }

      triggerBlurGracePeriod();
    };

    const handleWindowFocus = () => {
      cancelBlurGraceTimer();
      const now = Date.now();
      if (offScreenStartTimeRef.current > 0) {
        const elapsed = now - offScreenStartTimeRef.current;
        offScreenStartTimeRef.current = 0;
        cumulativeOffScreenMsRef.current += elapsed;

        // Persist cumulative data immediately
        saveCumulativeProctoringData(examCode, sbd, {
          totalOffScreenMs: cumulativeOffScreenMsRef.current,
          rapidSwitchCount: rapidSwitchTimestampsRef.current.length,
          lastUpdated: new Date().toISOString()
        }).catch(() => {});

        // Cumulative threshold check (6.0 seconds cumulative across the entire exam)
        if (cumulativeOffScreenMsRef.current >= 6000) {
          if (now - lastCumulativeWarningTimeRef.current >= 10000) {
            lastCumulativeWarningTimeRef.current = now;
            const totalSec = (cumulativeOffScreenMsRef.current / 1000).toFixed(1);
            recordViolation(`Cumulative time off-screen exceeded safe threshold (${totalSec}s / 6s)`);
          }
        }

        if (onProctoringMetricsChange) {
          onProctoringMetricsChange({
            violationCount,
            cumulativeOffScreenSeconds: Math.round(cumulativeOffScreenMsRef.current / 1000),
            rapidSwitchCount: rapidSwitchTimestampsRef.current.length
          });
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleWindowBlur();
      } else {
        handleWindowFocus();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelBlurGraceTimer();
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [testMode, submissionId, sbd, examCode]);

  if (testMode !== 'TEST') return null;

  return (
    <>
      {/* Top Proctoring Bar - Minimalist & Neutral (Reduces Extraneous Cognitive Load) */}
      <div className="bg-white border-b border-purple-100/80 px-4 py-2 flex items-center justify-between text-xs text-[#3C2A63] shadow-xs">
        <div className="flex items-center space-x-3">
          <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Official Examination Session • Proctoring Active</span>
          </span>
          <span className="hidden sm:inline border-l border-purple-200 pl-3 text-slate-600 font-medium">
            Candidate ID: <strong className="text-[#3C2A63] font-bold">{sbd}</strong>
          </span>
          <span className="hidden sm:inline border-l border-purple-200 pl-3 text-slate-600 font-medium">
            Exam Code: <strong className="text-[#6B51A5] font-bold">{examCode}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Fullscreen Button */}
          {!isFullscreen && (
            <button
              onClick={requestFullscreenMode}
              className="px-3 py-1 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-xl font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              Fullscreen
            </button>
          )}

          {/* Neutral Status Pill */}
          <span className="px-2.5 py-1 rounded-xl font-semibold text-[11px] bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Connection Stable</span>
          </span>
        </div>
      </div>

      {/* Floating Warning Banner - Calm, Non-disruptive feedback */}
      {warningMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-slate-900/90 text-white font-bold rounded-2xl shadow-xl flex items-center space-x-2 border border-slate-700 animate-fadeIn text-xs backdrop-blur-md">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* 30-Second Lock Screen Overlay */}
      {isLocked30s && (
        <div className="fixed inset-0 bg-[#3C2A63]/95 z-[9999] backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-20 h-20 bg-rose-500/20 border border-rose-400/40 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
            <Lock className="w-10 h-10 text-rose-400" />
          </div>

          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
            EXAM WINDOW IS TEMPORARILY LOCKED!
          </h2>
          <p className="text-sm text-rose-200 max-w-md mb-6 leading-relaxed font-medium">
            The automated proctoring system detected 3 or more tab switches / window blur events ({violationCount} violations).
          </p>

          {/* Countdown Clock */}
          <div className="w-28 h-28 rounded-full border-4 border-rose-400/50 flex items-center justify-center mb-6 bg-rose-950/40">
            <span className="text-4xl font-black text-rose-300">{lockCountdown}s</span>
          </div>

          <p className="text-xs text-purple-200 font-medium">
            Please remain on this screen. Your exam will resume automatically when the timer reaches zero.
          </p>
        </div>
      )}
    </>
  );
};
