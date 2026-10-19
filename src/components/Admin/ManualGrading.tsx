import React, { useState, useEffect } from 'react';
import { 
  FileEdit, 
  Copy, 
  Check, 
  Save, 
  UserCheck, 
  Send, 
  Sparkles, 
  Clock, 
  ArrowLeft, 
  ChevronRight, 
  ListFilter,
  Image as ImageIcon,
  Maximize2,
  X,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { SubmissionRecord, GradingForm, ExamData } from '../../types';
import { fetchSubmissions, saveWritingScore, deduplicateSubmissions, DEFAULT_API_URL, fetchExam } from '../../services/api';
import { DEFAULT_EXAMS } from '../../data/defaultExams';
import { formatSubmissionTime } from '../../utils/dateFormatter';
import { normalizeScoreInput, calculateIeltsOverallBand } from '../../services/answerScoring';

interface ManualGradingProps {
  apiUrl?: string;
  gasUrl?: string;
}

export const ManualGrading: React.FC<ManualGradingProps> = ({ apiUrl, gasUrl }) => {
  const effectiveApiUrl = apiUrl || gasUrl || DEFAULT_API_URL;
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [selectedSub, setSelectedSub] = useState<SubmissionRecord | null>(null);
  const [examCache, setExamCache] = useState<Record<string, ExamData>>({});
  const [zoomDiagramUrl, setZoomDiagramUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedZalo, setCopiedZalo] = useState(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'grading'>('list');
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);
  const [gradingForm, setGradingForm] = useState<GradingForm>({
    tr: 6.0,
    cc: 6.0,
    lr: 6.0,
    gra: 6.0,
    overall_writing: 6.0,
    feedback: ''
  });

  const countWords = (text?: string): number => {
    if (!text || typeof text !== 'string') return 0;
    const clean = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!clean) return 0;
    return clean.split(/\s+/).filter(t => t.length > 0 && /\w/.test(t)).length;
  };

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetchSubmissions(effectiveApiUrl);
      if (res.success && res.data) {
        const clean = deduplicateSubmissions(res.data);
        setSubmissions(clean);
        // Default select first pending teacher record
        const pending = clean.find((s) => s.writing_status === 'PENDING_TEACHER');
        if (pending) {
          setSelectedSub(pending);
        } else if (clean.length > 0) {
          setSelectedSub(clean[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [effectiveApiUrl]);

  // Load exam data for prompt and diagram preview
  useEffect(() => {
    if (!selectedSub?.exam_code) return;
    const code = selectedSub.exam_code.trim().toUpperCase();
    if (examCache[code]) return;

    const defaultMatch = DEFAULT_EXAMS.find(e => e.exam_code.toUpperCase() === code);
    if (defaultMatch) {
      setExamCache(prev => ({ ...prev, [code]: defaultMatch }));
      return;
    }

    fetchExam(effectiveApiUrl, code).then(res => {
      if (res.success && res.exam) {
        setExamCache(prev => ({ ...prev, [code]: res.exam! }));
      }
    }).catch(err => console.warn('Could not fetch exam details for grading:', err));
  }, [selectedSub?.exam_code, effectiveApiUrl, examCache]);

  // Recalculate Overall Writing score according to official IELTS band rounding (.25/.75 rules)
  useEffect(() => {
    const tr = normalizeScoreInput(gradingForm.tr);
    const cc = normalizeScoreInput(gradingForm.cc);
    const lr = normalizeScoreInput(gradingForm.lr);
    const gra = normalizeScoreInput(gradingForm.gra);
    const rounded = calculateIeltsOverallBand([tr, cc, lr, gra]);
    setGradingForm((prev) => ({ ...prev, overall_writing: rounded }));
  }, [gradingForm.tr, gradingForm.cc, gradingForm.lr, gradingForm.gra]);

  const handleSaveGrading = async () => {
    if (!selectedSub) return;
    setLoading(true);
    try {
      const tr = normalizeScoreInput(gradingForm.tr);
      const cc = normalizeScoreInput(gradingForm.cc);
      const lr = normalizeScoreInput(gradingForm.lr);
      const gra = normalizeScoreInput(gradingForm.gra);
      const expectedVersion = (selectedSub as any).grading_version || 1;

      const res = await saveWritingScore(effectiveApiUrl, selectedSub.submission_id, {
        ...gradingForm,
        tr,
        cc,
        lr,
        gra,
        expected_version: expectedVersion
      });

      if (res.success) {
        alert(`✅ Writing score for candidate ${selectedSub.sbd} saved successfully!`);
        loadSubmissions();
      } else {
        if (res.conflict) {
          alert(`⚠️ DỮ LIỆU ĐÃ ĐƯỢC CẬP NHẬT BỞI NGƯỜI KHÁC. VUI LÒNG TẢI LẠI TRANG.\n\n(Another examiner has submitted grades for candidate ${selectedSub.sbd}. The latest data will now be reloaded.)`);
          loadSubmissions();
        } else {
          alert(`❌ Failed to save score: ${res.message}`);
        }
      }
    } catch (err) {
      console.error('Error saving score:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format Zalo Copy Text according to teacher standards
  const generateZaloFormattedText = () => {
    if (!selectedSub) return '';

    return `
========================================
📝 IELTS WRITING ASSESSMENT REPORT - ID: ${selectedSub.sbd}
========================================
📌 Candidate: ${selectedSub.sbd}
📌 Exam Code: ${selectedSub.exam_code}
📌 Submission ID: ${selectedSub.submission_id}

🎧 Listening Score (Raw): ${selectedSub.listening_score} / 40
📖 Reading Score (Raw): ${selectedSub.reading_score} / 40

✍️ DETAILED WRITING 4-CRITERIA SCORES:
- Task Response (TR): ${gradingForm.tr}
- Coherence & Cohesion (CC): ${gradingForm.cc}
- Lexical Resource (LR): ${gradingForm.lr}
- Grammatical Range & Accuracy (GRA): ${gradingForm.gra}
=> OVERALL WRITING BAND SCORE: ${gradingForm.overall_writing}

💬 INSTRUCTOR FEEDBACK:
${gradingForm.feedback || 'The essay meets task requirements. Focus on incorporating higher-level lexical items and refining paragraph cohesion.'}
========================================
`.trim();
  };

  const handleCopyZalo = () => {
    const zaloText = generateZaloFormattedText();
    navigator.clipboard.writeText(zaloText);
    setCopiedZalo(true);
    setTimeout(() => {
      setCopiedZalo(false);
    }, 3000);
  };

  const pendingCount = submissions.filter((s) => s.writing_status === 'PENDING_TEACHER').length;
  const filteredSubmissions = filterPendingOnly
    ? submissions.filter((s) => s.writing_status === 'PENDING_TEACHER')
    : submissions;

  const handleSelectCandidate = (sub: SubmissionRecord) => {
    setSelectedSub(sub);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileTab('grading');
    }
  };

  const criteriaPresets = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Header */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-4 sm:p-6 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#3C2A63] flex items-center gap-2">
            <FileEdit className="w-5 h-5 sm:w-6 sm:h-6 text-[#6B51A5] shrink-0" />
            <span>Manual Writing Assessment &amp; Grading Desk</span>
          </h2>
          <p className="text-xs text-[#7C68A5] font-medium mt-1">
            Currently <strong className="text-amber-800 font-bold">{pendingCount}</strong> submissions with status <strong className="text-amber-800 font-bold">PENDING_TEACHER</strong>
          </p>
        </div>

        {/* Copy for Zalo Button */}
        {selectedSub && (
          <button
            onClick={handleCopyZalo}
            className="w-full md:w-auto px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-950/10 flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            {copiedZalo ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
            <span>{copiedZalo ? 'Report Copied to Clipboard!' : 'Export Student Report (Zalo/Message)'}</span>
          </button>
        )}
      </div>

      {/* Mobile Tab Switcher (< lg) */}
      <div className="lg:hidden flex items-center bg-[#E2DDEC] p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'list'
              ? 'bg-[#6B51A5] text-white shadow-md'
              : 'text-[#3C2A63] hover:text-[#503A7A]'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Submissions ({filteredSubmissions.length})</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-extrabold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('grading')}
          disabled={!selectedSub}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'grading'
              ? 'bg-[#6B51A5] text-white shadow-md'
              : 'text-[#3C2A63] hover:text-[#503A7A] disabled:opacity-40'
          }`}
        >
          <FileEdit className="w-4 h-4" />
          <span>Grade {selectedSub ? `(${selectedSub.sbd})` : 'Essay'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sidebar: List of Submissions */}
        <div className={`lg:col-span-4 bg-white border border-purple-100/80 rounded-3xl p-4 sm:p-5 shadow-xl shadow-purple-950/5 space-y-3 ${
          mobileTab === 'grading' ? 'hidden lg:block' : 'block'
        }`}>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-[#3C2A63] uppercase tracking-wider">
              Candidate Submissions ({submissions.length})
            </h3>
            <button
              type="button"
              onClick={() => setFilterPendingOnly(!filterPendingOnly)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                filterPendingOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-purple-50 text-[#6B51A5] border-purple-200'
              }`}
            >
              {filterPendingOnly ? 'Pending Only' : 'Show All'}
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredSubmissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#7C68A5] italic">
                No submissions found.
              </div>
            ) : (
              filteredSubmissions.map((sub, idx) => {
                const isSelected = selectedSub?.submission_id === sub.submission_id;
                const isPending = sub.writing_status === 'PENDING_TEACHER';

                return (
                  <div
                    key={`${sub.submission_id || 'sub'}-${idx}`}
                    onClick={() => handleSelectCandidate(sub)}
                    className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#6B51A5] border-[#6B51A5] text-white shadow-md'
                        : 'bg-[#F8F6FC] border-purple-100 text-[#3C2A63] hover:bg-[#E2DDEC]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-extrabold text-sm flex items-center gap-2">
                        <span>Candidate: {sub.sbd}</span>
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-purple-200' : 'text-[#7C68A5]'}`}>
                          ({sub.exam_code})
                        </span>
                      </div>
                      <div className={`text-[11px] font-medium ${isSelected ? 'text-purple-100' : 'text-[#7C68A5]'}`}>
                        Listening: {sub.listening_score ?? sub.listening_raw_score ?? 0}/40 | Reading: {sub.reading_score ?? sub.reading_raw_score ?? 0}/40
                      </div>
                      <div className={`text-[10px] font-mono flex items-center gap-1 ${isSelected ? 'text-purple-200' : 'text-[#9684B8]'}`}>
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{formatSubmissionTime(sub)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                        isPending
                          ? isSelected
                            ? 'bg-amber-100 text-amber-900 border-amber-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                          : isSelected
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {isPending ? 'PENDING' : 'GRADED'}
                      </span>
                      <ChevronRight className={`w-4 h-4 lg:hidden ${isSelected ? 'text-white' : 'text-[#7C68A5]'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Content: Student Essay Text & Grading Form */}
        <div className={`lg:col-span-8 space-y-4 sm:space-y-6 ${
          mobileTab === 'list' ? 'hidden lg:block' : 'block'
        }`}>
          {selectedSub ? (
            <div className="space-y-4 sm:space-y-6">
              
              {/* Back to list button on mobile */}
              <div className="lg:hidden flex items-center justify-between bg-white border border-purple-100 rounded-2xl p-3 shadow-xs">
                <button
                  type="button"
                  onClick={() => setMobileTab('list')}
                  className="text-xs font-extrabold text-[#6B51A5] flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Candidate List</span>
                </button>
                <span className="text-xs font-mono text-[#7C68A5]">
                  {selectedSub.sbd} - {selectedSub.exam_code}
                </span>
              </div>

              {/* Two-Column Synchronized Grading Workspace */}
              {(() => {
                const currentExam = examCache[selectedSub.exam_code?.toUpperCase()];
                const writingSection = currentExam?.sections?.find(s => s.skill === 'writing');
                const task1Obj = writingSection?.tasks?.find(t => t.task_number === 1) || writingSection?.tasks?.[0];
                const task2Obj = writingSection?.tasks?.find(t => t.task_number === 2) || writingSection?.tasks?.[1];

                const t1Prompt = currentExam?.writing_task1_prompt || task1Obj?.prompt || '';
                const t1Image = currentExam?.writing_task1_image || currentExam?.writing_task1_image_url || task1Obj?.image_url || task1Obj?.imageUrl || currentExam?.image_url || '';
                const t2Prompt = currentExam?.writing_task2_prompt || task2Obj?.prompt || '';

                const t1WordCount = countWords(selectedSub.writing_task1);
                const t2WordCount = countWords(selectedSub.writing_task2);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                    
                    {/* Column 1: Exam Prompts & Candidate Essays (7 Cols) */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* Candidate & Exam Metadata Banner */}
                      <div className="bg-white border border-purple-100/90 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-[#3C2A63]">
                              Candidate: {selectedSub.sbd}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 text-[#503A7A] font-extrabold border border-purple-200">
                              {selectedSub.exam_code}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#7C68A5] font-mono">
                            <Clock className="w-3.5 h-3.5 text-[#6B51A5]" />
                            <span>Submitted: {formatSubmissionTime(selectedSub)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#503A7A] bg-[#FAF8FE] px-3 py-1.5 rounded-xl border border-purple-100">
                          <span>ID: {selectedSub.submission_id?.slice(-8) || selectedSub.submission_id}</span>
                        </div>
                      </div>

                      {/* TASK 1 PANEL */}
                      <div className="bg-white border border-purple-100/90 rounded-3xl p-4 sm:p-6 shadow-md shadow-purple-950/5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-purple-100">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#503A7A] text-white text-xs font-black flex items-center justify-center">1</span>
                            <h4 className="text-xs font-black text-[#3C2A63] uppercase tracking-wider">
                              Writing Task 1 (Report / Synthesis)
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              t1WordCount >= 150
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {t1WordCount} words (Target: 150+)
                            </span>
                          </div>
                        </div>

                        {/* Task 1 Official Question Prompt & Diagram */}
                        <div className="bg-[#FAF8FE] border border-purple-100/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-[#6B51A5] uppercase tracking-wider">
                              Task 1 Question Prompt:
                            </span>
                            {t1Image && (
                              <button
                                type="button"
                                onClick={() => setZoomDiagramUrl(t1Image)}
                                className="px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-[#503A7A] text-[10px] font-bold flex items-center gap-1 hover:bg-purple-50 transition cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3 text-[#6B51A5]" />
                                <span>Enlarge Diagram</span>
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-[#3C2A63] leading-relaxed font-medium">
                            {t1Prompt || 'The chart below shows information about the given topic. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'}
                          </p>

                          {/* Thumbnail Diagram */}
                          {t1Image && (
                            <div 
                              onClick={() => setZoomDiagramUrl(t1Image)}
                              className="relative group rounded-xl overflow-hidden border border-purple-200 bg-white cursor-pointer max-h-48 flex items-center justify-center"
                            >
                              <img 
                                src={t1Image} 
                                alt="Task 1 Diagram"
                                className="max-h-48 w-auto object-contain transition-transform group-hover:scale-102"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-2xs">
                                <Maximize2 className="w-4 h-4" />
                                <span>Click to inspect diagram</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Candidate Task 1 Essay Response */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-extrabold text-[#503A7A] block">
                            Candidate Essay Response:
                          </span>
                          <div className="p-4 bg-[#F8F6FC] border border-purple-100 rounded-2xl text-xs sm:text-sm text-[#3C2A63] leading-relaxed font-sans whitespace-pre-wrap selection:bg-purple-200">
                            {selectedSub.writing_task1 || (
                              <span className="italic text-[#7C68A5]">(No response submitted for Task 1)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* TASK 2 PANEL */}
                      <div className="bg-white border border-purple-100/90 rounded-3xl p-4 sm:p-6 shadow-md shadow-purple-950/5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-purple-100">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#503A7A] text-white text-xs font-black flex items-center justify-center">2</span>
                            <h4 className="text-xs font-black text-[#3C2A63] uppercase tracking-wider">
                              Writing Task 2 (Discursive Essay)
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              t2WordCount >= 250
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {t2WordCount} words (Target: 250+)
                            </span>
                          </div>
                        </div>

                        {/* Task 2 Official Question Prompt */}
                        <div className="bg-[#FAF8FE] border border-purple-100/80 rounded-2xl p-3.5 sm:p-4 space-y-1.5">
                          <span className="text-[11px] font-extrabold text-[#6B51A5] uppercase tracking-wider block">
                            Task 2 Question Prompt:
                          </span>
                          <p className="text-xs text-[#3C2A63] leading-relaxed font-medium">
                            {t2Prompt || 'Write about the given topic. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.'}
                          </p>
                        </div>

                        {/* Candidate Task 2 Essay Response */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-extrabold text-[#503A7A] block">
                            Candidate Essay Response:
                          </span>
                          <div className="p-4 bg-[#F8F6FC] border border-purple-100 rounded-2xl text-xs sm:text-sm text-[#3C2A63] leading-relaxed font-sans whitespace-pre-wrap selection:bg-purple-200">
                            {selectedSub.writing_task2 || (
                              <span className="italic text-[#7C68A5]">(No response submitted for Task 2)</span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Sticky Grading Rubric & Feedback Form (5 Cols) */}
                    <div className="lg:col-span-5 sticky top-4 self-start bg-white border border-purple-100/90 rounded-3xl p-4 sm:p-6 shadow-xl shadow-purple-950/10 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain">
                      
                      {/* Rubric Header */}
                      <div className="border-b border-purple-100 pb-3 flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                            Official 4-Criteria Rubric
                          </h4>
                          <span className="text-[10px] text-[#7C68A5] font-medium">
                            Cambridge .25/.75 Band Rounding
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyZalo}
                            className="px-2.5 py-1 bg-[#F5F2F9] hover:bg-[#E2DDEC] text-[#503A7A] border border-purple-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Copy Zalo formatted report to clipboard"
                          >
                            {copiedZalo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-[#6B51A5]" />}
                            <span>{copiedZalo ? 'Copied' : 'Zalo'}</span>
                          </button>

                          <span className="text-xs font-black text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 shadow-2xs font-mono">
                            Band: {gradingForm.overall_writing.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* 4 Criteria Inputs */}
                      <div className="space-y-3">
                        {/* TR / Task Achievement */}
                        <div className="space-y-1 bg-[#F8F6FC] p-3 rounded-2xl border border-purple-100">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-extrabold text-[#503A7A]">
                              Task Response / Achievement (TR)
                            </label>
                            <span className="text-xs font-black text-[#6B51A5] font-mono">{gradingForm.tr}</span>
                          </div>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="9"
                            value={gradingForm.tr}
                            onChange={(e) => setGradingForm({ ...gradingForm, tr: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                          />
                          <div className="flex flex-wrap gap-1 pt-1">
                            {criteriaPresets.map((sc) => (
                              <button
                                key={sc}
                                type="button"
                                onClick={() => setGradingForm(p => ({ ...p, tr: sc }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                  gradingForm.tr === sc ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] border border-purple-200 hover:bg-purple-50'
                                }`}
                              >
                                {sc}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* CC / Coherence & Cohesion */}
                        <div className="space-y-1 bg-[#F8F6FC] p-3 rounded-2xl border border-purple-100">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-extrabold text-[#503A7A]">
                              Coherence &amp; Cohesion (CC)
                            </label>
                            <span className="text-xs font-black text-[#6B51A5] font-mono">{gradingForm.cc}</span>
                          </div>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="9"
                            value={gradingForm.cc}
                            onChange={(e) => setGradingForm({ ...gradingForm, cc: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                          />
                          <div className="flex flex-wrap gap-1 pt-1">
                            {criteriaPresets.map((sc) => (
                              <button
                                key={sc}
                                type="button"
                                onClick={() => setGradingForm(p => ({ ...p, cc: sc }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                  gradingForm.cc === sc ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] border border-purple-200 hover:bg-purple-50'
                                }`}
                              >
                                {sc}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* LR / Lexical Resource */}
                        <div className="space-y-1 bg-[#F8F6FC] p-3 rounded-2xl border border-purple-100">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-extrabold text-[#503A7A]">
                              Lexical Resource (LR)
                            </label>
                            <span className="text-xs font-black text-[#6B51A5] font-mono">{gradingForm.lr}</span>
                          </div>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="9"
                            value={gradingForm.lr}
                            onChange={(e) => setGradingForm({ ...gradingForm, lr: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                          />
                          <div className="flex flex-wrap gap-1 pt-1">
                            {criteriaPresets.map((sc) => (
                              <button
                                key={sc}
                                type="button"
                                onClick={() => setGradingForm(p => ({ ...p, lr: sc }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                  gradingForm.lr === sc ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] border border-purple-200 hover:bg-purple-50'
                                }`}
                              >
                                {sc}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* GRA / Grammatical Range & Accuracy */}
                        <div className="space-y-1 bg-[#F8F6FC] p-3 rounded-2xl border border-purple-100">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-extrabold text-[#503A7A]">
                              Grammar &amp; Accuracy (GRA)
                            </label>
                            <span className="text-xs font-black text-[#6B51A5] font-mono">{gradingForm.gra}</span>
                          </div>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="9"
                            value={gradingForm.gra}
                            onChange={(e) => setGradingForm({ ...gradingForm, gra: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                          />
                          <div className="flex flex-wrap gap-1 pt-1">
                            {criteriaPresets.map((sc) => (
                              <button
                                key={sc}
                                type="button"
                                onClick={() => setGradingForm(p => ({ ...p, gra: sc }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                  gradingForm.gra === sc ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] border border-purple-200 hover:bg-purple-50'
                                }`}
                              >
                                {sc}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Feedback Comment Box */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold text-[#503A7A]">
                          Instructor Detailed Feedback:
                        </label>
                        <textarea
                          rows={3}
                          value={gradingForm.feedback}
                          onChange={(e) => setGradingForm({ ...gradingForm, feedback: e.target.value })}
                          placeholder="Provide constructive feedback, strengths, and targeted improvement points..."
                          className="w-full p-3 bg-[#F8F6FC] border border-purple-200 rounded-2xl text-xs text-[#3C2A63] font-medium placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                        />
                      </div>

                      {/* Save Score Button */}
                      <button
                        type="button"
                        onClick={handleSaveGrading}
                        disabled={loading}
                        className="w-full py-3.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-purple-950/10 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{loading ? 'Securing Grade...' : 'Save Writing Grade & Comments'}</span>
                      </button>

                    </div>

                  </div>
                );
              })()}

              {/* Task 1 Diagram Enlarge Modal */}
              {zoomDiagramUrl && (
                <div 
                  className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setZoomDiagramUrl(null)}
                >
                  <div 
                    className="bg-white rounded-3xl p-5 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col items-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-full flex items-center justify-between border-b border-purple-100 pb-3">
                      <span className="text-xs font-black text-[#3C2A63] uppercase tracking-wider">
                        Task 1 Reference Diagram ({selectedSub.exam_code})
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomDiagramUrl(null)}
                        className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <img 
                      src={zoomDiagramUrl} 
                      alt="Full diagram"
                      className="max-h-[75vh] w-auto object-contain rounded-xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-white border border-purple-100/80 rounded-3xl text-[#7C68A5] italic">
              Please select a candidate submission from the list on the left to grade their essay.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
