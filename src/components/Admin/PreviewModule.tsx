import React, { useState, useEffect } from 'react';
import { ExamData } from '../../types';
import { 
  Eye, 
  Layers, 
  Clock, 
  Headphones, 
  BookOpen, 
  FileText, 
  CheckCircle, 
  Download, 
  Sparkles, 
  Music, 
  Check, 
  Image as ImageIcon,
  Sliders,
  Zap,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Save as SaveIcon
} from 'lucide-react';
import { VisualExamBuilder } from './VisualExamBuilder';
import { saveExamToIndexedDB } from '../../services/indexedDb';
import { saveExamToServerDb, saveServerConfig, fetchServerConfig } from '../../services/api';
import { 
  getStoredSpreadsheetId, 
  setStoredSpreadsheetId, 
  extractSpreadsheetId, 
  testGvizConnection,
  fetchExamViaGviz 
} from '../../services/gvizService';
import { sanitizeExamForSkills } from '../../utils/examUtils';

const BLANK_TEMPLATE: ExamData = {
  exam_code: 'NEW_EXAM',
  title: 'New IELTS Test Paper',
  exam_type: 'full_test',
  skills: ['listening', 'reading', 'writing'],
  duration_mins: 150,
  passages: [
    { passage_index: 1, title: 'Passage 1', text: '', questions: [] }
  ],
  questions: []
};

interface PreviewModuleProps {
  initialExamData?: ExamData;
  onSaveToGas?: (examData: ExamData) => void;
  gasUrl?: string;
}

export const PreviewModule: React.FC<PreviewModuleProps> = ({
  initialExamData,
  onSaveToGas,
  gasUrl
}) => {
  const currentInitial = initialExamData || BLANK_TEMPLATE;
  const [exam, setExam] = useState<ExamData>(currentInitial);
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  // GViz Speed Test State
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>('');
  const [isTestingGviz, setIsTestingGviz] = useState<boolean>(false);
  const [isSavingGvizId, setIsSavingGvizId] = useState<boolean>(false);
  const [gvizSaveSuccess, setGvizSaveSuccess] = useState<boolean>(false);
  const [gvizSpeedResult, setGvizSpeedResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
    examsFound: number;
  } | null>(null);

  useEffect(() => {
    const localId = getStoredSpreadsheetId();
    if (localId) {
      setSpreadsheetIdInput(localId);
    } else {
      fetchServerConfig().then((cfg) => {
        if (cfg?.spreadsheet_id) {
          setSpreadsheetIdInput(cfg.spreadsheet_id);
          setStoredSpreadsheetId(cfg.spreadsheet_id);
        }
      }).catch(() => {});
    }
  }, []);

  const extractedSheetId = extractSpreadsheetId(spreadsheetIdInput);

  const handleSaveSpreadsheetId = async () => {
    setIsSavingGvizId(true);
    setGvizSaveSuccess(false);
    try {
      if (extractedSheetId) {
        setStoredSpreadsheetId(extractedSheetId);
        await saveServerConfig({ spreadsheet_id: extractedSheetId });
      } else {
        setStoredSpreadsheetId('');
        await saveServerConfig({ spreadsheet_id: '' });
      }
      setGvizSaveSuccess(true);
      setTimeout(() => setGvizSaveSuccess(false), 2500);
    } finally {
      setIsSavingGvizId(false);
    }
  };

  const handleRunGvizSpeedTest = async () => {
    if (!extractedSheetId) {
      setGvizSpeedResult({
        success: false,
        latencyMs: 0,
        message: 'Vui lòng nhập Google Spreadsheet ID hoặc link bảng tính hợp lệ.',
        examsFound: 0
      });
      return;
    }

    setIsTestingGviz(true);
    setGvizSpeedResult(null);

    try {
      const connResult = await testGvizConnection(extractedSheetId);
      const examResult = await fetchExamViaGviz(extractedSheetId, exam.exam_code || 'TEST01');
      const latency = examResult.latencyMs || connResult.latencyMs;

      setGvizSpeedResult({
        success: connResult.success,
        latencyMs: latency,
        message: connResult.success 
          ? `GViz phản hồi trong ${latency}ms (<200ms Edge CDN). ${connResult.examsFound} đề thi có sẵn trong sheet.`
          : connResult.message,
        examsFound: connResult.examsFound
      });
    } catch (err: any) {
      setGvizSpeedResult({
        success: false,
        latencyMs: 0,
        message: `Lỗi kết nối GViz: ${err.message}`,
        examsFound: 0
      });
    } finally {
      setIsTestingGviz(false);
    }
  };

  // Handle save from VisualExamBuilder
  const handleSaveExam = async (updatedExam: ExamData) => {
    const sanitizedExam = sanitizeExamForSkills(updatedExam);
    setExam(sanitizedExam);
    setSaveStatus('saving');

    // Dual persist in IndexedDB
    await saveExamToIndexedDB(sanitizedExam);

    // Save to Centralized Server Database so all devices can access immediately
    await saveExamToServerDb(sanitizedExam);

    // Dual persist in localStorage
    try {
      const existingRaw = localStorage.getItem('ielts_saved_exams');
      let existingList: ExamData[] = existingRaw ? JSON.parse(existingRaw) : [];
      if (!Array.isArray(existingList)) existingList = [];
      const idx = existingList.findIndex(e => e.exam_code === sanitizedExam.exam_code);
      if (idx >= 0) {
        existingList[idx] = sanitizedExam;
      } else {
        existingList.push(sanitizedExam);
      }
      localStorage.setItem('ielts_saved_exams', JSON.stringify(existingList));
      localStorage.setItem('ielts_current_exam', JSON.stringify(sanitizedExam));
    } catch (err) {
      console.warn('Could not save exam to localStorage:', err);
    }

    if (onSaveToGas) {
      onSaveToGas(sanitizedExam);
    }

    // Direct fetch to GAS if configured
    try {
      if (gasUrl && !gasUrl.includes('AKfycbx_mock')) {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'upload_exam',
            exam_data: sanitizedExam
          })
        });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('saved'); // Offline / IndexedDB fallback preserved
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(exam, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.exam_code || 'IELTS_EXAM'}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalListeningQuestions = exam.listening_questions?.length || (exam.questions || []).filter(q => q.section === 'listening').length;
  const totalReadingQuestions = (exam.passages || []).reduce((acc, p) => acc + (p.questions?.length || 0), 0) || (exam.questions || []).filter(q => q.section === 'reading').length;
  const totalPassages = exam.passages?.length || 3;

  return (
    <div className="space-y-6">
      
      {/* Top Header & Tab Navigation */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-3 py-1 rounded-full bg-purple-100 text-[#503A7A] uppercase tracking-wider">
              Administration
            </span>
            <span className="text-xs font-bold text-[#7C68A5]">
              Schema Standardized
            </span>
          </div>
          <h2 className="text-lg font-black text-[#3C2A63] mt-2 flex items-center gap-2">
            Exam Configuration: {exam.exam_code} - {exam.title}
          </h2>
          <p className="text-xs text-[#7C68A5] font-medium mt-0.5">
            Manage passages with nested questions, audio streams, and validate via Zod schema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tabs: Visual Builder Form vs Preview */}
          <div className="bg-[#E2DDEC] p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'builder'
                  ? 'bg-[#6B51A5] text-white shadow-md'
                  : 'text-[#3C2A63] hover:text-[#503A7A]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Visual Builder Form</span>
            </button>

            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-[#6B51A5] text-white shadow-md'
                  : 'text-[#3C2A63] hover:text-[#503A7A]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Overview &amp; Audit</span>
            </button>
          </div>

          <button
            onClick={handleDownloadJson}
            className="px-3.5 py-2 bg-[#F8F6FC] hover:bg-[#E2DDEC] text-[#3C2A63] border border-purple-200 rounded-2xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
            title="Download standardized JSON file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .json</span>
          </button>
        </div>
      </div>

      {/* ACTIVE TAB 1: VISUAL EXAM BUILDER (Replaces raw JSON textarea entirely) */}
      {activeTab === 'builder' && (
        <VisualExamBuilder
          initialExamData={exam}
          onSaveExam={handleSaveExam}
          isSaving={saveStatus === 'saving'}
        />
      )}

      {/* ACTIVE TAB 2: OVERVIEW & AUDIT */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          
          {/* Key Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#6B51A5]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">Exam Duration</p>
                <p className="text-base font-black text-[#3C2A63]">{exam.duration_mins || 150} mins</p>
              </div>
            </div>

            <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#6B51A5]">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">Listening Items</p>
                <p className="text-base font-black text-[#3C2A63]">{totalListeningQuestions} Questions</p>
              </div>
            </div>

            <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#6B51A5]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">Reading Items</p>
                <p className="text-base font-black text-[#3C2A63]">{totalReadingQuestions} Questions</p>
              </div>
            </div>

            <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#6B51A5]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-[#7C68A5] uppercase tracking-wider">Reading Passages</p>
                <p className="text-base font-black text-[#3C2A63]">{totalPassages} Passages</p>
              </div>
            </div>
          </div>

          {/* Google Visualization API (GViz/TQ) Edge Connection & Speed Test */}
          <div className="bg-white border border-purple-100/90 rounded-3xl p-6 shadow-xl shadow-purple-950/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-[#6B51A5] rounded-xl">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
                    <span>Google Visualization API (GViz / TQ) Connection</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Edge CDN &lt;200ms
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#7C68A5]">
                    Trích xuất trực tiếp từ Google Sheets, bypass hoàn toàn Apps Script runtime
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-8 space-y-1">
                <label className="text-[11px] font-bold text-[#503A7A] block">
                  Google Spreadsheet ID / URL:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={spreadsheetIdInput}
                    onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit hoặc Spreadsheet ID"
                    className="w-full px-3.5 py-2.5 bg-[#F8F6FC] border border-purple-200 rounded-xl text-xs font-mono text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                  />
                  <FileSpreadsheet className="w-4 h-4 text-[#7C68A5] absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="md:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSpreadsheetId}
                  disabled={isSavingGvizId}
                  className="flex-1 py-2.5 px-3 bg-[#E2DDEC] hover:bg-[#D5CEE4] text-[#3C2A63] font-bold text-xs rounded-xl border border-purple-200 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <SaveIcon className="w-3.5 h-3.5 text-[#6B51A5]" />
                  <span>{gvizSaveSuccess ? 'Đã lưu!' : 'Lưu ID'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunGvizSpeedTest}
                  disabled={isTestingGviz || !extractedSheetId}
                  className="flex-1 py-2.5 px-3 bg-[#6B51A5] hover:bg-[#583F8F] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingGviz ? 'animate-spin' : ''}`} />
                  <span>{isTestingGviz ? 'Đang test...' : 'Speed Test'}</span>
                </button>
              </div>
            </div>

            {extractedSheetId && (
              <div className="text-[11px] text-[#7C68A5] flex items-center gap-1.5">
                <span>Clean Spreadsheet ID:</span>
                <span className="font-mono text-[#503A7A] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {extractedSheetId}
                </span>
              </div>
            )}

            {gvizSpeedResult && (
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                gvizSpeedResult.success
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}>
                {gvizSpeedResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-black flex items-center gap-2">
                    <span>{gvizSpeedResult.success ? 'GViz Kết Nối Thành Công' : 'Lỗi Kết Nối GViz'}</span>
                    {gvizSpeedResult.latencyMs > 0 && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-black border ${
                        gvizSpeedResult.latencyMs <= 200
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        ⚡ {gvizSpeedResult.latencyMs}ms {gvizSpeedResult.latencyMs <= 200 ? '(<200ms)' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90">{gvizSpeedResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Reading Passages Summary Audit */}
          <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 space-y-4">
            <h3 className="text-xs font-extrabold text-[#6B51A5] uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Academic Reading Standardized Passages ({exam.passages?.length || 0})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(exam.passages || []).map((passage) => (
                <div
                  key={passage.passage_index}
                  className="p-4 bg-[#F8F6FC] rounded-2xl border border-purple-100 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#6B51A5] text-white">
                      Passage {passage.passage_index}
                    </span>
                    <span className="text-xs font-bold text-[#503A7A]">
                      {passage.questions?.length || 0} Questions
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-[#3C2A63] line-clamp-2">
                    {passage.title}
                  </h4>
                  <p className="text-[11px] text-[#7C68A5] line-clamp-3 font-serif">
                    {passage.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Stream Player */}
          {Boolean(exam.audio_url && exam.audio_url.trim()) && (
            <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 space-y-3">
              <h3 className="text-xs font-extrabold text-[#6B51A5] uppercase tracking-wider flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>Audio Stream Player: {exam.audio_title || 'IELTS Listening Audio'}</span>
              </h3>
              <audio controls className="w-full rounded-xl" src={exam.audio_url.trim()}>
                Your browser does not support audio.
              </audio>
            </div>
          )}

          {/* Writing Prompts Audit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 space-y-3">
              <h3 className="text-xs font-extrabold text-[#6B51A5] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Writing Task 1 Prompt</span>
              </h3>
              <p className="text-xs text-[#3C2A63] leading-relaxed">
                {exam.writing_task1_prompt || 'No Task 1 prompt defined.'}
              </p>
              {Boolean(exam.writing_task1_image && exam.writing_task1_image.trim()) && (
                <div className="mt-2 rounded-xl overflow-hidden border border-purple-100 max-h-40">
                  <img
                    src={exam.writing_task1_image.trim()}
                    alt="Task 1 Graph"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

            <div className="bg-white border border-purple-100/80 rounded-3xl p-6 shadow-xl shadow-purple-950/5 space-y-3">
              <h3 className="text-xs font-extrabold text-[#6B51A5] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Writing Task 2 Prompt</span>
              </h3>
              <p className="text-xs text-[#3C2A63] leading-relaxed">
                {exam.writing_task2_prompt || 'No Task 2 prompt defined.'}
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
