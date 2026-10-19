import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  FileText, 
  Headphones, 
  BookOpen, 
  AlertCircle, 
  Sparkles, 
  Home, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Check,
  HelpCircle,
  Lightbulb,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  ShieldCheck,
  Printer,
  Copy
} from 'lucide-react';
import { SubmissionResponse, ExamData } from '../../types';
import { GeminiAnalysisModal } from './Practice/GeminiAnalysisModal';

interface ResultPageProps {
  result: SubmissionResponse;
  testMode: 'TEST' | 'PRACTICE';
  examData?: ExamData | null;
  userAnswers?: Record<string, string>;
  writingTask1?: string;
  writingTask2?: string;
  onRestartPractice?: () => void;
  onReturnHome?: () => void;
  onRetrySync?: () => Promise<void>;
}

export const ResultPage: React.FC<ResultPageProps> = ({
  result,
  testMode,
  examData,
  userAnswers = {},
  writingTask1 = '',
  writingTask2 = '',
  onRestartPractice,
  onReturnHome,
  onRetrySync
}) => {
  const [showDetailedReview, setShowDetailedReview] = useState(false);

  // Extract listening and reading questions from examData
  const listeningQuestions = examData?.listening_questions || (examData?.questions || []).filter(q => q.section === 'listening');
  
  const readingQuestions: any[] = [];
  if (examData?.passages && examData.passages.length > 0) {
    examData.passages.forEach(p => {
      if (p.questions) readingQuestions.push(...p.questions);
    });
  }
  if (readingQuestions.length === 0) {
    readingQuestions.push(...(examData?.reading_questions || (examData?.questions || []).filter(q => q.section === 'reading')));
  }

  const hasListeningQuestions = listeningQuestions.length > 0;
  const hasReadingQuestions = readingQuestions.length > 0;
  const hasWritingSubmitted = Boolean(writingTask1 || writingTask2 || examData?.writing_task1_prompt || examData?.writing_task2_prompt);

  const isWritingRetake = Boolean(
    (result.retakeMode && result.targetSkill === 'writing') ||
    (examData?.retakeMode && examData?.targetSkill === 'writing') ||
    (result.targetSkill === 'writing') ||
    (examData?.targetSkill === 'writing') ||
    (examData?.exam_type === 'one_skill' && examData?.skills?.length === 1 && examData.skills[0] === 'writing')
  );

  const initialTab: 'listening' | 'reading' | 'writing' = isWritingRetake 
    ? 'writing' 
    : hasListeningQuestions 
    ? 'listening' 
    : hasReadingQuestions 
    ? 'reading' 
    : 'writing';

  const [activeReviewTab, setActiveReviewTab] = useState<'listening' | 'reading' | 'writing'>(initialTab);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'correct'>('all');

  // AI Remediation Modal State
  const [selectedSentenceForAI, setSelectedSentenceForAI] = useState<string | null>(null);
  const [selectedWordForAI, setSelectedWordForAI] = useState<string | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const isOffline = !!result.is_offline_pending || result.sync_status === 'QUEUED_OFFLINE';

  const handleCopyReceipt = () => {
    const code = result.offline_receipt_code || result.submission_id;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 3000);
    }
  };

  const handlePrintScorecard = () => {
    window.print();
  };

  const handleEmergencyExport = () => {
    const exportData = {
      submission_id: result.submission_id,
      sbd: result.sbd,
      exam_code: result.exam_code,
      submitted_at: result.submitted_at || new Date().toISOString(),
      sealed_token: result.sealed_token,
      offline_receipt_code: result.offline_receipt_code,
      sync_status: result.sync_status || (isOffline ? 'QUEUED_OFFLINE' : 'CERTIFIED_ONLINE'),
      listening_raw_score: result.listening_raw_score,
      listening_band: result.listening_band,
      reading_raw_score: result.reading_raw_score,
      reading_band: result.reading_band,
      overall_band: result.overall_band,
      writing_status: result.writing_status,
      user_answers: userAnswers,
      writing_task1: writingTask1,
      writing_task2: writingTask2,
      detailed_results: result.detailed_results
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IELTS_OFFICIAL_RESULT_${result.exam_code}_${result.sbd}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      if (onRetrySync) {
        await onRetrySync();
        setSyncFeedback('✅ Server synchronization requested successfully!');
      }
    } catch (e: any) {
      setSyncFeedback('⚠️ Server temporarily unreachable. Data remains safely secured offline.');
    } finally {
      setIsSyncing(false);
    }
  };

  const detailedResults = result.detailed_results || {};

  // Overall Band calculation fallback if not already provided (respects One Skill Retake: Writing has no estimated overall before teacher grading)
  const overallBand = isWritingRetake 
    ? undefined 
    : result.overall_band !== undefined 
    ? result.overall_band 
    : (result.listening_band !== undefined && result.reading_band !== undefined)
      ? Math.round(((result.listening_band + result.reading_band) / 2) * 2) / 2
      : result.reading_band ?? result.listening_band ?? undefined;

  const getFilteredQuestions = (section: 'listening' | 'reading') => {
    const list = section === 'listening' ? listeningQuestions : readingQuestions;
    return list.filter((q, idx) => {
      const qRes = detailedResults[q.question_id];
      const isCorrect = qRes ? qRes.is_correct : false;
      if (reviewFilter === 'incorrect') return !isCorrect;
      if (reviewFilter === 'correct') return isCorrect;
      return true;
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4 font-sans text-[#3C2A63]">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#6B51A5] via-[#503A7A] to-[#3C2A63] border border-purple-200 rounded-3xl p-8 shadow-xl text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Award className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isOffline ? (
              <>
                <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-amber-500/90 text-white rounded-full border border-amber-300 text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-lg">
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>STATUS: SEALED OFFLINE</span>
                </div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/20 text-white rounded-full border border-white/30 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                  <WifiOff className="w-3.5 h-3.5 text-amber-200" />
                  <span>SERVER SYNC QUEUE ACTIVE</span>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-emerald-500/90 text-white rounded-full border border-emerald-300 text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>STATUS: SUBMITTED &amp; GRADED</span>
                </div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/20 text-white rounded-full border border-white/30 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>SERVER AUTHORITATIVE GRADED</span>
                </div>
              </>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white">
            {isOffline ? 'TEST RESPONSES SAFELY SEALED' : 'EXAMINATION COMPLETED & GRADED'}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="text-sm text-purple-100 font-medium">
              Candidate: <strong className="text-white font-bold">{result.sbd || 'Candidate'}</strong> | Exam Code: <strong className="text-white font-bold">{result.exam_code}</strong> | Submission ID: <span className="font-mono text-xs text-purple-200 bg-white/10 px-2 py-0.5 rounded">{result.submission_id}</span>
            </p>
            {result.submission_type === 'TIMEOUT_FORCED' && (
              <span className="px-3 py-1 bg-amber-400 text-amber-950 font-black text-xs rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Auto-Submitted on Time Limit (Timeout Forced)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Official Examination Receipt & Export Action Bar */}
      <div className={`border-2 rounded-3xl p-6 shadow-xl space-y-4 ${
        isOffline 
          ? 'bg-amber-50 border-amber-300' 
          : 'bg-white border-purple-200/80 shadow-purple-950/5'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 shrink-0 ${isOffline ? 'text-amber-700' : 'text-emerald-600'}`} />
              <h3 className={`text-base font-black ${isOffline ? 'text-amber-950' : 'text-[#3C2A63]'}`}>
                {isOffline ? 'BÀI THI ĐÃ NIÊM PHONG AN TOÀN TRÊN MÁY TÍNH (OFFLINE SEALED)' : 'XÁC NHẬN NỘP BÀI THI CHÍNH THỨC (OFFICIAL EXAM RECEIPT)'}
              </h3>
            </div>
            <p className={`text-xs leading-relaxed max-w-2xl ${isOffline ? 'text-amber-900' : 'text-[#7C68A5]'}`}>
              {isOffline 
                ? 'Hệ thống đã mã hóa và lưu trữ bài làm vào bộ nhớ IndexedDB an toàn. Ngay khi kết nối mạng được khôi phục, bài thi sẽ tự động gửi lên Google Sheets và cập nhật điểm.'
                : 'Bài thi đã được ghi nhận vào cơ sở dữ liệu hệ thống và chấm điểm tự động. Bạn có thể in phiếu điểm hoặc lưu bản sao kết quả về máy.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isOffline && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Thử đồng bộ lại'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintScorecard}
              className="px-4 py-2.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="In phiếu kết quả bài thi hoặc lưu file PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In phiếu điểm / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleEmergencyExport}
              className="px-4 py-2.5 bg-white hover:bg-purple-50 text-[#3C2A63] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="Tải tệp JSON chứa toàn bộ câu trả lời và điểm số"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải kết quả (.json)</span>
            </button>
          </div>
        </div>

        <div className="bg-white/80 border border-purple-100 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#503A7A]">Mã biên nhận (Receipt Code):</span>
            <code className="font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              {result.offline_receipt_code || result.submission_id}
            </code>
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-[#3C2A63] rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedReceipt ? '✓ Đã sao chép!' : 'Sao chép'}</span>
            </button>
          </div>

          {result.sealed_token && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#7C68A5]">Chữ ký số:</span>
              <code className="font-mono text-[11px] text-[#503A7A] bg-slate-100 px-2 py-0.5 rounded max-w-[220px] truncate" title={result.sealed_token}>
                {result.sealed_token}
              </code>
            </div>
          )}
        </div>

        {syncFeedback && (
          <div className="text-xs font-bold p-2.5 rounded-xl bg-white border border-amber-200 text-amber-950 animate-fadeIn">
            {syncFeedback}
          </div>
        )}
      </div>

      {/* Raw & Band Score Display Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Overall Estimated Band */}
        {overallBand !== undefined && (
          <div className="bg-gradient-to-br from-indigo-900 to-[#503A7A] text-white rounded-3xl p-6 shadow-xl shadow-purple-950/10 flex flex-col items-center justify-between text-center space-y-3 relative overflow-hidden">
            <div className="p-3.5 bg-white/15 rounded-2xl border border-white/20">
              <Award className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <h4 className="text-[11px] font-extrabold text-purple-200 uppercase tracking-wider">ESTIMATED OVERALL</h4>
              <div className="text-4xl font-black text-white mt-1.5 font-mono">
                {overallBand.toFixed(1)}
              </div>
              <p className="text-[11px] text-purple-200 font-medium mt-0.5">
                Standard IELTS Rounding
              </p>
            </div>
            <span className="text-[10px] font-extrabold px-3 py-0.5 rounded-full bg-amber-400 text-amber-950 uppercase tracking-wider">
              Receptive Skills Band
            </span>
          </div>
        )}

        {/* Listening Raw & Band Score */}
        <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 flex flex-col items-center justify-between text-center space-y-3 hover:border-emerald-300 transition-all">
          <div className={`p-3.5 rounded-2xl border ${
            result.listening_max_score === 0
              ? 'bg-gray-100 text-gray-500 border-gray-200'
              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
          }`}>
            <Headphones className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">LISTENING RAW &amp; BAND</h4>
            {result.listening_max_score === 0 ? (
              <div className="mt-1.5 space-y-0.5">
                <div className="text-2xl font-black text-gray-400">N/A</div>
                <p className="text-[11px] text-[#7C68A5] font-semibold">Not in test paper</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-black text-emerald-700 mt-1.5 font-mono">
                  {result.listening_score ?? result.listening_raw_score ?? 0}{' '}
                  <span className="text-lg text-[#7C68A5]">/ {result.listening_max_score ?? 40}</span>
                </div>
                {result.listening_band !== undefined && (
                  <div className="mt-1 text-xs font-black text-[#3C2A63]">
                    Band: <span className="text-emerald-600 font-black text-sm">{result.listening_band.toFixed(1)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <span className={`text-[10px] font-extrabold px-3 py-0.5 rounded-full border ${
            result.listening_max_score === 0
              ? 'bg-gray-100 text-gray-600 border-gray-200'
              : 'text-emerald-800 bg-emerald-100 border-emerald-200'
          }`}>
            {result.listening_max_score === 0 ? 'Section Omitted' : 'Normalized Auto-Graded'}
          </span>
        </div>

        {/* Reading Raw & Band Score */}
        <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 flex flex-col items-center justify-between text-center space-y-3 hover:border-purple-300 transition-all">
          <div className={`p-3.5 rounded-2xl border ${
            result.reading_max_score === 0
              ? 'bg-gray-100 text-gray-500 border-gray-200'
              : 'bg-purple-100 text-[#503A7A] border border-purple-200'
          }`}>
            <BookOpen className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">READING RAW &amp; BAND</h4>
            {result.reading_max_score === 0 ? (
              <div className="mt-1.5 space-y-0.5">
                <div className="text-2xl font-black text-gray-400">N/A</div>
                <p className="text-[11px] text-[#7C68A5] font-semibold">Not in test paper</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-black text-[#6B51A5] mt-1.5 font-mono">
                  {result.reading_score ?? result.reading_raw_score ?? 0}{' '}
                  <span className="text-lg text-[#7C68A5]">/ {result.reading_max_score ?? 40}</span>
                </div>
                {result.reading_band !== undefined && (
                  <div className="mt-1 text-xs font-black text-[#3C2A63]">
                    Band: <span className="text-[#6B51A5] font-black text-sm">{result.reading_band.toFixed(1)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <span className={`text-[10px] font-extrabold px-3 py-0.5 rounded-full border ${
            result.reading_max_score === 0
              ? 'bg-gray-100 text-gray-600 border-gray-200'
              : 'text-purple-800 bg-purple-100 border-purple-200'
          }`}>
            {result.reading_max_score === 0 ? 'Section Omitted' : 'Normalized Auto-Graded'}
          </span>
        </div>

        {/* Writing Status */}
        <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 flex flex-col items-center justify-between text-center space-y-3 hover:border-amber-300 transition-all">
          <div className="p-3.5 bg-amber-100 text-amber-800 rounded-2xl border border-amber-200">
            <FileText className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">WRITING STATUS</h4>
            <div className="text-sm font-black text-amber-800 mt-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl inline-block">
              {result.writing_status || 'PENDING_TEACHER'}
            </div>
            {writingTask1 && (
              <p className="text-[10px] text-[#7C68A5] mt-1">
                Task 1: {writingTask1.trim().split(/\s+/).filter(Boolean).length}w | Task 2: {writingTask2.trim().split(/\s+/).filter(Boolean).length}w
              </p>
            )}
          </div>

          <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 px-3 py-0.5 rounded-full border border-amber-200">
            Pending Teacher Review
          </span>
        </div>

      </div>

      {/* Accordion Toggle: Detailed Question Breakdown */}
      <div className="bg-white border border-purple-100 rounded-3xl p-6 shadow-xl shadow-purple-950/5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#3C2A63] flex items-center gap-2">
              <span>Detailed Answer Key &amp; Solutions</span>
            </h3>
            <p className="text-xs text-[#7C68A5] font-medium mt-0.5">
              Review your responses against official correct answers and acceptable spelling variations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDetailedReview(prev => !prev)}
            className="px-5 py-2.5 bg-[#F5F2F9] hover:bg-[#E2DDEC] text-[#503A7A] rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer border border-purple-200 self-start sm:self-auto"
          >
            <span>{showDetailedReview ? 'Hide Solutions Review' : 'Show Solutions Review'}</span>
            {showDetailedReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showDetailedReview && (
          <div className="pt-4 border-t border-purple-100 space-y-6">
            
            {/* Section Switcher Tabs & Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-[#F5F2F9] p-1.5 rounded-2xl border border-purple-100">
                {hasListeningQuestions && (
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('listening')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                      activeReviewTab === 'listening'
                        ? 'bg-[#6B51A5] text-white shadow-md'
                        : 'text-[#503A7A] hover:bg-[#E2DDEC]'
                    }`}
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Listening ({listeningQuestions.length})</span>
                  </button>
                )}

                {hasReadingQuestions && (
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('reading')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                      activeReviewTab === 'reading'
                        ? 'bg-[#6B51A5] text-white shadow-md'
                        : 'text-[#503A7A] hover:bg-[#E2DDEC]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Reading ({readingQuestions.length})</span>
                  </button>
                )}

                {hasWritingSubmitted && (
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('writing')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                      activeReviewTab === 'writing'
                        ? 'bg-[#6B51A5] text-white shadow-md'
                        : 'text-[#503A7A] hover:bg-[#E2DDEC]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Writing Drafts</span>
                  </button>
                )}
              </div>

              {/* Status Filter for Receptive Skills */}
              {activeReviewTab !== 'writing' && (
                <div className="flex items-center space-x-1.5 text-xs font-bold">
                  <Filter className="w-3.5 h-3.5 text-[#7C68A5]" />
                  <span className="text-[#7C68A5] mr-1">Filter:</span>
                  {(['all', 'incorrect', 'correct'] as const).map((filterOpt) => (
                    <button
                      key={filterOpt}
                      type="button"
                      onClick={() => setReviewFilter(filterOpt)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer capitalize ${
                        reviewFilter === filterOpt
                          ? 'bg-[#503A7A] text-white shadow-sm'
                          : 'bg-[#F5F2F9] text-[#7C68A5] hover:bg-[#E2DDEC]'
                      }`}
                    >
                      {filterOpt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Questions Table / List */}
            {activeReviewTab !== 'writing' ? (
              <div className="space-y-3">
                {getFilteredQuestions(activeReviewTab).length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF8FE] border border-purple-100 rounded-2xl">
                    <p className="text-xs text-[#7C68A5] font-bold">No questions match the current filter.</p>
                  </div>
                ) : (
                  getFilteredQuestions(activeReviewTab).map((q, idx) => {
                    const qRes = detailedResults[q.question_id];
                    const isCorrect = qRes ? qRes.is_correct : false;
                    const studentAns = userAnswers[q.question_id] || (qRes ? qRes.user_answer : '') || '(No answer)';
                    const correctAnswers = qRes?.acceptable_answers?.length 
                      ? qRes.acceptable_answers.join(' / ')
                      : q.correct_answer || 'N/A';

                    return (
                      <div
                        key={`${q.question_id}-${idx}`}
                        className={`p-5 rounded-3xl border transition-all space-y-3.5 ${
                          isCorrect
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        {/* Top: Question Number, Prompt & Result Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-3">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-xs ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}>
                              {q.question_number || idx + 1}
                            </span>
                            <div>
                              <p className="text-xs md:text-sm font-bold text-[#3C2A63] leading-snug">
                                {q.question_text || `Question ${q.question_number || idx + 1}`}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isCorrect ? (
                              <span className="flex items-center space-x-1 text-xs font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3 py-1 rounded-xl shadow-xs">
                                <Check className="w-3.5 h-3.5" />
                                <span>Correct (+1)</span>
                              </span>
                            ) : (
                              <span className="flex items-center space-x-1 text-xs font-black text-rose-800 bg-rose-100/90 border border-rose-300 px-3 py-1 rounded-xl shadow-xs">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Incorrect (0)</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Side-by-Side Direct Comparison (Recognition over Recall) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          {/* Student Answer */}
                          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                            isCorrect 
                              ? 'bg-white border-emerald-200' 
                              : 'bg-white border-rose-200'
                          }`}>
                            <div className="text-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block">
                                Your Response:
                              </span>
                              <span className={`font-mono font-black text-xs md:text-sm ${
                                isCorrect ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                {studentAns || '(Unanswered)'}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isCorrect ? 'Matched Key' : 'Incorrect'}
                            </span>
                          </div>

                          {/* Acceptable Correct Answer */}
                          <div className="p-3 rounded-2xl border bg-white border-emerald-200 flex items-center justify-between gap-2">
                            <div className="text-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                                Accepted Correct Answer(s):
                              </span>
                              <span className="font-mono font-black text-xs md:text-sm text-emerald-700">
                                {correctAnswers}
                              </span>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          </div>
                        </div>

                        {/* Explanation Box if available */}
                        {q.explanation && (
                          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-1 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-[#6B51A5]">
                              <Lightbulb className="w-3.5 h-3.5" />
                              <span>Academic Evidence &amp; Explanation:</span>
                            </div>
                            <p className="text-[#3C2A63] leading-relaxed italic">
                              "{q.explanation}"
                            </p>
                          </div>
                        )}

                        {/* Interactive AI Remediation: Ask Gemini */}
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSentenceForAI(q.question_text || `Question ${q.question_number || idx + 1}`);
                              setSelectedWordForAI(q.correct_answer || undefined);
                            }}
                            className="px-3.5 py-1.5 bg-[#FAF8FE] hover:bg-purple-100 text-[#6B51A5] border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="Open in-depth grammar, vocabulary, and exam strategy analysis with Gemini AI"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Analyze with Gemini AI</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Writing Review Section */
              <div className="space-y-6">
                {/* Task 1 */}
                <div className="p-5 bg-[#FAF8FE] border border-purple-100 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-[#3C2A63]">Writing Task 1 Submission</h4>
                    <span className="text-xs font-mono font-bold text-[#6B51A5]">
                      {writingTask1.trim().split(/\s+/).filter(Boolean).length} words (Recommended: 150+)
                    </span>
                  </div>
                  {examData?.writing_task1_prompt && (
                    <p className="text-xs text-[#7C68A5] italic bg-white p-3 rounded-xl border border-purple-100">
                      Prompt: {examData.writing_task1_prompt}
                    </p>
                  )}
                  <div className="bg-white p-4 rounded-2xl border border-purple-100 text-xs text-[#3C2A63] leading-relaxed whitespace-pre-wrap font-serif">
                    {writingTask1.trim() || '(No draft entered for Task 1)'}
                  </div>
                </div>

                {/* Task 2 */}
                <div className="p-5 bg-[#FAF8FE] border border-purple-100 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-[#3C2A63]">Writing Task 2 Submission</h4>
                    <span className="text-xs font-mono font-bold text-[#6B51A5]">
                      {writingTask2.trim().split(/\s+/).filter(Boolean).length} words (Recommended: 250+)
                    </span>
                  </div>
                  {examData?.writing_task2_prompt && (
                    <p className="text-xs text-[#7C68A5] italic bg-white p-3 rounded-xl border border-purple-100">
                      Prompt: {examData.writing_task2_prompt}
                    </p>
                  )}
                  <div className="bg-white p-4 rounded-2xl border border-purple-100 text-xs text-[#3C2A63] leading-relaxed whitespace-pre-wrap font-serif">
                    {writingTask2.trim() || '(No draft entered for Task 2)'}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="p-5 bg-white border border-purple-100/80 rounded-3xl text-xs text-[#503A7A] flex items-start space-x-3 shadow-sm">
        <AlertCircle className="w-5 h-5 text-[#6B51A5] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-extrabold text-[#3C2A63]">Official IELTS Assessment Standards:</p>
          <p className="leading-relaxed">
            Listening and Reading band scores are automatically determined according to Cambridge IELTS scoring conversion scales. Writing submissions are securely persisted and queued for instructor evaluation based on Task Response, Coherence &amp; Cohesion, Lexical Resource, and Grammatical Range &amp; Accuracy.
          </p>
        </div>
      </div>

      {/* Action Buttons: Return Home / Restart Practice */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        {onReturnHome && (
          <button
            type="button"
            onClick={onReturnHome}
            className="px-7 py-3.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-purple-950/10 flex items-center space-x-2 transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Candidate Portal</span>
          </button>
        )}

        {testMode === 'PRACTICE' && onRestartPractice && (
          <button
            type="button"
            onClick={onRestartPractice}
            className="px-7 py-3.5 bg-[#E2DDEC] hover:bg-[#D9D3E4] text-[#3C2A63] font-extrabold text-sm rounded-2xl border border-purple-200/80 flex items-center space-x-2 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Practice Test</span>
          </button>
        )}
      </div>

      {/* Interactive AI Remediation Modal (Hick's law & Recognition over Recall) */}
      <GeminiAnalysisModal
        isOpen={Boolean(selectedSentenceForAI)}
        onClose={() => {
          setSelectedSentenceForAI(null);
          setSelectedWordForAI(undefined);
        }}
        sentence={selectedSentenceForAI || ''}
        targetWord={selectedWordForAI}
      />

    </div>
  );
};
