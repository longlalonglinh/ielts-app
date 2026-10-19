import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HighlightingTool, Question, ReadingPassageItem } from '../../types';
import { 
  Paintbrush, 
  Eraser, 
  MoveHorizontal, 
  CheckCircle, 
  CheckCircle2, 
  BookOpen, 
  HelpCircle, 
  FileText, 
  ChevronRight,
  ChevronLeft,
  Filter,
  Check,
  RotateCcw,
  Sparkles,
  Maximize2,
  Save
} from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { IELTSQuestionCard } from './IELTSQuestionCard';

interface ReadingModuleProps {
  passageTitle?: string;
  passageText?: string;
  passages?: ReadingPassageItem[];
  questions?: Question[];
  userAnswers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  testMode?: 'TEST' | 'PRACTICE';
  durationMins?: number;
  examCode?: string;
  candidateId?: string;
  onTimeExpire?: () => void;
  isPreview?: boolean;
}

export const ReadingModule: React.FC<ReadingModuleProps> = ({
  passageTitle,
  passageText = '',
  passages,
  questions = [],
  userAnswers,
  onAnswerChange,
  testMode = 'TEST',
  durationMins = 60,
  examCode = '',
  candidateId = '',
  onTimeExpire,
  isPreview = false
}) => {
  const [leftWidth, setLeftWidth] = useState<number>(50); // 50% default split
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeColor, setActiveColor] = useState<'yellow' | 'green' | 'blue'>('yellow');
  const [highlights, setHighlights] = useState<HighlightingTool[]>([]);
  const [activePassageIndex, setActivePassageIndex] = useState<1 | 2 | 3>(1);
  const [filterMode, setFilterMode] = useState<'current_passage' | 'all' | 'unanswered'>('current_passage');
  const [mobileTab, setMobileTab] = useState<'questions' | 'passage'>('questions');
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [tabletSplitEnabled, setTabletSplitEnabled] = useState<boolean>(false);
  const [fontScale, setFontScale] = useState<'sm' | 'base' | 'lg'>('base');
  const [autoSaveTime, setAutoSaveTime] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());

  const handleToggleFlag = (qid: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  useEffect(() => {
    if (!isPreview && Object.keys(userAnswers).length > 0) {
      setIsSaving(true);
      const timer = setTimeout(() => {
        setAutoSaveTime(new Date().toLocaleTimeString());
        setIsSaving(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [userAnswers, isPreview]);

  // Track window resize to ensure fluid responsive layout on mobile, tablet, and desktop
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

  const passageContainerRef = useRef<HTMLDivElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Standardize and normalize passages with direct questions embedding
  const normalizedPassages = useMemo<ReadingPassageItem[]>(() => {
    if (passages && Array.isArray(passages) && passages.length > 0) {
      // Filter passages that have either text or questions
      const validPassages = passages.filter(p => (p.text && p.text.trim()) || (p.questions && p.questions.length > 0));
      const sourcePassages = validPassages.length > 0 ? validPassages : passages;

      const hasQuestionsInside = sourcePassages.some(p => p.questions && p.questions.length > 0);
      if (hasQuestionsInside) {
        return sourcePassages.map((p, idx) => ({
          passage_index: (p.passage_index || idx + 1) as 1 | 2 | 3,
          title: p.title || `Reading Passage ${p.passage_index || idx + 1}`,
          text: p.text || '',
          questions: p.questions || []
        }));
      }

      // If passages exist but questions were provided at root level
      return sourcePassages.map((p, idx) => {
        const pIdx = (p.passage_index || idx + 1) as 1 | 2 | 3;
        const pQs = questions.filter(q => {
          if (q.passage_index) return q.passage_index === pIdx;
          const qIdx = questions.indexOf(q);
          if (pIdx === 1 && qIdx < 13) return true;
          if (pIdx === 2 && qIdx >= 13 && qIdx < 26) return true;
          if (pIdx === 3 && qIdx >= 26) return true;
          return false;
        });

        return {
          passage_index: pIdx,
          title: p.title || `Reading Passage ${pIdx}`,
          text: p.text || '',
          questions: pQs
        };
      });
    }

    // Fallback: parse passageText or construct from questions
    const p1Questions = questions.filter(q => q.passage_index === 1 || (!q.passage_index && questions.indexOf(q) < 13));
    const p2Questions = questions.filter(q => q.passage_index === 2 || (!q.passage_index && questions.indexOf(q) >= 13 && questions.indexOf(q) < 26));
    const p3Questions = questions.filter(q => q.passage_index === 3 || (!q.passage_index && questions.indexOf(q) >= 26));

    const result: ReadingPassageItem[] = [
      {
        passage_index: 1,
        title: passageTitle || 'Reading Passage 1',
        text: passageText || (questions.length > 0 ? 'Reading Passage' : 'No passage text available for Passage 1.'),
        questions: p1Questions
      }
    ];

    if (p2Questions.length > 0) {
      result.push({
        passage_index: 2,
        title: 'Reading Passage 2',
        text: '',
        questions: p2Questions
      });
    }

    if (p3Questions.length > 0) {
      result.push({
        passage_index: 3,
        title: 'Reading Passage 3',
        text: '',
        questions: p3Questions
      });
    }

    return result;
  }, [passages, passageText, passageTitle, questions]);

  // 2. Build flat list of all 40 questions with global indexing and passage assignment
  const all40Questions = useMemo(() => {
    let list: (Question & { globalNumber: number; assignedPassage: 1 | 2 | 3 })[] = [];
    let counter = 1;

    normalizedPassages.forEach((p) => {
      (p.questions || []).forEach((q) => {
        list.push({
          ...q,
          globalNumber: counter++,
          assignedPassage: p.passage_index
        });
      });
    });

    // Fallback if normalizedPassages had no questions but questions prop exists
    if (list.length === 0 && questions.length > 0) {
      list = questions.map((q, idx) => {
        const assigned: 1 | 2 | 3 = q.passage_index || (idx < 13 ? 1 : idx < 26 ? 2 : 3);
        return {
          ...q,
          globalNumber: idx + 1,
          assignedPassage: assigned
        };
      });
    }

    return list;
  }, [normalizedPassages, questions]);

  // 3. Current active passage data
  const currentPassage = useMemo(() => {
    const found = normalizedPassages.find(p => p.passage_index === activePassageIndex);
    if (found) return found;
    return normalizedPassages[0] || {
      passage_index: 1,
      title: 'Reading Passage 1',
      text: passageText,
      questions: []
    };
  }, [normalizedPassages, activePassageIndex, passageText]);

  // 4. Questions filtered according to filterMode
  const displayedQuestions = useMemo(() => {
    if (filterMode === 'all') {
      return all40Questions;
    }
    if (filterMode === 'unanswered') {
      return all40Questions.filter(q => !userAnswers[q.question_id] || userAnswers[q.question_id].trim() === '');
    }
    // 'current_passage' mode: questions belonging directly to activePassageIndex
    return all40Questions.filter(q => q.assignedPassage === activePassageIndex);
  }, [all40Questions, filterMode, activePassageIndex, userAnswers]);

  // 5. Resizable Split-Screen Drag Logic with Global Window Listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      if (percentage >= 25 && percentage <= 75) {
        setLeftWidth(percentage);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing || !splitContainerRef.current || !e.touches[0]) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const relativeX = e.touches[0].clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      if (percentage >= 25 && percentage <= 75) {
        setLeftWidth(percentage);
      }
    };

    const handleEnd = () => {
      if (isResizing) {
        setIsResizing(false);
      }
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

  // 6. Multi-color highlighter logic
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return;

    const colorHexMap = {
      yellow: '#fef08a', // yellow-200
      green: '#86efac',  // green-300
      blue: '#93c5fd',   // blue-300
    };

    const newHighlight: HighlightingTool = {
      id: 'hl_' + Date.now(),
      text: selectedText,
      color: activeColor,
      color_hex: colorHexMap[activeColor],
    };

    setHighlights((prev) => [...prev, newHighlight]);
    selection.removeAllRanges();
  };

  const handleRemoveHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const clearAllHighlights = () => {
    setHighlights([]);
  };

  const renderHighlightedPassage = (textToRender: string) => {
    const fontClass = fontScale === 'sm' 
      ? 'text-[13.5px] leading-relaxed' 
      : fontScale === 'lg' 
      ? 'text-[17px] leading-loose' 
      : 'text-[15px] leading-relaxed';

    if (highlights.length === 0) {
      return (
        <div className={`whitespace-pre-wrap ${fontClass} text-[#2D1E4B] font-serif font-normal space-y-4`}>
          {textToRender}
        </div>
      );
    }

    let htmlContent = textToRender;
    highlights.forEach((hl) => {
      const regex = new RegExp(`(${hl.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      htmlContent = htmlContent.replace(
        regex,
        `<mark style="background-color: ${hl.color_hex}; color: #0f172a; padding: 2px 4px; border-radius: 4px; font-weight: 600;">$1</mark>`
      );
    });

    return (
      <div
        className={`whitespace-pre-wrap ${fontClass} text-[#2D1E4B] font-serif font-normal space-y-4`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  };

  // 7. Question Navigation Helper: scroll and auto-switch passage
  const handleJumpToQuestion = (question: Question & { globalNumber: number; assignedPassage: 1 | 2 | 3 }) => {
    if (activePassageIndex !== question.assignedPassage) {
      setActivePassageIndex(question.assignedPassage);
    }
    if (filterMode === 'unanswered' && !!userAnswers[question.question_id]) {
      setFilterMode('current_passage');
    }

    setHighlightedQuestionId(question.question_id);
    setTimeout(() => {
      const el = document.getElementById(`rq_box_${question.question_id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setHighlightedQuestionId(null), 2500);
    }, 100);
  };

  // Global counts
  const totalAnswered = useMemo(() => {
    return all40Questions.filter(q => !!userAnswers[q.question_id] && userAnswers[q.question_id].trim() !== '').length;
  }, [all40Questions, userAnswers]);

  return (
    <div className="space-y-4 pb-28">
      
      {/* 1. TOP COUNTDOWN TIMER BAR */}
      <CountdownTimer
        initialMinutes={durationMins}
        testMode={testMode}
        sectionName={`ACADEMIC READING (${all40Questions.length} Questions / ${normalizedPassages.length} Passage${normalizedPassages.length > 1 ? 's' : ''})`}
        sessionKey={`${examCode || 'EXAM'}_${candidateId || 'USER'}_reading`}
        onTimeExpire={onTimeExpire}
      />

      {/* 2. PASSAGE TABS & FILTER MATRIX BAR */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-4 shadow-xl shadow-purple-950/5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Passage Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {normalizedPassages.map((p) => {
            const pQuestions = all40Questions.filter(q => q.assignedPassage === p.passage_index);
            const answeredInPassage = pQuestions.filter(q => !!userAnswers[q.question_id] && userAnswers[q.question_id].trim() !== '').length;
            const isActive = activePassageIndex === p.passage_index;

            return (
              <button
                key={p.passage_index}
                type="button"
                onClick={() => {
                  setActivePassageIndex(p.passage_index);
                  if (filterMode !== 'all' && filterMode !== 'unanswered') {
                    setFilterMode('current_passage');
                  }
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#6B51A5] text-white shadow-md'
                    : 'bg-[#F5F2F9] text-[#503A7A] hover:bg-[#E2DDEC] border border-purple-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Passage {p.passage_index}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : answeredInPassage === pQuestions.length && pQuestions.length > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-purple-200/80 text-[#503A7A]'
                }`}>
                  {answeredInPassage}/{pQuestions.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Question Filter Modes */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#F5F2F9] p-1 rounded-2xl border border-purple-100 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('current_passage')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                filterMode === 'current_passage' ? 'bg-[#6B51A5] text-white shadow-sm' : 'text-[#503A7A] hover:text-[#3C2A63]'
              }`}
            >
              Passage {activePassageIndex}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                filterMode === 'all' ? 'bg-[#6B51A5] text-white shadow-sm' : 'text-[#503A7A] hover:text-[#3C2A63]'
              }`}
            >
              All 40 Questions
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unanswered')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1 ${
                filterMode === 'unanswered' ? 'bg-amber-600 text-white shadow-sm' : 'text-[#503A7A] hover:text-[#3C2A63]'
              }`}
            >
              <span>Unanswered</span>
              <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-mono">
                {all40Questions.length - totalAnswered}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pl-2">
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

            <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all shadow-2xs ${
              isSaving 
                ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`} title="Tiến trình làm bài thi được tự động lưu liên tục vào IndexedDB offline">
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
              <span>{isSaving ? 'Đang lưu...' : autoSaveTime ? `✓ Đã tự động lưu (${autoSaveTime})` : '✓ Đã bảo vệ dữ liệu'}</span>
            </span>

            <span className="hidden lg:inline text-xs text-[#7C68A5] font-medium">
              Answered: <strong className="text-[#6B51A5] font-black">{totalAnswered}</strong> / {all40Questions.length}
            </span>
          </div>
        </div>

      </div>

      {/* 3. MOBILE & TABLET VIEW SWITCHER */}
      {!isDesktop && (
        <div className="flex items-center justify-between bg-purple-50 p-1.5 rounded-2xl border border-purple-200 shadow-xs">
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => setMobileTab('passage')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                mobileTab === 'passage' ? 'bg-[#6B51A5] text-white shadow-md' : 'text-[#503A7A] hover:bg-purple-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>📖 Reading Passage (Passage {activePassageIndex})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('questions')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                mobileTab === 'questions' ? 'bg-[#6B51A5] text-white shadow-md' : 'text-[#503A7A] hover:bg-purple-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>❓ Questions ({displayedQuestions.length} Qs)</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. SPLIT SCREEN WORKSPACE WITH DRAGGABLE RESIZER */}
      <div
        ref={splitContainerRef}
        className="flex flex-col md:flex-row h-[calc(100dvh-13rem)] min-h-[460px] max-h-[850px] bg-white rounded-3xl border border-purple-100/80 overflow-hidden shadow-xl shadow-purple-950/5 relative"
      >
        
        {/* LEFT COLUMN: READING PASSAGE & HIGHLIGHTER */}
        <div
          className={`h-full flex flex-col bg-[#F8F6FC] ${isDesktop ? 'border-r border-purple-100' : ''} overflow-hidden w-full ${
            !isDesktop && mobileTab === 'questions' ? 'hidden' : 'flex'
          }`}
          style={{
            width: isDesktop ? `${leftWidth}%` : '100%'
          }}
        >
          {/* Passage Toolbar */}
          <div className="p-3 bg-white border-b border-purple-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2">
              <Paintbrush className="w-4 h-4 text-[#6B51A5]" />
              <span className="text-xs font-extrabold text-[#3C2A63] uppercase tracking-wider">Highlight:</span>
              
              {/* Color Pickers */}
              <div className="flex items-center space-x-1.5 ml-1">
                <button
                  type="button"
                  onClick={() => setActiveColor('yellow')}
                  className={`w-6 h-6 rounded-full bg-yellow-300 border-2 transition ${
                    activeColor === 'yellow' ? 'border-[#3C2A63] scale-110 shadow' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title="Yellow Highlight"
                />
                <button
                  type="button"
                  onClick={() => setActiveColor('green')}
                  className={`w-6 h-6 rounded-full bg-green-400 border-2 transition ${
                    activeColor === 'green' ? 'border-[#3C2A63] scale-110 shadow' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title="Green Highlight"
                />
                <button
                  type="button"
                  onClick={() => setActiveColor('blue')}
                  className={`w-6 h-6 rounded-full bg-blue-400 border-2 transition ${
                    activeColor === 'blue' ? 'border-[#3C2A63] scale-110 shadow' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title="Blue Highlight"
                />
              </div>

              {/* Font Size Zoom Controls */}
              <div className="flex items-center gap-1 border-l border-purple-100 pl-2">
                <button
                  type="button"
                  onClick={() => setFontScale('sm')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                    fontScale === 'sm' ? 'bg-[#3C2A63] text-white shadow-xs' : 'bg-purple-50 text-[#503A7A] hover:bg-purple-100'
                  }`}
                  title="Small font size (compact)"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontScale('base')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                    fontScale === 'base' ? 'bg-[#3C2A63] text-white shadow-xs' : 'bg-purple-50 text-[#503A7A] hover:bg-purple-100'
                  }`}
                  title="Standard font size"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setFontScale('lg')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                    fontScale === 'lg' ? 'bg-[#3C2A63] text-white shadow-xs' : 'bg-purple-50 text-[#503A7A] hover:bg-purple-100'
                  }`}
                  title="Large font size"
                >
                  A+
                </button>
              </div>

              {/* Quick Split Ratio Presets on 13" and Desktop */}
              <div className="hidden md:flex items-center gap-1 pl-2 border-l border-purple-100">
                <button
                  type="button"
                  onClick={() => setLeftWidth(50)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    leftWidth === 50 ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-purple-50 text-[#503A7A] hover:bg-purple-100'
                  }`}
                  title="Balanced 50/50"
                >
                  50:50
                </button>
                <button
                  type="button"
                  onClick={() => setLeftWidth(60)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    leftWidth === 60 ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-purple-50 text-[#503A7A] hover:bg-purple-100'
                  }`}
                  title="Expand passage 60%"
                >
                  Passage 60%
                </button>
                <button
                  type="button"
                  onClick={() => setLeftWidth(40)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    leftWidth === 40 ? 'bg-[#6B51A5] text-white shadow-xs' : 'bg-purple-50 text-[#503A7A] hover:bg-purple-100'
                  }`}
                  title="Expand questions 60%"
                >
                  Questions 60%
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {highlights.length > 0 && (
                <button
                  onClick={clearAllHighlights}
                  className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Clear ({highlights.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Passage Content */}
          <div
            ref={passageContainerRef}
            onMouseUp={handleTextSelection}
            className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overscroll-contain select-text font-serif leading-relaxed text-[#3C2A63]"
          >
            <div className="mb-4 pb-3 border-b border-purple-200">
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-[#503A7A] uppercase tracking-wider">
                Passage {currentPassage.passage_index} of {normalizedPassages.length}
              </span>
              <h2 className="text-xl font-extrabold text-[#3C2A63] font-sans mt-2">
                {currentPassage.title}
              </h2>
            </div>
            {renderHighlightedPassage(currentPassage.text)}
          </div>

          {/* Mobile & Tablet Jump to Questions Footer Banner */}
          {!isDesktop && (
            <div className="p-3 bg-white border-t border-purple-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-[#7C68A5] font-semibold">
                Passage {currentPassage.passage_index} ({displayedQuestions.length} questions)
              </span>
              <button
                type="button"
                onClick={() => setMobileTab('questions')}
                className="bg-[#6B51A5] hover:bg-[#503A7A] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <span>Answer Questions</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* DRAGGABLE RESIZER SPLIT HANDLE (Desktop only) */}
        <div
          onMouseDown={() => setIsResizing(true)}
          onTouchStart={() => setIsResizing(true)}
          onDoubleClick={() => setLeftWidth(50)}
          className={`hidden md:flex w-3 hover:w-3.5 bg-[#E2DDEC] hover:bg-[#6B51A5] active:bg-[#503A7A] cursor-col-resize items-center justify-center transition-all shrink-0 z-20 select-none touch-none ${
            isResizing ? 'bg-[#6B51A5] shadow-lg ring-2 ring-[#6B51A5]/40' : ''
          }`}
          title="Drag to resize split panes (Double-click to reset 50/50)"
        >
          <div className="h-8 w-1 bg-white/60 rounded-full flex flex-col justify-center items-center gap-0.5 pointer-events-none">
            <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
            <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
            <div className="w-0.5 h-1 bg-[#3C2A63] rounded-full" />
          </div>
        </div>

        {/* RIGHT COLUMN: READING QUESTIONS */}
        <div
          className={`h-full flex flex-col bg-white overflow-hidden w-full ${
            !isDesktop && mobileTab === 'passage' ? 'hidden' : 'flex'
          }`}
          style={{
            width: isDesktop ? `${100 - leftWidth}%` : '100%'
          }}
        >
          {/* Header Bar */}
          <div className="p-3.5 bg-[#F8F6FC] border-b border-purple-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-extrabold text-[#3C2A63] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#6B51A5]" />
              <span>
                {filterMode === 'all'
                  ? `All Questions (${all40Questions.length} Qs)`
                  : filterMode === 'unanswered'
                  ? `Unanswered Questions (${displayedQuestions.length} remaining)`
                  : `Passage ${activePassageIndex} Questions (${displayedQuestions.length} questions)`}
              </span>
            </span>

            <div className="flex items-center gap-2">
              {/* Quick Jump back to Passage on Mobile/Tablet */}
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setMobileTab('passage')}
                  className="bg-[#6B51A5] hover:bg-[#503A7A] text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <BookOpen className="w-3 h-3 text-purple-200" />
                  <span>View Passage</span>
                </button>
              )}

              {/* Jump buttons within current filtered view */}
              <div className="flex flex-wrap gap-1">
                {displayedQuestions.map((q, idx) => {
                  const isAns = !!userAnswers[q.question_id] && userAnswers[q.question_id].trim() !== '';
                  return (
                    <button
                      key={`${q.question_id || 'rq_nav'}-${idx}`}
                      type="button"
                      onClick={() => handleJumpToQuestion(q)}
                      className={`w-6 h-6 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center justify-center ${
                        isAns
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[#E2DDEC] hover:bg-[#D9D3E4] text-[#3C2A63]'
                      }`}
                      title={`Question ${q.globalNumber}`}
                    >
                      {q.globalNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scrollable Questions List with generous bottom padding for fixed footer */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-6 pb-36 md:pb-28">
            {displayedQuestions.length === 0 ? (
              <div className="p-12 text-center bg-purple-50/50 rounded-3xl border border-dashed border-purple-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-extrabold text-[#3C2A63]">All questions in this section are answered!</h4>
                <p className="text-xs text-[#7C68A5] mt-1">
                  Use the navigation bar below to review or proceed to other passages.
                </p>
              </div>
            ) : (
              displayedQuestions.map((q, idx) => (
                <div
                  key={`${q.question_id || 'rq'}-${idx}`}
                  id={`rq_box_${q.question_id}`}
                  className={`transition-all duration-300 rounded-3xl ${
                    highlightedQuestionId === q.question_id ? 'ring-4 ring-[#6B51A5] shadow-xl' : ''
                  }`}
                >
                  <IELTSQuestionCard
                    question={q}
                    questionNumber={q.globalNumber}
                    userAnswer={userAnswers[q.question_id] || ''}
                    onAnswerChange={onAnswerChange}
                    headingsList={q.headings_list}
                    isFlagged={flaggedQuestions.has(q.question_id)}
                    onToggleFlag={handleToggleFlag}
                    allUserAnswers={userAnswers}
                    allQuestions={all40Questions}
                  />
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 5. DEDICATED 40-QUESTION NAVIGATION FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-purple-200/80 shadow-2xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Left metrics & Legend (Heuristic #4 & #6 Recognition rather than recall) */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-[#3C2A63]">Question Matrix:</span>
            </div>
            <span className="text-xs font-bold text-[#6B51A5] bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100">
              {totalAnswered} / {all40Questions.length} Answered
            </span>

            {/* 4-State Standardized Legend (Heuristic #4 & Audit Issue #3) */}
            <div className="hidden lg:flex items-center gap-2.5 text-[10px] text-[#7C68A5] font-semibold border-l border-purple-100 pl-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300 inline-block" />
                <span>Chưa làm</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-purple-100 border-2 border-[#6B51A5] inline-block" />
                <span>Đang chọn</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
                <span>Đã trả lời</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400 border border-amber-500 inline-block" />
                <span>Đánh dấu</span>
              </span>
            </div>
          </div>

          {/* Center 40 Questions Grid with 4 unambiguous states (Never green unless answered) */}
          <div className="flex-1 overflow-x-auto max-w-full pb-1">
            <div className="flex items-center gap-1 min-w-max justify-center">
              {all40Questions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.question_id] && userAnswers[q.question_id].trim() !== '';
                const isFlagged = flaggedQuestions.has(q.question_id);
                const isCurrent = highlightedQuestionId === q.question_id;
                const isCurrentPassage = activePassageIndex === q.assignedPassage;

                // Priority: Flagged > Answered > Current active > Current passage > Unanswered
                let stateClasses = 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'; // Unanswered
                if (isFlagged) {
                  stateClasses = 'bg-amber-400 text-amber-950 font-black border border-amber-500 shadow-2xs hover:bg-amber-500';
                } else if (isAnswered) {
                  stateClasses = 'bg-emerald-600 text-white font-black shadow-xs hover:bg-emerald-700'; // Answered
                } else if (isCurrent) {
                  stateClasses = 'bg-purple-100 text-[#503A7A] border-2 border-[#6B51A5] font-black ring-2 ring-purple-300 shadow-sm'; // Current active unattempted
                } else if (isCurrentPassage) {
                  stateClasses = 'bg-purple-50 text-[#503A7A] border border-purple-200 hover:bg-purple-100 font-bold'; // Current passage unattempted
                }

                return (
                  <button
                    key={`${q.question_id || 'all40'}-${idx}`}
                    type="button"
                    onClick={() => handleJumpToQuestion(q)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center relative ${stateClasses} ${
                      isCurrent ? 'ring-2 ring-[#6B51A5] scale-110 z-10' : ''
                    }`}
                    title={`Câu ${q.globalNumber} (Passage ${q.assignedPassage}) - ${
                      isFlagged ? 'Đã đánh dấu xem lại' : isAnswered ? 'Đã trả lời' : isCurrent ? 'Đang chọn' : 'Chưa làm'
                    }`}
                    aria-label={`Câu ${q.globalNumber} - ${
                      isFlagged ? 'Đã đánh dấu xem lại' : isAnswered ? 'Đã trả lời' : 'Chưa làm'
                    }`}
                  >
                    <span>{q.globalNumber}</span>
                    {isFlagged && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-800" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Navigation Shortcut Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activePassageIndex > 1) {
                  setActivePassageIndex((activePassageIndex - 1) as 1 | 2 | 3);
                }
              }}
              disabled={activePassageIndex <= 1}
              className="px-3 py-1.5 bg-[#F5F2F9] hover:bg-[#E2DDEC] text-[#3C2A63] disabled:opacity-30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev Passage</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (activePassageIndex < normalizedPassages.length) {
                  setActivePassageIndex((activePassageIndex + 1) as 1 | 2 | 3);
                }
              }}
              disabled={activePassageIndex >= normalizedPassages.length}
              className="px-3 py-1.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white disabled:opacity-30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md"
            >
              <span>Next Passage</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
