import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  UploadCloud, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Database, 
  Server, 
  FileSpreadsheet, 
  Sparkles, 
  Zap, 
  Clock, 
  Save, 
  ArrowRight, 
  HelpCircle,
  Headphones,
  BookOpen,
  FileText,
  ShieldCheck,
  Lock,
  Key,
  Layers,
  Inbox,
  Globe
} from 'lucide-react';
import { 
  FullDiagnosticReport, 
  runDatabaseDiagnostics, 
  seedExamToGoogleSheets 
} from '../../services/dbDiagnostics';
import { 
  extractSpreadsheetId, 
  getStoredSpreadsheetId, 
  setStoredSpreadsheetId, 
  testGvizConnection, 
  fetchExamViaGviz 
} from '../../services/gvizService';
import { 
  saveServerConfig, 
  fetchServerConfig, 
  triggerServerSheetSync, 
  fetchAppsScriptWebhookCode, 
  flushServerSubmissionsQueue 
} from '../../services/api';
import { gasScriptCodeTemplate } from '../../data/gasScriptCode';

interface DatabaseDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  initialExamCode?: string;
  onApplyExam?: (examData: any) => void;
}

export const DatabaseDiagnosticsModal: React.FC<DatabaseDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  apiUrl,
  initialExamCode = 'TEST01',
  onApplyExam
}) => {
  const [activeTab, setActiveTab] = useState<'private_sheets' | 'gviz' | 'gas'>('private_sheets');
  const [examCodeInput, setExamCodeInput] = useState(initialExamCode);

  // Private Sheets Service Account State
  const [serviceAccountJson, setServiceAccountJson] = useState<string>('');
  const [isServiceAccountConfigured, setIsServiceAccountConfigured] = useState<boolean>(false);
  const [isSyncingServerCache, setIsSyncingServerCache] = useState<boolean>(false);
  const [syncCacheResult, setSyncCacheResult] = useState<{
    success: boolean;
    message: string;
    synced_count?: number;
    latencyMs?: number;
  } | null>(null);
  const [webhookCode, setWebhookCode] = useState<string>('');
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [isFlushingQueue, setIsFlushingQueue] = useState<boolean>(false);
  const [flushQueueResult, setFlushQueueResult] = useState<{ success: boolean; count: number } | null>(null);

  // GViz Engine State
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>('');
  const [isTestingGviz, setIsTestingGviz] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [saveConfigSuccess, setSaveConfigSuccess] = useState<boolean>(false);
  const [gvizTestResult, setGvizTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
    examsFound: number;
    examData?: any;
    listeningCount?: number;
    readingCount?: number;
  } | null>(null);

  // GAS Diagnostics State
  const [isRunningGas, setIsRunningGas] = useState<boolean>(false);
  const [report, setReport] = useState<FullDiagnosticReport | null>(null);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Load configured spreadsheet ID and Service Account on mount or modal open
  useEffect(() => {
    if (!isOpen) return;
    const localId = getStoredSpreadsheetId();
    if (localId) {
      setSpreadsheetInput(localId);
    }
    fetchServerConfig().then((cfg: any) => {
      if (cfg?.spreadsheet_id) {
        setSpreadsheetInput(cfg.spreadsheet_id);
        setStoredSpreadsheetId(cfg.spreadsheet_id);
      }
      if (cfg?.is_service_account_configured) {
        setIsServiceAccountConfigured(true);
      }
    }).catch(() => {});

    fetchAppsScriptWebhookCode().then((code) => {
      if (code) setWebhookCode(code);
    }).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const extractedId = extractSpreadsheetId(spreadsheetInput);

  // --- Handlers for Private Sheets Service Account ---
  const handleSaveServiceAccount = async () => {
    setIsSavingConfig(true);
    setSaveConfigSuccess(false);
    try {
      const payload: any = {};
      if (extractedId) payload.spreadsheet_id = extractedId;
      if (serviceAccountJson.trim()) payload.service_account_json = serviceAccountJson.trim();

      const success = await saveServerConfig(payload);
      if (success) {
        setSaveConfigSuccess(true);
        if (extractedId) setStoredSpreadsheetId(extractedId);
        if (serviceAccountJson.trim()) setIsServiceAccountConfigured(true);
        setTimeout(() => setSaveConfigSuccess(false), 2500);
      }
    } catch (err) {
      console.warn('Could not save service account config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveSpreadsheetId = handleSaveServiceAccount;

  const handleTriggerCacheSync = async () => {
    setIsSyncingServerCache(true);
    setSyncCacheResult(null);
    try {
      const res = await triggerServerSheetSync(
        examCodeInput.trim() || undefined,
        extractedId || undefined
      );
      setSyncCacheResult(res);
    } catch (err: any) {
      setSyncCacheResult({
        success: false,
        message: 'Failed to trigger synchronization: ' + err.message
      });
    } finally {
      setIsSyncingServerCache(false);
    }
  };

  const handleCopyWebhookScript = () => {
    if (!webhookCode) return;
    navigator.clipboard.writeText(webhookCode).then(() => {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
    });
  };

  const handleFlushSubmissions = async () => {
    setIsFlushingQueue(true);
    setFlushQueueResult(null);
    try {
      const res = await flushServerSubmissionsQueue();
      setFlushQueueResult(res);
      setTimeout(() => setFlushQueueResult(null), 3000);
    } catch (err) {
      console.warn('Failed to flush submissions queue:', err);
    } finally {
      setIsFlushingQueue(false);
    }
  };

  const handleRunGvizSpeedTest = async () => {
    if (!extractedId) {
      setGvizTestResult({
        success: false,
        latencyMs: 0,
        message: 'Please enter a valid Google Spreadsheet ID or sheet URL before testing.',
        examsFound: 0
      });
      return;
    }

    setIsTestingGviz(true);
    setGvizTestResult(null);

    try {
      // 1. Connection check & exams count
      const connResult = await testGvizConnection(extractedId);

      // 2. Sample exam fetch for target exam code
      const targetCode = examCodeInput.trim() || 'TEST01';
      const examResult = await fetchExamViaGviz(extractedId, targetCode);

      const effectiveLatency = examResult.latencyMs || connResult.latencyMs;

      if (examResult.success && examResult.exam) {
        const exam = examResult.exam;
        const listeningCount = (exam.listening_questions || []).length;
        const readingCount = (exam.reading_questions || []).length;

        setGvizTestResult({
          success: true,
          latencyMs: effectiveLatency,
          message: `GViz connection successful! Fully extracted exam [${targetCode}] in ${effectiveLatency}ms.`,
          examsFound: connResult.examsFound || 1,
          examData: exam,
          listeningCount,
          readingCount
        });
      } else if (connResult.success) {
        setGvizTestResult({
          success: true,
          latencyMs: connResult.latencyMs,
          message: `${connResult.message}. Note: Exam code [${targetCode}] was not found in EXAMS tab.`,
          examsFound: connResult.examsFound
        });
      } else {
        setGvizTestResult({
          success: false,
          latencyMs: connResult.latencyMs,
          message: connResult.message,
          examsFound: 0
        });
      }
    } catch (err: any) {
      setGvizTestResult({
        success: false,
        latencyMs: 0,
        message: `GViz connection error: ${err.message || 'Unable to access Google Sheets.'}`,
        examsFound: 0
      });
    } finally {
      setIsTestingGviz(false);
    }
  };

  const handleApplyGvizExamToApp = () => {
    if (gvizTestResult?.examData && onApplyExam) {
      onApplyExam(gvizTestResult.examData);
      onClose();
    }
  };

  // --- Handlers for GAS ---
  const handleRunGasDiagnostics = async () => {
    setIsRunningGas(true);
    setSeedResult(null);
    try {
      const res = await runDatabaseDiagnostics(apiUrl, examCodeInput.trim() || 'TEST01');
      setReport(res);
    } catch (err: any) {
      console.error('GAS Diagnostics failed:', err);
    } finally {
      setIsRunningGas(false);
    }
  };

  const handleSeedExam = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await seedExamToGoogleSheets(apiUrl);
      setSeedResult(res);
      if (res.success) {
        setTimeout(handleRunGasDiagnostics, 1500);
      }
    } catch (err: any) {
      setSeedResult({
        success: false,
        message: err.message || 'Error uploading exam to Google Sheets.'
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(gasScriptCodeTemplate);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Database &amp; Protocol Diagnostics</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GViz &amp; GAS Edge Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Test real-time Google Sheets query speeds and diagnose REST API protocols
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 pb-0 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('private_sheets')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'private_sheets'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Private Sheets (Service Account API v4 &amp; Webhook)</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Enterprise Security
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gviz')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'gviz'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Client GViz/TQ Fast Query</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gas')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'gas'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Apps Script REST Diagnostic</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* ================================= TAB 0: PRIVATE SHEETS SERVICE ACCOUNT ================================= */}
          {activeTab === 'private_sheets' && (
            <div className="space-y-4">
              
              {/* Architecture & Security Highlights */}
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Zero-Leak Security Architecture &amp; High-Speed Cache Sync (&lt;20ms)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    isServiceAccountConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {isServiceAccountConfigured ? '🟢 Service Account Active' : '⚪ Service Account Not Configured'}
                  </span>
                </div>
                <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                  <li><strong>Private Google Sheet:</strong> Spreadsheet remains completely private (no need to enable "Anyone with the link can view").</li>
                  <li><strong>Anti-Leak Middleware:</strong> Node.js backend strips answers (`CORRECT_ANSWER`) before delivering questions to candidates. Correct answers are kept securely in server RAM.</li>
                  <li><strong>Server In-Memory Cache:</strong> Candidates fetch exam questions from RAM Cache with &lt;20ms latency instead of waiting on Google Sheets.</li>
                  <li><strong>Batched Submission Queue:</strong> Submissions are queued and batch-appended via Sheets API `values.append`, avoiding rate limiting.</li>
                </ul>
              </div>

              {/* Service Account & Spreadsheet Configuration Form */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Google Service Account &amp; Spreadsheet ID Configuration</span>
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Google Spreadsheet ID / Sheet URL:
                    </label>
                    <input
                      type="text"
                      value={spreadsheetInput}
                      onChange={(e) => setSpreadsheetInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit or spreadsheet ID"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {extractedId && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <span>Clean ID:</span>
                        <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">{extractedId}</code>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Service Account Credentials (JSON Key):
                    </label>
                    <textarea
                      rows={3}
                      value={serviceAccountJson}
                      onChange={(e) => setServiceAccountJson(e.target.value)}
                      placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      (Paste raw JSON key here or configure via server environment variable <code>GOOGLE_SERVICE_ACCOUNT_KEY</code>).
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveServiceAccount}
                      disabled={isSavingConfig}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saveConfigSuccess ? 'Saved successfully!' : 'Save Private Sheet Configuration'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Cache Sync & Webhook Trigger Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Synchronize Server In-Memory Cache (/api/sync-sheet)</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={examCodeInput}
                      onChange={(e) => setExamCodeInput(e.target.value.toUpperCase())}
                      placeholder="Exam Code (e.g. TEST01) or leave blank to sync all exams"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerCacheSync}
                    disabled={isSyncingServerCache}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingServerCache ? 'animate-spin' : ''}`} />
                    <span>{isSyncingServerCache ? 'Syncing cache...' : '⚡ Sync Server Cache Now'}</span>
                  </button>
                </div>

                {syncCacheResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    syncCacheResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}>
                    {syncCacheResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <span>{syncCacheResult.success ? 'Cache synchronized successfully!' : 'Cache sync error'}</span>
                        {syncCacheResult.latencyMs !== undefined && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ⚡ {syncCacheResult.latencyMs}ms (&lt;20ms)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-90 mt-0.5">{syncCacheResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submissions Batch Queue & Flush Control */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <Inbox className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Batch Submission Queue</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Exam submissions are batched (3s debounce / 15 submissions) before appending to SUBMISSIONS sheet to avoid rate limits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFlushSubmissions}
                  disabled={isFlushingQueue}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                  <span>{flushQueueResult ? `Appended ${flushQueueResult.count} exams!` : 'Flush Queue Now'}</span>
                </button>
              </div>

              {/* Apps Script Webhook Trigger Setup Guide */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Automatic Webhook Script (Apps Script onEdit Trigger)</span>
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Automatically notifies the server to refresh in-memory cache whenever questions are edited on Google Sheets.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyWebhookScript}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300 leading-relaxed">
                  <pre>{webhookCode || '// Loading Apps Script Webhook code from server...'}</pre>
                </div>

                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-indigo-300">How to install on your Private Google Sheet:</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                    <li>Open Google Sheets &gt; <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
                    <li>Paste the code above into a file named <code>WebhookSync.gs</code>.</li>
                    <li>Click the <strong>Triggers (Clock icon)</strong> &gt; Add trigger for function <code>installedOnEdit</code> with event type <code>On edit</code>.</li>
                  </ol>
                </div>
              </div>

            </div>
          )}

          {/* ================================= TAB 1: GVIZ ENGINE ================================= */}
          {activeTab === 'gviz' && (
            <div className="space-y-4">
              
              {/* Architecture Highlight Banner & GitHub Pages Static Mode Notice */}
              <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Running on GitHub Pages (Static Mode)</span>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    GitHub Pages Pure Static SPA
                  </span>
                </div>
                <div className="text-[11px] text-amber-200/90 leading-relaxed font-medium bg-amber-900/30 p-2.5 rounded-xl border border-amber-500/20">
                  ⚠️ <strong>Google Sheet Permission Required:</strong> The Google Sheet must be set to <strong>&quot;Anyone with the link can view&quot;</strong> so the GViz/TQ protocol can fetch questions directly in the candidate's browser without requiring a backend server.
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  The Google Visualization (`gviz/tq`) protocol queries Google C++ Edge Engines &amp; CDNs directly, loading tests at ultra-fast speeds (<strong>~50ms – 180ms</strong>) without depending on a Node.js server.
                </p>
              </div>

              {/* Spreadsheet ID Configuration Input */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Google Spreadsheet ID or Sheet URL:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={spreadsheetInput}
                      onChange={(e) => setSpreadsheetInput(e.target.value)}
                      placeholder="Paste sheet URL (https://docs.google.com/spreadsheets/d/.../edit) or ID"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <FileSpreadsheet className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                  </div>
                </div>

                {/* Extracted ID Preview & Save Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-400">Extracted ID:</span>
                    {extractedId ? (
                      <span className="font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                        {extractedId}
                      </span>
                    ) : (
                      <span className="italic text-slate-500">Not entered or invalid</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSpreadsheetId}
                    disabled={isSavingConfig}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {saveConfigSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saveConfigSuccess ? 'Saved successfully!' : 'Save Spreadsheet ID'}</span>
                  </button>
                </div>
              </div>

              {/* Speed Test Controls */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Target Exam Code:
                    </label>
                    <input
                      type="text"
                      value={examCodeInput}
                      onChange={(e) => setExamCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. TEST01, IELTS01..."
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRunGvizSpeedTest}
                    disabled={isTestingGviz || !extractedId}
                    className="w-full sm:w-auto mt-auto h-[40px] px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTestingGviz ? 'animate-spin' : ''}`} />
                    <span>{isTestingGviz ? 'Testing speed...' : 'Test GViz Connection (Speed Test)'}</span>
                  </button>
                </div>
              </div>

              {/* Speed Test Result Display */}
              {gvizTestResult && (
                <div className={`p-4 rounded-2xl border space-y-3 animate-fade-in ${
                  gvizTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {gvizTestResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                          <span>{gvizTestResult.success ? 'GViz Connected Successfully' : 'GViz Connection Failed'}</span>
                          {gvizTestResult.latencyMs > 0 && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold border ${
                              gvizTestResult.latencyMs <= 200
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                            }`}>
                              ⚡ {gvizTestResult.latencyMs}ms {gvizTestResult.latencyMs <= 200 ? '(<200ms Ultra-Fast)' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed opacity-90 mt-1">
                          {gvizTestResult.message}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 shrink-0">
                      {gvizTestResult.examsFound} exams in Sheet
                    </span>
                  </div>

                  {/* If target exam details were loaded */}
                  {gvizTestResult.examData && (
                    <div className="p-3 bg-slate-900/90 border border-emerald-500/20 rounded-xl space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between text-white font-bold">
                        <span>Exam: {gvizTestResult.examData.title || gvizTestResult.examData.exam_code}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-500/30">
                          {gvizTestResult.examData.exam_type || 'full_test'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Headphones className="w-3.5 h-3.5 text-purple-400" />
                          <span>Listening: <strong>{gvizTestResult.listeningCount || 0} questions</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                          <span>Reading: <strong>{gvizTestResult.readingCount || 0} questions</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <FileText className="w-3.5 h-3.5 text-purple-400" />
                          <span>Writing: <strong>{gvizTestResult.examData.writing_task1_prompt ? 'Available' : 'Empty'}</strong></span>
                        </div>
                      </div>

                      {onApplyExam && (
                        <div className="pt-2 border-t border-slate-800 flex justify-end">
                          <button
                            type="button"
                            onClick={handleApplyGvizExamToApp}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <span>Load exam into active session now</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step-by-step Setup Helper */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-400">
                <div className="font-bold text-slate-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>How to configure Google Sheet permissions for GViz:</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-[11px] leading-relaxed text-slate-400">
                  <li>Open your Google Sheet containing the IELTS exam data.</li>
                  <li>Click the <strong>Share</strong> button at the top-right corner.</li>
                  <li>Change access to: <strong>Anyone with the link</strong> with the role set to <strong>Viewer</strong>.</li>
                  <li>Copy the spreadsheet URL and paste it in the field above, then click <em>Save Spreadsheet ID</em>.</li>
                </ol>
              </div>

            </div>
          )}

          {/* ================================= TAB 2: GAS REST DIAGNOSTICS ================================= */}
          {activeTab === 'gas' && (
            <div className="space-y-4">
              
              {/* Diagnostic Controls */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Target Exam Code:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={examCodeInput}
                        onChange={(e) => setExamCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. TEST01, IELTS01, PRAC01..."
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-wide"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                        EXAM_CODE
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleRunGasDiagnostics}
                    disabled={isRunningGas}
                    className="w-full sm:w-auto mt-auto h-[42px] px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRunningGas ? 'animate-spin' : ''}`} />
                    <span>{isRunningGas ? 'Running checks...' : 'Run GAS Diagnostics'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">GAS URL: {apiUrl || '(Not configured)'}</span>
                </div>
              </div>

              {/* Diagnostic Results Display */}
              {report ? (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Overall Status Banner */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                    report.overallStatus === 'OPTIMAL'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : report.overallStatus === 'DEGRADED'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  }`}>
                    {report.overallStatus === 'OPTIMAL' ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                    ) : report.overallStatus === 'DEGRADED' ? (
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="text-xs font-bold uppercase tracking-wider">
                        Overall Status: {report.overallStatus}
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        {report.summary}
                      </p>
                    </div>
                  </div>

                  {/* Step by Step Breakdown */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Diagnostic Step Details</span>
                    </div>

                    <div className="space-y-2">
                      {report.steps.map((s, idx) => (
                        <div 
                          key={s.id || idx}
                          className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            {s.status === 'SUCCESS' && (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                            )}
                            {s.status === 'WARNING' && (
                              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                            )}
                            {s.status === 'ERROR' && (
                              <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold text-white text-xs">{s.title}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{s.message}</div>
                            </div>
                          </div>

                          {typeof s.durationMs === 'number' && (
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {s.durationMs}ms
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons for Auto-Fixing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleSeedExam}
                      disabled={isSeeding}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{isSeeding ? 'Uploading to Sheets...' : 'Upload Starter Pack to Sheets'}</span>
                    </button>

                    <button
                      onClick={handleCopyScript}
                      className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedScript ? 'GAS Script Copied!' : 'Copy Google Apps Script Code'}</span>
                    </button>
                  </div>

                  {seedResult && (
                    <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      seedResult.success 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {seedResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>{seedResult.message}</span>
                    </div>
                  )}

                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 space-y-3">
                  <Database className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
                  <div className="text-xs font-medium">
                    Click <strong>&quot;Run GAS Diagnostics&quot;</strong> to test connectivity with Google Apps Script Web App.
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            IELTS CBT Online Examination System &bull; Google Visualization &amp; GAS Integration
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
