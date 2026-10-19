import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { LoginInstructions } from './components/Student/LoginInstructions';
import { ListeningModule } from './components/Student/ListeningModule';
import { ReadingModule } from './components/Student/ReadingModule';
import { WritingModule } from './components/Student/WritingModule';
import { ProctoringMonitor } from './components/Student/ProctoringMonitor';
import { ResultPage } from './components/Student/ResultPage';
import { SubmitConfirmationModal } from './components/Student/SubmitConfirmationModal';
import { ReloadConfirmationModal } from './components/Student/ReloadConfirmationModal';
import { ExitConfirmationModal } from './components/Student/ExitConfirmationModal';
import { SubmissionProgressModal } from './components/Student/SubmissionProgressModal';
import { MonitoringDashboard } from './components/Admin/MonitoringDashboard';
import { ManualGrading } from './components/Admin/ManualGrading';
import { UploadModule } from './components/Admin/UploadModule';
import { PreviewModule } from './components/Admin/PreviewModule';
import { PracticeDashboard } from './components/Student/Practice/PracticeDashboard';
import { CustomPracticeManager } from './components/Admin/CustomPracticeManager';
import { practiceService } from './services/practiceService';
import { ExamData, SubmissionResponse, SubmissionPayload, CheatLog, Question } from './types';
import { 
  Headphones, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  Send, 
  Wifi,
  WifiOff, 
  X,
  RefreshCw, 
  Database, 
  Code, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Eye,
  Settings,
  HelpCircle,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  ArrowLeft,
  Activity,
  Hourglass,
  AlertTriangle,
  Download
} from 'lucide-react';

import { DEFAULT_API_URL, fetchExam, prefetchExam, submitExamPayload, syncPendingSubmissions, clearExamCache, clearSessionTimers, fetchServerConfig, saveServerConfig } from './services/api';
import { gradeExamAnswers } from './services/answerScoring';
import { getCurrentAnswersFromIndexedDB, getWritingDraftFromIndexedDB, saveWritingDraftToIndexedDB, saveCurrentAnswersToIndexedDB, clearCurrentAnswersFromIndexedDB, createCandidateDraftBackup } from './services/indexedDb';
import { DEFAULT_EXAMS } from './data/defaultExams';
import { DatabaseDiagnosticsModal } from './components/Common/DatabaseDiagnosticsModal';
import { extractQuestionsFromRawResponse } from './services/dbDiagnostics';

// Default GAS URL or loaded from LocalStorage
const DEFAULT_GAS_URL = DEFAULT_API_URL;

// Sample fallback exam data if GAS endpoint is not connected yet (uses full standard IELTS exam)
const defaultTemplate = DEFAULT_EXAMS[0];
const SAMPLE_EXAM: ExamData = {
  exam_code: 'IELTS01',
  title: defaultTemplate.title,
  audio_url: defaultTemplate.audio_url,
  listening_questions: defaultTemplate.questions.filter(q => q.section === 'listening'),
  passage_title: defaultTemplate.passages?.[0]?.title || 'Reading Passage',
  passage_text: defaultTemplate.passages?.[0]?.text || '',
  passages: defaultTemplate.passages,
  reading_questions: defaultTemplate.questions.filter(q => q.section === 'reading'),
  sections: defaultTemplate.sections,
  writing_task1_prompt: defaultTemplate.writing_task1_prompt,
  writing_task1_image: defaultTemplate.writing_task1_image,
  writing_task1_image_url: defaultTemplate.writing_task1_image,
  writing_task1_imageUrl: defaultTemplate.writing_task1_image,
  writing_task2_prompt: defaultTemplate.writing_task2_prompt
};

export default function App() {
  const [activeView, setActiveView] = useState<'student' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin' || window.location.pathname.includes('admin')) {
        return 'admin';
      }
    }
    return 'student';
  });
  const [adminTab, setAdminTab] = useState<'dashboard' | 'grading' | 'upload' | 'preview' | 'gas_setup' | 'custom_practice'>('dashboard');

  useEffect(() => {
    const checkAdminQueryOrHash = () => {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('view') === 'admin' ||
        window.location.pathname.includes('admin') ||
        window.location.hash === '#admin'
      ) {
        setActiveView('admin');
      }
    };
    checkAdminQueryOrHash();
    window.addEventListener('hashchange', checkAdminQueryOrHash);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setActiveView(prev => (prev === 'admin' ? 'student' : 'admin'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', checkAdminQueryOrHash);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // GAS Web App URL
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('ielts_gas_url') || DEFAULT_GAS_URL;
  });

  // Automatically fetch centralized GAS URL from server database on mount (Cross-Device Sync)
  useEffect(() => {
    fetchServerConfig().then(cfg => {
      if (cfg && cfg.gas_url && cfg.gas_url.trim() && !cfg.gas_url.includes('mock_ielts_exam_system_gas_url')) {
        const remoteUrl = cfg.gas_url.trim();
        setGasUrl(prev => {
          if (!prev || prev === DEFAULT_GAS_URL || prev.includes('mock_ielts_exam_system_gas_url')) {
            localStorage.setItem('ielts_gas_url', remoteUrl);
            return remoteUrl;
          }
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  // Diagnostics Modal State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  // Student Flow State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sbd, setSbd] = useState('');
  const [examCode, setExamCode] = useState('');
  const [testMode, setTestMode] = useState<'TEST' | 'PRACTICE'>('TEST');
  const [submissionId, setSubmissionId] = useState('');
  const [currentModule, setCurrentModule] = useState<'listening' | 'reading' | 'writing' | 'results'>('listening');

  // Sequential progression state for TEST MODE
  const [completedSkills, setCompletedSkills] = useState<{ listening: boolean; reading: boolean; writing: boolean }>({
    listening: false,
    reading: false,
    writing: false
  });
  const [skillNotice, setSkillNotice] = useState<string | null>(null);

  // Exam Data State
  const [examData, setExamData] = useState<ExamData>(SAMPLE_EXAM);
  const [retakeMode, setRetakeMode] = useState<boolean>(false);
  const [targetSkill, setTargetSkill] = useState<'listening' | 'reading' | 'writing' | undefined>(undefined);

  // Dynamic skill presence flags (aware of One Skill Retake & single skill exams)
  const isRetake = Boolean(retakeMode || examData.retakeMode || examData.exam_type === 'one_skill' || (examData.skills && examData.skills.length === 1));
  const activeTargetSkill: 'listening' | 'reading' | 'writing' | undefined = targetSkill || examData.targetSkill || 
    (examData.skills && examData.skills.length === 1 ? (examData.skills[0] as 'listening' | 'reading' | 'writing') : undefined) ||
    ((examData.exam_code || '').toUpperCase().startsWith('WT') ? 'writing' : undefined);

  const hasListening = isRetake ? activeTargetSkill === 'listening' : ((examData.listening_questions?.length ?? 0) > 0);
  const hasReading = isRetake ? activeTargetSkill === 'reading' : (((examData.reading_questions?.length ?? 0) > 0) || ((examData.passages?.length ?? 0) > 0));
  const hasWriting = isRetake ? activeTargetSkill === 'writing' : Boolean(examData.writing_task1_prompt || examData.writing_task2_prompt);

  // Submit confirmation dialog state
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState<boolean>(false);

  // Exit confirmation modal state (Heuristic #3 & #5, Fitts's Law)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  // Flow State & Distraction-Free Mode (Csikszentmihalyi, Superhuman: Minimize Distractions)
  const [isFocusFlowMode, setIsFocusFlowMode] = useState(false);

  // Reload confirmation modal state & beforeunload protection
  const [isReloadModalOpen, setIsReloadModalOpen] = useState(false);
  const isBypassingBeforeUnloadRef = useRef(false);

  const handleConfirmReload = () => {
    setIsReloadModalOpen(false);
    isBypassingBeforeUnloadRef.current = true;
    window.location.reload();
  };

  const handleCancelReload = () => {
    setIsReloadModalOpen(false);
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    setIsLoggedIn(false);
    setSbd('');
    setExamCode('');
    setCurrentModule('listening');
    setCompletedSkills({ listening: false, reading: false, writing: false });
  };

  // Browser beforeunload protection (Accidental browser reload / close during test)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isBypassingBeforeUnloadRef.current) return;
      if (isLoggedIn && currentModule !== 'results') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLoggedIn, currentModule]);

  // Intercept keyboard reload shortcuts (F5, Ctrl+R, Cmd+R)
  useEffect(() => {
    const handleReloadKey = (e: KeyboardEvent) => {
      const isReload = 
        e.key === 'F5' || 
        ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));

      if (isReload) {
        if (isLoggedIn && currentModule !== 'results') {
          e.preventDefault();
          setIsReloadModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleReloadKey);
    return () => {
      window.removeEventListener('keydown', handleReloadKey);
    };
  }, [isLoggedIn, currentModule]);

  // Reading questions count & ids helper
  const readingQuestionsCount = (examData.passages && examData.passages.length > 0)
    ? examData.passages.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
    : (examData.reading_questions?.length ?? 0);

  const allReadingQuestionIds = (examData.passages && examData.passages.length > 0)
    ? examData.passages.flatMap(p => (p.questions || []).map(q => q.question_id))
    : (examData.reading_questions || []).map(q => q.question_id);

  const defaultInitialModule: 'listening' | 'reading' | 'writing' = hasListening 
    ? 'listening' 
    : hasReading 
    ? 'reading' 
    : 'writing';

  // Switch tabs safely based on TEST vs PRACTICE mode
  const handleSwitchTab = (targetModule: 'listening' | 'reading' | 'writing') => {
    if (targetModule === 'listening' && !hasListening) {
      setSkillNotice('ℹ️ Listening section is not included in this test paper.');
      setTimeout(() => setSkillNotice(null), 3000);
      return;
    }
    if (targetModule === 'reading' && !hasReading) {
      setSkillNotice('ℹ️ Reading section is not included in this test paper.');
      setTimeout(() => setSkillNotice(null), 3000);
      return;
    }
    if (targetModule === 'writing' && !hasWriting) {
      setSkillNotice('ℹ️ Writing section is not included in this test paper.');
      setTimeout(() => setSkillNotice(null), 3000);
      return;
    }

    if (testMode === 'PRACTICE') {
      setCurrentModule(targetModule);
      setSkillNotice(null);
      return;
    }

    // TEST MODE ENFORCEMENT
    if (targetModule === 'listening') {
      if (testMode === 'TEST' && completedSkills.listening) {
        setSkillNotice('🔒 In TEST MODE: Listening section has already been submitted and locked.');
        setTimeout(() => setSkillNotice(null), 4000);
        return;
      }
      setCurrentModule('listening');
      setSkillNotice(null);
    } else if (targetModule === 'reading') {
      if (testMode === 'TEST' && completedSkills.reading) {
        setSkillNotice('🔒 In TEST MODE: Reading section has already been submitted and locked.');
        setTimeout(() => setSkillNotice(null), 4000);
        return;
      }
      if (hasListening && !completedSkills.listening) {
        setSkillNotice('🔒 In TEST MODE: You must complete and submit the Listening section to unlock Reading!');
        setTimeout(() => setSkillNotice(null), 4000);
        return;
      }
      setCurrentModule('reading');
      setSkillNotice(null);
    } else if (targetModule === 'writing') {
      if (hasListening && !completedSkills.listening) {
        setSkillNotice('🔒 In TEST MODE: You must complete the Listening section before Writing!');
        setTimeout(() => setSkillNotice(null), 4000);
        return;
      }
      if (hasReading && !completedSkills.reading) {
        setSkillNotice('🔒 In TEST MODE: You must complete and submit the Reading section to unlock Writing!');
        setTimeout(() => setSkillNotice(null), 4000);
        return;
      }
      setCurrentModule('writing');
      setSkillNotice(null);
    }
  };

  // Section Advancement Handlers
  const handleCompleteListening = () => {
    setCompletedSkills(prev => ({ ...prev, listening: true }));
    if (hasReading) {
      setCurrentModule('reading');
      setSkillNotice('✅ Listening section submitted! Proceeding to Reading.');
    } else if (hasWriting) {
      setCompletedSkills(prev => ({ ...prev, listening: true, reading: true }));
      setCurrentModule('writing');
      setSkillNotice('✅ Listening section submitted! Proceeding directly to Writing.');
    } else {
      setSkillNotice('✅ Listening section completed! Submitting examination.');
      handleSubmitExam('STANDARD');
    }
    setTimeout(() => setSkillNotice(null), 5000);
  };

  const handleCompleteReading = () => {
    setCompletedSkills(prev => ({ ...prev, reading: true }));
    if (hasWriting) {
      setCurrentModule('writing');
      setSkillNotice('✅ Reading section submitted! Proceeding to Writing.');
    } else {
      setSkillNotice('✅ Reading section completed! Submitting examination.');
      handleSubmitExam('STANDARD');
    }
    setTimeout(() => setSkillNotice(null), 5000);
  };
  
  const handleSetExamData = (data: ExamData) => {
    const sanitizeQs = (qs: any[], prefix: string) => {
      const seen = new Set<string>();
      return qs.map((q, idx) => {
        let qid = q.question_id || `${prefix}${idx + 1}`;
        if (seen.has(qid)) {
          qid = `${qid}_dup_${idx}`;
        }
        seen.add(qid);
        return { ...q, question_id: qid };
      });
    };
    
    setExamData({
      ...data,
      listening_questions: sanitizeQs(data.listening_questions || [], 'l'),
      reading_questions: sanitizeQs(data.reading_questions || [], 'r'),
    });
  };

  const handleLaunchStudentExam = (exam: ExamData) => {
    handleSetExamData(exam);
    setExamCode(exam.exam_code);
    setTestMode(exam.test_type || 'TEST');
    setSbd(`CAND_${Math.floor(1000 + Math.random() * 9000)}`);
    setSubmissionId(`sub_${Date.now()}`);
    setUserAnswers({});
    setWritingTask1('');
    setWritingTask2('');

    const examIsRetake = Boolean(
      exam.retakeMode || 
      exam.exam_type === 'one_skill' || 
      (exam.skills && exam.skills.length === 1) ||
      (exam.exam_code || '').toUpperCase().startsWith('WT')
    );
    const examTargetSkill: 'listening' | 'reading' | 'writing' | undefined = exam.targetSkill || 
      (exam.skills && exam.skills.length === 1 ? (exam.skills[0] as 'listening' | 'reading' | 'writing') : undefined) ||
      ((exam.exam_code || '').toUpperCase().startsWith('WT') ? 'writing' : undefined);

    setRetakeMode(examIsRetake);
    setTargetSkill(examTargetSkill);

    let initialMod: 'listening' | 'reading' | 'writing' = 'listening';
    if (examIsRetake && examTargetSkill === 'writing') {
      initialMod = 'writing';
      setCompletedSkills({ listening: true, reading: true, writing: false });
    } else if (examIsRetake && examTargetSkill === 'reading') {
      initialMod = 'reading';
      setCompletedSkills({ listening: true, reading: false, writing: true });
    } else if (examIsRetake && examTargetSkill === 'listening') {
      initialMod = 'listening';
      setCompletedSkills({ listening: false, reading: true, writing: true });
    } else if (exam.listening_questions && exam.listening_questions.length > 0) {
      initialMod = 'listening';
      setCompletedSkills({ listening: false, reading: false, writing: false });
    } else if ((exam.reading_questions && exam.reading_questions.length > 0) || (exam.passages && exam.passages.length > 0)) {
      initialMod = 'reading';
      setCompletedSkills({ listening: true, reading: false, writing: false });
    } else {
      initialMod = 'writing';
      setCompletedSkills({ listening: true, reading: true, writing: false });
    }

    setCurrentModule(initialMod);
    setIsLoggedIn(true);
    setActiveView('student');
  };

  const [isLoadingExam, setIsLoadingExam] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);

  // User Responses State
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [writingTask1, setWritingTask1] = useState('');
  const [writingTask2, setWritingTask2] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const [proctoringMetrics, setProctoringMetrics] = useState({
    violationCount: 0,
    cumulativeOffScreenSeconds: 0,
    rapidSwitchCount: 0
  });

  const answeredListeningCount = Object.keys(userAnswers).filter(k => 
    (examData.listening_questions || []).some(q => q.question_id === k) && Boolean(userAnswers[k]?.trim())
  ).length;

  const answeredReadingCount = Object.keys(userAnswers).filter(k => 
    allReadingQuestionIds.includes(k) && Boolean(userAnswers[k]?.trim())
  ).length;

  const totalAnsweredQuestions = 
    (hasListening ? answeredListeningCount : 0) + 
    (hasReading ? answeredReadingCount : 0) + 
    (hasWriting && (writingTask1.trim() || writingTask2.trim()) ? 1 : 0);

  const totalPossibleQuestions = 
    (hasListening ? (examData.listening_questions?.length ?? 0) : 0) + 
    (hasReading ? readingQuestionsCount : 0) + 
    (hasWriting ? (examData.writing_task1_prompt && examData.writing_task2_prompt ? 2 : 1) : 0);

  // Submission & Retry State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForcedSubmitting, setIsForcedSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmissionResponse | null>(null);
  const [offlinePending, setOfflinePending] = useState(false);
  const [copiedGasCode, setCopiedGasCode] = useState(false);

  // Save GAS URL to LocalStorage & Central Server Database
  const handleSaveGasUrl = (url: string) => {
    setGasUrl(url);
    localStorage.setItem('ielts_gas_url', url);
    saveServerConfig(url).catch(() => {});
  };

  // Determine TEST vs PRACTICE Mode:
  // Explicit prefix overrides:
  // - PRAC, PRACTICE, WT (Writing tasks), DRILL, ON_TAP -> PRACTICE
  // - TEST, EXAM -> TEST
  // Fallback: (code % 2) math (odd = TEST, even = PRACTICE)
  const determineTestMode = (code: string): 'TEST' | 'PRACTICE' => {
    const clean = (code || '').trim().toUpperCase();
    if (clean.startsWith('PRAC') || clean.startsWith('WT') || clean.startsWith('DRILL') || clean.startsWith('ON_TAP')) {
      return 'PRACTICE';
    }
    if (clean.startsWith('TEST') || clean.startsWith('EXAM')) {
      // If code starts with TEST or EXAM, use numeric parity if digits exist
      const digits = clean.replace(/\D/g, '');
      if (digits.length > 0) {
        const numVal = parseInt(digits, 10);
        return numVal % 2 !== 0 ? 'TEST' : 'PRACTICE';
      }
      return 'TEST';
    }

    const digits = clean.replace(/\D/g, '');
    let numVal = 1;
    if (digits.length > 0) {
      numVal = parseInt(digits, 10);
    } else {
      // Sum char codes if no digits
      numVal = clean.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    }
    return numVal % 2 !== 0 ? 'TEST' : 'PRACTICE';
  };

  // Custom Practice Deck Session State
  const [isCustomPracticeSession, setIsCustomPracticeSession] = useState(false);
  const [customPracticeDeckId, setCustomPracticeDeckId] = useState('ON_TAP_01');

  // Prefetch default exams on mount for 0-second instant transition
  useEffect(() => {
    prefetchExam(gasUrl, 'IELTS01').catch(() => {});
    prefetchExam(gasUrl, 'TEST01').catch(() => {});
  }, [gasUrl]);

  // Background exam updates from Google Sheets without disrupting active test taking
  useEffect(() => {
    const handleRevalidated = (e: any) => {
      const freshExam = e.detail as ExamData;
      if (!freshExam || !freshExam.exam_code) return;
      if (isLoggedIn && examCode.toUpperCase() === freshExam.exam_code.toUpperCase()) {
        const answersCount = Object.keys(userAnswers).filter(k => userAnswers[k]?.trim()).length;
        if (answersCount === 0 && !writingTask1.trim() && !writingTask2.trim()) {
          handleSetExamData(freshExam);
          setSkillNotice(`⚡ Synchronized latest questions for [${freshExam.exam_code}] from Google Sheets.`);
          setTimeout(() => setSkillNotice(null), 5000);
        }
      }
    };

    window.addEventListener('ielts:exam-revalidated', handleRevalidated);
    return () => {
      window.removeEventListener('ielts:exam-revalidated', handleRevalidated);
    };
  }, [isLoggedIn, examCode, userAnswers, writingTask1, writingTask2]);

  // Handle Login & Load Exam with Ultra-Fast Instant Entry
  const handleLogin = async (
    sbdInput: string, 
    codeInput: string, 
    modeOrReview?: 'TEST' | 'PRACTICE' | boolean, 
    reviewPreviousParam?: boolean
  ) => {
    let chosenMode: 'TEST' | 'PRACTICE' | undefined;
    let reviewPrevious = false;
    if (typeof modeOrReview === 'string') {
      chosenMode = modeOrReview;
      reviewPrevious = !!reviewPreviousParam;
    } else if (typeof modeOrReview === 'boolean') {
      reviewPrevious = modeOrReview;
    }

    const cleanSbd = sbdInput.trim();
    const cleanCode = codeInput.trim().toUpperCase();
    clearSessionTimers(cleanCode);
    setSbd(cleanSbd);
    setExamCode(cleanCode);
    setUserAnswers({});
    setWritingTask1('');
    setWritingTask2('');
    setCompletedSkills({ listening: false, reading: false, writing: false });
    setSkillNotice(null);

    // Check if entered code corresponds to a Custom Practice Deck
    const upperCode = cleanCode;
    const allPracticeDecks = practiceService.getAllDecks();
    const isPracticeDeck = allPracticeDecks.some(d => d.deck_id.toUpperCase() === upperCode) ||
      upperCode.startsWith('ON_TAP') ||
      upperCode.startsWith('VOCAB') ||
      upperCode.startsWith('GRAMMAR') ||
      upperCode.startsWith('COMMUNICATION') ||
      upperCode.startsWith('DECK_') ||
      upperCode.startsWith('PRAC_SET');

    if (isPracticeDeck) {
      if (cleanSbd) {
        const upperSbd = cleanSbd.toUpperCase();
        if (upperSbd === 'HV01' || upperSbd === 'HV02' || upperSbd === 'HV03') {
          practiceService.setCurrentLearner(upperSbd);
        } else {
          // If the learner entered their real name
          const cur = practiceService.getCurrentLearner();
          practiceService.updateLearnerName(cur.student_id, cleanSbd);
        }
      }
      setIsCustomPracticeSession(true);
      setCustomPracticeDeckId(cleanCode);
      setIsLoggedIn(true);
      setIsLoadingExam(false);
      return;
    }

    setIsCustomPracticeSession(false);

    const mode = chosenMode || determineTestMode(cleanCode);
    setTestMode(mode);

    const subId = `${cleanSbd}_${cleanCode}_${Date.now()}`;
    setSubmissionId(subId);

    setIsLoadingExam(true);
    setLoginErrorMessage(null);

    let finalExamData: ExamData | null = null;
    let fetchErrorMessage = '';

    try {
      const fetchResult = await fetchExam(gasUrl, cleanCode);
      if (fetchResult.success && fetchResult.exam) {
        finalExamData = fetchResult.exam;
        const totalCount = (finalExamData.listening_questions?.length || 0) + (finalExamData.reading_questions?.length || 0);
        if (fetchResult.source === 'gas') {
          setSkillNotice(`✅ Successfully loaded test [${cleanCode}] from Google Sheets (${totalCount} questions).`);
        } else if (fetchResult.source === 'local' || fetchResult.source === 'idb' || fetchResult.source === 'memory') {
          setSkillNotice(`⚡ Entered exam room immediately [${cleanCode}] (${totalCount} questions).`);
        } else {
          setSkillNotice(`ℹ️ Loaded standard test package [${cleanCode}] (${totalCount} questions).`);
        }
        setTimeout(() => setSkillNotice(null), 5000);
      } else if (fetchResult.error) {
        fetchErrorMessage = fetchResult.error;
      }
    } catch (err: any) {
      console.warn('Could not fetch exam from API:', err);
      fetchErrorMessage = err?.message || 'Error loading exam from server.';
    }

    if (!finalExamData) {
      setIsLoadingExam(false);
      clearExamCache(cleanCode).catch(() => {});
      const notFoundMsg = fetchErrorMessage || `Exam not found: No test paper found for code [${cleanCode}]. Please check your test code, switch to Practice Mode if this is a writing drill (e.g. WT codes), or tap Force Resync.`;
      setLoginErrorMessage(notFoundMsg);
      setSkillNotice(`⚠️ ${notFoundMsg}`);
      setTimeout(() => setSkillNotice(null), 7000);
      return;
    }

    setLoginErrorMessage(null);
    handleSetExamData(finalExamData);
    setIsLoadingExam(false);
    setIsLoggedIn(true);

    // Synchronize One Skill Retake flags from finalExamData
    const isRetakeExam = Boolean(
      finalExamData.retakeMode || 
      finalExamData.exam_type === 'one_skill' || 
      (finalExamData.skills && finalExamData.skills.length === 1) ||
      cleanCode.startsWith('WT')
    );
    const resolvedTargetSkill: 'listening' | 'reading' | 'writing' | undefined = finalExamData.targetSkill || 
      (finalExamData.skills && finalExamData.skills.length === 1 ? (finalExamData.skills[0] as 'listening' | 'reading' | 'writing') : undefined) ||
      (cleanCode.startsWith('WT') ? 'writing' : undefined);

    setRetakeMode(isRetakeExam);
    setTargetSkill(resolvedTargetSkill);

    // Check if reviewing previous submission in Practice Mode
    if (mode === 'PRACTICE' && reviewPrevious) {
      const existingSubs = localStorage.getItem('ielts_student_submissions');
      if (existingSubs) {
        try {
          const subsArr: SubmissionResponse[] = JSON.parse(existingSubs);
          const found = subsArr.find(s => String(s?.sbd ?? '') === cleanSbd && String(s?.exam_code ?? '').toUpperCase() === cleanCode.toUpperCase());
          if (found) {
            setSubmitResult(found);
            setCurrentModule('results');
            return;
          }
        } catch (e) {}
      }
    }

    // Restore any existing answers from IndexedDB or LocalStorage
    try {
      const savedAnswers = await getCurrentAnswersFromIndexedDB(cleanCode, cleanSbd);
      if (savedAnswers && Object.keys(savedAnswers).length > 0) {
        setUserAnswers(savedAnswers);
        setSkillNotice(`🔄 Restored ${Object.keys(savedAnswers).length} previously saved answers.`);
        setTimeout(() => setSkillNotice(null), 4000);
      }
    } catch (e) {}

    // Restore writing drafts from IndexedDB
    try {
      const draft = await getWritingDraftFromIndexedDB(cleanCode, cleanSbd);
      if (draft) {
        if (draft.task1) setWritingTask1(draft.task1);
        if (draft.task2) setWritingTask2(draft.task2);
      }
    } catch (e) {}

    // Intelligently route to Listening, Reading, or Writing depending on retakeMode & available questions/tasks
    const examHasReading = (finalExamData.reading_questions && finalExamData.reading_questions.length > 0) ||
      (finalExamData.passages && finalExamData.passages.some(p => (p.questions?.length ?? 0) > 0));

    if (isRetakeExam && resolvedTargetSkill === 'writing') {
      // One Skill Retake for Writing: SKIP Listening and Reading modules completely
      setCurrentModule('writing');
      setCompletedSkills({ listening: true, reading: true, writing: false });
    } else if (isRetakeExam && resolvedTargetSkill === 'reading') {
      setCurrentModule('reading');
      setCompletedSkills({ listening: true, reading: false, writing: true });
    } else if (isRetakeExam && resolvedTargetSkill === 'listening') {
      setCurrentModule('listening');
      setCompletedSkills({ listening: false, reading: true, writing: true });
    } else if (finalExamData.listening_questions && finalExamData.listening_questions.length > 0) {
      setCurrentModule('listening');
    } else if (examHasReading) {
      setCurrentModule('reading');
      setCompletedSkills({ listening: true, reading: false, writing: false });
    } else if (finalExamData.writing_task1_prompt || finalExamData.writing_task2_prompt) {
      // Writing-only exam or practice task (e.g., WT1003)
      setCurrentModule('writing');
      setCompletedSkills({ listening: true, reading: true, writing: false });
    } else {
      setCurrentModule('reading');
    }
  };

  // Debounced auto-save of userAnswers to IndexedDB
  useEffect(() => {
    if (!isLoggedIn || !examCode || !sbd || Object.keys(userAnswers).length === 0) return;
    const timeout = setTimeout(() => {
      saveCurrentAnswersToIndexedDB(examCode, sbd, userAnswers).catch(() => {});
    }, 400);
    return () => clearTimeout(timeout);
  }, [userAnswers, examCode, sbd, isLoggedIn]);

  // Force Resync test directly from remote server and bypass local caches
  const handleForceResyncExam = async (codeToResync: string) => {
    const cleanCode = (codeToResync || examCode || 'TEST01').trim().toUpperCase();
    setIsLoadingExam(true);
    setLoginErrorMessage(null);
    setSkillNotice(`🔄 Force resyncing test [${cleanCode}] from server...`);
    try {
      await clearExamCache(cleanCode);
      const res = await fetchExam(gasUrl, cleanCode, true);
      if (res.success && res.exam) {
        handleSetExamData(res.exam);
        setSkillNotice(`✅ Successfully synchronized [${cleanCode}] fresh from Google Sheets!`);
        setTimeout(() => setSkillNotice(null), 5000);
      } else {
        const msg = res.error || `Could not find test paper [${cleanCode}] on Google Sheets.`;
        setLoginErrorMessage(msg);
        setSkillNotice(`⚠️ ${msg}`);
      }
    } catch (e: any) {
      setLoginErrorMessage(e?.message || 'Resynchronization failed.');
    } finally {
      setIsLoadingExam(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Emergency Draft Backup for Candidate (Dual Vault protection)
  const handleExportDraftBackup = async () => {
    try {
      const backup = await createCandidateDraftBackup(examCode, sbd);
      backup.answers = { ...userAnswers, ...backup.answers };
      if (writingTask1 || writingTask2) {
        backup.writing_draft = { task1: writingTask1, task2: writingTask2 };
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IELTS_DRAFT_${examCode}_${sbd}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSkillNotice('💾 Đã tải bản sao lưu bài thi (.json) về máy tính an toàn!');
      setTimeout(() => setSkillNotice(null), 4000);
    } catch (e: any) {
      setSkillNotice('⚠️ Không thể xuất bản sao lưu: ' + (e?.message || 'Lỗi'));
    }
  };

  // Submit Exam & Batching Payload (handles both STANDARD candidate click and TIMEOUT_FORCED)
  const handleSubmitExam = async (submissionType: 'STANDARD' | 'TIMEOUT_FORCED' = 'STANDARD') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (submissionType === 'TIMEOUT_FORCED') {
      setIsForcedSubmitting(true);
    }

    // Step 1: Pull the latest answers from local state and IndexedDB to guarantee nothing is missed
    let latestAnswers = { ...userAnswers };
    try {
      const idbAnswers = await getCurrentAnswersFromIndexedDB(examCode, sbd);
      if (idbAnswers && Object.keys(idbAnswers).length > 0) {
        latestAnswers = { ...idbAnswers, ...latestAnswers };
      }
    } catch (e) {
      console.warn('Could not read latest answers from IndexedDB during submission:', e);
    }

    // Pull latest writing draft from IndexedDB
    let currentTask1 = writingTask1;
    let currentTask2 = writingTask2;
    try {
      const writingDraft = await getWritingDraftFromIndexedDB(examCode, sbd);
      if (writingDraft) {
        if (!currentTask1 && writingDraft.task1) currentTask1 = writingDraft.task1;
        if (!currentTask2 && writingDraft.task2) currentTask2 = writingDraft.task2;
      }
    } catch (e) {
      console.warn('Could not read latest writing draft during submission:', e);
    }

    // Retrieve cheat logs from LocalStorage
    const rawCheatLogs = localStorage.getItem('ielts_cheat_logs');
    const cheatLogs: CheatLog[] = rawCheatLogs ? JSON.parse(rawCheatLogs) : [];
    const currentLogs = cheatLogs.filter(log => String(log?.sbd ?? '') === String(sbd ?? '') && String(log?.exam_code ?? '').toUpperCase() === String(examCode ?? '').toUpperCase());

    const payload: SubmissionPayload = {
      submission_id: submissionId,
      sbd,
      exam_code: examCode,
      test_mode: testMode,
      retakeMode: isRetake,
      targetSkill: activeTargetSkill,
      submission_type: submissionType,
      answers: latestAnswers,
      listening_answers: latestAnswers,
      reading_answers: latestAnswers,
      writing_task1: currentTask1,
      writing_task2: currentTask2,
      writing_task1_text: currentTask1,
      writing_task2_text: currentTask2,
      cheat_logs: currentLogs,
      violation_logs: currentLogs,
      violations_count: proctoringMetrics.violationCount || violationCount,
      cumulative_off_screen_seconds: proctoringMetrics.cumulativeOffScreenSeconds,
      switch_count: proctoringMetrics.rapidSwitchCount,
      submitted_at: new Date().toISOString()
    };

    // Use submitExamPayload with lock retry, local IndexedDB backup, normalized scoring and band conversion
    const serverResponse = await submitExamPayload(gasUrl, payload, examData);

    // Save submission locally
    const subsRaw = localStorage.getItem('ielts_student_submissions');
    const subsArr: SubmissionResponse[] = subsRaw ? JSON.parse(subsRaw) : [];
    if (!subsArr.some(s => s.submission_id === serverResponse.submission_id)) {
      subsArr.unshift(serverResponse);
    }
    const seen = new Set<string>();
    const cleanSubs = subsArr.filter(s => {
      const id = String(s?.submission_id ?? '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    localStorage.setItem('ielts_student_submissions', JSON.stringify(cleanSubs));

    setSubmitResult(serverResponse);
    setIsSubmitting(false);
    setIsForcedSubmitting(false);
    clearCurrentAnswersFromIndexedDB(examCode, sbd).catch(() => {});
    setCurrentModule('results');
  };

  // Background Offline Retry Loop via Central Sync Engine
  const triggerOfflineRetry = useCallback(async () => {
    try {
      const syncOutcome = await syncPendingSubmissions(gasUrl);
      setOfflinePending(syncOutcome.remaining > 0);
      if (syncOutcome.synced > 0 && syncOutcome.results.length > 0) {
        setSubmitResult(prev => {
          if (!prev) return prev;
          const matched = syncOutcome.results.find(r => r.submission_id === prev.submission_id);
          return matched || prev;
        });
      }
    } catch (e) {
      console.warn('Background sync error:', e);
    }
  }, [gasUrl]);

  const [networkToast, setNetworkToast] = useState<{ type: 'offline' | 'online'; message: string } | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      console.log('[Auto-Resync]: Internet connection restored. Processing offline pending submissions...');
      setNetworkToast({
        type: 'online',
        message: 'Network restored! Auto-syncing pending exam submissions to Google Sheets...'
      });

      try {
        const syncOutcome = await syncPendingSubmissions(gasUrl);
        setOfflinePending(syncOutcome.remaining > 0);
        if (syncOutcome.synced > 0) {
          setNetworkToast({
            type: 'online',
            message: `Successfully synced ${syncOutcome.synced} pending exam submission(s) to Google Sheets!`
          });
        }
      } catch (err) {
        console.warn('[Auto-Resync Error]:', err);
      } finally {
        setTimeout(() => setNetworkToast(null), 5000);
      }
    };

    const handleOffline = () => {
      setNetworkToast({
        type: 'offline',
        message: 'Network offline. Your exam answers are safely preserved in IndexedDB vault and will auto-sync upon reconnection.'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount in case there are pending submissions
    triggerOfflineRetry();

    const interval = setInterval(() => {
      triggerOfflineRetry();
    }, 12000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [gasUrl, triggerOfflineRetry]);

  // Complete GAS Code Script Template
  const gasBackendScript = `/**
 * BACKEND GOOGLE APPS SCRIPT (GAS) - IELTS EXAM SYSTEM
 * Compatible with Google Sheets containing tabs: EXAMS, QUESTIONS, SUBMISSIONS, CHEATLOGS, STUDENT_PROGRESS, PRACTICE_QUESTIONS
 */

function doGet(e) {
  var params = e ? e.parameter : {};
  var action = (params.action || 'get_exam').toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ACTION: GET EXAM (get_exam / getexam)
  if (action === 'get_exam' || action === 'getexam') {
    var rawCode = params.exam_code || 'IELTS01';
    var examCode = rawCode.toString().trim().toUpperCase();

    // Read general exam information from EXAMS sheet (if present)
    var title = 'IELTS Exam ' + rawCode;
    var audioUrl = '';
    var passageTitle = '';
    var passageText = '';
    var writingTask1 = '';
    var writingTask2 = '';

    var examsSheet = ss.getSheetByName('EXAMS');
    var writingTask1Image = '';
    if (examsSheet && examsSheet.getLastRow() > 1) {
      var examsData = examsSheet.getDataRange().getValues();
      for (var eRow = 1; eRow < examsData.length; eRow++) {
        var er = examsData[eRow];
        if (er[0] && er[0].toString().trim().toUpperCase() === examCode) {
          if (er[1]) title = er[1].toString().trim();
          if (er[4]) audioUrl = er[4].toString().trim(); // Audio URL column if present
          if (er[5]) passageTitle = er[5].toString().trim();
          if (er[6]) passageText = er[6].toString().trim();
          if (er[7]) writingTask1 = er[7].toString().trim();
          if (er[8]) writingTask2 = er[8].toString().trim();
          if (er[9]) writingTask1Image = er[9].toString().trim();
          break;
        }
      }
    }

    // Read question list from QUESTIONS sheet
    var questionsSheet = ss.getSheetByName('QUESTIONS');
    var questions = [];

    if (questionsSheet && questionsSheet.getLastRow() > 1) {
      var data = questionsSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] && row[0].toString().trim().toUpperCase() === examCode) {
          var rawSection = (row[2] || 'reading').toString().trim().toLowerCase();
          var qObj = {
            question_id: (row[1] || ('q_' + i)).toString().trim(),
            section: rawSection, // listening or reading
            question_text: (row[3] || '').toString().trim(),
            question_type: (row[4] || 'multiple_choice').toString().trim().toLowerCase(),
            options: row[5] ? row[5].toString().split('|').map(function(s){ return s.trim(); }) : [],
            max_score: Number(row[7]) || 1
            // Note: Column 6 (CORRECT_ANSWERS) is kept confidential on server, not sent to client
          };
          questions.push(qObj);

          // Update passage/meta if defined in QUESTIONS row
          if (row[8] && !passageTitle) passageTitle = row[8].toString().trim();
          if (row[9] && !passageText) passageText = row[9].toString().trim();
          if (row[10] && !audioUrl) audioUrl = row[10].toString().trim();
          if (row[11] && !writingTask1) writingTask1 = row[11].toString().trim();
          if (row[12] && !writingTask2) writingTask2 = row[12].toString().trim();
        }
      }
    }

    var result = {
      status: 'success',
      exam_code: rawCode,
      title: title,
      questions: questions,
      passage_title: passageTitle,
      passage_text: passageText,
      audio_url: audioUrl,
      writing_task1_prompt: writingTask1,
      writing_task2_prompt: writingTask2,
      writing_task1_image: writingTask1Image,
      writing_task1_image_url: writingTask1Image,
      writing_task1_imageUrl: writingTask1Image
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. ACTION: GET SUBMISSIONS FOR INSTRUCTOR (getSubmissions / get_submissions)
  if (action === 'getsubmissions' || action === 'get_submissions') {
    var subSheet = ss.getSheetByName('SUBMISSIONS');
    var submissions = [];
    if (subSheet && subSheet.getLastRow() > 1) {
      var sData = subSheet.getDataRange().getValues();
      for (var s = 1; s < sData.length; s++) {
        var sr = sData[s];
        submissions.push({
          submission_id: sr[0],
          sbd: sr[1],
          exam_code: sr[2],
          listening_raw_score: Number(sr[3]) || 0,
          reading_raw_score: Number(sr[4]) || 0,
          writing_status: sr[5] || 'PENDING_TEACHER',
          writing_task1_essay: sr[6] || '',
          writing_task2_essay: sr[7] || '',
          writing_scores: {
            TR: sr[8] || null,
            CC: sr[9] || null,
            LR: sr[10] || null,
            GRA: sr[11] || null
          },
          writing_band: sr[12] || null,
          writing_feedback: sr[13] || '',
          submitted_at: sr[14] || sr[5] || new Date().toISOString()
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: submissions }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. ACTION: GET CHEAT / INTEGRITY LOGS (getCheatLogs / get_cheat_logs)
  if (action === 'getcheatlogs' || action === 'get_cheat_logs') {
    var cheatSheet = ss.getSheetByName('CHEATLOGS');
    var logs = [];
    if (cheatSheet && cheatSheet.getLastRow() > 1) {
      var logsData = cheatSheet.getDataRange().getValues();
      for (var j = 1; j < logsData.length; j++) {
        var r = logsData[j];
        logs.push({
          log_id: r[0],
          submission_id: r[1],
          sbd: r[2],
          exam_code: r[3],
          violation_type: r[4],
          timestamp: r[5]
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: logs }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 4. ACTION: GET 3 LEARNERS PROGRESS (get_student_progress)
  if (action === 'get_student_progress') {
    var pSheet = ss.getSheetByName('STUDENT_PROGRESS');
    var progress = [];
    if (pSheet && pSheet.getLastRow() > 1) {
      var pData = pSheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        var pr = pData[p];
        progress.push({
          student_id: pr[0],
          student_name: pr[1],
          deck_id: pr[2],
          deck_title: pr[3],
          cards_mastered: Number(pr[4]) || 0,
          total_cards: Number(pr[5]) || 0,
          mastery_pct: Number(pr[6]) || 0,
          correct_count: Number(pr[7]) || 0,
          wrong_count: Number(pr[8]) || 0,
          daily_streak: Number(pr[9]) || 0,
          last_studied_at: pr[10] || '',
          notes: pr[11] || ''
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: progress }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 5. ACTION: GET PRACTICE QUESTIONS FROM SHEET (get_practice_questions)
  if (action === 'get_practice_questions') {
    var pqSheet = ss.getSheetByName('PRACTICE_QUESTIONS');
    var pCards = [];
    if (pqSheet && pqSheet.getLastRow() > 1) {
      var pqData = pqSheet.getDataRange().getValues();
      for (var q = 1; q < pqData.length; q++) {
        var qr = pqData[q];
        pCards.push({
          id: qr[0] || ('pq_' + q),
          deck_id: qr[1] || 'PRACTICE_01',
          sentence_en: qr[2] || '',
          sentence_vi: qr[3] || '',
          cloze_target: qr[4] || '',
          target_word: qr[5] || qr[4] || '',
          part_of_speech: qr[6] || '',
          phonetic: qr[7] || '',
          hints: qr[8] || '',
          accepted_answers: qr[9] ? qr[9].toString().split('|').map(function(s){ return s.trim(); }) : [qr[4]],
          explanation: qr[10] || '',
          options: qr[11] ? qr[11].toString().split('|').map(function(s){ return s.trim(); }) : [],
          difficulty: qr[12] || 'medium'
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: pCards }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'IELTS GAS API Ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    // Acquire sequential write lock (wait up to 30s for concurrent submissions)
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ERROR',
        message: 'Google Sheets concurrent write lock is busy. Server is processing another submission, retry queued...'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var contents = JSON.parse(e.postData.contents);
    var action = (contents.action || 'submitExam').toLowerCase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 0. ACTION: SYNC LEARNER PROGRESS (sync_student_progress)
    if (action === 'sync_student_progress') {
      var studentSheet = ss.getSheetByName('STUDENT_PROGRESS') || ss.insertSheet('STUDENT_PROGRESS');
      if (studentSheet.getLastRow() === 0) {
        studentSheet.appendRow([
          'STUDENT_ID', 'STUDENT_NAME', 'DECK_ID', 'DECK_TITLE',
          'CARDS_MASTERED', 'TOTAL_CARDS', 'MASTERY_PCT', 'CORRECT_COUNT',
          'WRONG_COUNT', 'DAILY_STREAK', 'LAST_STUDIED_AT', 'RAW_PAYLOAD'
        ]);
      }

      var records = contents.records || [];
      for (var rIdx = 0; rIdx < records.length; rIdx++) {
        var rec = records[rIdx];
        studentSheet.appendRow([
          rec.student_id || contents.student_id || 'HV01',
          rec.student_name || contents.student_name || 'Learner',
          rec.deck_id || 'PRACTICE_01',
          rec.deck_title || 'Practice',
          rec.cards_mastered || 0,
          rec.total_cards || 0,
          rec.mastery_pct || 0,
          rec.correct_count || 0,
          rec.wrong_count || 0,
          rec.daily_streak || 1,
          rec.last_studied_at || new Date().toISOString(),
          contents.raw_stats_json || ''
        ]);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Student progress synchronized successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1. ACTION: GRADE WRITING (gradeWriting / grade_writing)
    if (action === 'gradewriting' || action === 'grade_writing') {
      var targetSubId = contents.submission_id;
      var subSheet = ss.getSheetByName('SUBMISSIONS');
      if (subSheet && subSheet.getLastRow() > 1) {
        var sRows = subSheet.getDataRange().getValues();
        for (var rowIdx = 1; rowIdx < sRows.length; rowIdx++) {
          if (sRows[rowIdx][0] == targetSubId) {
            var scores = contents.writing_scores || {};
            subSheet.getRange(rowIdx + 1, 6).setValue('GRADED'); // Status
            subSheet.getRange(rowIdx + 1, 9).setValue(scores.TR || '');
            subSheet.getRange(rowIdx + 1, 10).setValue(scores.CC || '');
            subSheet.getRange(rowIdx + 1, 11).setValue(scores.LR || '');
            subSheet.getRange(rowIdx + 1, 12).setValue(scores.GRA || '');
            subSheet.getRange(rowIdx + 1, 13).setValue(contents.writing_band || '');
            subSheet.getRange(rowIdx + 1, 14).setValue(contents.writing_feedback || '');
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Grading saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ACTION: UPLOAD EXAM (upload_exam / uploadexam)
    if (action === 'upload_exam' || action === 'uploadexam') {
      var exam = contents.exam_data;
      if (!exam) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing exam_data payload' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var sheetE = ss.getSheetByName('EXAMS') || ss.insertSheet('EXAMS');
      var sheetQ = ss.getSheetByName('QUESTIONS') || ss.insertSheet('QUESTIONS');

      var uExamCode = (exam.exam_code || 'IELTS01').toString().trim().toUpperCase();
      var uTitle = exam.title || ('IELTS Exam ' + uExamCode);
      var uTestType = exam.test_type || 'Academic';
      var uDuration = exam.duration_mins || 60;

      var examSkills = exam.skills || [];
      var isOneSkill = exam.exam_type === 'one_skill' || examSkills.length === 1;

      var allowListening = !isOneSkill || examSkills.indexOf('listening') !== -1;
      var allowReading = !isOneSkill || examSkills.indexOf('reading') !== -1;
      var allowWriting = !isOneSkill || examSkills.indexOf('writing') !== -1;

      var uAudioUrl = allowListening ? (exam.audio_url || '') : '';
      var uPassageTitle = allowReading ? (exam.passage_title || '') : '';
      var uPassageText = allowReading ? (exam.passage_text || '') : '';
      var uWritingTask1 = allowWriting ? (exam.writing_task1_prompt || '') : '';
      var uWritingTask2 = allowWriting ? (exam.writing_task2_prompt || '') : '';
      var rawTask1Img = allowWriting ? (exam.writing_task1_image || exam.writing_task1_image_url || exam.writing_task1_imageUrl || '') : '';
      var uWritingTask1Image = (rawTask1Img && rawTask1Img.length > 45000 && rawTask1Img.indexOf('data:image') === 0) ? '' : rawTask1Img;

      sheetE.appendRow([
        uExamCode,
        uTitle,
        uTestType,
        uDuration,
        uAudioUrl,
        uPassageTitle,
        uPassageText,
        uWritingTask1,
        uWritingTask2,
        uWritingTask1Image
      ]);

      var listeningQs = allowListening ? (exam.listening_questions || []) : [];
      for (var l = 0; l < listeningQs.length; l++) {
        var lq = listeningQs[l];
        var lOptions = (lq.options && Array.isArray(lq.options)) ? lq.options.join('|') : (lq.options || '');
        sheetQ.appendRow([
          uExamCode,
          lq.question_id || ('l_' + (l + 1)),
          'listening',
          lq.question_text || '',
          lq.question_type || 'multiple_choice',
          lOptions,
          lq.correct_answer || '',
          lq.max_score || 1,
          uPassageTitle,
          uPassageText,
          uAudioUrl
        ]);
      }

      var readingQs = allowReading ? (exam.reading_questions || []) : [];
      for (var r = 0; r < readingQs.length; r++) {
        var rq = readingQs[r];
        var rOptions = (rq.options && Array.isArray(rq.options)) ? rq.options.join('|') : (rq.options || '');
        sheetQ.appendRow([
          uExamCode,
          rq.question_id || ('r_' + (r + 1)),
          'reading',
          rq.question_text || '',
          rq.question_type || 'multiple_choice',
          rOptions,
          rq.correct_answer || '',
          rq.max_score || 1,
          uPassageTitle,
          uPassageText,
          uAudioUrl
        ]);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Exam ' + uExamCode + ' saved to Google Sheets successfully!',
        exam_code: uExamCode,
        total_questions: listeningQs.length + readingQs.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ACTION: SUBMIT EXAM (submitExam / submit_exam)
    var subSheet = ss.getSheetByName('SUBMISSIONS');
    var cheatSheet = ss.getSheetByName('CHEATLOGS');

    var subId = contents.submission_id || (contents.sbd + '_' + contents.exam_code + '_' + new Date().getTime());
    var sbd = contents.sbd;
    var examCode = (contents.exam_code || '').toString().trim().toUpperCase();
    var answers = contents.answers || contents.listening_answers || contents.reading_answers || {};
    var submissionType = contents.submission_type || 'STANDARD';

    // Auto-grade Listening & Reading objective questions with Answer Normalization Engine
    function normalizeAns(str) {
      if (!str) return '';
      return str.toString()
        .toLowerCase()
        .replace(/^(a|an|the)\s+/, '')
        .replace(/[.,/#!$%^&*;:{}=\-_~()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    var questionsSheet = ss.getSheetByName('QUESTIONS');
    var listeningScore = 0;
    var readingScore = 0;

    if (questionsSheet && questionsSheet.getLastRow() > 1) {
      var qData = questionsSheet.getDataRange().getValues();
      for (var k = 1; k < qData.length; k++) {
        var qRow = qData[k];
        if (qRow[0] && qRow[0].toString().trim().toUpperCase() === examCode) {
          var qId = (qRow[1] || '').toString().trim();
          var section = (qRow[2] || '').toString().trim().toLowerCase();
          var rawCorrect = qRow[6] ? qRow[6].toString() : '';
          var userAns = answers[qId] ? normalizeAns(answers[qId]) : '';

          if (userAns && rawCorrect) {
            // Support pipe-separated answers: "1,400 kilometres|1400 kilometres|1400 km"
            var acceptedVariants = rawCorrect.split('|').map(function(item) {
              return normalizeAns(item);
            });
            if (acceptedVariants.indexOf(userAns) !== -1) {
              if (section === 'listening') listeningScore++;
              if (section === 'reading') readingScore++;
            }
          }
        }
      }
    }

    // Official IELTS Academic Raw-to-Band mapping
    function rawToReadingBand(raw) {
      if (raw >= 39) return 9.0;
      if (raw >= 37) return 8.5;
      if (raw >= 35) return 8.0;
      if (raw >= 33) return 7.5;
      if (raw >= 30) return 7.0;
      if (raw >= 27) return 6.5;
      if (raw >= 23) return 6.0;
      if (raw >= 19) return 5.5;
      if (raw >= 15) return 5.0;
      if (raw >= 13) return 4.5;
      if (raw >= 10) return 4.0;
      if (raw >= 8) return 3.5;
      if (raw >= 6) return 3.0;
      if (raw >= 4) return 2.5;
      return 2.0;
    }

    function rawToListeningBand(raw) {
      if (raw >= 39) return 9.0;
      if (raw >= 37) return 8.5;
      if (raw >= 35) return 8.0;
      if (raw >= 32) return 7.5;
      if (raw >= 30) return 7.0;
      if (raw >= 26) return 6.5;
      if (raw >= 23) return 6.0;
      if (raw >= 18) return 5.5;
      if (raw >= 16) return 5.0;
      if (raw >= 13) return 4.5;
      if (raw >= 10) return 4.0;
      if (raw >= 8) return 3.5;
      if (raw >= 6) return 3.0;
      if (raw >= 4) return 2.5;
      return 2.0;
    }

    var listeningBand = rawToListeningBand(listeningScore);
    var readingBand = rawToReadingBand(readingScore);

    // Record into SUBMISSIONS sheet (with submission_type & band scores)
    if (subSheet) {
      subSheet.appendRow([
        subId,
        sbd,
        contents.exam_code,
        listeningScore,
        readingScore,
        'PENDING_TEACHER', // Writing status
        contents.writing_task1 || contents.writing_task1_text || '',
        contents.writing_task2 || contents.writing_task2_text || '',
        '', '', '', '', '', '', // TR, CC, LR, GRA, Band, Feedback
        new Date().toISOString(),
        submissionType,
        listeningBand,
        readingBand
      ]);
    }

    // Record Integrity / Violation Logs
    if (cheatSheet && contents.cheat_logs && contents.cheat_logs.length > 0) {
      for (var m = 0; m < contents.cheat_logs.length; m++) {
        var log = contents.cheat_logs[m];
        cheatSheet.appendRow([
          log.log_id || ('log_' + new Date().getTime()),
          subId,
          sbd,
          contents.exam_code,
          log.violation_type || 'Unknown Violation',
          log.timestamp || new Date().toISOString()
        ]);
      }
    }

    var responseObj = {
      status: 'success',
      submission_id: subId,
      sbd: sbd,
      exam_code: contents.exam_code,
      submission_type: submissionType,
      listening_score: listeningScore,
      reading_score: readingScore,
      listening_band: listeningBand,
      reading_band: readingBand,
      writing_status: 'PENDING_TEACHER',
      created_at: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(responseObj))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (lockErr) {}
    }
  }
}
`;

  const copyGasCode = () => {
    navigator.clipboard.writeText(gasBackendScript);
    setCopiedGasCode(true);
    setTimeout(() => setCopiedGasCode(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F5F2F9] text-[#3C2A63] flex flex-col font-sans transition-colors duration-300">
      
      {/* Universal Top Navigation Header */}
      <Navbar
        activeView={activeView}
        adminTab={adminTab}
        setActiveView={setActiveView}
        setAdminTab={setAdminTab}
        isLoggedIn={isLoggedIn}
        studentMode={testMode}
        sbd={sbd}
        examCode={examCode}
        gasUrl={gasUrl}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onTriggerReload={() => setIsReloadModalOpen(true)}
        onTriggerExit={() => setIsExitModalOpen(true)}
        isFocusFlowMode={isFocusFlowMode}
        onToggleFocusFlowMode={() => setIsFocusFlowMode(prev => !prev)}
      />

      {/* Non-blocking Offline / Online Toast Notification */}
      {networkToast && (
        <div className={`fixed bottom-5 right-5 z-50 p-3.5 rounded-2xl shadow-2xl border flex items-center gap-2.5 max-w-sm text-xs font-bold transition-all duration-300 animate-fadeIn ${
          networkToast.type === 'offline'
            ? 'bg-amber-900 text-amber-50 border-amber-700/80 shadow-amber-950/30'
            : 'bg-emerald-900 text-emerald-50 border-emerald-700/80 shadow-emerald-950/30'
        }`}>
          {networkToast.type === 'offline' ? (
            <WifiOff className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
          ) : (
            <Wifi className="w-4 h-4 text-emerald-300 shrink-0" />
          )}
          <span className="leading-snug">{networkToast.message}</span>
          <button
            type="button"
            onClick={() => setNetworkToast(null)}
            className="ml-auto text-white/70 hover:text-white p-0.5 rounded cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offline Pending Submission Alert */}
      {offlinePending && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            <span>
              <strong>Offline-Retry Mode:</strong> Unstable network detected. The system has safely queued your submission and will automatically resubmit once reconnected!
            </span>
          </div>
          <button
            onClick={triggerOfflineRetry}
            className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Retry Now
          </button>
        </div>
      )}

      {/* Forced Auto-Submission Blocking Modal Overlay */}
      {isForcedSubmitting && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-purple-200 text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto text-rose-600 shadow-inner">
              <Hourglass className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-[#3C2A63]">
                Time is up!
              </h3>
              <p className="text-sm font-semibold text-rose-600">
                Your exam is being submitted automatically...
              </p>
              <p className="text-xs text-[#7C68A5]">
                All answers, passages, and writing drafts are being locked, scored, and securely synchronized to the official exam record. Please do not close your browser.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-[#503A7A] bg-[#F5F2F9] py-2.5 px-4 rounded-2xl border border-purple-100">
              <RefreshCw className="w-4 h-4 animate-spin text-[#6B51A5]" />
              <span>Locking session &amp; computing official scores...</span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className={`flex-1 w-full mx-auto transition-all duration-300 ${isFocusFlowMode ? 'max-w-[98%] p-2 sm:p-4' : 'max-w-7xl p-4 sm:p-6'}`}>
        
        {/* STUDENT VIEW */}
        {activeView === 'student' && (
          <div>
            {!isLoggedIn ? (
              <>
                <LoginInstructions 
                  onLogin={handleLogin} 
                  onSwitchToAdmin={() => setActiveView('admin')}
                  onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
                  onOpenPracticeHub={() => handleLogin('HV01', 'ON_TAP_01', 'PRACTICE', false)}
                  onForceResync={handleForceResyncExam}
                  isLoadingExam={isLoadingExam}
                  gasUrl={gasUrl}
                  loginError={loginErrorMessage}
                  onClearLoginError={() => setLoginErrorMessage(null)}
                />

                {/* Instant Entry Progress Modal (if downloading fresh exam on cache miss) */}
                {isLoadingExam && (
                  <div className="fixed inset-0 bg-[#1E1035]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white border border-purple-100 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4">
                      <div className="w-14 h-14 bg-purple-100 text-[#6B51A5] rounded-2xl flex items-center justify-center mx-auto">
                        <RefreshCw className="w-7 h-7 animate-spin text-[#6B51A5]" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-[#3C2A63]">Preparing Exam Room</h3>
                        <p className="text-xs text-[#7C68A5] mt-1">Configuring exam package [{examCode}] and loading test session...</p>
                      </div>
                      <div className="w-full bg-purple-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#6B51A5] h-full rounded-full w-4/5 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : isCustomPracticeSession ? (
              <PracticeDashboard
                initialDeckId={customPracticeDeckId}
                candidateSbd={sbd}
                onExitToLogin={() => {
                  setIsLoggedIn(false);
                  setIsCustomPracticeSession(false);
                  setSbd('');
                  setExamCode('');
                  setTestMode('TEST');
                }}
                gasUrl={gasUrl}
              />
            ) : (
              <div className="space-y-6">
                
                {/* Proctoring Monitor for Test Mode */}
                <ProctoringMonitor
                  submissionId={submissionId}
                  sbd={sbd}
                  examCode={examCode}
                  testMode={testMode}
                  onViolationCountChange={(count) => setViolationCount(count)}
                  onProctoringMetricsChange={(m) => setProctoringMetrics(m)}
                />

                {/* Skill Lock / Notice Banner */}
                {skillNotice && (
                  <div className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center justify-between gap-3 animate-fade-in shadow-md ${
                    skillNotice.startsWith('✅')
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>{skillNotice}</span>
                    </div>
                    <button
                      onClick={() => setSkillNotice(null)}
                      className="text-xs hover:opacity-75 font-black px-2 py-0.5 rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Student Step Module Switcher Tabs */}
                {currentModule !== 'results' && (
                  <div className="bg-white/90 border border-purple-100/80 p-2 sm:p-2.5 rounded-3xl shadow-xl shadow-purple-950/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      
                      {hasListening && (
                        <button
                          onClick={() => handleSwitchTab('listening')}
                          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                            currentModule === 'listening'
                              ? 'bg-[#6B51A5] text-white shadow-md'
                              : completedSkills.listening
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-[#E2DDEC] text-[#3C2A63] hover:bg-[#D9D3E4]'
                          }`}
                        >
                          {completedSkills.listening ? (
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
                          ) : (
                            <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          )}
                          <span>1. Listening ({examData.listening_questions?.length ?? 0} Qs)</span>
                        </button>
                      )}

                      {hasReading && (
                        <button
                          onClick={() => handleSwitchTab('reading')}
                          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                            currentModule === 'reading'
                              ? 'bg-[#6B51A5] text-white shadow-md'
                              : completedSkills.reading
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : testMode === 'TEST' && hasListening && !completedSkills.listening
                              ? 'bg-purple-50 text-[#7C68A5] border border-purple-200/60 opacity-80'
                              : 'bg-[#E2DDEC] text-[#3C2A63] hover:bg-[#D9D3E4]'
                          }`}
                        >
                          {completedSkills.reading ? (
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
                          ) : testMode === 'TEST' && hasListening && !completedSkills.listening ? (
                            <Lock className="w-3 h-3 text-rose-500" />
                          ) : (
                            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          )}
                          <span>2. Reading ({readingQuestionsCount} Qs)</span>
                        </button>
                      )}

                      {hasWriting && (
                        <button
                          onClick={() => handleSwitchTab('writing')}
                          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                            currentModule === 'writing'
                              ? 'bg-[#6B51A5] text-white shadow-md'
                              : completedSkills.writing
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : testMode === 'TEST' && ((hasListening && !completedSkills.listening) || (hasReading && !completedSkills.reading))
                              ? 'bg-purple-50 text-[#7C68A5] border border-purple-200/60 opacity-80'
                              : 'bg-[#E2DDEC] text-[#3C2A63] hover:bg-[#D9D3E4]'
                          }`}
                        >
                          {completedSkills.writing ? (
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
                          ) : testMode === 'TEST' && ((hasListening && !completedSkills.listening) || (hasReading && !completedSkills.reading)) ? (
                            <Lock className="w-3 h-3 text-rose-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          )}
                          <span>3. Writing</span>
                        </button>
                      )}

                    </div>

                    {/* ACTIONS: Emergency Backup & Final Submission */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleExportDraftBackup}
                        title="Tải bản sao lưu bài làm đang làm (.json) về máy tính"
                        className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white hover:bg-purple-50 text-[#3C2A63] border border-purple-200/90 font-bold text-[11px] sm:text-xs rounded-xl sm:rounded-2xl shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-[#6B51A5]" />
                        <span className="hidden sm:inline">Lưu bản sao (.json)</span>
                        <span className="sm:hidden">Lưu</span>
                      </button>

                      {/* SUBMIT BUTTON: Distinct visual hierarchy separating final submission from navigation tabs */}
                      <button
                        onClick={() => setIsConfirmSubmitOpen(true)}
                        disabled={isSubmitting}
                        className="px-5 sm:px-6 py-2.5 sm:py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] sm:text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-950/15 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shrink-0 active:scale-95"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Đang nộp...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>SUBMIT EXAM</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Render Selected Student Module */}
                {currentModule === 'listening' && (
                  <div className="space-y-4">
                    <ListeningModule
                      audioUrl={examData.audio_url}
                      questions={examData.listening_questions || []}
                      userAnswers={userAnswers}
                      onAnswerChange={handleAnswerChange}
                      testMode={testMode}
                      durationMins={examData.listening_duration_mins || 30}
                      examCode={examCode}
                      candidateId={sbd}
                      onTimeExpire={() => handleSubmitExam('TIMEOUT_FORCED')}
                    />

                    {/* Section Progression Footer */}
                    <div className="bg-white border border-purple-100/80 rounded-3xl p-5 shadow-xl shadow-purple-950/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[#3C2A63]">Submit Listening Answers</h4>
                          <p className="text-xs text-[#7C68A5] font-medium">
                            {testMode === 'TEST'
                              ? hasReading
                                ? 'In TEST MODE: Submitting Listening locks your answers and unlocks the Reading section.'
                                : hasWriting
                                ? 'In TEST MODE: Submitting Listening locks your answers and unlocks the Writing section.'
                                : 'In TEST MODE: Submitting Listening locks your answers and submits the examination.'
                              : 'Proceed to next section.'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleCompleteListening}
                        className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/10 flex items-center gap-2 transition cursor-pointer shrink-0"
                      >
                        <span>
                          {hasReading
                            ? 'Submit Listening & Proceed to Reading'
                            : hasWriting
                            ? 'Submit Listening & Proceed to Writing'
                            : 'Submit Listening & Finish Exam'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {currentModule === 'reading' && (
                  <div className="space-y-4">
                    <ReadingModule
                      passageTitle={examData.passage_title}
                      passageText={examData.passage_text}
                      passages={examData.passages}
                      questions={examData.reading_questions}
                      userAnswers={userAnswers}
                      onAnswerChange={handleAnswerChange}
                      testMode={testMode}
                      durationMins={examData.reading_duration_mins || 60}
                      examCode={examCode}
                      candidateId={sbd}
                      onTimeExpire={() => handleSubmitExam('TIMEOUT_FORCED')}
                    />

                    {/* Section Progression Footer */}
                    <div className="bg-white border border-purple-100/80 rounded-3xl p-5 shadow-xl shadow-purple-950/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-purple-100 text-[#503A7A] rounded-2xl">
                          <CheckCircle2 className="w-5 h-5 text-[#6B51A5]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[#3C2A63]">Submit Reading Answers</h4>
                          <p className="text-xs text-[#7C68A5] font-medium">
                            {testMode === 'TEST'
                              ? hasWriting
                                ? 'In TEST MODE: Submitting Reading locks your answers and unlocks the Writing section.'
                                : 'In TEST MODE: Submitting Reading locks your answers and submits the examination.'
                              : 'Proceed to next section.'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleCompleteReading}
                        className="px-6 py-3 bg-[#6B51A5] hover:bg-[#583F8F] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-purple-900/15 flex items-center gap-2 transition cursor-pointer shrink-0"
                      >
                        <span>
                          {hasWriting
                            ? 'Submit Reading & Proceed to Writing'
                            : 'Submit Reading & Finish Exam'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {currentModule === 'writing' && (
                  <div className="space-y-4">
                    {(() => {
                      const writingSection = examData.sections?.find(s => s.skill === 'writing');
                      const wTasks = writingSection?.tasks;
                      const task1Obj = wTasks?.find(t => t.task_number === 1) || wTasks?.[0];
                      const task2Obj = wTasks?.find(t => t.task_number === 2) || wTasks?.[1];

                      const resolvedTask1Prompt = examData.writing_task1_prompt || task1Obj?.prompt;
                      const resolvedTask1Image = examData.writing_task1_image || 
                        examData.writing_task1_image_url || 
                        examData.writing_task1_imageUrl || 
                        task1Obj?.image_url || 
                        task1Obj?.imageUrl || 
                        (task1Obj as any)?.image || 
                        examData.image_url || 
                        (examData as any).imageUrl || 
                        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60';
                      const resolvedTask2Prompt = examData.writing_task2_prompt || task2Obj?.prompt;

                      return (
                        <WritingModule
                          task1Prompt={resolvedTask1Prompt}
                          task1Image={resolvedTask1Image}
                          image_url={resolvedTask1Image}
                          imageUrl={resolvedTask1Image}
                          tasks={wTasks}
                          task2Prompt={resolvedTask2Prompt}
                          task1Text={writingTask1}
                          task2Text={writingTask2}
                          onTask1Change={setWritingTask1}
                          onTask2Change={setWritingTask2}
                          submissionId={submissionId}
                          examCode={examCode}
                          candidateId={sbd}
                          testMode={testMode}
                          durationMins={examData.writing_duration_mins || 60}
                          onTimeExpire={() => handleSubmitExam('TIMEOUT_FORCED')}
                        />
                      );
                    })()}

                    {/* Section Progression Footer */}
                    <div className="bg-white border border-purple-100/80 rounded-3xl p-5 shadow-xl shadow-purple-950/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
                          <Send className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[#3C2A63]">Submit Entire Examination</h4>
                          <p className="text-xs text-[#7C68A5] font-medium">
                            Submit all answers across skills for automated score computation and official recording.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsConfirmSubmitOpen(true)}
                        disabled={isSubmitting}
                        className="px-8 py-3.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-purple-900/15 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Submitting Exam...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>SUBMIT COMPLETE EXAM</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {currentModule === 'results' && submitResult && (
                  <ResultPage
                    result={submitResult}
                    testMode={testMode}
                    examData={examData}
                    userAnswers={userAnswers}
                    writingTask1={writingTask1}
                    writingTask2={writingTask2}
                    onRetrySync={triggerOfflineRetry}
                    onReturnHome={() => {
                      clearSessionTimers();
                      setIsLoggedIn(false);
                      setSbd('');
                      setExamCode('');
                      setUserAnswers({});
                      setWritingTask1('');
                      setWritingTask2('');
                      setSubmitResult(null);
                      setCurrentModule(defaultInitialModule);
                      setCompletedSkills({ listening: false, reading: false, writing: false });
                      setSkillNotice(null);
                    }}
                    onRestartPractice={() => {
                      clearSessionTimers();
                      setIsLoggedIn(false);
                      setSbd('');
                      setExamCode('');
                      setUserAnswers({});
                      setWritingTask1('');
                      setWritingTask2('');
                      setSubmitResult(null);
                      setCurrentModule(defaultInitialModule);
                      setCompletedSkills({ listening: false, reading: false, writing: false });
                      setSkillNotice(null);
                    }}
                  />
                )}

                {/* Final Submission Pre-flight Confirmation Modal (rendered for all modules) */}
                <SubmitConfirmationModal
                  isOpen={isConfirmSubmitOpen}
                  onClose={() => setIsConfirmSubmitOpen(false)}
                  onConfirmSubmit={() => {
                    setIsConfirmSubmitOpen(false);
                    handleSubmitExam('STANDARD');
                  }}
                  onSaveDraft={async () => {
                    await saveCurrentAnswersToIndexedDB(examCode, sbd, userAnswers);
                    if (writingTask1 || writingTask2) {
                      await saveWritingDraftToIndexedDB(examCode, sbd, { task1: writingTask1, task2: writingTask2 });
                    }
                    setSkillNotice('💾 Draft responses safely saved to IndexedDB storage!');
                    setTimeout(() => setSkillNotice(null), 4000);
                  }}
                  isSubmitting={isSubmitting}
                  totalListening={examData.listening_questions?.length ?? 0}
                  answeredListening={answeredListeningCount}
                  totalReading={readingQuestionsCount}
                  answeredReading={answeredReadingCount}
                  hasListening={hasListening}
                  hasReading={hasReading}
                  hasWriting={hasWriting}
                  retakeMode={isRetake}
                  targetSkill={activeTargetSkill}
                  writingTask1Words={writingTask1.trim().split(/\s+/).filter(Boolean).length}
                  writingTask2Words={writingTask2.trim().split(/\s+/).filter(Boolean).length}
                />

                {/* Safe Exam Abandonment & Exit Confirmation Modal (Heuristic #3 & #5, Fitts's Law) */}
                <ExitConfirmationModal
                  isOpen={isExitModalOpen}
                  onClose={() => setIsExitModalOpen(false)}
                  onConfirmExit={handleConfirmExit}
                  answeredCount={totalAnsweredQuestions}
                  totalQuestions={totalPossibleQuestions}
                  examCode={examCode}
                />

                {/* Real-time Candidate Submission Progress Modal */}
                <SubmissionProgressModal
                  isOpen={isSubmitting}
                  isForcedTimeout={isForcedSubmitting}
                  sbd={sbd}
                  examCode={examCode}
                  answeredCount={totalAnsweredQuestions}
                  totalQuestions={totalPossibleQuestions}
                />

              </div>
            )}
          </div>
        )}

        {/* ADMIN VIEW */}
        {activeView === 'admin' && (
          <div className="space-y-6">
            
            {/* GitHub Pages Static Mode Info Alert */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-2xl">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-amber-300 text-xs uppercase tracking-wide">
                      Đang chạy chế độ GitHub Pages (Static Mode)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40">
                      Pure Static SPA
                    </span>
                  </div>
                  <p className="text-amber-200/90 text-[11px] mt-0.5">
                    Yêu cầu Google Sheet phải bật quyền <strong>&quot;Anyone with the link can view&quot;</strong> để GViz có thể nạp câu hỏi siêu tốc mà không cần máy chủ trung gian.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDiagnosticsOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-[11px] transition shrink-0 cursor-pointer shadow-md"
              >
                Cấu hình Sheet &amp; GViz
              </button>
            </div>

            {/* GAS Endpoint URL Config Bar */}
            <div className="bg-white/90 border border-purple-100/80 rounded-3xl p-5 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <div className="p-3 bg-[#E2DDEC] text-[#3C2A63] rounded-2xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#3C2A63]">Google Apps Script (GAS) Web App Endpoint</h3>
                  <p className="text-xs text-[#7C68A5]">Live Google Sheets backend endpoint integration</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full md:w-auto">
                <input
                  type="text"
                  value={gasUrl}
                  onChange={(e) => handleSaveGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="px-4 py-2.5 bg-[#E2DDEC] border border-purple-200/80 rounded-2xl text-xs text-[#3C2A63] font-medium w-full md:w-96 focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                />
                <span className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-200 rounded-xl shrink-0">
                  Active
                </span>
              </div>
            </div>

            {/* Admin Tab Content */}
            {adminTab === 'dashboard' && <MonitoringDashboard gasUrl={gasUrl} />}
            {adminTab === 'grading' && <ManualGrading gasUrl={gasUrl} />}
            {adminTab === 'upload' && (
              <UploadModule 
                onParsedData={(parsed) => handleSetExamData(parsed)} 
                onNavigateToPreview={() => setAdminTab('preview')}
                onTakeExamNow={(exam) => handleLaunchStudentExam(exam)}
              />
            )}
            {adminTab === 'custom_practice' && <CustomPracticeManager gasUrl={gasUrl} />}
            
            {adminTab === 'preview' && (
              <PreviewModule 
                gasUrl={gasUrl} 
                initialExamData={examData} 
                onSaveToGas={(savedExam) => handleSetExamData(savedExam)} 
              />
            )}

            {adminTab === 'gas_setup' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Code className="w-5 h-5 text-indigo-400" />
                      Google Apps Script Source Code (Backend REST API)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Instructions to configure Google Sheets with 4 tabs: EXAMS, QUESTIONS, SUBMISSIONS, CHEATLOGS
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsDiagnosticsOpen(true)}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Activity className="w-4 h-4 text-purple-200 animate-pulse" />
                      <span>Run DB Diagnostics</span>
                    </button>

                    <button
                      onClick={copyGasCode}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                    >
                      {copiedGasCode ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Code Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy GAS Script (Code.gs)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Setup Steps */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/40">1</span>
                    <h4 className="font-bold text-white">Create Google Sheet</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Create a spreadsheet named <strong>IELTS_Exam_System</strong>. Five tabs: <strong className="text-indigo-300">EXAMS, QUESTIONS, SUBMISSIONS, CHEATLOGS, PRACTICE_QUESTIONS</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/40">2</span>
                    <h4 className="font-bold text-white">Open Apps Script</h4>
                    <p className="text-slate-400 leading-relaxed">
                      In your Google Sheet, click <strong>Extensions</strong> &rarr; <strong>Apps Script</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/40">3</span>
                    <h4 className="font-bold text-white">Paste Backend Code</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Clear default code and paste the script below into <strong className="text-indigo-300">Code.gs</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/40">4</span>
                    <h4 className="font-bold text-white">Deploy Web App</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Click <strong>Deploy &rarr; New Deployment &rarr; Web App</strong>. Set Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>. Copy the Web App URL into the system.
                    </p>
                  </div>
                </div>

                {/* Google Sheet Schema Guide */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
                  <h4 className="text-sm font-bold text-amber-400">📋 Google Sheets Column Schema (Required):</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="font-bold text-indigo-300">1. Tab "EXAMS" (Exam Catalog):</span>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        Col A: exam_code | Col B: title | Col C: duration | Col D: mode (TEST / PRACTICE) | Col E: audio_url | Col F: passage_title | Col G: passage_text | Col H: writing_task1_prompt | Col I: writing_task2_prompt
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-emerald-300">2. Tab "QUESTIONS" (Questions List):</span>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        Col A: exam_code | Col B: question_id | Col C: section (listening / reading) | Col D: question_text | Col E: question_type (multiple_choice / fill_in_blank / true_false_not_given) | Col F: options (A. ...|B. ...|C. ...|D. ...) | Col G: correct_answer | Col H: max_score (1) | Col I: passage_title | Col J: passage_text | Col K: audio_url
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-purple-300">3. Tab "SUBMISSIONS" &amp; Tab "CHEATLOGS":</span>
                      <p className="text-[11px] text-slate-400">
                        System automatically records scores, student essays, and proctoring violation logs upon test completion.
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-sky-300">4. Tab "PRACTICE_QUESTIONS" (Practice Sets Database):</span>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        Col A: DECK_ID | Col B: DECK_TITLE | Col C: CATEGORY | Col D: DESCRIPTION | Col E: LEVEL | Col F: CARD_ID | Col G: SENTENCE_EN | Col H: SENTENCE_VI | Col I: CLOZE_TARGET | Col J: TARGET_WORD | Col K: PART_OF_SPEECH | Col L: PHONETIC | Col M: HINTS | Col N: OPTIONS_JSON | Col O: ACCEPTED_ANSWERS_JSON | Col P: EXPLANATION | Col Q: GRAMMAR_POINTS_JSON | Col R: DIFFICULTY | Col S: UPDATED_AT
                      </p>
                    </div>
                  </div>
                </div>

                {/* Code Block */}
                <div className="relative">
                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-indigo-200 font-mono overflow-x-auto max-h-96 leading-relaxed select-all">
                    {gasBackendScript}
                  </pre>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Automated Database & Connection Diagnostics Modal */}
      <DatabaseDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        apiUrl={gasUrl}
        initialExamCode={examCode || 'TEST01'}
        onApplyExam={(examDataLoaded) => {
          handleSetExamData(examDataLoaded);
          setIsDiagnosticsOpen(false);
        }}
      />

      {/* Page Reload Confirmation Modal */}
      <ReloadConfirmationModal
        isOpen={isReloadModalOpen}
        onCancel={handleCancelReload}
        onConfirmReload={handleConfirmReload}
        examCode={examCode}
        candidateId={sbd}
        isExamActive={isLoggedIn && currentModule !== 'results'}
      />

    </div>
  );
}
