import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  FileCheck2, 
  Server, 
  CheckCircle2, 
  Clock, 
  WifiOff, 
  Database,
  Sparkles
} from 'lucide-react';

interface SubmissionProgressModalProps {
  isOpen: boolean;
  isForcedTimeout?: boolean;
  sbd?: string;
  examCode?: string;
  answeredCount?: number;
  totalQuestions?: number;
}

export const SubmissionProgressModal: React.FC<SubmissionProgressModalProps> = ({
  isOpen,
  isForcedTimeout = false,
  sbd = 'CANDIDATE',
  examCode = 'EXAM',
  answeredCount = 0,
  totalQuestions = 40
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [progressPercent, setProgressPercent] = useState<number>(20);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setProgressPercent(20);
      return;
    }

    const t1 = setTimeout(() => {
      setCurrentStep(2);
      setProgressPercent(50);
    }, 450);

    const t2 = setTimeout(() => {
      setCurrentStep(3);
      setProgressPercent(85);
    }, 1100);

    const t3 = setTimeout(() => {
      setCurrentStep(4);
      setProgressPercent(100);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    {
      id: 1,
      title: 'Packaging Exam Data',
      desc: 'Consolidating all Listening, Reading, and Writing responses (Task 1 & Task 2)',
      icon: FileCheck2
    },
    {
      id: 2,
      title: 'Digital Seal & Checksum Verification',
      desc: 'Generating tamper-proof cryptographic signature and securing offline IndexedDB vault',
      icon: Lock
    },
    {
      id: 3,
      title: 'Submitting & Standardized Scoring',
      desc: 'Transmitting responses to server for IELTS algorithmic scoring and Band conversion',
      icon: Server
    },
    {
      id: 4,
      title: 'Storing & Generating Exam Receipt',
      desc: 'Recording submission to database and issuing official verifiable digital receipt',
      icon: Database
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden text-slate-800 transition-all transform scale-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-progress-title"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#6B51A5] via-[#583F8F] to-[#3C2A63] p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 backdrop-blur flex items-center justify-center mb-3 shadow-inner">
              {isForcedTimeout ? (
                <Clock className="w-7 h-7 text-amber-300 animate-pulse" />
              ) : (
                <ShieldCheck className="w-7 h-7 text-emerald-300 animate-bounce" />
              )}
            </div>

            <h3 id="submission-progress-title" className="text-xl font-black tracking-tight text-white">
              {isForcedTimeout ? 'Time Expired - Auto-submitting Exam' : 'Processing & Sealing Exam Submission'}
            </h3>

            <p className="text-xs text-purple-200 mt-1 font-medium">
              Candidate: <strong className="text-white font-bold">{sbd}</strong> | Test Code: <strong className="text-white font-bold">{examCode}</strong>
            </p>

            {isForcedTimeout && (
              <div className="mt-2.5 px-3 py-1 bg-amber-400 text-amber-950 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Clock className="w-3.5 h-3.5" />
                <span>100% of recorded responses safely preserved</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 relative overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-600 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps List */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {steps.map((s) => {
              const Icon = s.icon;
              const isCompleted = currentStep > s.id;
              const isCurrent = currentStep === s.id;

              return (
                <div 
                  key={s.id} 
                  className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                    isCurrent 
                      ? 'bg-purple-50/80 border-purple-300 shadow-sm' 
                      : isCompleted
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-700'
                      : 'bg-slate-50 border-slate-200/70 opacity-60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                    isCurrent
                      ? 'bg-[#6B51A5] text-white animate-pulse'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-bold ${isCurrent ? 'text-[#3C2A63]' : isCompleted ? 'text-emerald-950' : 'text-slate-600'}`}>
                        {s.title}
                      </h4>
                      {isCurrent && (
                        <span className="text-[10px] font-black text-[#6B51A5] uppercase tracking-wider animate-pulse">
                          Processing...
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-0.5">
                          ✓ Completed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {s.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reassurance Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-slate-600">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              <strong>Dual Vault Security:</strong> If your network connection drops, your exam is sealed instantly on your local device and submitted automatically once reconnected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
