import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  RefreshCw, 
  Users, 
  FileText, 
  CheckCircle2, 
  Search, 
  Filter, 
  Clock, 
  Activity,
  LayoutList,
  Table as TableIcon,
  Wifi,
  WifiOff,
  AlertTriangle,
  Flag,
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  Eye,
  TrendingUp,
  Award,
  Layers,
  Sparkles,
  Check,
  BarChart3,
  Sliders
} from 'lucide-react';
import { CheatLog, Question, SubmissionRecord } from '../../types';
import { 
  fetchSubmissions, 
  fetchCheatLogs, 
  deduplicateSubmissions, 
  deduplicateCheatLogs, 
  DEFAULT_API_URL,
  exportSubmissionsCSV,
  exportSubmissionsJSON,
  importSubmissionsJSON,
  syncDatabaseToSheets,
  fetchServerConfig,
  saveServerConfig,
  fetchExam,
  fetchPublishedCatalog
} from '../../services/api';
import { DEFAULT_EXAMS } from '../../data/defaultExams';
import { formatSubmissionTime, toIsoDateKey } from '../../utils/dateFormatter';
import { SubmissionDetailModal } from './SubmissionDetailModal';

export interface QuestionItemAnalysisRow {
  question_id: string;
  section: string;
  question_type: string;
  question_text: string;
  correct_answer: string;
  attempts: number;
  correctCount: number;
  correctRate: number;
  difficultyLabel: 'Too Hard (<30%)' | 'Too Easy (>85%)' | 'Balanced (30-85%)';
  answerBreakdown: Array<{ answer: string; count: number; isCorrect: boolean }>;
}

function isFallbackAnswerMatch(studentAns: string, correctAns: string | string[], acceptableAnswers?: string[]): boolean {
  const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const u = norm(studentAns);
  if (!u) return false;
  const candidates = new Set<string>();
  const rawList = Array.isArray(correctAns) ? correctAns : String(correctAns || '').split(/[|\/]/);
  rawList
    .map(norm)
    .filter(Boolean)
    .forEach(c => candidates.add(c));
  if (Array.isArray(acceptableAnswers)) {
    acceptableAnswers.map(norm).filter(Boolean).forEach(c => candidates.add(c));
  }
  return candidates.has(u);
}

export function computeExamItemAnalysis(
  examCode: string,
  questions: Question[],
  submissions: SubmissionRecord[]
): QuestionItemAnalysisRow[] {
  const targetCode = String(examCode || '').trim().toUpperCase();
  const matchingSubs = submissions.filter(
    sub => String(sub?.exam_code || '').trim().toUpperCase() === targetCode
  );

  return questions.map((q) => {
    const qid = q.question_id;
    let attempts = 0;
    let correctCount = 0;
    const distMap = new Map<string, { answer: string; count: number; isCorrect: boolean }>();

    matchingSubs.forEach((sub) => {
      const anySub = sub as any;
      const detailed = sub.detailed_results?.[qid];
      const rawAns =
        detailed?.user_answer ??
        sub.listening_answers?.[qid] ??
        sub.reading_answers?.[qid] ??
        anySub.answers?.[qid] ??
        anySub.user_answers?.[qid] ??
        '';
      const cleanedAns = String(rawAns || '').trim();
      const displayAns = cleanedAns || '(Blank)';

      const isCorrect = detailed
        ? Boolean(detailed.is_correct)
        : isFallbackAnswerMatch(cleanedAns, q.correct_answer || '', q.acceptable_answers);

      attempts++;
      if (isCorrect) correctCount++;

      const key = displayAns.toUpperCase();
      const existing = distMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.isCorrect = existing.isCorrect || isCorrect;
      } else {
        distMap.set(key, { answer: displayAns, count: 1, isCorrect });
      }
    });

    const correctRate = attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0;
    const difficultyLabel: QuestionItemAnalysisRow['difficultyLabel'] =
      attempts === 0
        ? 'Balanced (30-85%)'
        : correctRate < 30
        ? 'Too Hard (<30%)'
        : correctRate > 85
        ? 'Too Easy (>85%)'
        : 'Balanced (30-85%)';

    const answerBreakdown = Array.from(distMap.values()).sort((a, b) => b.count - a.count);
    const formattedKey = Array.isArray(q.correct_answer)
      ? q.correct_answer.join(', ')
      : String(q.correct_answer || '');

    return {
      question_id: qid,
      section: q.section || 'reading',
      question_type: String(q.question_type || 'MULTIPLE_CHOICE'),
      question_text: String(q.question_text || '').trim() || `Question ${qid}`,
      correct_answer: formattedKey,
      attempts,
      correctCount,
      correctRate,
      difficultyLabel,
      answerBreakdown
    };
  });
}

interface MonitoringDashboardProps {
  apiUrl?: string;
  gasUrl?: string;
  onOpenDiagnostics?: () => void;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ 
  apiUrl, 
  gasUrl, 
  onOpenDiagnostics 
}) => {
  const effectiveApiUrl = apiUrl || gasUrl || DEFAULT_API_URL;
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [cheatLogs, setCheatLogs] = useState<CheatLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveTab] = useState<'submissions' | 'cheatlogs' | 'analysis'>('submissions');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [violationThresholdFilter, setViolationThresholdFilter] = useState<'all' | 'high'>('all');
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());

  // Proctoring Auto-Submit Policy State
  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(false);
  const [maxViolationsLimit, setMaxViolationsLimit] = useState(3);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  // Item Analysis State
  const [catalogCodes, setCatalogCodes] = useState<string[]>([]);
  const [selectedAnalysisExam, setSelectedAnalysisExam] = useState<string>('TEST01');
  const [analysisQuestions, setAnalysisQuestions] = useState<Question[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Database Management & Extraction State
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Periodically refresh current time to update 15s disconnection indicators
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeMs(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch submissions
      const subRes = await fetchSubmissions(effectiveApiUrl);
      if (subRes.success && subRes.data) {
        const deduped = deduplicateSubmissions(subRes.data);
        setSubmissions(deduped);
        if (deduped.length > 0 && deduped[0].exam_code) {
          setSelectedAnalysisExam(prev => prev || deduped[0].exam_code);
        }
      }

      // Fetch cheat logs
      const logRes = await fetchCheatLogs(effectiveApiUrl);
      if (logRes.success && logRes.data) {
        setCheatLogs(deduplicateCheatLogs(logRes.data));
      }
    } catch (err) {
      console.error('Error fetching admin monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchServerConfig().then((cfg) => {
      if (!cfg) return;
      if (typeof cfg.auto_submit_on_violation === 'boolean') {
        setAutoSubmitEnabled(cfg.auto_submit_on_violation);
      }
      if (typeof cfg.max_violations_limit === 'number' && cfg.max_violations_limit >= 1) {
        setMaxViolationsLimit(cfg.max_violations_limit);
      }
    }).catch(() => {});

    fetchPublishedCatalog({ asAdmin: true }).then((list) => {
      if (Array.isArray(list)) {
        setCatalogCodes(list.map(item => String(item.exam_code || '').toUpperCase()).filter(Boolean));
      }
    }).catch(() => {});
  }, [effectiveApiUrl]);

  // Available exam codes for Item Analysis selector
  const availableExamCodes = React.useMemo(() => {
    const codeSet = new Set<string>();
    submissions.forEach(s => {
      if (s.exam_code) codeSet.add(String(s.exam_code).trim().toUpperCase());
    });
    catalogCodes.forEach(c => codeSet.add(c));
    DEFAULT_EXAMS.forEach(d => {
      if (d.exam_code) codeSet.add(d.exam_code.toUpperCase());
    });
    return Array.from(codeSet).sort();
  }, [submissions, catalogCodes]);

  // Load questions for selected exam when Item Analysis sub-tab is active
  useEffect(() => {
    if (activeSubTab !== 'analysis' || !selectedAnalysisExam) return;
    let cancelled = false;
    setLoadingAnalysis(true);

    const extractCombinedQuestions = (exam: any): Question[] => {
      if (!exam) return [];
      const combined: Question[] = [];
      const seen = new Set<string>();
      const pushList = (qs?: Question[]) => {
        if (!Array.isArray(qs)) return;
        qs.forEach(q => {
          if (q && q.question_id && !seen.has(q.question_id)) {
            seen.add(q.question_id);
            combined.push(q);
          }
        });
      };
      pushList(exam.listening_questions);
      if (Array.isArray(exam.passages)) {
        exam.passages.forEach((p: any) => pushList(p.questions));
      }
      pushList(exam.reading_questions);
      pushList(exam.questions);
      return combined;
    };

    fetchExam(effectiveApiUrl, selectedAnalysisExam, false, { asAdmin: true })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.exam) {
          setAnalysisQuestions(extractCombinedQuestions(res.exam));
        } else {
          const fallback = DEFAULT_EXAMS.find(d => d.exam_code.toUpperCase() === selectedAnalysisExam.toUpperCase());
          setAnalysisQuestions(extractCombinedQuestions(fallback));
        }
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = DEFAULT_EXAMS.find(d => d.exam_code.toUpperCase() === selectedAnalysisExam.toUpperCase());
        setAnalysisQuestions(extractCombinedQuestions(fallback));
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalysis(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSubTab, selectedAnalysisExam, effectiveApiUrl]);

  const itemAnalysisRows = React.useMemo(
    () => computeExamItemAnalysis(selectedAnalysisExam, analysisQuestions, submissions),
    [selectedAnalysisExam, analysisQuestions, submissions]
  );

  const handleSaveProctoringPolicy = async () => {
    setIsSavingPolicy(true);
    const sanitizedLimit = Math.max(1, Math.min(20, Number(maxViolationsLimit) || 3));
    setMaxViolationsLimit(sanitizedLimit);
    try {
      const ok = await saveServerConfig({
        auto_submit_on_violation: autoSubmitEnabled,
        max_violations_limit: sanitizedLimit
      });
      if (ok) {
        showToast(
          'success',
          autoSubmitEnabled
            ? `Proctoring policy saved: Auto-submit after ${sanitizedLimit} violation(s).`
            : 'Proctoring policy saved: Warning-only mode (auto-submit disabled).'
        );
      } else {
        showToast('error', 'Unable to save proctoring policy to server (verify Admin authentication).');
      }
    } catch (err: any) {
      showToast('error', 'Failed to save proctoring policy: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Database Actions
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await exportSubmissionsCSV(searchTerm);
      showToast('success', 'Exam submissions exported to Excel / CSV (UTF-8) successfully!');
    } catch (err: any) {
      showToast('error', 'CSV export failed: ' + (err?.message || 'Unable to export'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      await exportSubmissionsJSON(searchTerm);
      showToast('success', 'Complete database backup (.json) downloaded successfully!');
    } catch (err: any) {
      showToast('error', 'JSON backup failed: ' + (err?.message || 'Unable to backup'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) 
        ? parsed 
        : Array.isArray(parsed?.submissions) 
        ? parsed.submissions 
        : (parsed && (parsed.sbd || parsed.submission_id || parsed.user_answers) ? [parsed] : null);

      if (!Array.isArray(items) || items.length === 0) {
        showToast('error', 'Invalid JSON file: missing candidate submission data.');
        return;
      }

      const res = await importSubmissionsJSON(items, false);
      if (res.success) {
        showToast('success', `Successfully imported ${res.imported} new records and updated ${res.updated} existing submissions!`);
        await loadData();
      } else {
        showToast('error', res.error || 'Failed to import submissions.');
      }
    } catch (err: any) {
      showToast('error', 'File read error: ' + err.message);
    }
  };

  const handleSyncToSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const res = await syncDatabaseToSheets();
      if (res.success) {
        showToast('success', res.message || 'Google Sheets synchronization completed!');
      } else {
        showToast('error', res.error || 'Google Sheets synchronization failed.');
      }
    } catch (err: any) {
      showToast('error', 'Connection error: ' + err.message);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const term = String(searchTerm || '').toLowerCase().trim();

  // Proctoring Metrics
  const candidateViolationsMap = new Map<string, number>();
  const candidateLastSeenMap = new Map<string, number>();

  cheatLogs.forEach(l => {
    const sbd = String(l.sbd || '').toUpperCase();
    candidateViolationsMap.set(sbd, (candidateViolationsMap.get(sbd) || 0) + 1);
    const logTime = new Date(l.timestamp || 0).getTime();
    const currentMax = candidateLastSeenMap.get(sbd) || 0;
    if (logTime > currentMax) {
      candidateLastSeenMap.set(sbd, logTime);
    }
  });

  const filteredSubmissions = submissions.filter((s) => {
    if (!term) return true;
    const sbd = String(s?.sbd ?? '').toLowerCase();
    const studentName = String(s?.student_name ?? '').toLowerCase();
    const examCode = String(s?.exam_code ?? '').toLowerCase();
    const subId = String(s?.submission_id ?? '').toLowerCase();
    return sbd.includes(term) || studentName.includes(term) || examCode.includes(term) || subId.includes(term);
  });

  const filteredLogs = cheatLogs.filter((l) => {
    const sbd = String(l?.sbd ?? '').toLowerCase();
    const cleanSbdUpper = String(l?.sbd ?? '').toUpperCase();
    const examCode = String(l?.exam_code ?? '').toLowerCase();
    const violation = String(l?.violation_type ?? '').toLowerCase();

    if (violationThresholdFilter === 'high') {
      const count = candidateViolationsMap.get(cleanSbdUpper) || 0;
      if (count <= 3) return false;
    }

    if (!term) return true;
    return sbd.includes(term) || examCode.includes(term) || violation.includes(term);
  });

  const boundedLogs = filteredLogs.slice(0, 150);

  // Database KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = submissions.filter(
    s => toIsoDateKey(s?.submitted_at ?? (s as any)?.received_at) === todayStr
  ).length;
  const gradedWritingCount = submissions.filter(s => s.writing_status === 'GRADED').length;
  const pendingWritingCount = submissions.filter(s => s.writing_status !== 'GRADED').length;
  
  const overallBands = submissions.map(s => Number(s.overall_band)).filter(b => !isNaN(b) && b > 0);
  const avgOverallBand = overallBands.length > 0 
    ? (overallBands.reduce((a, b) => a + b, 0) / overallBands.length).toFixed(1)
    : '---';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hidden File Input for JSON Database Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action Toast */}
      {actionNotice && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn shadow-lg ${
          actionNotice.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
            : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${actionNotice.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs font-black px-2 py-0.5 rounded hover:opacity-75 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Top Header & Refresh Control */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-4 sm:p-6 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#3C2A63] flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#6B51A5] shrink-0" />
            <span>Candidate Examination &amp; Database Hub</span>
          </h2>
          <p className="text-xs text-[#7C68A5] font-medium mt-1">
            Manage, monitor, and export IELTS exam records synchronized with server database and Google Sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-xs rounded-2xl shadow-xs flex items-center space-x-2 transition cursor-pointer"
            >
              <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>DB Diagnostics</span>
            </button>
          )}

          {/* Manual Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="px-5 py-2.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-purple-950/10 flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Loading...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Database KPI Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#6B51A5] flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Total Submissions</span>
            <span className="text-xl font-black text-[#3C2A63] font-mono">{submissions.length}</span>
          </div>
        </div>

        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Submitted Today</span>
            <span className="text-xl font-black text-indigo-900 font-mono">{todayCount}</span>
          </div>
        </div>

        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Writing Pending</span>
            <span className="text-xl font-black text-amber-900 font-mono">
              {pendingWritingCount}{' '}
              <span className="text-xs font-normal text-[#7C68A5]">({gradedWritingCount} graded)</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Avg Overall Band</span>
            <span className="text-xl font-black text-emerald-700 font-mono">{avgOverallBand}</span>
          </div>
        </div>
      </div>

      {/* Database Extraction & Management Toolbar */}
      <div className="bg-gradient-to-r from-purple-50 via-white to-purple-50 border border-purple-200/80 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3C2A63]">
          <Database className="w-4 h-4 text-[#6B51A5]" />
          <span>Data Extraction &amp; Database Backup:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel / CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Export score report to Excel / CSV file (UTF-8 encoding)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Excel / CSV'}</span>
          </button>

          {/* Export Full JSON Backup */}
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExporting}
            className="px-3.5 py-2 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Download complete database as a standardized JSON backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup Database (.json)</span>
          </button>

          {/* Import / Restore JSON */}
          <button
            type="button"
            onClick={handleTriggerImport}
            className="px-3.5 py-2 bg-white hover:bg-purple-100 text-[#3C2A63] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Upload a backup JSON file to import submissions into the database"
          >
            <Upload className="w-3.5 h-3.5 text-[#6B51A5]" />
            <span>Import / Restore (.json)</span>
          </button>

          {/* Push to Google Sheets */}
          <button
            type="button"
            onClick={handleSyncToSheets}
            disabled={isSyncingSheets}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Push all saved submissions to Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingSheets ? 'animate-spin' : ''}`} />
            <span>{isSyncingSheets ? 'Syncing...' : 'Push to Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Filter, Search & View Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Sub-tabs */}
        <div className="flex bg-[#E2DDEC] p-1.5 rounded-2xl space-x-1">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'submissions'
                ? 'bg-[#6B51A5] text-white shadow-md'
                : 'text-[#3C2A63] hover:text-[#503A7A]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Submission List ({submissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cheatlogs')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'cheatlogs'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-[#3C2A63] hover:text-[#503A7A]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Proctoring Alerts ({cheatLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'analysis'
                ? 'bg-indigo-700 text-white shadow-md'
                : 'text-[#3C2A63] hover:text-[#503A7A]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Item Analysis</span>
          </button>
        </div>

        {/* Search Field & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeSubTab === 'cheatlogs' && (
            <div className="flex bg-[#E2DDEC] p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setViolationThresholdFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  violationThresholdFilter === 'all' ? 'bg-white text-[#3C2A63] shadow-xs' : 'text-[#7C68A5]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setViolationThresholdFilter('high')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  violationThresholdFilter === 'high' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700'
                }`}
                title="Filter candidates with more than 3 violations"
              >
                Violations &gt; 3
              </button>
            </div>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#7C68A5] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, Name, Test Code..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-purple-200/80 rounded-2xl text-xs text-[#3C2A63] font-medium placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5] transition-all shadow-xs"
            />
          </div>

          <div className="hidden sm:flex bg-[#E2DDEC] p-1 rounded-xl">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'cards' ? 'bg-white text-[#3C2A63] shadow-xs' : 'text-[#7C68A5]'}`}
              title="Card View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white text-[#3C2A63] shadow-xs' : 'text-[#7C68A5]'}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SUBMISSIONS VIEW */}
      {activeSubTab === 'submissions' && (
        <>
          {/* Mobile Card List */}
          <div className={`${viewMode === 'table' ? 'hidden' : 'block md:hidden'} space-y-3`}>
            {filteredSubmissions.length === 0 ? (
              <div className="bg-white border border-purple-100 rounded-3xl p-8 text-center text-xs text-[#7C68A5] italic">
                No exam submissions match your search query.
              </div>
            ) : (
              filteredSubmissions.map((sub, idx) => (
                <div 
                  key={`${sub.submission_id || 'sub'}-${idx}`}
                  className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-[#3C2A63] flex items-center gap-1.5">
                        <span>SBD: {sub.sbd}</span>
                        {sub.student_name && <span className="font-normal text-xs text-[#7C68A5]">({sub.student_name})</span>}
                        <span className="text-xs font-mono font-bold text-[#6B51A5]">[{sub.exam_code}]</span>
                      </div>
                      <div className="text-[11px] font-mono text-[#7C68A5] truncate max-w-[200px]">
                        ID: {sub.submission_id}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border shrink-0 ${
                        sub.writing_status === 'GRADED'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {sub.writing_status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#F8F6FC] p-2.5 rounded-xl border border-purple-100/60 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Listening:</span>
                      <strong className="text-emerald-700 font-extrabold">
                        {sub.listening_score ?? sub.listening_raw_score ?? 0}/40
                      </strong>
                      {sub.listening_band !== undefined && (
                        <span className="block text-[10px] text-emerald-600 font-bold">B: {sub.listening_band}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Reading:</span>
                      <strong className="text-[#6B51A5] font-extrabold">
                        {sub.reading_score ?? sub.reading_raw_score ?? 0}/40
                      </strong>
                      {sub.reading_band !== undefined && (
                        <span className="block text-[10px] text-[#6B51A5] font-bold">B: {sub.reading_band}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Overall:</span>
                      <strong className="text-amber-800 font-black text-sm">
                        {sub.overall_band !== undefined ? Number(sub.overall_band).toFixed(1) : '---'}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#7C68A5] pt-1 border-t border-purple-50">
                    <div className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#6B51A5] shrink-0" />
                      <span>{formatSubmissionTime(sub)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSubmission(sub)}
                      className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-[#3C2A63] font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#6B51A5]" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Table View */}
          <div className={`${viewMode === 'cards' ? 'hidden md:block' : 'block'} bg-white border border-purple-100/80 rounded-3xl overflow-hidden shadow-xl shadow-purple-950/5`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#3C2A63]">
                <thead className="bg-[#F8F6FC] border-b border-purple-100 text-[#503A7A] font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Submission ID</th>
                    <th className="py-3.5 px-4">Candidate (SBD)</th>
                    <th className="py-3.5 px-4">Exam Code</th>
                    <th className="py-3.5 px-4">Listening</th>
                    <th className="py-3.5 px-4">Reading</th>
                    <th className="py-3.5 px-4">Writing</th>
                    <th className="py-3.5 px-4">Overall Band</th>
                    <th className="py-3.5 px-4">Submission Time</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100/60">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-[#7C68A5] italic">
                        No submissions found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, idx) => (
                      <tr key={`${sub.submission_id || 'sub'}-row-${idx}`} className="hover:bg-[#F8F6FC] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#6B51A5]">
                          {sub.submission_id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#3C2A63]">{sub.sbd}</div>
                          {sub.student_name && <div className="text-[11px] text-[#7C68A5] font-normal">{sub.student_name}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold">{sub.exam_code}</span>
                          <span className="block text-[10px] text-[#7C68A5] uppercase font-mono">{sub.test_mode || 'TEST'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-emerald-700">
                            {sub.listening_score ?? sub.listening_raw_score ?? 0} / 40
                          </span>
                          {sub.listening_band !== undefined && (
                            <span className="block text-[10px] font-bold text-emerald-600">Band {sub.listening_band}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-[#6B51A5]">
                            {sub.reading_score ?? sub.reading_raw_score ?? 0} / 40
                          </span>
                          {sub.reading_band !== undefined && (
                            <span className="block text-[10px] font-bold text-[#6B51A5]">Band {sub.reading_band}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            sub.writing_status === 'GRADED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}>
                            {sub.writing_status || 'PENDING_TEACHER'}
                          </span>
                          {sub.writing_band !== undefined && (
                            <span className="block text-[10px] font-bold text-amber-900 mt-0.5">Band {sub.writing_band}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {sub.overall_band !== undefined ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs font-mono">
                              {Number(sub.overall_band).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono">---</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#503A7A] font-semibold">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200/60 text-xs font-mono text-[#503A7A]">
                            <Clock className="w-3 h-3 text-[#6B51A5] shrink-0" />
                            <span>{formatSubmissionTime(sub)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="px-3 py-1.5 bg-purple-100 hover:bg-[#6B51A5] hover:text-white text-[#3C2A63] font-bold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="View detailed responses and essay text"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CHEAT LOGS VIEW */}
      {activeSubTab === 'cheatlogs' && (
        <>
          {/* Proctoring Auto-Submit Policy Controls */}
          <div className="bg-white border border-rose-200/80 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#3C2A63]">Proctoring Enforcement Policy (TEST Mode)</h3>
                <p className="text-xs text-[#7C68A5]">
                  Optionally force-submit a candidate&apos;s exam automatically when tab-switch/blur violations reach the configured threshold.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F6FC] border border-purple-200 cursor-pointer text-xs font-bold text-[#3C2A63]">
                <input
                  type="checkbox"
                  checked={autoSubmitEnabled}
                  onChange={(e) => setAutoSubmitEnabled(e.target.checked)}
                  className="rounded border-purple-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Auto-Submit on Excess Violations</span>
              </label>

              <div className="flex items-center gap-2 text-xs font-bold text-[#503A7A]">
                <span>Max Limit:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxViolationsLimit}
                  onChange={(e) => setMaxViolationsLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2.5 py-1.5 bg-[#F8F6FC] border border-purple-200 rounded-xl text-center font-mono font-bold text-[#3C2A63]"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProctoringPolicy}
                disabled={isSavingPolicy}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingPolicy ? 'Saving...' : 'Save Policy'}</span>
              </button>
            </div>
          </div>

          {filteredLogs.length > 150 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Displaying 150 of {filteredLogs.length} total recorded proctoring alerts.
              </span>
            </div>
          )}

          {/* Mobile Cards for Alerts */}
          <div className="block md:hidden space-y-3">
            {boundedLogs.length === 0 ? (
              <div className="bg-white border border-purple-100 rounded-3xl p-8 text-center text-xs text-[#7C68A5] italic">
                No proctoring violation incidents recorded.
              </div>
            ) : (
              boundedLogs.map((log, idx) => {
                const sbdUpper = String(log.sbd || '').toUpperCase();
                const lastSeen = candidateLastSeenMap.get(sbdUpper) || new Date(log.timestamp || 0).getTime();
                const isDisconnected = (currentTimeMs - lastSeen) > 15000;

                return (
                  <div 
                    key={`${log.log_id || 'log'}-${idx}`}
                    className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-[#3C2A63]">
                          Candidate: {log.sbd} <span className="font-mono text-xs text-[#6B51A5]">({log.exam_code})</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#7C68A5]">{log.log_id}</span>
                      </div>

                      {log.violation_type === 'TASK1_IMAGE_ISSUE_REPORT' || log.violation_type === 'WRITING_ISSUE_REPORT' ? (
                        <div className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Flag className="w-3 h-3 text-amber-600" />
                          <span>ISSUE REPORT</span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          <span>{log.violation_type}</span>
                        </div>
                      )}
                    </div>

                    {log.description && (
                      <div className="p-2 rounded-xl bg-purple-50/70 border border-purple-100 text-[11px] text-[#503A7A]">
                        {log.description}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {isDisconnected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <WifiOff className="w-3 h-3 text-rose-600" />
                          <span>LOST SIGNAL</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-emerald-600" />
                          <span>CONNECTION STABLE</span>
                        </span>
                      )}

                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#503A7A]">
                        <Clock className="w-3.5 h-3.5 text-[#6B51A5]" />
                        <span>{formatSubmissionTime(log)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-purple-100/80 rounded-3xl overflow-hidden shadow-xl shadow-purple-950/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#3C2A63]">
                <thead className="bg-[#F8F6FC] border-b border-purple-100 text-[#503A7A] font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Event ID</th>
                    <th className="py-3.5 px-4">Candidate (SBD)</th>
                    <th className="py-3.5 px-4">Exam Code</th>
                    <th className="py-3.5 px-4">Connection Status</th>
                    <th className="py-3.5 px-4">Incident / Violation</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100/60">
                  {boundedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#7C68A5] italic">
                        No proctoring violation incidents recorded.
                      </td>
                    </tr>
                  ) : (
                    boundedLogs.map((log, idx) => {
                      const sbdUpper = String(log.sbd || '').toUpperCase();
                      const lastSeen = candidateLastSeenMap.get(sbdUpper) || new Date(log.timestamp || 0).getTime();
                      const isDisconnected = (currentTimeMs - lastSeen) > 15000;

                      return (
                        <tr key={`${log.log_id || 'log'}-row-${idx}`} className="hover:bg-[#F8F6FC] transition-colors">
                          <td className="py-3 px-4 font-mono text-[#7C68A5]">{log.log_id}</td>
                          <td className="py-3 px-4 font-bold text-[#3C2A63]">{log.sbd}</td>
                          <td className="py-3 px-4 font-medium">{log.exam_code}</td>
                          <td className="py-3 px-4">
                            {isDisconnected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
                                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                                <span>DISCONNECTED</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px]">
                                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                                <span>CONNECTION STABLE</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {log.violation_type === 'TASK1_IMAGE_ISSUE_REPORT' || log.violation_type === 'WRITING_ISSUE_REPORT' ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px] w-fit">
                                  <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>EXAM ISSUE REPORT</span>
                                </span>
                                {log.description && (
                                  <span className="text-[10px] font-normal text-[#7C68A5] max-w-xs truncate">
                                    {log.description}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-rose-700">
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                <span>{log.violation_type}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#503A7A] font-semibold">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200/60 text-xs font-mono text-[#503A7A]">
                              <Clock className="w-3 h-3 text-[#6B51A5] shrink-0" />
                              <span>{formatSubmissionTime(log)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ITEM ANALYSIS VIEW */}
      {activeSubTab === 'analysis' && (
        <div className="space-y-4">
          <div className="bg-white border border-purple-100/80 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700 shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#3C2A63]">Per-Question Item Analysis &amp; Distractor Breakdown</h3>
                <p className="text-xs text-[#7C68A5]">
                  Identify overly difficult (&lt;30%) or too easy (&gt;85%) questions and inspect candidate answer distribution.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-bold text-[#503A7A]">Exam Code:</label>
              <select
                value={selectedAnalysisExam}
                onChange={(e) => setSelectedAnalysisExam(e.target.value)}
                className="px-3.5 py-2 bg-[#F8F6FC] border border-purple-200 rounded-xl text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {availableExamCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingAnalysis ? (
            <div className="bg-white border border-purple-100 rounded-3xl p-10 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-[#503A7A]">Analyzing question statistics for {selectedAnalysisExam}...</p>
            </div>
          ) : itemAnalysisRows.length === 0 ? (
            <div className="bg-white border border-purple-100 rounded-3xl p-10 text-center text-xs text-[#7C68A5]">
              No objective questions found for exam <strong>{selectedAnalysisExam}</strong>.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-[#7C68A5] block">Analyzed Questions</span>
                  <span className="text-xl font-black text-[#3C2A63] font-mono">{itemAnalysisRows.length}</span>
                </div>
                <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-[#7C68A5] block">Submissions Sampled</span>
                  <span className="text-xl font-black text-indigo-800 font-mono">{itemAnalysisRows[0]?.attempts || 0}</span>
                </div>
                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-rose-700 block">Too Hard (&lt;30%)</span>
                  <span className="text-xl font-black text-rose-700 font-mono">
                    {itemAnalysisRows.filter(r => r.attempts > 0 && r.correctRate < 30).length}
                  </span>
                </div>
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">Too Easy (&gt;85%)</span>
                  <span className="text-xl font-black text-emerald-700 font-mono">
                    {itemAnalysisRows.filter(r => r.attempts > 0 && r.correctRate > 85).length}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-purple-100/80 rounded-3xl overflow-hidden shadow-xl shadow-purple-950/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#3C2A63]">
                    <thead className="bg-[#F8F6FC] border-b border-purple-100 text-[#503A7A] font-extrabold uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Q#</th>
                        <th className="py-3.5 px-4">Section</th>
                        <th className="py-3.5 px-4">Question</th>
                        <th className="py-3.5 px-4">Answer Key</th>
                        <th className="py-3.5 px-4">Accuracy</th>
                        <th className="py-3.5 px-4">Difficulty</th>
                        <th className="py-3.5 px-4">Response Distribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100/60">
                      {itemAnalysisRows.map((row) => (
                        <tr key={row.question_id} className="hover:bg-[#F8F6FC] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#6B51A5] whitespace-nowrap">
                            {row.question_id}
                          </td>
                          <td className="py-3 px-4 uppercase font-bold text-[11px] text-[#503A7A]">
                            {row.section}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="line-clamp-2 font-medium text-[#3C2A63]">{row.question_text}</p>
                          </td>
                          <td className="py-3 px-4 font-mono font-extrabold text-emerald-700">
                            {row.correct_answer || '---'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.attempts === 0 ? (
                              <span className="text-[#7C68A5] italic">No attempts</span>
                            ) : (
                              <div className="space-y-1 min-w-[90px]">
                                <div className="font-mono font-black text-[#3C2A63]">
                                  {row.correctRate}% ({row.correctCount}/{row.attempts})
                                </div>
                                <div className="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      row.correctRate < 30
                                        ? 'bg-rose-500'
                                        : row.correctRate > 85
                                        ? 'bg-emerald-500'
                                        : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${row.correctRate}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                              row.attempts === 0
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : row.difficultyLabel === 'Too Hard (<30%)'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : row.difficultyLabel === 'Too Easy (>85%)'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}>
                              {row.attempts === 0 ? 'Unattempted' : row.difficultyLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {row.answerBreakdown.length === 0 ? (
                              <span className="text-[11px] text-[#7C68A5]">---</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.answerBreakdown.slice(0, 5).map((item, i) => (
                                  <span
                                    key={`${row.question_id}-dist-${i}`}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                                      item.isCorrect
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {item.answer}: {item.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Submission Detail Inspection Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
      />
    </div>
  );
};
