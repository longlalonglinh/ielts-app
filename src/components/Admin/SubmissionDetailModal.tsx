import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Headphones, 
  BookOpen, 
  Award, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Download, 
  User, 
  Calendar,
  Lock,
  ExternalLink
} from 'lucide-react';
import { SubmissionRecord } from '../../types';
import { formatSubmissionTime } from '../../utils/dateFormatter';

interface SubmissionDetailModalProps {
  submission: SubmissionRecord | null;
  onClose: () => void;
}

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submission,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'answers' | 'writing' | 'proctoring'>('overview');
  const [copied, setCopied] = useState(false);

  if (!submission) return null;

  const handleCopyId = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(submission.submission_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUBMISSION_${submission.exam_code}_${submission.sbd}_${submission.submission_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const listeningAnswers = submission.listening_answers || submission.answers || {};
  const readingAnswers = submission.reading_answers || submission.answers || {};
  const detailedResults = submission.detailed_results || {};

  const t1Text = submission.writing_task1_text || submission.writing_task1 || (submission as any).writing_task1_response || '';
  const t2Text = submission.writing_task2_text || submission.writing_task2 || (submission as any).writing_task2_response || '';
  const t1Words = t1Text.trim().split(/\s+/).filter(Boolean).length;
  const t2Words = t2Text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-purple-100 flex flex-col overflow-hidden text-[#3C2A63]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#6B51A5] via-[#503A7A] to-[#3C2A63] text-white p-5 sm:p-6 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px] font-black uppercase tracking-wider">
                {submission.test_mode || 'TEST'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                submission.writing_status === 'GRADED'
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'bg-amber-400 text-amber-950'
              }`}>
                {submission.writing_status || 'PENDING_TEACHER'}
              </span>
              {submission.submission_type === 'TIMEOUT_FORCED' && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                  Timeout Forced
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>Thí sinh: {submission.sbd}</span>
              {submission.student_name && (
                <span className="text-purple-200 font-medium text-sm">({submission.student_name})</span>
              )}
              <span className="text-amber-300 font-mono text-base">[{submission.exam_code}]</span>
            </h3>

            <div className="flex items-center gap-3 text-xs text-purple-200 mt-1 font-mono">
              <span className="truncate max-w-[280px]">ID: {submission.submission_id}</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="hover:text-white underline text-[11px] cursor-pointer"
              >
                {copied ? '✓ Đã sao chép' : 'Sao chép ID'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadSingle}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition cursor-pointer"
              title="Tải tệp JSON của bài nộp này"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-[#F8F6FC] px-5 sm:px-6 pt-3 border-b border-purple-100 flex gap-2 shrink-0 overflow-x-auto">
          {[
            { id: 'overview', label: 'Tổng quan & Điểm', icon: Award },
            { id: 'answers', label: 'Đáp án Trắc nghiệm & Điền từ', icon: BookOpen },
            { id: 'writing', label: `Bài viết Writing (${t1Words + t2Words} từ)`, icon: FileText },
            { id: 'proctoring', label: `Giám sát & Vi phạm (${submission.violations_count || 0})`, icon: ShieldAlert }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3.5 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-[#6B51A5] text-[#6B51A5]'
                    : 'border-transparent text-[#7C68A5] hover:text-[#503A7A]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Score Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-purple-50 border border-purple-200/80 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block">Listening</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                    {submission.listening_raw_score ?? submission.listening_score ?? 0}
                    <span className="text-xs text-[#7C68A5]"> / {submission.listening_max_score ?? 40}</span>
                  </div>
                  {submission.listening_band !== undefined && (
                    <span className="inline-block mt-1 text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Band {Number(submission.listening_band).toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200/80 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block">Reading</span>
                  <div className="text-2xl font-black text-[#6B51A5] mt-1 font-mono">
                    {submission.reading_raw_score ?? submission.reading_score ?? 0}
                    <span className="text-xs text-[#7C68A5]"> / {submission.reading_max_score ?? 40}</span>
                  </div>
                  {submission.reading_band !== undefined && (
                    <span className="inline-block mt-1 text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      Band {Number(submission.reading_band).toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Writing</span>
                  <div className="text-base font-black text-amber-950 mt-1">
                    {submission.writing_band !== undefined ? `Band ${Number(submission.writing_band).toFixed(1)}` : 'Chờ chấm'}
                  </div>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-900">
                    {t1Words + t2Words} từ đã nộp
                  </span>
                </div>

                <div className="p-4 bg-gradient-to-br from-indigo-900 to-[#503A7A] text-white rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200 block">Overall Band</span>
                  <div className="text-3xl font-black text-amber-300 mt-1 font-mono">
                    {submission.overall_band !== undefined ? Number(submission.overall_band).toFixed(1) : '---'}
                  </div>
                  <span className="inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white">
                    IELTS Academic
                  </span>
                </div>
              </div>

              {/* Submission Metadata Details */}
              <div className="bg-[#F8F6FC] border border-purple-100 rounded-2xl p-4 text-xs space-y-2">
                <h4 className="font-extrabold text-[#503A7A] uppercase tracking-wider text-[11px] mb-2">
                  Thông tin phiên thi &amp; Bảo mật
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#3C2A63]">
                  <div><strong>Thời gian nộp:</strong> {formatSubmissionTime(submission)}</div>
                  <div><strong>Mã biên nhận (Receipt):</strong> <code className="font-mono bg-white px-2 py-0.5 rounded border border-purple-100">{submission.offline_receipt_code || 'N/A'}</code></div>
                  <div><strong>Trạng thái đồng bộ:</strong> <span className="font-semibold text-emerald-700">{submission.sync_status || 'CERTIFIED_ONLINE'}</span></div>
                  <div><strong>Chữ ký số SHA:</strong> <code className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-purple-100 max-w-[200px] truncate inline-block align-bottom">{submission.sealed_token || 'N/A'}</code></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OBJECTIVE ANSWERS */}
          {activeTab === 'answers' && (
            <div className="space-y-4 text-xs">
              {Object.keys(listeningAnswers).length === 0 && Object.keys(readingAnswers).length === 0 ? (
                <p className="text-center py-8 text-[#7C68A5] italic">Không có dữ liệu câu trả lời trắc nghiệm cho bài thi này.</p>
              ) : (
                <div className="space-y-4">
                  {Object.keys(listeningAnswers).length > 0 && (
                    <div className="border border-purple-100 rounded-2xl overflow-hidden">
                      <div className="bg-emerald-50 px-4 py-2.5 font-extrabold text-emerald-950 flex items-center justify-between">
                        <span>Listening Answers ({Object.keys(listeningAnswers).length} câu)</span>
                      </div>
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto">
                        {Object.entries(listeningAnswers).map(([qKey, ans]) => {
                          const res = detailedResults[qKey];
                          const isCorrect = res ? res.is_correct : undefined;
                          return (
                            <div key={qKey} className={`p-2 rounded-xl border flex flex-col justify-between ${
                              isCorrect === true ? 'bg-emerald-50/80 border-emerald-200' : isCorrect === false ? 'bg-rose-50/80 border-rose-200' : 'bg-slate-50 border-slate-200'
                            }`}>
                              <span className="font-mono font-bold text-[10px] text-[#7C68A5]">{qKey}</span>
                              <span className="font-black text-xs mt-0.5 truncate">{String(ans || '---')}</span>
                              {isCorrect !== undefined && (
                                <span className={`text-[10px] font-extrabold mt-1 ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isCorrect ? '✓ Đúng' : `✗ Đáp án: ${res?.correct_answer || 'N/A'}`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {Object.keys(readingAnswers).length > 0 && (
                    <div className="border border-purple-100 rounded-2xl overflow-hidden">
                      <div className="bg-purple-50 px-4 py-2.5 font-extrabold text-[#503A7A] flex items-center justify-between">
                        <span>Reading Answers ({Object.keys(readingAnswers).length} câu)</span>
                      </div>
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto">
                        {Object.entries(readingAnswers).map(([qKey, ans]) => {
                          const res = detailedResults[qKey];
                          const isCorrect = res ? res.is_correct : undefined;
                          return (
                            <div key={qKey} className={`p-2 rounded-xl border flex flex-col justify-between ${
                              isCorrect === true ? 'bg-emerald-50/80 border-emerald-200' : isCorrect === false ? 'bg-rose-50/80 border-rose-200' : 'bg-slate-50 border-slate-200'
                            }`}>
                              <span className="font-mono font-bold text-[10px] text-[#7C68A5]">{qKey}</span>
                              <span className="font-black text-xs mt-0.5 truncate">{String(ans || '---')}</span>
                              {isCorrect !== undefined && (
                                <span className={`text-[10px] font-extrabold mt-1 ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isCorrect ? '✓ Đúng' : `✗ Đáp án: ${res?.correct_answer || 'N/A'}`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WRITING ESSAYS */}
          {activeTab === 'writing' && (
            <div className="space-y-4 text-xs">
              <div className="border border-purple-100 rounded-2xl p-4 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-[#3C2A63]">Writing Task 1</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6B51A5] font-bold text-[11px]">
                    {t1Words} từ
                  </span>
                </div>
                <div className="p-3 bg-[#F8F6FC] rounded-xl border border-purple-100/80 whitespace-pre-wrap font-serif text-sm leading-relaxed text-[#3C2A63] max-h-60 overflow-y-auto">
                  {t1Text || <span className="italic text-[#7C68A5]">Thí sinh không làm Task 1</span>}
                </div>
              </div>

              <div className="border border-purple-100 rounded-2xl p-4 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-[#3C2A63]">Writing Task 2</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6B51A5] font-bold text-[11px]">
                    {t2Words} từ
                  </span>
                </div>
                <div className="p-3 bg-[#F8F6FC] rounded-xl border border-purple-100/80 whitespace-pre-wrap font-serif text-sm leading-relaxed text-[#3C2A63] max-h-80 overflow-y-auto">
                  {t2Text || <span className="italic text-[#7C68A5]">Thí sinh không làm Task 2</span>}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROCTORING & VIOLATIONS */}
          {activeTab === 'proctoring' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase text-rose-800 block">Số vi phạm</span>
                  <span className="text-2xl font-black text-rose-700 mt-1 block">
                    {submission.violations_count || 0}
                  </span>
                </div>
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">Chuyển tab</span>
                  <span className="text-2xl font-black text-amber-800 mt-1 block">
                    {submission.switch_count || 0}
                  </span>
                </div>
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase text-[#7C68A5] block">Rời màn hình</span>
                  <span className="text-2xl font-black text-[#6B51A5] mt-1 block">
                    {submission.cumulative_off_screen_seconds || 0}s
                  </span>
                </div>
              </div>

              {Array.isArray((submission as any).violation_logs) && (submission as any).violation_logs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-[#503A7A]">
                    Nhật ký sự kiện giám sát chi tiết
                  </h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {(submission as any).violation_logs.map((log: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-[#F8F6FC] border border-purple-100 rounded-xl flex items-center justify-between">
                        <span className="font-bold text-rose-700">{log.violation_type}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{log.timestamp ? formatSubmissionTime(log) : '---'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-[#F8F6FC] px-5 sm:px-6 py-3.5 border-t border-purple-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-[#7C68A5] font-medium">
            Hệ thống chấm thi IELTS CBT Authoritative Database
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#6B51A5] hover:bg-[#583F8F] text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
