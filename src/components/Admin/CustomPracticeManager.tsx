import React, { useState, useEffect } from 'react';
import { CustomPracticeDeck, PracticeCard } from '../../types/practice';
import { practiceService } from '../../services/practiceService';
import { DEFAULT_API_URL } from '../../services/api';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  FileText, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Upload, 
  RotateCcw, 
  Loader2,
  BookOpen,
  ArrowRight,
  Code2,
  ListPlus,
  Database,
  RefreshCw,
  HelpCircle,
  X,
  ExternalLink
} from 'lucide-react';

interface CustomPracticeManagerProps {
  gasUrl?: string;
}

export const CustomPracticeManager: React.FC<CustomPracticeManagerProps> = ({ gasUrl }) => {
  const effectiveGasUrl = gasUrl || localStorage.getItem('ielts_gas_url') || DEFAULT_API_URL;

  const [decks, setDecks] = useState<CustomPracticeDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<CustomPracticeDeck | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'library' | 'editor'>('library');

  // Sheets Database Management State
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);
  const [dbStatus, setDbStatus] = useState(() => practiceService.getDatabaseStatus());
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  // AI Generator Modal / Form State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCategory, setAiCategory] = useState<'Vocabulary' | 'Grammar' | 'Communication' | 'IELTS Academic'>('Vocabulary');
  const [aiLevel, setAiLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2'>('B1-B2');
  const [aiCount, setAiCount] = useState(8);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Current deck form state
  const [deckId, setDeckId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Vocabulary' | 'Grammar' | 'Communication' | 'IELTS Academic' | 'General English' | 'Custom'>('Vocabulary');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2'>('B1-B2');
  const [cards, setCards] = useState<PracticeCard[]>([]);

  useEffect(() => {
    refreshDecks();
  }, []);

  const refreshDecks = () => {
    const all = practiceService.getAllDecks();
    setDecks(all);
    if (!selectedDeck && all.length > 0) {
      handleSelectDeck(all[0]);
    }
  };

  // Google Sheets CSDL Handlers
  const handleInitDatabaseOnSheets = async () => {
    setIsSyncingSheets(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await practiceService.initDatabaseOnSheets(effectiveGasUrl);
      if (res.success) {
        setSuccessMsg(res.message || 'Practice database initialized on Google Sheets successfully! All questions saved to PRACTICE_QUESTIONS tab.');
        setDbStatus(practiceService.getDatabaseStatus());
        refreshDecks();
      } else {
        setErrorMsg(res.error || 'Failed to initialize database on Google Sheets. Please check Web App URL and Anyone access.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error while initializing database.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleFetchFromSheets = async () => {
    setIsFetchingSheets(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await practiceService.fetchFromSheets(effectiveGasUrl);
      if (res.success && res.decks && res.decks.length > 0) {
        const totalCards = res.decks.reduce((acc, d) => acc + (d.cards?.length || 0), 0);
        setSuccessMsg(`Successfully retrieved ${res.decks.length} practice sets (${totalCards} questions) from Google Sheets!`);
        setDbStatus(practiceService.getDatabaseStatus());
        refreshDecks();
        handleSelectDeck(res.decks[0]);
      } else if (res.is_initialized === false) {
        setErrorMsg('PRACTICE_QUESTIONS tab does not exist on Google Sheets. Please click "Initialize DB" first.');
      } else {
        setErrorMsg(res.error || 'No practice questions found on Google Sheets.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching data from Google Sheets.');
    } finally {
      setIsFetchingSheets(false);
    }
  };

  const handleSaveSelectedDeckToSheets = async () => {
    if (!selectedDeck) return;
    setIsSyncingSheets(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await practiceService.saveDeckToSheets(effectiveGasUrl, selectedDeck);
      if (res.success) {
        setSuccessMsg(`Practice set [${selectedDeck.deck_id}] saved to Google Sheets successfully!`);
        setDbStatus(practiceService.getDatabaseStatus());
      } else {
        setErrorMsg(res.error || 'Failed to save practice set to Google Sheets.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while saving to Google Sheets.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleSelectDeck = (deck: CustomPracticeDeck) => {
    setSelectedDeck(deck);
    setDeckId(deck.deck_id);
    setTitle(deck.title);
    setCategory(deck.category);
    setDescription(deck.description);
    setLevel(deck.level);
    setCards(deck.cards || []);
    setIsEditing(false);
    setSuccessMsg(null);
    setErrorMsg(null);
    setMobileTab('editor');
  };

  const handleNewDeck = () => {
    const newId = `PRACTICE_${Date.now().toString().slice(-4)}`;
    setSelectedDeck(null);
    setDeckId(newId);
    setTitle('New Custom Practice Set');
    setCategory('Vocabulary');
    setDescription('Objectives and key focus of this practice set...');
    setLevel('B1-B2');
    setMobileTab('editor');
    setCards([
      {
        id: `c_${Date.now()}_1`,
        sentence_en: 'We need to _____ sustainable energy solutions for future generations.',
        sentence_vi: 'We need to develop sustainable energy solutions for future generations.',
        cloze_target: 'develop',
        target_word: 'develop',
        part_of_speech: 'verb',
        phonetic: '/dɪˈvel.əp/',
        hints: 'expand, advance (verb)',
        accepted_answers: ['develop', 'promote', 'create'],
        explanation: 'The verb "develop" correctly collocates with "sustainable energy solutions".',
        grammar_points: ['Collocation: develop energy solutions'],
        options: ['develop', 'developing', 'development', 'developer'],
        difficulty: 'medium'
      }
    ]);
    setIsEditing(true);
  };

  const handleAddCard = () => {
    const newCard: PracticeCard = {
      id: `c_${Date.now()}_${cards.length + 1}`,
      sentence_en: 'This is a sample sentence with a _____ blank.',
      sentence_vi: 'This is a sample sentence containing a blank to fill.',
      cloze_target: 'sample',
      target_word: 'sample',
      part_of_speech: 'adjective',
      phonetic: '/ˈsɑːm.pəl/',
      hints: 'model, example (adjective)',
      accepted_answers: ['sample', 'test'],
      explanation: 'Explanation of structure and context here...',
      grammar_points: ['Key grammar reminder'],
      options: ['sample', 'sampling', 'sampled', 'sampler'],
      difficulty: 'medium'
    };
    setCards([...cards, newCard]);
  };

  const handleRemoveCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleCardChange = (index: number, field: keyof PracticeCard, value: any) => {
    const updated = [...cards];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setCards(updated);
  };

  const handleSaveDeck = () => {
    if (!deckId.trim() || !title.trim()) {
      setErrorMsg('Please enter both Set Code and Set Title.');
      return;
    }
    if (cards.length === 0) {
      setErrorMsg('Practice set must have at least 1 question card.');
      return;
    }

    const newDeck: CustomPracticeDeck = {
      deck_id: deckId.trim().toUpperCase(),
      title: title.trim(),
      category,
      description: description.trim(),
      target_language: 'English',
      native_language: 'Vietnamese',
      level,
      cards,
      is_custom: true,
      updated_at: new Date().toISOString()
    };

    const saved = practiceService.saveDeck(newDeck);
    if (saved) {
      setSuccessMsg(`Successfully saved practice set [${newDeck.deck_id}].`);
      refreshDecks();
      setSelectedDeck(newDeck);
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg('Error saving practice set.');
    }
  };

  const handleDeleteDeck = () => {
    if (!selectedDeck) return;
    if (window.confirm(`Are you sure you want to delete practice set [${selectedDeck.deck_id}]?`)) {
      practiceService.deleteDeck(selectedDeck.deck_id);
      refreshDecks();
      setSelectedDeck(null);
      setSuccessMsg('Practice set deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Generate Deck with AI Gemini
  const handleGenerateAiDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim() || isGeneratingAi) return;

    setIsGeneratingAi(true);
    setErrorMsg(null);
    try {
      const generated = await practiceService.generateDeck(
        aiTopic.trim(),
        aiCategory,
        aiLevel,
        aiCount
      );

      if (generated) {
        setIsAiModalOpen(false);
        setAiTopic('');
        refreshDecks();
        handleSelectDeck(generated);
        setSuccessMsg(`Gemini AI generated practice set [${generated.deck_id}] with ${generated.cards.length} questions!`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg('Unable to generate practice set via AI at this time. Please try again.');
      }
    } catch (e: any) {
      console.error('AI Generator Error:', e);
      setErrorMsg('Gemini AI connection error.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Export to JSON
  const handleExportJson = () => {
    if (!selectedDeck) return;
    const jsonStr = JSON.stringify(selectedDeck, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDeck.deck_id}_practice_deck.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Practice Sets &amp; Custom Decks Manager</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Smart Practice Repository (Mastery Decks)
          </h2>
          <p className="text-xs text-slate-400">
            Create unlimited self-paced practice sets, input manually or generate instantly using Gemini AI.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-purple-600/20 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with Gemini AI</span>
          </button>

          <button
            onClick={handleNewDeck}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Deck</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Database Synchronization Panel */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 rounded-2xl shrink-0 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Google Sheets Practice Database</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Tab PRACTICE_QUESTIONS
                </span>
              </h3>
              {dbStatus.is_on_sheets ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Saved on Sheets ({dbStatus.total_cards} questions)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Not Initialized on Sheets
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Initialize sheet structure, store the full question repository in the <code className="text-indigo-300">PRACTICE_QUESTIONS</code> tab, and retrieve questions in real-time.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={handleInitDatabaseOnSheets}
            disabled={isSyncingSheets}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-md shadow-emerald-900/20 disabled:opacity-50 cursor-pointer"
            title="Initialize PRACTICE_QUESTIONS tab on Google Sheets and upload all questions"
          >
            {isSyncingSheets ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Initialize DB on Sheet</span>
          </button>

          <button
            onClick={handleFetchFromSheets}
            disabled={isFetchingSheets}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            title="Retrieve latest practice questions stored on Google Sheets to Web"
          >
            {isFetchingSheets ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <RefreshCw className="w-4 h-4 text-indigo-400" />
            )}
            <span>Reload from Sheet</span>
          </button>

          <button
            onClick={() => setShowSchemaModal(true)}
            className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-700 cursor-pointer"
            title="View column schema for Google Sheets"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-rose-300 text-xs font-semibold animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setMobileTab('library')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'library'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Decks Library ({decks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'editor'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Deck Editor {selectedDeck ? `(${selectedDeck.deck_id})` : ''}</span>
        </button>
      </div>

      {/* Main Grid: Deck List (Left) vs Deck Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Deck Library (4 Cols) */}
        <div className={`lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 ${
          mobileTab === 'editor' ? 'hidden lg:block' : 'block'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Practice Sets ({decks.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">Select set to view/edit</span>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {decks.map((deck, idx) => {
              const isSelected = selectedDeck?.deck_id === deck.deck_id;
              return (
                <div
                  key={`${deck.deck_id || 'deck'}-${idx}`}
                  onClick={() => handleSelectDeck(deck)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md'
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-700/40">
                      {deck.deck_id}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      {deck.category}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1">
                    {deck.title}
                  </h4>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>{deck.cards.length} questions</span>
                    <span className="text-emerald-400 font-semibold">{deck.level}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deck Details & Question Editor (8 Cols) */}
        <div className={`lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-6 ${
          mobileTab === 'library' ? 'hidden lg:block' : 'block'
        }`}>
          {/* Back to library button on mobile */}
          <div className="lg:hidden flex items-center justify-between pb-3 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setMobileTab('library')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span>← Back to Decks Library</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {selectedDeck ? selectedDeck.deck_id : 'New'}
            </span>
          </div>
          
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">
                {selectedDeck ? `Practice Set Details [${selectedDeck.deck_id}]` : 'Create New Practice Set'}
              </h3>
              <p className="text-xs text-slate-400">
                Candidates enter this set code at login to take the practice test
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {selectedDeck && (
                <>
                  <button
                    onClick={handleExportJson}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition text-xs flex items-center gap-1"
                    title="Export JSON"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleDeleteDeck}
                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition text-xs flex items-center gap-1"
                    title="Delete this set"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={handleSaveDeck}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-md shadow-emerald-600/20 cursor-pointer"
                title="Save practice set to local storage"
              >
                <Save className="w-4 h-4" />
                <span>Save Deck</span>
              </button>

              <button
                onClick={handleSaveSelectedDeckToSheets}
                disabled={isSyncingSheets || !selectedDeck}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
                title="Synchronize this practice set directly to Google Sheets (PRACTICE_QUESTIONS tab)"
              >
                {isSyncingSheets ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>Push to Sheet</span>
              </button>
            </div>
          </div>

          {/* Form Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Set Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                placeholder="e.g. PRACTICE_01, VOCAB_B2"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Set Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Academic Vocabulary & Advanced Collocations"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="Vocabulary">Vocabulary</option>
                <option value="Grammar">Grammar</option>
                <option value="Communication">Communication</option>
                <option value="IELTS Academic">IELTS Academic</option>
                <option value="General English">General English</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="A1-A2">A1 - A2 (Beginner)</option>
                <option value="B1-B2">B1 - B2 (Intermediate)</option>
                <option value="C1-C2">C1 - C2 (Advanced)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Brief Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key focus, contexts, and target competencies..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Question Cards List ({cards.length})</span>
              </h4>

              <button
                onClick={handleAddCard}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold rounded-xl text-xs flex items-center space-x-1 border border-slate-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {cards.map((card, idx) => (
                <div
                  key={`${card.id || 'card'}-${idx}`}
                  className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>

                    <button
                      onClick={() => handleRemoveCard(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sentence EN with cloze mark */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      English Sentence (Use _____ for the blank):
                    </label>
                    <input
                      type="text"
                      value={card.sentence_en}
                      onChange={(e) => handleCardChange(idx, 'sentence_en', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Sentence VI */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Context Translation / Meaning:
                    </label>
                    <input
                      type="text"
                      value={card.sentence_vi}
                      onChange={(e) => handleCardChange(idx, 'sentence_vi', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Target & Hints */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                        Target Word (Answer):
                      </label>
                      <input
                        type="text"
                        value={card.cloze_target}
                        onChange={(e) => handleCardChange(idx, 'cloze_target', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 font-bold text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Part of Speech &amp; IPA Phonetic:
                      </label>
                      <input
                        type="text"
                        value={card.phonetic || ''}
                        onChange={(e) => handleCardChange(idx, 'phonetic', e.target.value)}
                        placeholder="e.g. /kɜːb/ (verb)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                        Hints:
                      </label>
                      <input
                        type="text"
                        value={card.hints || ''}
                        onChange={(e) => handleCardChange(idx, 'hints', e.target.value)}
                        placeholder="e.g. restrict, limit (verb)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Grammar &amp; Collocation Explanation:
                    </label>
                    <textarea
                      rows={2}
                      value={card.explanation}
                      onChange={(e) => handleCardChange(idx, 'explanation', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* AI Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Generate with Gemini AI</h3>
                  <p className="text-xs text-slate-400">Automatically generate questions, cloze blanks, and in-depth explanations</p>
                </div>
              </div>

              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateAiDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Target Topic / Focus Area <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Advanced Relative Clauses, IELTS Task 2 Environment, Phrasal Verbs..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Vocabulary">Vocabulary</option>
                    <option value="Grammar">Grammar</option>
                    <option value="Communication">Communication</option>
                    <option value="IELTS Academic">IELTS Academic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Level
                  </label>
                  <select
                    value={aiLevel}
                    onChange={(e) => setAiLevel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="A1-A2">A1 - A2</option>
                    <option value="B1-B2">B1 - B2</option>
                    <option value="C1-C2">C1 - C2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Number of questions ({aiCount} questions)
                </label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-purple-600/30"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini is generating questions &amp; explanations...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Practice Deck Now</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheets Schema Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    PRACTICE_QUESTIONS Tab Schema (Google Sheets)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Standard 19-column layout for cloud storage and bidirectional synchronization
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2 text-indigo-200">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Automated &amp; Bidirectional Sync Mechanism:</span>
                </p>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  When clicking <strong>"Initialize DB on Sheet"</strong>, the application automatically creates the <code>PRACTICE_QUESTIONS</code> tab in your Google Sheet (if not present) and populates the entire question library. When students access the Practice module, the application automatically fetches the questions from Google Sheets for the practice session.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  PRACTICE_QUESTIONS Column Field Specification (19 Columns):
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col A (DECK_ID):</span> Practice set code (e.g. PRACTICE_01)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col B (DECK_TITLE):</span> Display title of practice set
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col C (CATEGORY):</span> Vocabulary | Grammar | IELTS
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col D (DESCRIPTION):</span> Short description of practice set
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col E (LEVEL):</span> A1-A2 | B1-B2 | C1-C2
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col F (CARD_ID):</span> Unique question item ID
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col G (SENTENCE_EN):</span> English sentence with cloze (_____)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col H (SENTENCE_VI):</span> Context meaning / translation
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">Col I (CLOZE_TARGET):</span> Correct target word
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col J (TARGET_WORD):</span> Base lemma
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col K (PART_OF_SPEECH):</span> Part of speech (noun, verb, adj...)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col L (PHONETIC):</span> IPA phonetic (/ˈɪm.pækt/)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col M (HINTS):</span> Hints and cues
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col N (OPTIONS_JSON):</span> Multiple-choice options array
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col O (ACCEPTED_ANSWERS_JSON):</span> Accepted synonyms array
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col P (EXPLANATION):</span> Grammar &amp; collocations explanation
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col Q (GRAMMAR_POINTS_JSON):</span> Key grammar points
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col R (DIFFICULTY):</span> easy | medium | hard
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Col S (UPDATED_AT):</span> Last update timestamp
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSchemaModal(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
              >
                Got It &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
