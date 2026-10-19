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
  Check
} from 'lucide-react';
import { CheatLog, SubmissionRecord } from '../../types';
import { 
  fetchSubmissions, 
  fetchCheatLogs, 
  deduplicateSubmissions, 
  deduplicateCheatLogs, 
  DEFAULT_API_URL,
  exportSubmissionsCSV,
  exportSubmissionsJSON,
  importSubmissionsJSON,
  syncDatabaseToSheets
} from '../../services/api';
import { formatSubmissionTime } from '../../utils/dateFormatter';
import { SubmissionDetailModal } from './SubmissionDetailModal';

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
  const [activeSubTab, setActiveTab] = useState<'submissions' | 'cheatlogs'>('submissions');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [violationThresholdFilter, setViolationThresholdFilter] = useState<'all' | 'high'>('all');
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());

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
        setSubmissions(deduplicateSubmissions(subRes.data));
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
  }, [effectiveApiUrl]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Database Actions
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await exportSubmissionsCSV(searchTerm);
      showToast('success', 'Đã xuất dữ liệu bài thi sang định dạng Excel / CSV (UTF-8) thành công!');
    } catch (err: any) {
      showToast('error', 'Lỗi khi xuất CSV: ' + (err?.message || 'Không thể xuất'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      await exportSubmissionsJSON(searchTerm);
      showToast('success', 'Đã tải toàn bộ bản sao lưu Database (.json) về máy tính!');
    } catch (err: any) {
      showToast('error', 'Lỗi khi sao lưu JSON: ' + (err?.message || 'Không thể sao lưu'));
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
      const items = Array.isArray(parsed) ? parsed : parsed?.submissions;
      if (!Array.isArray(items) || items.length === 0) {
        showToast('error', 'Tệp JSON không hợp lệ hoặc không có dữ liệu bài nộp (cần mảng submissions).');
        return;
      }

      const res = await importSubmissionsJSON(items, false);
      if (res.success) {
        showToast('success', `Đã nhập thành công ${res.imported} bài mới và cập nhật ${res.updated} bài vào database!`);
        await loadData();
      } else {
        showToast('error', res.error || 'Nhập dữ liệu thất bại.');
      }
    } catch (err: any) {
      showToast('error', 'Lỗi đọc tệp: ' + err.message);
    }
  };

  const handleSyncToSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const res = await syncDatabaseToSheets();
      if (res.success) {
        showToast('success', res.message || 'Đồng bộ Google Sheets hoàn tất!');
      } else {
        showToast('error', res.error || 'Đồng bộ Google Sheets thất bại.');
      }
    } catch (err: any) {
      showToast('error', 'Lỗi kết nối: ' + err.message);
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
  const todayCount = submissions.filter(s => (s.submitted_at || (s as any).received_at || '').startsWith(todayStr)).length;
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
            Quản lý, theo dõi giám sát và trích xuất cơ sở dữ liệu bài thi IELTS đồng bộ với máy chủ và Google Sheets.
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
            <span>{loading ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
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
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Tổng bài thi</span>
            <span className="text-xl font-black text-[#3C2A63] font-mono">{submissions.length}</span>
          </div>
        </div>

        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Nộp hôm nay</span>
            <span className="text-xl font-black text-indigo-900 font-mono">{todayCount}</span>
          </div>
        </div>

        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Writing chờ chấm</span>
            <span className="text-xl font-black text-amber-900 font-mono">
              {pendingWritingCount}{' '}
              <span className="text-xs font-normal text-[#7C68A5]">({gradedWritingCount} đã chấm)</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-purple-100/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7C68A5] block">Overall Band TB</span>
            <span className="text-xl font-black text-emerald-700 font-mono">{avgOverallBand}</span>
          </div>
        </div>
      </div>

      {/* Database Extraction & Management Toolbar */}
      <div className="bg-gradient-to-r from-purple-50 via-white to-purple-50 border border-purple-200/80 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3C2A63]">
          <Database className="w-4 h-4 text-[#6B51A5]" />
          <span>Công cụ trích xuất &amp; Lưu trữ Database:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel / CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Xuất bảng điểm ra file Excel / CSV có định dạng Tiếng Việt UTF-8"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel / CSV'}</span>
          </button>

          {/* Export Full JSON Backup */}
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExporting}
            className="px-3.5 py-2 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Tải toàn bộ cơ sở dữ liệu bài thi dưới dạng tệp JSON sao lưu"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sao lưu Database (.json)</span>
          </button>

          {/* Import / Restore JSON */}
          <button
            type="button"
            onClick={handleTriggerImport}
            className="px-3.5 py-2 bg-white hover:bg-purple-100 text-[#3C2A63] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Tải lên tệp JSON sao lưu để nhập dữ liệu bài thi vào hệ thống"
          >
            <Upload className="w-3.5 h-3.5 text-[#6B51A5]" />
            <span>Nhập / Phục hồi (.json)</span>
          </button>

          {/* Push to Google Sheets */}
          <button
            type="button"
            onClick={handleSyncToSheets}
            disabled={isSyncingSheets}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Đẩy toàn bộ bài thi đang lưu sang Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingSheets ? 'animate-spin' : ''}`} />
            <span>{isSyncingSheets ? 'Đang đồng bộ...' : 'Đẩy sang Sheets'}</span>
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
            <span>Danh sách bài thi ({submissions.length})</span>
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
            <span>Cảnh báo Giám thị ({cheatLogs.length})</span>
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
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setViolationThresholdFilter('high')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  violationThresholdFilter === 'high' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700'
                }`}
                title="Lọc thí sinh có hơn 3 lần vi phạm"
              >
                Vi phạm &gt; 3
              </button>
            </div>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#7C68A5] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo SBD, Tên, Mã đề..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-purple-200/80 rounded-2xl text-xs text-[#3C2A63] font-medium placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5] transition-all shadow-xs"
            />
          </div>

          <div className="hidden sm:flex bg-[#E2DDEC] p-1 rounded-xl">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'cards' ? 'bg-white text-[#3C2A63] shadow-xs' : 'text-[#7C68A5]'}`}
              title="Xem dạng thẻ"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white text-[#3C2A63] shadow-xs' : 'text-[#7C68A5]'}`}
              title="Xem dạng bảng"
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
                Không tìm thấy bài thi nào phù hợp với từ khóa tìm kiếm.
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
                      <span>Chi tiết</span>
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
                    <th className="py-3.5 px-4">Mã bài thi (ID)</th>
                    <th className="py-3.5 px-4">Thí sinh (SBD)</th>
                    <th className="py-3.5 px-4">Mã đề thi</th>
                    <th className="py-3.5 px-4">Listening</th>
                    <th className="py-3.5 px-4">Reading</th>
                    <th className="py-3.5 px-4">Writing</th>
                    <th className="py-3.5 px-4">Overall Band</th>
                    <th className="py-3.5 px-4">Thời gian nộp</th>
                    <th className="py-3.5 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100/60">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-[#7C68A5] italic">
                        Không tìm thấy bài thi nào phù hợp.
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
                            title="Xem chi tiết câu trả lời và bài viết"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem</span>
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
          {filteredLogs.length > 150 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Hiển thị 150 trong tổng số {filteredLogs.length} cảnh báo được ghi nhận.
              </span>
            </div>
          )}

          {/* Mobile Cards for Alerts */}
          <div className="block md:hidden space-y-3">
            {boundedLogs.length === 0 ? (
              <div className="bg-white border border-purple-100 rounded-3xl p-8 text-center text-xs text-[#7C68A5] italic">
                Không có sự cố gian lận nào được ghi nhận.
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
                          Thí sinh: {log.sbd} <span className="font-mono text-xs text-[#6B51A5]">({log.exam_code})</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#7C68A5]">{log.log_id}</span>
                      </div>

                      {log.violation_type === 'TASK1_IMAGE_ISSUE_REPORT' || log.violation_type === 'WRITING_ISSUE_REPORT' ? (
                        <div className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Flag className="w-3 h-3 text-amber-600" />
                          <span>BÁO CÁO SỰ CỐ</span>
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
                          <span>MẤT KẾT NỐI (LOST SIGNAL)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-emerald-600" />
                          <span>KẾT NỐI ỔN ĐỊNH</span>
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
                    <th className="py-3.5 px-4">Mã sự kiện</th>
                    <th className="py-3.5 px-4">Thí sinh (SBD)</th>
                    <th className="py-3.5 px-4">Mã đề thi</th>
                    <th className="py-3.5 px-4">Tình trạng kết nối</th>
                    <th className="py-3.5 px-4">Loại vi phạm</th>
                    <th className="py-3.5 px-4">Thời gian ghi nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100/60">
                  {boundedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#7C68A5] italic">
                        Không có sự cố gian lận nào được ghi nhận.
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
                                <span>MẤT KẾT NỐI (DISCONNECTED)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px]">
                                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                                <span>KẾT NỐI ỔN ĐỊNH</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {log.violation_type === 'TASK1_IMAGE_ISSUE_REPORT' || log.violation_type === 'WRITING_ISSUE_REPORT' ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px] w-fit">
                                  <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>BÁO CÁO SỰ CỐ ĐỀ THI</span>
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

      {/* Submission Detail Inspection Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
      />
    </div>
  );
};
