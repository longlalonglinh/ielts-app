import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Send, 
  Headphones, 
  BookOpen, 
  FileText, 
  Save, 
  ShieldCheck, 
  Loader2, 
  Server, 
  Lock 
} from 'lucide-react';

interface SubmitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
  onSaveDraft?: () => void;
  isSubmitting: boolean;
  totalListening: number;
  answeredListening: number;
  totalReading: number;
  answeredReading: number;
  hasListening: boolean;
  hasReading: boolean;
  hasWriting: boolean;
  writingTask1Words: number;
  writingTask2Words: number;
  retakeMode?: boolean;
  targetSkill?: 'listening' | 'reading' | 'writing';
}

export const SubmitConfirmationModal: React.FC<SubmitConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirmSubmit,
  onSaveDraft,
  isSubmitting,
  totalListening,
  answeredListening,
  totalReading,
  answeredReading,
  hasListening,
  hasReading,
  hasWriting,
  writingTask1Words,
  writingTask2Words,
  retakeMode = false,
  targetSkill
}) => {
  const [submissionStage, setSubmissionStage] = useState<1 | 2 | 3>(1);
  const [draftSavedToast, setDraftSavedToast] = useState(false);

  useEffect(() => {
    let t1: any, t2: any;
    if (isSubmitting) {
      setSubmissionStage(1);
      t1 = setTimeout(() => setSubmissionStage(2), 600);
      t2 = setTimeout(() => setSubmissionStage(3), 1400);
    } else {
      setSubmissionStage(1);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSubmitting]);

  if (!isOpen) return null;

  const effectiveHasListening = retakeMode ? targetSkill === 'listening' : hasListening;
  const effectiveHasReading = retakeMode ? targetSkill === 'reading' : hasReading;
  const effectiveHasWriting = retakeMode ? targetSkill === 'writing' : hasWriting;

  const totalQuestions = (effectiveHasListening ? totalListening : 0) + (effectiveHasReading ? totalReading : 0);
  const totalAnswered = (effectiveHasListening ? answeredListening : 0) + (effectiveHasReading ? answeredReading : 0);
  const unansweredCount = Math.max(0, totalQuestions - totalAnswered);

  const hasWritingWarnings = effectiveHasWriting && (
    (writingTask1Words > 0 && writingTask1Words < 150) || 
    (writingTask2Words > 0 && writingTask2Words < 250) ||
    (writingTask1Words === 0 && writingTask2Words === 0)
  );

  const handleSaveDraftClick = () => {
    if (onSaveDraft) {
      onSaveDraft();
    }
    setDraftSavedToast(true);
    setTimeout(() => {
      setDraftSavedToast(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl shadow-purple-950/20 space-y-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        {!isSubmitting && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-purple-100 text-[#503A7A] rounded-2xl shrink-0">
            <Send className="w-6 h-6 text-[#6B51A5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-black text-[#3C2A63]">
                Confirm Final Submission
              </h3>
              {retakeMode ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold uppercase tracking-wider border border-emerald-200">
                  One Skill Retake: {targetSkill?.toUpperCase() || 'SINGLE SKILL'}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-[#6B51A5] font-extrabold uppercase tracking-wider">
                  Official Exam
                </span>
              )}
            </div>
            <p className="text-xs text-[#7C68A5] font-medium">
              Review your responses carefully before finalizing submission and grading
            </p>
          </div>
        </div>

        {/* Material Design 3 Progress Stepper during submission */}
        {isSubmitting ? (
          <div className="py-6 px-4 bg-[#FAF8FE] border border-purple-100 rounded-2xl space-y-5 text-center">
            <div className="flex items-center justify-center">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-[#6B51A5] animate-spin" />
                <Server className="w-5 h-5 text-[#3C2A63] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black text-[#3C2A63]">
                {submissionStage === 1 && 'Phase 1: Sealing & encrypting test responses...'}
                {submissionStage === 2 && 'Phase 2: Secure backend scoring in progress...'}
                {submissionStage === 3 && 'Phase 3: Finalizing official score receipt...'}
              </h4>
              <p className="text-xs text-[#7C68A5]">
                {submissionStage === 1 && 'Verifying response integrity for Listening, Reading, and Writing.'}
                {submissionStage === 2 && 'Executing authoritative server scoring and proctoring validation.'}
                {submissionStage === 3 && 'Synchronizing receipt records to central database and Google Sheets.'}
              </p>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    submissionStage >= step 
                      ? 'bg-[#6B51A5] scale-110 shadow-sm' 
                      : 'bg-purple-200'
                  }`} />
                  {step < 3 && <div className={`w-8 h-0.5 transition-colors ${
                    submissionStage > step ? 'bg-[#6B51A5]' : 'bg-purple-200'
                  }`} />}
                </div>
              ))}
            </div>

            <div className="text-[11px] text-emerald-800 font-bold bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Session Protected: Do not close browser or reload page during submission.</span>
            </div>
          </div>
        ) : (
          <>
            {/* Completion Progress Cards */}
            <div className="space-y-3">
              {effectiveHasListening && (
                <div className="p-3.5 bg-[#FAF8FE] border border-purple-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Headphones className="w-4 h-4 text-[#6B51A5]" />
                    <span className="text-xs font-bold text-[#3C2A63]">Listening Section</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-extrabold text-[#503A7A] font-mono">
                      {answeredListening} / {totalListening} answered
                    </span>
                    {answeredListening === totalListening ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {totalListening - answeredListening} remaining
                      </span>
                    )}
                  </div>
                </div>
              )}

              {effectiveHasReading && (
                <div className="p-3.5 bg-[#FAF8FE] border border-purple-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <BookOpen className="w-4 h-4 text-[#6B51A5]" />
                    <span className="text-xs font-bold text-[#3C2A63]">Reading Section</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-extrabold text-[#503A7A] font-mono">
                      {answeredReading} / {totalReading} answered
                    </span>
                    {answeredReading === totalReading ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {totalReading - answeredReading} remaining
                      </span>
                    )}
                  </div>
                </div>
              )}

              {effectiveHasWriting && (
                <div className="p-3.5 bg-[#FAF8FE] border border-purple-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-4 h-4 text-[#6B51A5]" />
                      <span className="text-xs font-bold text-[#3C2A63]">Academic Writing</span>
                    </div>
                    <span className="text-xs font-bold text-[#7C68A5]">Task 1 &amp; 2</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-purple-100/60">
                    <div className="bg-white p-2 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-[#7C68A5] block font-semibold">Task 1 (Target 150+)</span>
                      <span className={`font-black font-mono ${writingTask1Words >= 150 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {writingTask1Words} words
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-[#7C68A5] block font-semibold">Task 2 (Target 250+)</span>
                      <span className={`font-black font-mono ${writingTask2Words >= 250 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {writingTask2Words} words
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Warning If Questions Left Unanswered */}
            {unansweredCount > 0 && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start space-x-3 text-xs text-amber-950 shadow-sm animate-fadeIn">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-amber-900 text-sm">
                      You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}!
                    </p>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      {totalAnswered} / {totalQuestions} answered
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    IELTS does not deduct points for incorrect guesses. We strongly recommend returning to the test and attempting all questions before turning in.
                  </p>
                </div>
              </div>
            )}

            {/* Writing warning if empty or very short */}
            {hasWritingWarnings && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start space-x-3 text-xs text-rose-950 shadow-sm animate-fadeIn">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-black text-rose-900 text-sm">
                    Writing word count requirements not met!
                  </p>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                    Task 1 requires at least 150 words (current: {writingTask1Words}) and Task 2 requires at least 250 words (current: {writingTask2Words}). Submitting now may severely impact your Task Achievement band.
                  </p>
                </div>
              </div>
            )}

            {/* Draft Saved Toast Notification */}
            {draftSavedToast && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-bounce">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Draft successfully secured to IndexedDB &amp; LocalStorage!</span>
              </div>
            )}

            {/* Action Buttons: Clear visual hierarchy & Fitts's Law separation (min 16px gap) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-purple-100">
              <button
                type="button"
                onClick={handleSaveDraftClick}
                className="px-4 py-2.5 bg-white hover:bg-purple-50 text-[#503A7A] font-extrabold text-xs rounded-xl border border-purple-200 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                title="Save draft and resume later"
              >
                <Save className="w-3.5 h-3.5 text-[#6B51A5]" />
                <span>SAVE DRAFT</span>
              </button>

              <div className="flex flex-col-reverse sm:flex-row items-center gap-4 sm:gap-4 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer text-center"
                >
                  ← Continue Test
                </button>

                <button
                  type="button"
                  onClick={onConfirmSubmit}
                  className={`w-full sm:w-auto px-6 py-3 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98 ${
                    unansweredCount > 0 || hasWritingWarnings
                      ? 'bg-rose-700 hover:bg-rose-800 shadow-rose-950/20 ring-2 ring-rose-400/40'
                      : 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-950/20'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {unansweredCount > 0
                      ? `SUBMIT WITH ${unansweredCount} UNANSWERED`
                      : 'CONFIRM & TURN IN'}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
