import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  Hourglass, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  CheckCircle2 
} from 'lucide-react';

interface CountdownTimerProps {
  initialMinutes: number;
  testMode?: 'TEST' | 'PRACTICE';
  sectionName?: string;
  sessionKey?: string;
  onTimeExpire?: () => void;
  className?: string;
  compact?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  initialMinutes,
  testMode = 'TEST',
  sectionName,
  sessionKey,
  onTimeExpire,
  className = '',
  compact = false
}) => {
  // Construct a stable storage key based on sessionKey or sectionName
  const cleanKey = (sessionKey || sectionName || 'general_timer').replace(/[^a-zA-Z0-9]/g, '_');
  const storageKey = `ielts_timer_target_${cleanKey}`;
  const totalSeconds = Math.max(1, initialMinutes * 60);

  const getOrInitEndTime = (): number => {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) {
      const parsed = parseInt(existing, 10);
      if (!isNaN(parsed) && parsed > Date.now()) {
        return parsed;
      }
    }
    const newEndTime = Date.now() + totalSeconds * 1000;
    sessionStorage.setItem(storageKey, newEndTime.toString());
    return newEndTime;
  };

  const [endTime, setEndTime] = useState<number>(getOrInitEndTime);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => 
    Math.max(0, Math.floor((getOrInitEndTime() - Date.now()) / 1000))
  );
  const [hasWarned5Min, setHasWarned5Min] = useState<boolean>(false);
  
  // User Control and Freedom: Allow hiding the frantic countdown digits
  const [isTimeHidden, setIsTimeHidden] = useState<boolean>(false);
  const hasExpiredRef = useRef(false);

  // Sync if initialMinutes changes and no active valid timer exists
  useEffect(() => {
    const targetTime = getOrInitEndTime();
    setEndTime(targetTime);
    setSecondsLeft(Math.max(0, Math.floor((targetTime - Date.now()) / 1000)));
  }, [initialMinutes, cleanKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          if (onTimeExpire) {
            onTimeExpire();
          }
        }
      }

      // Trigger subtle notification at 5 minutes mark without alarming sounds
      if (remaining === 300 && !hasWarned5Min) {
        setHasWarned5Min(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onTimeExpire, hasWarned5Min]);

  const handleResetTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newTarget = Date.now() + totalSeconds * 1000;
    sessionStorage.setItem(storageKey, newTarget.toString());
    setEndTime(newTarget);
    setSecondsLeft(totalSeconds);
    hasExpiredRef.current = false;
    setHasWarned5Min(false);
  };

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const formattedTime = hours > 0
    ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isUnder10Min = secondsLeft > 0 && secondsLeft <= 600; // <= 10 mins
  const isUnder5Min = secondsLeft > 0 && secondsLeft <= 300; // <= 5 mins

  // Peripheral Vision Progress: percentage of time remaining
  const progressPercent = Math.min(100, Math.max(0, (secondsLeft / totalSeconds) * 100));

  if (compact) {
    return (
      <div className={`relative flex items-center space-x-2 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all overflow-hidden ${
        isUnder5Min
          ? 'bg-amber-50 text-amber-900 border border-amber-300 ring-2 ring-amber-400/30'
          : 'bg-[#E2DDEC] text-[#3C2A63] border border-purple-200/80'
      } ${className}`}>
        {/* Subtle Ambient Background Bar for peripheral vision */}
        <div 
          className={`absolute bottom-0 left-0 h-0.5 transition-all duration-1000 ${
            isUnder5Min ? 'bg-amber-500' : 'bg-[#6B51A5]'
          }`}
          style={{ width: `${progressPercent}%` }}
        />

        <Clock className={`w-3.5 h-3.5 shrink-0 ${isUnder5Min ? 'text-amber-700' : 'text-[#6B51A5]'}`} />
        
        {isTimeHidden ? (
          <span className="font-sans text-[11px] text-[#7C68A5]">Time hidden</span>
        ) : (
          <span className="font-mono text-xs font-bold tracking-wider">{formattedTime}</span>
        )}

        <button
          type="button"
          onClick={() => setIsTimeHidden(!isTimeHidden)}
          className="p-1 text-[#7C68A5] hover:text-[#3C2A63] transition rounded-md cursor-pointer"
          title={isTimeHidden ? 'Show countdown timer' : 'Hide timer numbers to reduce anxiety'}
        >
          {isTimeHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>

        {testMode === 'PRACTICE' && (
          <button
            type="button"
            onClick={handleResetTimer}
            className="p-1 text-purple-600 hover:text-purple-900 transition rounded-md cursor-pointer"
            title="Reset timer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative bg-white border rounded-3xl p-4 shadow-sm flex flex-col justify-between gap-3 transition-all overflow-hidden ${
      isUnder5Min
        ? 'border-amber-300/80 bg-amber-50/20 ring-2 ring-amber-300/30'
        : 'border-purple-100/90 bg-white'
    } ${className}`}>
      
      {/* Top row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left info */}
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
            isUnder5Min
              ? 'bg-amber-100 text-amber-800'
              : 'bg-purple-100 text-[#6B51A5]'
          }`}>
            <Hourglass className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5]">
                {sectionName ? `${sectionName}` : 'Remaining Test Time'}
              </span>
              {testMode === 'TEST' && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  Official
                </span>
              )}
            </div>

            <div className="flex items-baseline space-x-2 mt-0.5">
              {isTimeHidden ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#7C68A5]">
                  <span>Timer running in background</span>
                  <span className="text-[11px] font-normal italic">(Track via peripheral visual bar below)</span>
                </div>
              ) : (
                <span className={`font-mono text-xl font-black tracking-tight ${
                  isUnder5Min ? 'text-amber-700 animate-pulse' : 'text-[#3C2A63]'
                }`}>
                  {formattedTime}
                </span>
              )}

              {!isTimeHidden && (
                <span className="text-[11px] text-[#7C68A5] font-medium hidden sm:inline">
                  {isUnder5Min ? '• Under 5 minutes remaining (check uncompleted questions)' : '• Counting down'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: User Control & Freedom Toggle */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsTimeHidden(!isTimeHidden)}
            className="px-3 py-1.5 bg-[#F5F2F9] hover:bg-[#E2DDEC] text-[#503A7A] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title={isTimeHidden ? 'Show countdown timer digits' : 'Hide timer digits to focus on test'}
          >
            {isTimeHidden ? (
              <>
                <Eye className="w-3.5 h-3.5 text-[#6B51A5]" />
                <span className="hidden sm:inline">Show Timer</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[#6B51A5]" />
                <span className="hidden sm:inline">Hide Timer</span>
              </>
            )}
          </button>

          {testMode === 'PRACTICE' && (
            <button
              type="button"
              onClick={handleResetTimer}
              className="px-3 py-1.5 bg-[#F5F2F9] hover:bg-[#E2DDEC] text-[#503A7A] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Reset test timer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#6B51A5]" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Ambient Peripheral Vision Progress Bar */}
      <div className="space-y-1">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-1.5 rounded-full transition-all duration-1000 ease-out ${
              isUnder5Min 
                ? 'bg-amber-600' 
                : isUnder10Min 
                ? 'bg-amber-500' 
                : 'bg-[#6B51A5]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#7C68A5] font-medium">
          <span>Time progress (Peripheral visual indicator)</span>
          <span>{Math.round(progressPercent)}% remaining</span>
        </div>
      </div>
    </div>
  );
};
