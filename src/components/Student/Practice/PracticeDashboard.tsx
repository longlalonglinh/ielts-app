import React, { useState, useEffect } from 'react';
import { CustomPracticeDeck, PracticeUserStats, PracticeCard, LearnerProfile } from '../../../types/practice';
import { 
  Sparkles, 
  Flame, 
  Target, 
  Award, 
  RotateCcw, 
  Play, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  ArrowLeft, 
  ShieldCheck, 
  ChevronRight, 
  PlusCircle, 
  Globe, 
  BarChart3,
  TrendingUp,
  RefreshCw,
  LogOut,
  FolderOpen,
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronLeft,
  Database,
  User,
  Users,
  Edit3,
  Check,
  Info
} from 'lucide-react';
import { practiceService } from '../../../services/practiceService';
import { PracticeCardView } from './PracticeCardView';
import { LearnerSelectModal } from './LearnerSelectModal';

interface PracticeDashboardProps {
  initialDeckId?: string;
  candidateSbd?: string;
  onExitToLogin: () => void;
  onOpenDeckManager?: () => void;
  gasUrl?: string;
}

export const PracticeDashboard: React.FC<PracticeDashboardProps> = ({
  initialDeckId = 'ON_TAP_01',
  candidateSbd = 'LEARNER_01',
  onExitToLogin,
  onOpenDeckManager,
  gasUrl
}) => {
  const [allDecks, setAllDecks] = useState<CustomPracticeDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<CustomPracticeDeck | null>(null);
  
  // 3 Learners Profile State
  const [learners, setLearners] = useState<LearnerProfile[]>(() => practiceService.getLearners());
  const [currentLearner, setCurrentLearner] = useState<LearnerProfile>(() => practiceService.getCurrentLearner());
  const [isLearnerModalOpen, setIsLearnerModalOpen] = useState(false);
  const [isSyncingProgress, setIsSyncingProgress] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // User Stats loaded specifically for current learner
  const [userStats, setUserStats] = useState<PracticeUserStats>(() => 
    practiceService.getUserStats(practiceService.getCurrentLearner().student_id)
  );
  
  const [isLoadingDeck, setIsLoadingDeck] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSyncingWithSheets, setIsSyncingWithSheets] = useState(false);
  const [dbStatus, setDbStatus] = useState(() => practiceService.getDatabaseStatus());

  // Active Session State
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState<Record<string, boolean>>({});
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Security / Proctoring Integrity Tracker
  const [securityViolations, setSecurityViolations] = useState<number>(0);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Search, Filter, Sort & Pagination for Multiple Practice Decks
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'cards_desc' | 'mastery_desc' | 'title_asc'>('newest');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewLayout === 'grid' ? 6 : 8;

  // Handle Switch Learner
  const handleSelectLearner = (learnerId: string) => {
    const updated = practiceService.setCurrentLearner(learnerId);
    setCurrentLearner(updated);
    const newStats = practiceService.getUserStats(updated.student_id);
    setUserStats(newStats);
  };

  // Handle Update Learner Name
  const handleUpdateLearnerName = (learnerId: string, newName: string) => {
    const updated = practiceService.updateLearnerName(learnerId, newName);
    setLearners(practiceService.getLearners());
    if (currentLearner.student_id === learnerId) {
      setCurrentLearner(updated);
    }
    // Sync update to sheets in background if gasUrl exists
    if (gasUrl) {
      practiceService.syncLearnerProgressToSheets(gasUrl, learnerId).catch(e => console.debug('Sync error:', e));
    }
  };

  // Manual Sync Learner Progress to Google Sheets
  const handleSyncLearnerProgress = async () => {
    if (!gasUrl) {
      setSyncFeedback('Google Apps Script URL is not configured.');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    setIsSyncingProgress(true);
    setSyncFeedback(null);
    try {
      const res = await practiceService.syncLearnerProgressToSheets(gasUrl, currentLearner.student_id);
      if (res.success) {
        setSyncFeedback(res.message || 'Learner progress successfully synced to Google Sheets!');
      } else {
        setSyncFeedback(res.error || 'Sync failed. Please check Google Sheets permissions.');
      }
    } catch (e: any) {
      setSyncFeedback('Sync connection error: ' + (e?.message || ''));
    } finally {
      setIsSyncingProgress(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // Sync Questions with Google Sheets tab PRACTICE_QUESTIONS
  const handleSyncWithSheets = async () => {
    if (!gasUrl) return;
    setIsSyncingWithSheets(true);
    try {
      const res = await practiceService.fetchFromSheets(gasUrl);
      if (res.success && res.decks && res.decks.length > 0) {
        setAllDecks(practiceService.getAllDecks());
        setDbStatus(practiceService.getDatabaseStatus());
        const current = await practiceService.getDeckById(activeDeck?.deck_id || initialDeckId, gasUrl);
        if (current) setActiveDeck(current);
      }
    } catch (e) {
      console.error('Error syncing practice questions from Sheets:', e);
    } finally {
      setIsSyncingWithSheets(false);
    }
  };

  // Load Decks & User Stats
  const loadDeckData = async (targetId: string) => {
    setIsLoadingDeck(true);
    setLoadError(null);
    try {
      const decks = practiceService.getAllDecks();
      setAllDecks(decks);

      const deck = await practiceService.getDeckById(targetId, gasUrl);
      if (deck) {
        setActiveDeck(deck);
      } else {
        setLoadError(`Practice deck not found with ID: "${targetId}".`);
      }
    } catch (e: any) {
      console.error('Error loading deck:', e);
      setLoadError('Failed to load practice deck data.');
    } finally {
      setIsLoadingDeck(false);
    }
  };

  useEffect(() => {
    loadDeckData(initialDeckId);
    setUserStats(practiceService.getUserStats(currentLearner.student_id));
    
    // Auto-sync questions in background if gasUrl is available
    if (gasUrl) {
      practiceService.fetchFromSheets(gasUrl).then(res => {
        if (res.success && res.decks && res.decks.length > 0) {
          setAllDecks(practiceService.getAllDecks());
          setDbStatus(practiceService.getDatabaseStatus());
        }
      }).catch(err => console.debug('Initial sheets fetch note:', err));
    }
  }, [initialDeckId, gasUrl]);

  // Anti-Cheat & Security Monitoring
  useEffect(() => {
    if (!isPracticing) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setSecurityViolations(prev => {
          const nextCount = prev + 1;
          const logsRaw = localStorage.getItem('ielts_cheat_logs');
          const logs = logsRaw ? JSON.parse(logsRaw) : [];
          logs.push({
            sbd: currentLearner.student_name || candidateSbd,
            exam_code: activeDeck?.deck_id || 'PRACTICE',
            type: 'TAB_SWITCH',
            timestamp: new Date().toISOString(),
            message: `Learner ${currentLearner.student_name} (${currentLearner.student_id}) left the practice tab (count: ${nextCount})`
          });
          localStorage.setItem('ielts_cheat_logs', JSON.stringify(logs));
          return nextCount;
        });

        setSecurityNotice('⚠️ Integrity Notice: You navigated away from the practice screen!');
        setTimeout(() => setSecurityNotice(null), 4000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPracticing, candidateSbd, activeDeck?.deck_id, currentLearner]);

  const handleStartPractice = (deckToStart?: CustomPracticeDeck) => {
    const deck = deckToStart || activeDeck;
    if (!deck || deck.cards.length === 0) return;
    setActiveDeck(deck);
    setCurrentCardIndex(0);
    setSessionResults({});
    setSessionCompleted(false);
    setIsPracticing(true);
  };

  const handleNextCard = (isCorrect: boolean) => {
    if (!activeDeck) return;
    const currentCard = activeDeck.cards[currentCardIndex];
    const newResults = {
      ...sessionResults,
      [currentCard.id]: isCorrect
    };
    setSessionResults(newResults);

    if (currentCardIndex + 1 < activeDeck.cards.length) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      // Complete Session for active learner
      const totalCards = activeDeck.cards.length;
      const correctCount = Object.values(newResults).filter(Boolean).length;
      const updatedStats = practiceService.recordPracticeSession(
        activeDeck.deck_id,
        activeDeck.title,
        totalCards,
        correctCount,
        newResults,
        currentLearner.student_id
      );
      setUserStats(updatedStats);
      setSessionCompleted(true);

      // Auto-sync progress to Google Sheets tab STUDENT_PROGRESS
      if (gasUrl) {
        practiceService.syncLearnerProgressToSheets(gasUrl, currentLearner.student_id)
          .then(res => {
            if (res.success) {
              setSyncFeedback('✓ Progress automatically synchronized to Google Sheets (STUDENT_PROGRESS tab)!');
              setTimeout(() => setSyncFeedback(null), 3500);
            }
          })
          .catch(e => console.debug('Auto sync note:', e));
      }
    }
  };

  const calculateDeckMastery = (deck: CustomPracticeDeck) => {
    if (!deck.cards || deck.cards.length === 0) return 0;
    const masteredCount = deck.cards.filter(c => userStats.cards_state[c.id]?.mastered).length;
    return Math.round((masteredCount / deck.cards.length) * 100);
  };

  // Filter, Search, Sort & Paginate Decks
  const filteredDecks = React.useMemo(() => {
    return allDecks.filter(deck => {
      const matchSearch = !searchQuery.trim() || 
        deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.deck_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'ALL' || deck.category === selectedCategory;
      const matchLevel = selectedLevel === 'ALL' || deck.level === selectedLevel;

      return matchSearch && matchCategory && matchLevel;
    }).sort((a, b) => {
      if (sortBy === 'cards_desc') return (b.cards?.length || 0) - (a.cards?.length || 0);
      if (sortBy === 'mastery_desc') return calculateDeckMastery(b) - calculateDeckMastery(a);
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
      return 0;
    });
  }, [allDecks, searchQuery, selectedCategory, selectedLevel, sortBy, userStats]);

  const totalPages = Math.max(1, Math.ceil(filteredDecks.length / pageSize));
  const paginatedDecks = filteredDecks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedLevel, sortBy, viewLayout]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F2F9] text-[#3C2A63] flex flex-col font-sans">
      
      {/* Top Header Bar - Synchronized with Exam Interface Style */}
      <div className="bg-white border-b border-purple-100 px-4 md:px-8 py-3 shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Left: Exit/Back & Current Active Deck Info */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => {
                if (isPracticing) {
                  setIsPracticing(false);
                } else {
                  onExitToLogin();
                }
              }}
              className="p-2 text-[#503A7A] hover:text-[#3C2A63] hover:bg-[#E2DDEC]/60 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isPracticing ? 'Exit Practice' : 'Back'}</span>
            </button>

            <div className="h-5 w-px bg-purple-200 hidden sm:block" />

            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 text-[#6B51A5] flex items-center justify-center font-bold text-xs">
                EN
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-[#3C2A63] tracking-tight">
                    {activeDeck?.title || 'Practice Deck'}
                  </h2>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                    {activeDeck?.level || 'B1-B2'}
                  </span>
                </div>
                <span className="text-[11px] text-[#7C68A5]">
                  {activeDeck?.category || 'Academic English'} • CEFR {activeDeck?.level || 'B1-B2'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Learner Selector (3 Learners) & Database Sync */}
          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end flex-wrap">
            
            {/* Active Learner Pill */}
            <button
              onClick={() => setIsLearnerModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-[#F5F2F9] hover:bg-purple-100/70 border border-purple-200 rounded-2xl text-xs text-[#3C2A63] font-semibold transition cursor-pointer shadow-sm group"
              title="Click to switch learner or edit name (Supports 3 learners)"
            >
              <div className={`w-6 h-6 rounded-full ${currentLearner.avatar_color} text-white flex items-center justify-center text-[10px] font-bold shadow-xs`}>
                {currentLearner.slot_index}
              </div>
              <div className="text-left">
                <span className="block leading-none text-[#3C2A63] group-hover:text-[#6B51A5] font-bold">
                  {currentLearner.student_name}
                </span>
                <span className="text-[10px] text-[#7C68A5] font-normal">
                  Slot {currentLearner.slot_index} • Change
                </span>
              </div>
              <Edit3 className="w-3.5 h-3.5 text-[#7C68A5] group-hover:text-[#6B51A5] ml-1" />
            </button>

            {/* Sheets Sync Button */}
            <button
              onClick={handleSyncLearnerProgress}
              disabled={isSyncingProgress}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 border border-purple-200 rounded-2xl text-xs text-[#6B51A5] font-medium transition cursor-pointer disabled:opacity-50 shadow-sm"
              title="Save your progress to STUDENT_PROGRESS in Google Sheets"
            >
              <Database className={`w-3.5 h-3.5 text-[#6B51A5] ${isSyncingProgress ? 'animate-spin' : ''}`} />
              <span>{isSyncingProgress ? 'Saving...' : 'Save Progress'}</span>
            </button>

            {/* Security Badge */}
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-800 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active</span>
            </div>

            {onOpenDeckManager && (
              <button
                onClick={onOpenDeckManager}
                className="px-3 py-1.5 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-2xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer shadow-sm shadow-[#6B51A5]/20"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Manage Decks</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncFeedback && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Security Warning Notification Banner */}
      {securityNotice && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-center text-xs text-rose-800 font-bold flex items-center justify-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{securityNotice}</span>
        </div>
      )}

      {/* MAIN VIEW: PRACTICING VS DASHBOARD */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center">
        
        {isLoadingDeck ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#6B51A5] animate-spin mx-auto" />
            <p className="text-sm font-medium text-[#503A7A]">Loading practice deck...</p>
          </div>
        ) : loadError ? (
          <div className="max-w-md mx-auto p-6 bg-white border border-purple-100 rounded-3xl text-center space-y-4 shadow-md">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-[#3C2A63]">{loadError}</h3>
            <p className="text-xs text-[#7C68A5]">Please check the deck code or select an available deck below.</p>
            <button
              onClick={() => loadDeckData('ON_TAP_01')}
              className="px-5 py-2 bg-[#6B51A5] text-white rounded-xl text-xs font-bold transition hover:bg-[#503A7A] cursor-pointer"
            >
              Retry Default Deck (ON_TAP_01)
            </button>
          </div>
        ) : isPracticing && activeDeck ? (
          
          /* ACTIVE PRACTICE SESSION */
          !sessionCompleted ? (
            <div className="space-y-6">
              {/* Progress Bar & Header */}
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-[#7C68A5] mb-1.5 font-mono">
                    <span>
                      Learner: <strong className="text-[#3C2A63]">{currentLearner.student_name}</strong> • Question {currentCardIndex + 1} of {activeDeck.cards.length}
                    </span>
                    <span>{Math.round(((currentCardIndex + 1) / activeDeck.cards.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6B51A5] to-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${((currentCardIndex + 1) / activeDeck.cards.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Card in Light Theme */}
              <PracticeCardView
                card={activeDeck.cards[currentCardIndex]}
                cardIndex={currentCardIndex}
                totalCards={activeDeck.cards.length}
                onNext={handleNextCard}
                isLast={currentCardIndex === activeDeck.cards.length - 1}
                isMastered={Boolean(userStats.cards_state[activeDeck.cards[currentCardIndex]?.id]?.mastered)}
              />
            </div>
          ) : (
            
            /* SESSION COMPLETION SUMMARY */
            <div className="max-w-md mx-auto bg-white border border-purple-100 rounded-3xl p-8 shadow-xl text-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20 text-white">
                <Award className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#3C2A63]">Practice Session Complete!</h3>
                <p className="text-xs text-[#7C68A5]">
                  Congratulations <strong>{currentLearner.student_name}</strong> for completing <strong>{activeDeck.title}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="p-4 bg-[#F5F2F9] rounded-2xl border border-purple-100 text-center">
                  <span className="text-xs text-[#7C68A5] block">Score</span>
                  <span className="text-2xl font-black text-[#6B51A5] font-mono">
                    {Object.values(sessionResults).filter(Boolean).length} / {activeDeck.cards.length}
                  </span>
                </div>
                <div className="p-4 bg-[#F5F2F9] rounded-2xl border border-purple-100 text-center">
                  <span className="text-xs text-[#7C68A5] block">Daily Streak</span>
                  <span className="text-2xl font-black text-amber-600 font-mono flex items-center justify-center gap-1">
                    <Flame className="w-5 h-5 fill-amber-500" />
                    <span>{userStats.daily_streak}</span>
                  </span>
                </div>
              </div>

              {gasUrl && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 py-1.5 px-3 rounded-xl">
                  ✓ Your progress is saved and synced to Google Sheets (STUDENT_PROGRESS).
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleStartPractice()}
                  className="flex-1 py-2.5 bg-[#F5F2F9] hover:bg-purple-100 text-[#503A7A] border border-purple-200 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Practice Again</span>
                </button>

                <button
                  onClick={() => setIsPracticing(false)}
                  className="flex-1 py-2.5 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-2xl text-xs font-bold transition shadow-md shadow-[#6B51A5]/20 cursor-pointer"
                >
                  Back to Library
                </button>
              </div>
            </div>
          )

        ) : (
          
          /* DASHBOARD VIEW */
          <div className="space-y-6">

            {/* Top Row: Hero Deck + 4 Metric Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left: Active Deck Preview (5 Cols) */}
              <div className="lg:col-span-5 bg-white border border-purple-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-3 py-1 bg-purple-50 border border-purple-200 text-[#6B51A5] rounded-xl font-bold uppercase tracking-wider">
                      Selected Deck
                    </span>
                    <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 font-bold">
                      {activeDeck?.level || 'B1-B2'}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-[#3C2A63] tracking-tight">
                      {activeDeck?.title || 'Practice Deck'}
                    </h2>
                    <p className="text-xs text-[#503A7A] mt-2 leading-relaxed">
                      {activeDeck?.description || 'Interactive flashcard set designed to boost vocabulary and grammar mastery.'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-[#7C68A5]">
                    <div className="flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-[#6B51A5]" />
                      <span>{activeDeck?.cards.length || 0} questions</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>AI Sentence Analysis</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-100">
                  <button
                    onClick={() => handleStartPractice()}
                    disabled={!activeDeck || activeDeck.cards.length === 0}
                    className="w-full py-3 bg-[#6B51A5] hover:bg-[#503A7A] disabled:opacity-50 text-white font-bold rounded-2xl shadow-md shadow-[#6B51A5]/20 flex items-center justify-center space-x-2 transition cursor-pointer text-sm"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Practice Session</span>
                  </button>
                </div>
              </div>

              {/* Right: 4 Metrics Grid (7 Cols) */}
              <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                
                {/* Metric 1: Streak */}
                <div className="p-5 bg-white border border-purple-100 rounded-3xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#7C68A5]">Daily Streak</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Flame className="w-4 h-4 fill-amber-500" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-[#3C2A63] font-mono">
                      {userStats.daily_streak}
                    </span>
                    <span className="text-xs text-[#7C68A5] ml-1.5 font-medium">days</span>
                    <p className="text-[11px] text-[#7C68A5] mt-1">Best record: {userStats.best_streak} days</p>
                  </div>
                </div>

                {/* Metric 2: Practiced Today */}
                <div className="p-5 bg-white border border-purple-100 rounded-3xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#7C68A5]">Practiced Today</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Target className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-[#3C2A63] font-mono">
                      {userStats.words_practiced_today}
                    </span>
                    <span className="text-xs text-[#7C68A5] ml-1.5 font-medium">cards</span>
                    <p className="text-[11px] text-emerald-600 mt-1">Steady learning pace</p>
                  </div>
                </div>

                {/* Metric 3: Correct repeats */}
                <div className="p-5 bg-white border border-purple-100 rounded-3xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#7C68A5]">Accuracy Rate</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-[#3C2A63] font-mono">
                      {userStats.correct_repeats_pct}%
                    </span>
                    <p className="text-[11px] text-[#7C68A5] mt-1">Long-term retention</p>
                  </div>
                </div>

                {/* Metric 4: Mastered words */}
                <div className="p-5 bg-white border border-purple-100 rounded-3xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#7C68A5]">Mastered Cards</span>
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#6B51A5] flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-[#3C2A63] font-mono">
                      {userStats.total_cards_mastered}
                    </span>
                    <span className="text-xs text-[#7C68A5] ml-1.5 font-medium">cards</span>
                    <p className="text-[11px] text-[#6B51A5] mt-1">Deep recall achieved</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Row: Decks Library, Filter, Search & Pagination */}
            <div className="space-y-4 pt-4">
              
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <BookOpen className="w-5 h-5 text-[#6B51A5]" />
                  <div>
                    <h3 className="text-base font-bold text-[#3C2A63] tracking-tight flex items-center gap-2">
                      <span>Practice Question Library</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6B51A5] font-mono font-bold">
                        {allDecks.length} decks
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncWithSheets}
                    disabled={isSyncingWithSheets}
                    className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-purple-50 text-[#6B51A5] border border-purple-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Refresh practice questions from Google Sheets"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWithSheets ? 'animate-spin' : ''}`} />
                    <span>Sync from Sheets</span>
                  </button>

                  {onOpenDeckManager && (
                    <button
                      onClick={onOpenDeckManager}
                      className="text-xs font-bold px-3.5 py-1.5 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>New Deck</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Toolbar: Search, Level, Sort, View Toggle */}
              <div className="bg-white border border-purple-100 p-3.5 rounded-2xl shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#7C68A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by deck title, code, or description..."
                      className="w-full pl-10 pr-8 py-2 bg-[#F5F2F9] border border-purple-200 rounded-xl text-xs text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:border-[#6B51A5] transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C68A5] hover:text-[#3C2A63] text-xs font-bold p-1"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Level & Sort & View Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    
                    {/* Level Filter */}
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="px-3 py-2 bg-[#F5F2F9] border border-purple-200 rounded-xl text-xs text-[#3C2A63] focus:outline-none focus:border-[#6B51A5]"
                    >
                      <option value="ALL">All Levels</option>
                      <option value="A1-A2">Level A1-A2</option>
                      <option value="B1-B2">Level B1-B2</option>
                      <option value="C1-C2">Level C1-C2</option>
                    </select>

                    {/* Sort Order */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 bg-[#F5F2F9] border border-purple-200 rounded-xl text-xs text-[#3C2A63] focus:outline-none focus:border-[#6B51A5]"
                    >
                      <option value="newest">Default</option>
                      <option value="cards_desc">Most Questions</option>
                      <option value="mastery_desc">Highest Mastery</option>
                      <option value="title_asc">Title (A-Z)</option>
                    </select>

                    {/* View Switcher */}
                    <div className="flex bg-[#F5F2F9] p-1 border border-purple-200 rounded-xl space-x-1">
                      <button
                        onClick={() => setViewLayout('grid')}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          viewLayout === 'grid' ? 'bg-[#6B51A5] text-white shadow-xs' : 'text-[#7C68A5] hover:text-[#3C2A63]'
                        }`}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewLayout('list')}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          viewLayout === 'list' ? 'bg-[#6B51A5] text-white shadow-xs' : 'text-[#7C68A5] hover:text-[#3C2A63]'
                        }`}
                        title="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  {[
                    { id: 'ALL', label: 'All Categories' },
                    { id: 'IELTS Reading', label: '📖 IELTS Reading' },
                    { id: 'IELTS Listening', label: '🎧 IELTS Listening' },
                    { id: 'IELTS Writing', label: '✍️ IELTS Writing' },
                    { id: 'Vocabulary', label: '✨ Vocabulary' },
                    { id: 'Grammar', label: '📐 Grammar' },
                    { id: 'Communication', label: '💬 Communication' },
                  ].map(cat => {
                    const active = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer text-xs ${
                          active
                            ? 'bg-[#6B51A5] text-white shadow-sm shadow-[#6B51A5]/20'
                            : 'bg-[#F5F2F9] text-[#503A7A] hover:text-[#3C2A63] border border-purple-100 hover:bg-purple-100/50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Decks Render View */}
              {filteredDecks.length === 0 ? (
                <div className="p-12 text-center bg-white border border-purple-100 rounded-3xl space-y-3 shadow-sm">
                  <BookOpen className="w-10 h-10 text-[#7C68A5] mx-auto" />
                  <h4 className="text-sm font-bold text-[#3C2A63]">No matching practice decks found</h4>
                  <p className="text-xs text-[#7C68A5] max-w-sm mx-auto">
                    Try adjusting your search query or clear your active filters.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                      setSelectedLevel('ALL');
                    }}
                    className="px-4 py-2 bg-[#F5F2F9] hover:bg-purple-100 text-[#503A7A] rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : viewLayout === 'grid' ? (
                
                /* GRID VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedDecks.map(deck => {
                    const isCurrent = activeDeck?.deck_id === deck.deck_id;
                    const mastery = calculateDeckMastery(deck);

                    return (
                      <div
                        key={deck.deck_id}
                        onClick={() => setActiveDeck(deck)}
                        className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm ${
                          isCurrent
                            ? 'bg-white border-2 border-[#6B51A5] shadow-md ring-2 ring-[#6B51A5]/10'
                            : 'bg-white border-purple-100 hover:border-purple-300 hover:shadow-md'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-50 text-[#6B51A5] border border-purple-200 font-bold uppercase tracking-wider">
                              {deck.category}
                            </span>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                                {deck.level}
                              </span>
                              <span className="text-[10px] font-mono text-[#7C68A5] bg-[#F5F2F9] px-1.5 py-0.5 rounded">
                                {deck.deck_id}
                              </span>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-[#3C2A63] line-clamp-1 mb-1">
                            {deck.title}
                          </h4>
                          <p className="text-xs text-[#503A7A] line-clamp-2 leading-relaxed">
                            {deck.description}
                          </p>
                        </div>

                        {/* Progress Bar & CTA */}
                        <div className="space-y-2.5 pt-2 border-t border-purple-100">
                          <div className="flex items-center justify-between text-xs text-[#7C68A5]">
                            <span>{deck.cards.length} questions</span>
                            <span className="font-semibold text-emerald-700">{mastery}% mastered</span>
                          </div>
                          <div className="w-full bg-purple-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#6B51A5] to-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${mastery}%` }}
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartPractice(deck);
                              }}
                              className="flex-1 py-2 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-xs"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>Practice Now</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                
                /* LIST VIEW */
                <div className="bg-white border border-purple-100 rounded-3xl divide-y divide-purple-100 overflow-hidden shadow-sm">
                  {paginatedDecks.map(deck => {
                    const isCurrent = activeDeck?.deck_id === deck.deck_id;
                    const mastery = calculateDeckMastery(deck);

                    return (
                      <div
                        key={deck.deck_id}
                        onClick={() => setActiveDeck(deck)}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition cursor-pointer hover:bg-[#F5F2F9]/50 ${
                          isCurrent ? 'bg-purple-50/60 border-l-4 border-[#6B51A5]' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-[#6B51A5] border border-purple-200 font-bold uppercase">
                              {deck.category}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                              {deck.level}
                            </span>
                            <span className="text-[10px] font-mono text-[#7C68A5]">
                              {deck.deck_id}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-[#3C2A63] truncate">
                            {deck.title}
                          </h4>
                          <p className="text-xs text-[#503A7A] line-clamp-1 mt-0.5">
                            {deck.description}
                          </p>
                        </div>

                        {/* Stats & Start Button */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right min-w-[90px]">
                            <div className="text-xs font-semibold text-[#3C2A63]">
                              {deck.cards.length} questions
                            </div>
                            <div className="text-[11px] text-emerald-700 font-mono font-bold">
                              {mastery}% mastered
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartPractice(deck);
                            }}
                            className="px-4 py-2 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shrink-0 shadow-xs"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Practice</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 text-xs text-[#7C68A5]">
                  <span>
                    Page <strong className="text-[#3C2A63]">{currentPage}</strong> of {totalPages} ({filteredDecks.length} total decks)
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-white border border-purple-200 hover:bg-purple-50 disabled:opacity-40 rounded-xl flex items-center gap-1 transition text-[#503A7A] font-bold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-xl font-mono font-bold text-xs transition cursor-pointer ${
                          currentPage === page
                            ? 'bg-[#6B51A5] text-white shadow-xs'
                            : 'bg-white text-[#7C68A5] hover:text-[#3C2A63] border border-purple-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 bg-white border border-purple-200 hover:bg-purple-50 disabled:opacity-40 rounded-xl flex items-center gap-1 transition text-[#503A7A] font-bold cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* 3 Learners Profile Modal */}
      <LearnerSelectModal
        isOpen={isLearnerModalOpen}
        onClose={() => setIsLearnerModalOpen(false)}
        learners={learners}
        currentLearner={currentLearner}
        onSelectLearner={handleSelectLearner}
        onUpdateLearnerName={handleUpdateLearnerName}
        onSyncToSheets={handleSyncLearnerProgress}
        isSyncing={isSyncingProgress}
      />

    </div>
  );
};
