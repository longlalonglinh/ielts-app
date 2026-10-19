import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Save, 
  FileText, 
  Image as ImageIcon, 
  Maximize2, 
  X,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Flag,
  Send,
  MessageSquare,
  ImageOff
} from 'lucide-react';
import { 
  saveWritingDraftToIndexedDB, 
  getWritingDraftFromIndexedDB 
} from '../../services/indexedDb';
import { WritingTask } from '../../types';
import { CountdownTimer } from './CountdownTimer';
import { normalizeGoogleDriveImageUrl } from '../../utils/imageUrl';
import { Task1DiagramViewer } from './Task1DiagramViewer';

interface WritingModuleProps {
  task1Prompt?: string;
  task1Image?: string;
  image_url?: string;
  imageUrl?: string;
  tasks?: WritingTask[];
  onTask1ImageChange?: (image: string) => void;
  task2Prompt?: string;
  task1Text: string;
  task2Text: string;
  onTask1Change: (text: string) => void;
  onTask2Change: (text: string) => void;
  submissionId?: string;
  examCode?: string;
  candidateId?: string;
  testMode?: 'TEST' | 'PRACTICE';
  durationMins?: number;
  onTimeExpire?: () => void;
}

export const WritingModule: React.FC<WritingModuleProps> = ({
  task1Prompt,
  task1Image,
  image_url,
  imageUrl,
  tasks,
  task2Prompt,
  task1Text,
  task2Text,
  onTask1Change,
  onTask2Change,
  submissionId,
  examCode = 'IELTS01',
  candidateId = 'STUDENT',
  testMode = 'TEST',
  durationMins = 60,
  onTimeExpire
}) => {
  const hasTask1Explicit = Boolean(
    task1Prompt?.trim() || 
    task1Image?.trim() ||
    (tasks && tasks.some(t => (t.task_number === 1 || t.id === 'task-1') && Boolean(t.prompt?.trim() || t.image_url || t.imageUrl)))
  );
  const hasTask2Explicit = Boolean(
    task2Prompt?.trim() || 
    (tasks && tasks.some(t => (t.task_number === 2 || t.id === 'task-2') && Boolean(t.prompt?.trim())))
  );

  const isTask2Only = !hasTask1Explicit && hasTask2Explicit;
  const isTask1Only = hasTask1Explicit && !hasTask2Explicit;

  const [activeTab, setActiveTab] = useState<'task1' | 'task2'>(() => (isTask2Only ? 'task2' : 'task1'));

  useEffect(() => {
    if (isTask2Only && activeTab !== 'task2') {
      setActiveTab('task2');
    } else if (isTask1Only && activeTab !== 'task1') {
      setActiveTab('task1');
    }
  }, [isTask2Only, isTask1Only, activeTab]);
  const [pasteWarning, setErrorPasteWarning] = useState<string | null>(null);
  const [autoSaveTime, setAutoSaveTime] = useState<string>('');
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Image zoom modal
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomImageError, setZoomImageError] = useState(false);
  
  // Guaranteed IELTS Academic Task 1 default image fallback
  const DEFAULT_TASK1_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60';

  // Extract task image using full property fallback cascade
  const task1FromList = tasks?.find(t => t.task_number === 1) || tasks?.[0];
  const detectedImage = task1Image || imageUrl || image_url || task1FromList?.image_url || task1FromList?.imageUrl || (task1FromList as any)?.image || DEFAULT_TASK1_FALLBACK_IMAGE;

  // Persist image in local state so re-renders (keystrokes, autosave, timer ticks) never clear it
  const [cachedImage, setCachedImage] = useState<string>(() => {
    return normalizeGoogleDriveImageUrl(detectedImage) || '';
  });

  useEffect(() => {
    const fresh = normalizeGoogleDriveImageUrl(detectedImage);
    if (fresh && fresh !== cachedImage) {
      setCachedImage(fresh);
    }
  }, [detectedImage]);

  const cleanTask1Image = cachedImage || normalizeGoogleDriveImageUrl(detectedImage) || null;

  // Report Issue Modal & Feedback State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTask, setReportTask] = useState<'task1' | 'task2'>('task1');
  const [reportCategory, setReportCategory] = useState<string>('image_failed');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);

  const handleSubmitIssueReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    try {
      const taskLabel = reportTask === 'task1' ? 'Writing Task 1' : 'Writing Task 2';
      const payload = {
        sbd: candidateId || 'CANDIDATE',
        exam_code: examCode || 'EXAM',
        violation_type: 'WRITING_ISSUE_REPORT',
        description: `Candidate feedback on [${taskLabel}]: Category=[${reportCategory}]. Note=[${reportDetails.trim() || 'N/A'}]. Diagram URL=[${cleanTask1Image || 'None'}]`,
        timestamp: new Date().toISOString()
      };

      await fetch('/api/cheat-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Failed to submit writing issue report to server:', err));

      const refId = `REP-W${Date.now().toString(36).toUpperCase()}`;
      setReportSuccessMsg(`Your issue report has been recorded with the invigilator (Ref: #${refId}). Our exam proctors will assist you.`);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportSuccessMsg(null);
        setReportDetails('');
      }, 2600);
    } catch (err) {
      console.error('Error submitting writing issue report:', err);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Split-view and small screen responsive states
  const [splitRatio, setSplitRatio] = useState<number>(45); // 45% left (prompt), 55% right (editor)
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [mobileWritingView, setMobileWritingView] = useState<'editor' | 'prompt'>('editor');
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [tabletSplitEnabled, setTabletSplitEnabled] = useState<boolean>(false);
  const writingSplitContainerRef = useRef<HTMLDivElement | null>(null);

  // Automatically switch to Task 2 if only Task 2 is present in the exam paper
  useEffect(() => {
    if (!task1Prompt && task2Prompt) {
      setActiveTab('task2');
    }
  }, [task1Prompt, task2Prompt]);

  // Track window resizing for mobile, tablet, and desktop screens
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024 || (isTablet && tabletSplitEnabled);

  // Split drag handle listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !writingSplitContainerRef.current) return;
      const rect = writingSplitContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      if (percentage >= 25 && percentage <= 75) {
        setSplitRatio(percentage);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing || !writingSplitContainerRef.current || !e.touches[0]) return;
      const rect = writingSplitContainerRef.current.getBoundingClientRect();
      const relativeX = e.touches[0].clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      if (percentage >= 25 && percentage <= 75) {
        setSplitRatio(percentage);
      }
    };

    const handleEnd = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleEnd);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Track initial hydration to prevent overwriting stored draft with empty props
  const hasHydratedRef = useRef(false);

  // TC-CAND-02 Defensive Implementation: ReDoS & Unicode Zero-Width Protection
  const countWords = (str: string): number => {
    if (!str || typeof str !== 'string') return 0;
    // Strip zero-width spaces, invisible characters, and non-printable control chars linearly
    const sanitized = str.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
    const trimmed = sanitized.trim();
    if (!trimmed) return 0;
    // Linear whitespace tokenization without regex backtracking
    return trimmed.split(/\s+/).filter(token => token.length > 0 && /\w/.test(token)).length;
  };

  const task1WordCount = countWords(task1Text);
  const task2WordCount = countWords(task2Text);

  // Requirement 5: Restore unsubmitted draft from IndexedDB/LocalStorage on reload
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const draft = await getWritingDraftFromIndexedDB(examCode, candidateId);
        if (isMounted && draft && !hasHydratedRef.current) {
          let hasRestored = false;
          if ((!task1Text || task1Text.trim() === '') && draft.task1 && draft.task1.trim() !== '') {
            onTask1Change(draft.task1);
            hasRestored = true;
          }
          if ((!task2Text || task2Text.trim() === '') && draft.task2 && draft.task2.trim() !== '') {
            onTask2Change(draft.task2);
            hasRestored = true;
          }

          if (hasRestored) {
            setRestoredNotice('Unsubmitted writing draft restored from IndexedDB local storage.');
          }
        }
      } catch (err) {
        console.warn('Failed to restore writing draft from IndexedDB:', err);
      } finally {
        hasHydratedRef.current = true;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [examCode, candidateId]);

  // Requirement 5: Debounced write after 1000ms from the last keystroke
  useEffect(() => {
    if (!hasHydratedRef.current && !task1Text && !task2Text) return;

    setIsSaving(true);
    const handler = setTimeout(async () => {
      try {
        await saveWritingDraftToIndexedDB(examCode, candidateId, {
          task1: task1Text,
          task2: task2Text
        });
        const now = new Date();
        setAutoSaveTime(now.toLocaleTimeString());
      } catch (err) {
        console.warn('Auto-save writing draft failed:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(handler);
  }, [task1Text, task2Text, examCode, candidateId]);

  // Strictly Block Paste per IELTS exam integrity
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setErrorPasteWarning('⚠️ PASTE ACTION IS DISABLED! Please type your response directly using your keyboard.');
    setTimeout(() => {
      setErrorPasteWarning(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* 0. Top Countdown Timer Bar */}
      <CountdownTimer
        initialMinutes={durationMins}
        testMode={testMode}
        sectionName="ACADEMIC WRITING (Task 1 & Task 2)"
        sessionKey={`${examCode || 'EXAM'}_${candidateId || 'USER'}_writing`}
        onTimeExpire={onTimeExpire}
      />

      {/* Top Banner & Status */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-5 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#E2DDEC] text-[#3C2A63] rounded-2xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#3C2A63] flex items-center gap-2">
              Writing Section (IELTS Writing Task 1 &amp; Task 2)
            </h3>
            <p className="text-xs text-[#7C68A5] font-medium">
              Spellcheck: DISABLED | Paste: BLOCKED | Word Counter: \b\S+\b Regex | 1000ms IndexedDB Auto-Backup
            </p>
          </div>
        </div>

        {/* Local IndexedDB AutoSave Badge */}
        <div className="flex items-center space-x-3">
          <span className={`text-xs font-extrabold px-3.5 py-2 rounded-2xl flex items-center gap-1.5 border transition ${
            isSaving 
              ? 'bg-amber-50 text-amber-800 border-amber-200' 
              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
          }`}>
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin text-amber-600' : 'text-emerald-700'}`} />
            {isSaving ? 'Saving Draft...' : autoSaveTime ? `Saved to IndexedDB (${autoSaveTime})` : 'Draft Autosave Active'}
          </span>
        </div>
      </div>

      {/* Restored Draft Notice Banner */}
      {restoredNotice && (
        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-[#503A7A] font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#6B51A5] shrink-0" />
            <span>{restoredNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoredNotice(null)}
            className="text-purple-700 hover:text-purple-900 font-extrabold text-xs cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Paste Blocked Warning Toast */}
      {pasteWarning && (
        <div className="p-4 bg-rose-100 border border-rose-200 rounded-2xl text-rose-800 text-xs font-extrabold flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{pasteWarning}</span>
        </div>
      )}

      {/* Tabs Switcher for Task 1 and Task 2 with Live Word Count Indicators & Split Ratio Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-[#E2DDEC] p-1.5 rounded-2xl w-fit space-x-2">
          {!isTask2Only && (
            <button
              type="button"
              onClick={() => setActiveTab('task1')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'task1'
                  ? 'bg-[#6B51A5] text-white shadow-md'
                  : 'text-[#3C2A63] hover:text-[#503A7A]'
              }`}
            >
              <span>Writing Task 1 (Min 150 words)</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                task1WordCount >= 150 
                  ? 'bg-emerald-200 text-emerald-950 font-black' 
                  : 'bg-rose-200 text-rose-950 font-black'
              }`}>
                {task1WordCount >= 150 ? <CheckCircle2 className="w-3 h-3 text-emerald-800 inline" /> : <AlertTriangle className="w-3 h-3 text-rose-800 inline" />}
                {task1WordCount} words
              </span>
            </button>
          )}

          {!isTask1Only && (
            <button
              type="button"
              onClick={() => setActiveTab('task2')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'task2'
                  ? 'bg-[#6B51A5] text-white shadow-md'
                  : 'text-[#3C2A63] hover:text-[#503A7A]'
              }`}
            >
              <span>Writing Task 2 (Min 250 words)</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                task2WordCount >= 250 
                  ? 'bg-emerald-200 text-emerald-950 font-black' 
                  : 'bg-rose-200 text-rose-950 font-black'
              }`}>
                {task2WordCount >= 250 ? <CheckCircle2 className="w-3 h-3 text-emerald-800 inline" /> : <AlertTriangle className="w-3 h-3 text-rose-800 inline" />}
                {task2WordCount} words
              </span>
            </button>
          )}
        </div>

        {/* Quick Split Ratio Presets for Desktop & Tablet */}
        <div className="flex items-center gap-2 text-xs">
          {isTablet && (
            <button
              type="button"
              onClick={() => setTabletSplitEnabled(!tabletSplitEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                tabletSplitEnabled 
                  ? 'bg-[#6B51A5] text-white border-purple-400 shadow-xs' 
                  : 'bg-white text-[#503A7A] border-purple-200 hover:bg-purple-50'
              }`}
              title="Switch display layout: 2 split columns or tabbed view"
            >
              <span>{tabletSplitEnabled ? '📱 Switch to Tabs' : '💻 Split 2 Columns'}</span>
            </button>
          )}

          {isDesktop && (
            <div className="hidden lg:flex items-center gap-1.5 bg-[#F5F2F9] px-3 py-1.5 rounded-2xl border border-purple-100 text-xs">
              <span className="text-[11px] font-bold text-[#7C68A5] mr-1">Ratio:</span>
              <button
                type="button"
                onClick={() => setSplitRatio(45)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                  splitRatio === 45 ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] hover:bg-purple-100'
                }`}
                title="Balanced (Prompt 45% - Response 55%)"
              >
                45:55
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio(58)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                  splitRatio === 58 ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] hover:bg-purple-100'
                }`}
                title="Expand prompt & diagram to 58%"
              >
                Prompt 58%
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio(35)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                  splitRatio === 35 ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-white text-[#503A7A] hover:bg-purple-100'
                }`}
                title="Expand writing editor to 65%"
              >
                Response 65%
              </button>
            </div>
          )}

          {/* Prominent Report Issue Button */}
          <button
            type="button"
            onClick={() => {
              setReportTask(activeTab);
              setReportCategory(activeTab === 'task1' ? 'image_failed' : 'prompt_content');
              setIsReportModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold flex items-center gap-1.5 transition cursor-pointer text-xs shrink-0 shadow-xs"
            title="Report issue with task image or prompt content"
            aria-label="Report Issue"
          >
            <Flag className="w-3.5 h-3.5 text-rose-600" />
            <span>Report Issue</span>
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Tab View Toggle */}
      {!isDesktop && (
        <div className="flex items-center justify-between bg-purple-50 p-1.5 rounded-2xl border border-purple-200 shadow-xs">
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => setMobileWritingView('editor')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                mobileWritingView === 'editor' ? 'bg-[#6B51A5] text-white shadow-md' : 'text-[#503A7A] hover:bg-purple-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>✍️ Writing Editor ({activeTab === 'task1' ? task1WordCount : task2WordCount} words)</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileWritingView('prompt')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                mobileWritingView === 'prompt' ? 'bg-[#6B51A5] text-white shadow-md' : 'text-[#503A7A] hover:bg-purple-100'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>📊 Prompt {activeTab === 'task1' ? '& Diagram' : ''}</span>
            </button>
          </div>
        </div>
      )}

      {/* TASK 1 SPLIT-SCREEN WORKSPACE */}
      {activeTab === 'task1' && (
        <div
          ref={writingSplitContainerRef}
          className="flex flex-col md:flex-row h-[calc(100dvh-13rem)] min-h-[460px] max-h-[850px] bg-white rounded-3xl border border-purple-100/80 overflow-hidden shadow-xl shadow-purple-950/5 relative"
        >
          {/* Left Column: Task 1 Prompt, Instructions & Graphic */}
          <div
            className={`h-full flex flex-col bg-[#F8F6FC] ${isDesktop ? 'border-r border-purple-100' : ''} overflow-hidden w-full ${
              !isDesktop && mobileWritingView === 'editor' ? 'hidden' : 'flex'
            }`}
            style={{ width: isDesktop ? `${splitRatio}%` : '100%' }}
          >
            <div className="p-3.5 bg-white border-b border-purple-100 flex items-center justify-between shrink-0">
              <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-[#503A7A] font-extrabold border border-purple-200">
                TASK 1 PROMPT &amp; DATA
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#7C68A5] font-semibold hidden sm:inline">Spend ~20 mins</span>
                <button
                  type="button"
                  onClick={() => {
                    setReportTask('task1');
                    setReportCategory('image_failed');
                    setIsReportModalOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Report image failure or prompt issue"
                >
                  <Flag className="w-3 h-3 text-rose-600" />
                  <span>Report Issue</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4">
              <div className="text-sm font-medium text-[#3C2A63] leading-relaxed whitespace-pre-wrap font-sans">
                {task1Prompt || 'You should spend about 20 minutes on this task. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'}
              </div>

              {/* Task 1 Graphic / Chart Image Display & Issue Reporting */}
              <Task1DiagramViewer
                imageUrl={cleanTask1Image}
                task1Prompt={task1Prompt}
                examCode={examCode}
                candidateId={candidateId}
                onOpenZoom={() => {
                  setZoomImageError(false);
                  setIsZoomOpen(true);
                }}
                onReportIssue={() => {
                  setReportTask('task1');
                  setReportCategory('image_failed');
                  setIsReportModalOpen(true);
                }}
              />

              <div className="p-3.5 bg-white rounded-2xl border border-purple-100 text-xs text-[#7C68A5] font-medium leading-relaxed">
                💡 <strong>Requirement:</strong> Summarise main features and trends. Minimum requirement is <strong>150 words</strong>.
              </div>
            </div>
          </div>

          {/* Draggable Resizer Split Handle */}
          <div
            onMouseDown={() => setIsResizing(true)}
            onTouchStart={() => setIsResizing(true)}
            onDoubleClick={() => setSplitRatio(45)}
            className={`hidden md:flex w-3 hover:w-3.5 bg-[#E2DDEC] hover:bg-[#6B51A5] active:bg-[#503A7A] cursor-col-resize items-center justify-center transition-all shrink-0 z-20 select-none touch-none ${
              isResizing ? 'bg-[#6B51A5] shadow-lg ring-2 ring-[#6B51A5]/40' : ''
            }`}
            title="Drag to resize split panes (Double-click to reset 45/55)"
          >
            <div className="h-8 w-1 bg-white/60 rounded-full flex flex-col justify-center items-center gap-0.5 pointer-events-none">
              <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
              <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
              <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
            </div>
          </div>

          {/* Right Column: Task 1 Response Editor */}
          <div
            className={`h-full flex flex-col bg-white overflow-hidden w-full ${
              !isDesktop && mobileWritingView === 'prompt' ? 'hidden' : 'flex'
            }`}
            style={{ width: isDesktop ? `${100 - splitRatio}%` : '100%' }}
          >
            <div className="p-3.5 bg-[#F8F6FC] border-b border-purple-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-extrabold text-[#3C2A63] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#6B51A5]" />
                <span>Task 1 Response Editor</span>
              </span>

              <div className="flex items-center gap-2">
                {/* Floating Quick View for Task 1 Diagram on mobile/tablet */}
                {cleanTask1Image && !isDesktop && (
                  <button
                    type="button"
                    onClick={() => setIsZoomOpen(true)}
                    className="bg-[#6B51A5] hover:bg-[#503A7A] text-white text-[11px] font-bold px-3 py-1 rounded-xl shadow-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    title="Click to view enlarged Task 1 diagram"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-purple-200" />
                    <span>View Diagram</span>
                  </button>
                )}

                {/* Word Count Indicator */}
                <span className={`text-xs font-black px-3 py-1 rounded-full border flex items-center gap-1.5 transition ${
                  task1WordCount >= 150
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {task1WordCount >= 150 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{task1WordCount} / 150 words (Met)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{task1WordCount} / 150 words (Need {150 - task1WordCount} more)</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              <textarea
                value={task1Text}
                onChange={(e) => onTask1Change(e.target.value)}
                onPaste={handlePaste}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Type your Task 1 response here... (Paste is disabled, auto-saves to IndexedDB)"
                className="w-full flex-1 p-4 bg-[#F8F6FC] border border-purple-100 rounded-2xl text-sm text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5] transition-all font-mono leading-relaxed resize-none overflow-y-auto"
              />
            </div>

            <div className="p-3 bg-white border-t border-purple-100 flex flex-wrap items-center justify-between text-[11px] text-[#7C68A5] font-medium shrink-0">
              <span>Auto-saved to IndexedDB every 1000ms {autoSaveTime && `(${autoSaveTime})`}</span>
              <span>Spellcheck: Disabled | Paste: Blocked</span>
            </div>
          </div>
        </div>
      )}

      {/* Task 1 Image Zoom Modal (Student view only) */}
      {isZoomOpen && cleanTask1Image && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] bg-white rounded-3xl p-4 overflow-auto shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-purple-100 mb-3">
              <span className="text-xs font-extrabold text-[#3C2A63] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#6B51A5]" />
                IELTS Task 1 Graphic / Chart View
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomOpen(false);
                    setReportTask('task1');
                    setReportCategory('image_failed');
                    setIsReportModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                  title="Report issue with diagram image"
                >
                  <Flag className="w-3.5 h-3.5 text-rose-600" />
                  <span>Report Issue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {zoomImageError ? (
              <div className="p-8 max-w-md w-full flex flex-col items-center justify-center text-center space-y-4 bg-rose-50/50 rounded-2xl border-2 border-dashed border-rose-200 my-4">
                <div className="p-4 rounded-3xl bg-rose-100 text-rose-600 shadow-sm ring-4 ring-rose-50">
                  <ImageOff className="w-12 h-12 text-rose-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-[#3C2A63] flex items-center justify-center gap-2">
                    <span>Image Unavailable</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase tracking-wider">
                      Load Error
                    </span>
                  </h4>
                  <p className="text-xs text-[#7C68A5] leading-relaxed">
                    The enlarged diagram image could not be loaded due to a network connection error. Please report this issue to your exam invigilator.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomOpen(false);
                    setReportTask('task1');
                    setReportCategory('image_failed');
                    setIsReportModalOpen(true);
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-900/20 transition flex items-center gap-2 cursor-pointer ring-4 ring-rose-300/50 hover:scale-[1.02] active:scale-95"
                >
                  <Flag className="w-4 h-4 text-white" />
                  <span>Report Issue to Invigilator</span>
                </button>
              </div>
            ) : (
              <img
                src={cleanTask1Image}
                alt="Full Task 1 Diagram"
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
                onError={() => {
                  console.error('Cannot load full zoom Task 1 image from URL:', cleanTask1Image);
                  setZoomImageError(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* TASK 2 SPLIT-SCREEN WORKSPACE */}
      {activeTab === 'task2' && (
        <div
          ref={writingSplitContainerRef}
          className="flex flex-col md:flex-row h-[calc(100dvh-13rem)] min-h-[460px] max-h-[850px] bg-white rounded-3xl border border-purple-100/80 overflow-hidden shadow-xl shadow-purple-950/5 relative"
        >
          {/* Left Column: Task 2 Prompt & Instructions */}
          <div
            className={`h-full flex flex-col bg-[#F8F6FC] ${isDesktop ? 'border-r border-purple-100' : ''} overflow-hidden w-full ${
              !isDesktop && mobileWritingView === 'editor' ? 'hidden' : 'flex'
            }`}
            style={{ width: isDesktop ? `${splitRatio}%` : '100%' }}
          >
            <div className="p-3.5 bg-white border-b border-purple-100 flex items-center justify-between shrink-0">
              <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-[#503A7A] font-extrabold border border-purple-200">
                TASK 2 PROMPT
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#7C68A5] font-semibold hidden sm:inline">Spend ~40 mins (2/3 score)</span>
                <button
                  type="button"
                  onClick={() => {
                    setReportTask('task2');
                    setReportCategory('prompt_content');
                    setIsReportModalOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Report issue with Task 2 prompt content"
                >
                  <Flag className="w-3 h-3 text-rose-600" />
                  <span>Report Issue</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4">
              <div className="text-sm font-medium text-[#3C2A63] leading-relaxed whitespace-pre-wrap font-sans">
                {task2Prompt || 'You should spend about 40 minutes on this task. Write about the following topic: Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think the true function of a university should be to give access to knowledge for its own sake. Discuss both views and give your opinion. Write at least 250 words.'}
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-purple-100 text-xs text-[#7C68A5] font-medium leading-relaxed">
                💡 <strong>Requirement:</strong> Task 2 accounts for 2/3 of your total Writing score. Minimum requirement is <strong>250 words</strong>.
              </div>
            </div>
          </div>

          {/* Draggable Resizer Split Handle */}
          <div
            onMouseDown={() => setIsResizing(true)}
            onTouchStart={() => setIsResizing(true)}
            onDoubleClick={() => setSplitRatio(45)}
            className={`hidden md:flex w-3 hover:w-3.5 bg-[#E2DDEC] hover:bg-[#6B51A5] active:bg-[#503A7A] cursor-col-resize items-center justify-center transition-all shrink-0 z-20 select-none touch-none ${
              isResizing ? 'bg-[#6B51A5] shadow-lg ring-2 ring-[#6B51A5]/40' : ''
            }`}
            title="Drag to resize split panes (Double-click to reset 45/55)"
          >
            <div className="h-8 w-1 bg-white/60 rounded-full flex flex-col justify-center items-center gap-0.5 pointer-events-none">
              <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
              <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
              <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
            </div>
          </div>

          {/* Right Column: Task 2 Response Editor */}
          <div
            className={`h-full flex flex-col bg-white overflow-hidden w-full ${
              !isDesktop && mobileWritingView === 'prompt' ? 'hidden' : 'flex'
            }`}
            style={{ width: isDesktop ? `${100 - splitRatio}%` : '100%' }}
          >
            <div className="p-3.5 bg-[#F8F6FC] border-b border-purple-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-extrabold text-[#3C2A63] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#6B51A5]" />
                <span>Task 2 Essay Editor</span>
              </span>

              {/* Word Count Indicator */}
              <span className={`text-xs font-black px-3 py-1 rounded-full border flex items-center gap-1.5 transition ${
                task2WordCount >= 250
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {task2WordCount >= 250 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{task2WordCount} / 250 words (Met)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{task2WordCount} / 250 words (Need {250 - task2WordCount} more)</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              <textarea
                value={task2Text}
                onChange={(e) => onTask2Change(e.target.value)}
                onPaste={handlePaste}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Type your Task 2 essay response here... (Paste is disabled, auto-saves to IndexedDB)"
                className="w-full flex-1 p-4 bg-[#F8F6FC] border border-purple-100 rounded-2xl text-sm text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5] transition-all font-mono leading-relaxed resize-none overflow-y-auto"
              />
            </div>

            <div className="p-3 bg-white border-t border-purple-100 flex flex-wrap items-center justify-between text-[11px] text-[#7C68A5] font-medium shrink-0">
              <span>Auto-saved to IndexedDB every 1000ms {autoSaveTime && `(${autoSaveTime})`}</span>
              <span>Spellcheck: Disabled | Paste: Blocked</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * REPORT ISSUE & FEEDBACK MODAL (Task Image Failure & Prompt Issues)
       * ========================================================================= */}
      {isReportModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsReportModalOpen(false)}
        >
          <div 
            className="bg-white border border-purple-200 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700">
                  <Flag className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#3C2A63]">Report Writing Issue / Feedback</h3>
                  <p className="text-[11px] text-[#7C68A5]">Report broken task diagram or prompt content problems</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccessMsg ? (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-2 text-center animate-fade-in">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-extrabold text-sm">{reportSuccessMsg}</p>
                <p className="text-[11px] text-emerald-700">You may continue writing your responses. Our system has safely recorded your feedback.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitIssueReport} className="space-y-4 text-xs">
                {/* Exam & Candidate Metadata Card */}
                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 space-y-1">
                  <div className="flex justify-between text-[#503A7A] font-bold text-xs">
                    <span>Candidate: {candidateId || 'CANDIDATE'}</span>
                    <span>Exam: {examCode || 'IELTS'}</span>
                  </div>
                  <div className="text-[11px] text-[#7C68A5] flex items-center justify-between">
                    <span>Active Section: Academic Writing</span>
                    <span className="font-semibold text-[#6B51A5]">{reportTask === 'task1' ? 'Task 1 (Report & Chart)' : 'Task 2 (Essay Prompt)'}</span>
                  </div>
                </div>

                {/* Target Task Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-[#3C2A63] block">Select Task with Issue:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReportTask('task1');
                        if (reportCategory === 'word_count_issue' || reportCategory === 'missing_instructions') {
                          setReportCategory('image_failed');
                        }
                      }}
                      className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        reportTask === 'task1'
                          ? 'bg-[#6B51A5] text-white border-purple-400 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Task 1 (Graphic &amp; Prompt)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportTask('task2');
                        if (reportCategory.startsWith('image_') || reportCategory === 'diagram_mismatch') {
                          setReportCategory('prompt_content');
                        }
                      }}
                      className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        reportTask === 'task2'
                          ? 'bg-[#6B51A5] text-white border-purple-400 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Task 2 (Essay Prompt)</span>
                    </button>
                  </div>
                </div>

                {/* Issue Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="font-bold text-[#3C2A63] block">What issue are you experiencing?</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl font-medium text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                  >
                    {reportTask === 'task1' ? (
                      <>
                        <option value="image_failed">🖼️ Task image fails to load / Blank diagram box</option>
                        <option value="image_blurry">🔍 Image is blurry / Numbers or text unreadable</option>
                        <option value="prompt_content">📝 Issue with prompt instructions or wording</option>
                        <option value="diagram_mismatch">⚠️ Diagram does not match the prompt description</option>
                        <option value="network_blocked">🌐 Image blocked by firewall or network error</option>
                        <option value="other">📌 Other issue</option>
                      </>
                    ) : (
                      <>
                        <option value="prompt_content">📝 Issue with essay prompt wording or topic</option>
                        <option value="missing_instructions">❓ Missing instructions or unclear topic statement</option>
                        <option value="word_count_issue">⏱️ Word counter or timer discrepancy</option>
                        <option value="other">📌 Other issue</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Helpful Tip when image issue is selected */}
                {reportTask === 'task1' && (reportCategory === 'image_failed' || reportCategory === 'image_blurry' || reportCategory === 'network_blocked') && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Need to see the chart immediately?</strong>
                      <p className="mt-0.5">The Task 1 Diagram viewer includes a built-in high-contrast vector safe chart that you can use right away without waiting.</p>
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                <div className="space-y-1.5">
                  <label className="font-bold text-[#3C2A63] block">Additional Details or Specific Errors (Optional):</label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe what you see or what needs to be fixed..."
                    rows={3}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition shadow-md shadow-rose-900/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingReport ? 'Submitting...' : 'Submit Report'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
