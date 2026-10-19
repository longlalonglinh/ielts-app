import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  BookOpen, 
  AlertCircle, 
  History, 
  ArrowRight, 
  Lock, 
  Sparkles,
  UserCheck,
  SlidersHorizontal,
  Activity,
  RefreshCw
} from 'lucide-react';
import { prefetchExam, DEFAULT_API_URL } from '../../services/api';

interface LoginInstructionsProps {
  onLogin: (sbd: string, code: string, mode: 'TEST' | 'PRACTICE', reviewPrevious: boolean) => void;
  onSwitchToAdmin?: () => void;
  onOpenPracticeHub?: () => void;
  onOpenDiagnostics?: () => void;
  onForceResync?: (code: string) => void;
  isLoadingExam?: boolean;
  gasUrl?: string;
  loginError?: string | null;
  onClearLoginError?: () => void;
}

export const LoginInstructions: React.FC<LoginInstructionsProps> = ({ 
  onLogin, 
  onSwitchToAdmin,
  onOpenPracticeHub,
  onOpenDiagnostics,
  onForceResync,
  isLoadingExam = false,
  gasUrl = DEFAULT_API_URL,
  loginError = null,
  onClearLoginError
}) => {
  const [sbd, setSbd] = useState('');
  const [examCode, setExamCode] = useState('IELTS01');
  const [selectedMode, setSelectedMode] = useState<'TEST' | 'PRACTICE'>('TEST');
  const [reviewPrevious, setReviewPrevious] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const activeCode = examCode.trim().toUpperCase();

  // Prefetch exam when component mounts so data is ready in memory
  useEffect(() => {
    if (activeCode) {
      prefetchExam(gasUrl, activeCode).catch(() => {});
    }
  }, [gasUrl]);

  // Debounced prefetch whenever student types or updates the exam code
  useEffect(() => {
    if (!activeCode) return;
    const timer = setTimeout(() => {
      prefetchExam(gasUrl, activeCode).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [activeCode, gasUrl]);

  // Sync internal submitting state when external loading finishes
  useEffect(() => {
    if (!isLoadingExam && isSubmittingLogin) {
      const resetTimer = setTimeout(() => setIsSubmittingLogin(false), 800);
      return () => clearTimeout(resetTimer);
    }
  }, [isLoadingExam, isSubmittingLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSbd = sbd.trim();
    const cleanCode = activeCode.trim().toUpperCase();

    if (!cleanSbd) {
      setErrorMsg('Please enter Candidate Name or Candidate ID (SBD).');
      return;
    }

    // Standardized Candidate ID / Name validation (supports Vietnamese & international Unicode names, short IDs like HV1, TS01)
    // Minimum 2 characters, maximum 50 characters, rejects dangerous tags/brackets
    if (cleanSbd.length < 2) {
      setErrorMsg('Candidate Name or Candidate ID must be at least 2 characters.');
      return;
    }
    if (cleanSbd.length > 50) {
      setErrorMsg('Candidate Name or Candidate ID must not exceed 50 characters.');
      return;
    }
    // Reject HTML/script or bracket injection characters
    if (/[<>{}[\]\\/]/.test(cleanSbd)) {
      setErrorMsg('Candidate ID / Name contains invalid special characters.');
      return;
    }

    if (!cleanCode) {
      setErrorMsg('Please enter the exam or practice set code.');
      return;
    }

    // Direct Admin Redirection Check via SBD / Code (for teachers/admins)
    const upperSbd = cleanSbd.toUpperCase();
    const upperCode = cleanCode.toUpperCase();
    if (
      (upperSbd === 'ADMIN' || upperSbd === 'ADMIN123' || upperSbd === 'TEACHER') &&
      (upperCode === 'ADMIN' || upperCode === 'ADMIN123' || upperCode === 'TEACHER' || upperCode === '123456')
    ) {
      if (onSwitchToAdmin) {
        onSwitchToAdmin();
        return;
      }
    }

    setErrorMsg('');
    setIsSubmittingLogin(true);
    onLogin(cleanSbd, cleanCode, selectedMode, reviewPrevious);
  };

  const isWritingTaskCode = activeCode.startsWith('WT') || activeCode.startsWith('WRITING') || activeCode.startsWith('IELTS_WRITING');

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in py-2 font-sans text-[#3C2A63]">
      
      {/* Top Hero Banner */}
      <div className="bg-white border border-purple-100 rounded-[28px] p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#3C2A63] tracking-tight">
              IELTS Online Testing &amp; Practice System
            </h1>
            <p className="text-xs text-[#7C68A5] mt-1 font-medium">
              Examination platform &amp; adaptive vocabulary/grammar practice for learners
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure</span>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto">
        
        {/* Authentication Card */}
        <div className="bg-white border border-purple-100 rounded-[28px] p-6 sm:p-8 shadow-sm space-y-5">
          <div className="space-y-5">
            <div className="border-b border-purple-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#3C2A63] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#6B51A5]" />
                  <span>Candidate Verification</span>
                </h2>
                <p className="text-xs text-[#7C68A5] mt-0.5">Enter candidate ID / name and test code</p>
              </div>
            </div>

            {/* Error or Alert Display with Resolution Actions */}
            {(errorMsg || loginError) && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2 animate-shake font-medium">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg || loginError}</span>
                </div>

                {/* Intelligent Quick Fix Buttons */}
                <div className="pt-1 flex flex-wrap gap-2">
                  {selectedMode === 'TEST' && isWritingTaskCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMode('PRACTICE');
                        setErrorMsg('');
                        if (onClearLoginError) onClearLoginError();
                      }}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Switch to Practice Mode</span>
                    </button>
                  )}

                  {onForceResync && (
                    <button
                      type="button"
                      onClick={() => onForceResync(activeCode)}
                      className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Force Resync from Server</span>
                    </button>
                  )}

                  {onOpenDiagnostics && (
                    <button
                      type="button"
                      onClick={onOpenDiagnostics}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Activity className="w-3 h-3" />
                      <span>Diagnostics</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* SBD / Student Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#3C2A63]">
                  Candidate Name / ID (SBD) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={sbd}
                    onChange={(e) => {
                      setSbd(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="e.g., John Doe, HV01, TS12345"
                    className="w-full pl-10 pr-4 py-3 bg-[#F5F2F9] border border-purple-200 rounded-2xl text-sm text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:border-[#6B51A5] transition-all font-medium"
                    required
                  />
                  <UserCheck className="w-4 h-4 text-[#7C68A5] absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
                <span className="text-[11px] text-[#7C68A5] block">
                  Must be at least 2 characters. Used to track your exam results.
                </span>
              </div>

              {/* Mode Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#3C2A63]">
                  Session Mode:
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#F5F2F9] p-1 rounded-2xl border border-purple-200">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('TEST');
                      if (onClearLoginError) onClearLoginError();
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMode === 'TEST'
                        ? 'bg-white text-amber-800 shadow-sm border border-amber-200'
                        : 'text-[#7C68A5] hover:text-[#3C2A63]'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Official Test</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('PRACTICE');
                      if (onClearLoginError) onClearLoginError();
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMode === 'PRACTICE'
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                        : 'text-[#7C68A5] hover:text-[#3C2A63]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Practice Mode</span>
                  </button>
                </div>
              </div>

              {/* Exam Code or Practice Set Input - DYNAMICALLY LABELED ACCORDING TO SESSION MODE */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#3C2A63]">
                    {selectedMode === 'TEST' ? 'Official Test Code' : 'Practice Set / Task Code'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#7C68A5]">
                    {selectedMode === 'TEST' ? 'Official Exam Code' : 'Writing / Drill / Deck'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={examCode}
                    onChange={(e) => {
                      setExamCode(e.target.value);
                      if (errorMsg) setErrorMsg('');
                      if (onClearLoginError) onClearLoginError();
                    }}
                    placeholder={selectedMode === 'TEST' ? 'e.g., TEST01, IELTS01' : 'e.g., WT1003, ON_TAP_01, IELTS_ACAD_VOCAB...'}
                    className="w-full pl-10 pr-4 py-3 bg-[#F5F2F9] border border-purple-200 rounded-2xl text-sm text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:border-[#6B51A5] transition-all font-mono font-bold"
                    required
                  />
                  <SlidersHorizontal className="w-4 h-4 text-[#7C68A5] absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
                <span className="text-[11px] text-[#7C68A5] block">
                  {selectedMode === 'TEST' 
                    ? 'Enter the official 60-minute test paper code provided by your proctor.' 
                    : 'Enter a Writing task code (e.g. WT1003), vocabulary deck, or skill drill.'}
                </span>
              </div>

              {/* WT Prefix Mismatch Helper (Shows when in Official Test mode with a Writing Practice Task code) */}
              {selectedMode === 'TEST' && isWritingTaskCode && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span><strong>[{activeCode}]</strong> is a Writing Task Practice Paper.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('PRACTICE');
                      if (onClearLoginError) onClearLoginError();
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] whitespace-nowrap cursor-pointer transition shadow-sm"
                  >
                    Switch to Practice
                  </button>
                </div>
              )}

              {/* PRACTICE Mode Option: Review Previous Submission */}
              {selectedMode === 'PRACTICE' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <label className="flex items-center space-x-2.5 text-xs font-medium text-emerald-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reviewPrevious}
                      onChange={(e) => setReviewPrevious(e.target.checked)}
                      className="w-4 h-4 rounded-md border-emerald-300 text-[#6B51A5] focus:ring-[#6B51A5] accent-[#6B51A5] cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5 font-bold">
                      <History className="w-4 h-4 text-emerald-700" />
                      Review previous submission and score report
                    </span>
                  </label>
                </div>
              )}

              {/* Primary Submit Button with Instant Visual Feedback */}
              <button
                type="submit"
                disabled={isSubmittingLogin || isLoadingExam}
                className={`w-full h-12 bg-[#6B51A5] hover:bg-[#503A7A] text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-[#6B51A5]/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] ${
                  (isSubmittingLogin || isLoadingExam) ? 'opacity-90 cursor-wait' : ''
                }`}
              >
                {isSubmittingLogin || isLoadingExam ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white shrink-0" />
                    <span>Entering exam room... (Loading exam)</span>
                  </>
                ) : (
                  <>
                    <span>
                      {selectedMode === 'TEST' 
                        ? 'START OFFICIAL TEST' 
                        : 'START PRACTICE SESSION'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Conditional Practice Hub Navigation (Shown prominently ONLY in PRACTICE mode to prevent TEST mode confusion) */}
              {selectedMode === 'PRACTICE' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPracticeHub) {
                      onOpenPracticeHub();
                    } else {
                      onLogin(sbd || 'HV01', 'ON_TAP_01', 'PRACTICE', false);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-purple-50 hover:bg-purple-100/70 border border-purple-200 text-xs font-bold text-[#6B51A5] rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#6B51A5]" />
                  <span>Practice Questions Hub (Browse All Decks)</span>
                </button>
              ) : (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('PRACTICE')}
                    className="text-[11px] text-[#7C68A5] hover:text-[#6B51A5] font-semibold underline underline-offset-2 transition cursor-pointer"
                  >
                    Looking for skill drills or vocabulary practice? Switch to Practice Mode
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};
