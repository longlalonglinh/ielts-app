import React, { useState } from 'react';
import { ShieldCheck, BookOpen, AlertCircle, History, ArrowRight, FileCheck } from 'lucide-react';
import { StudentSession } from '../../types';

interface LoginSectionProps {
  onStartExam: (session: StudentSession) => void;
  availableExams?: string[];
  savedSubmissions: any[];
  onReviewSubmission: (submissionId: string) => void;
}

export const LoginSection: React.FC<LoginSectionProps> = ({
  onStartExam,
  savedSubmissions,
  onReviewSubmission
}) => {
  const [sbd, setSbd] = useState('');
  const [examCode, setExamCode] = useState('TEST01');
  const [showHistory, setShowHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Determine mode mathematically
  const finalCode = examCode.trim().toUpperCase();
  
  const calculateMode = (codeStr: string): 'TEST' | 'PRACTICE' => {
    if (!codeStr) return 'TEST';
    // If starts with TEST or PRAC
    if (codeStr.startsWith('TEST')) return 'TEST';
    if (codeStr.startsWith('PRAC')) return 'PRACTICE';
    
    // Otherwise calculate numeric modulo: code % 2
    const numMatch = codeStr.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      return num % 2 === 1 ? 'TEST' : 'PRACTICE';
    }
    return 'TEST'; // default
  };

  const detectedMode = calculateMode(finalCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbd.trim()) {
      setErrorMsg('Please enter your Candidate Registration Number (SBD).');
      return;
    }
    if (!finalCode) {
      setErrorMsg('Please enter the Exam Code.');
      return;
    }

    setErrorMsg('');
    onStartExam({
      sbd: sbd.trim().toUpperCase(),
      exam_code: finalCode,
      test_mode: detectedMode,
      is_review: false
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-900 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">IELTS Candidate Portal</h2>
          <p className="text-xs text-slate-400 mt-1">
            Enter your Registration ID and Exam Code to start your IELTS examination
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SBD */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Candidate Number (SBD) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={sbd}
              onChange={(e) => setSbd(e.target.value)}
              placeholder="e.g. TS12345"
              className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              required
            />
          </div>

          {/* Exam Code Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Exam Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              placeholder="e.g. IELTS01, TEST01, PRAC02"
              className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              required
            />
          </div>

          {/* Mode Indicator Box */}
          <div className={`p-4 rounded-xl border transition-all ${
            detectedMode === 'TEST'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                Automatic Mode Routing:
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${
                detectedMode === 'TEST' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
              }`}>
                {detectedMode === 'TEST' ? 'TEST MODE' : 'PRACTICE MODE'}
              </span>
            </div>
            <p className="text-[11px] opacity-80 mt-1.5 leading-relaxed">
              {detectedMode === 'TEST'
                ? '⚡ Odd code / TEST: Activates official examination mode with proctoring, fullscreen enforcement, right-click disabling, and tab tracking.'
                : '📖 Even code / PRAC: Activates practice mode with flexible highlighting, instant review options, and self-paced navigation.'}
            </p>
          </div>

          {/* History Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(e) => setShowHistory(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span>Show saved exam history (Review submissions)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition transform active:scale-[0.98]"
          >
            <span>Enter Examination Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* History Review Drawer */}
        {showHistory && (
          <div className="mt-6 pt-6 border-t border-slate-700/80">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              Locally Saved Submissions ({savedSubmissions.length})
            </h3>

            {savedSubmissions.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No previous submissions found on this browser.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {savedSubmissions.map((sub, idx) => (
                  <div
                    key={`${sub.submission_id || 'sub'}-${idx}`}
                    className="p-3 bg-slate-900/80 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs hover:border-indigo-500/50 transition"
                  >
                    <div>
                      <div className="font-bold text-indigo-300 flex items-center gap-2">
                        <span>{sub.submission_id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {sub.test_mode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Listening: <strong className="text-emerald-400">{sub.listening_raw}</strong> | Reading: <strong className="text-emerald-400">{sub.reading_raw}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => onReviewSubmission(sub.submission_id)}
                      className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1"
                    >
                      <FileCheck className="w-3 h-3" />
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
