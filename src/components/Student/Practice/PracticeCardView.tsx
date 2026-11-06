import React, { useState, useEffect, useRef } from 'react';
import { PracticeCard, PracticeCardItem, PracticeOption, PracticeQuestionType } from '../../../types/practice';
import { calculatePartialCreditScore, PartialCreditResult } from '../../../services/answerScoring';
import { 
  Volume2, 
  Check, 
  X, 
  HelpCircle, 
  ArrowRight, 
  RotateCcw, 
  Lightbulb, 
  Star, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  Sparkles,
  CheckSquare,
  Square,
  Circle,
  Dot,
  CheckCircle,
  XCircle,
  Tag,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { GeminiAnalysisModal } from './GeminiAnalysisModal';

interface PracticeCardViewProps {
  card: PracticeCard | PracticeCardItem;
  cardIndex: number;
  totalCards: number;
  onNext: (isCorrect: boolean) => void;
  onPrev?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  isMastered?: boolean;
}

/**
 * Normalizes either legacy PracticeCard or structured PracticeCardItem into a unified PracticeCardItem model.
 */
function normalizeToCardItem(input: PracticeCard | PracticeCardItem): PracticeCardItem {
  // If already a PracticeCardItem
  if ('type' in input && input.type && Array.isArray((input as PracticeCardItem).options)) {
    return input as PracticeCardItem;
  }

  const legacy = input as PracticeCard;

  // If card has an embedded item
  if (legacy.item) {
    return legacy.item;
  }

  // Derive from legacy PracticeCard properties
  let type: PracticeQuestionType = legacy.type || 'multiple-choice';
  let options: PracticeOption[] = [];

  if (legacy.options_data && legacy.options_data.length > 0) {
    options = legacy.options_data;
  } else if (legacy.options && legacy.options.length > 0) {
    const target = (legacy.cloze_target || '').toLowerCase().trim();
    const acceptedTargets = [target, ...(legacy.accepted_answers || []).map(a => a.toLowerCase().trim())];

    options = legacy.options.map((optText, idx) => {
      const cleanOpt = optText.toLowerCase().trim();
      const isCorrect = acceptedTargets.includes(cleanOpt);
      const isTargetLemma = cleanOpt === target;

      let rationale = '';
      if (isCorrect) {
        rationale = legacy.explanation || `Correct lexical choice: "${optText}" aligns with the required academic collocation and sentence grammar.`;
      } else {
        // Distractor explanation
        if (cleanOpt.endsWith('ly')) {
          rationale = `Adverb form ("-ly" suffix): Incorrect syntactic position; a noun/verb/adjective is required in this context.`;
        } else if (cleanOpt.endsWith('tion') || cleanOpt.endsWith('ment') || cleanOpt.endsWith('ness')) {
          rationale = `Noun derivative ("-tion/-ment/-ness"): The sentence structure demands a different part of speech.`;
        } else if (cleanOpt.endsWith('ed') || cleanOpt.endsWith('ing')) {
          rationale = `Participle form ("-ed/-ing"): Tense or voice mismatch with the governing clause structure.`;
        } else {
          rationale = `Distractor trap: Does not satisfy the collocations or semantic constraints of the context. Correct target: "${legacy.cloze_target}".`;
        }
      }

      return {
        id: `opt-${idx}`,
        text: optText,
        isCorrect,
        distractorRationale: rationale
      };
    });

    // Check if multiple correct answers exist
    const correctCount = options.filter(o => o.isCorrect).length;
    if (correctCount > 1 || (legacy.min_selections && legacy.min_selections > 1)) {
      type = 'multiple-response';
    }
  }

  return {
    id: legacy.id,
    type,
    cognitiveLevel: legacy.cognitive_level || 'applying',
    learningOutcomeId: legacy.learning_outcome_id || 'LO-IELTS-ACAD-01',
    promptPrefix: legacy.prompt_prefix || (type === 'multiple-response' ? 'Select ALL correct answers that apply:' : 'Choose the most appropriate option:'),
    stimulusText: legacy.sentence_en || '',
    promptSuffix: legacy.prompt_suffix || '',
    options,
    minSelections: legacy.min_selections || 1,
    maxSelections: legacy.max_selections || (options.length > 0 ? options.length : 1),
    itemDifficulty: legacy.difficulty === 'hard' ? 1.5 : legacy.difficulty === 'easy' ? -0.8 : 0.0,
    targetWord: legacy.target_word || legacy.cloze_target,
    partOfSpeech: legacy.part_of_speech,
    explanation: legacy.explanation,
    grammarPoints: legacy.grammar_points,
    hints: legacy.hints
  };
}

export const PracticeCardView: React.FC<PracticeCardViewProps> = ({
  card,
  cardIndex,
  totalCards,
  onNext,
  onPrev,
  isFirst = false,
  isLast = false,
  isMastered = false
}) => {
  const item = normalizeToCardItem(card);
  const legacyCard = card as PracticeCard;

  // Selection states for different interaction models
  const [selectedSingleId, setSelectedSingleId] = useState<string | null>(null);
  const [selectedMultipleIds, setSelectedMultipleIds] = useState<Set<string>>(new Set());
  const [selectedTfng, setSelectedTfng] = useState<'TRUE' | 'FALSE' | 'NOT_GIVEN' | null>(null);
  const [categorizedMap, setCategorizedMap] = useState<Record<string, string>>({});
  const [userInput, setUserInput] = useState('');

  // Submission & Scoring State
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [partialCreditResult, setPartialCreditResult] = useState<PartialCreditResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [expandedRationaleIds, setExpandedRationaleIds] = useState<Set<string>>(new Set());
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when card changes
  useEffect(() => {
    setSelectedSingleId(null);
    setSelectedMultipleIds(new Set());
    setSelectedTfng(null);
    setCategorizedMap({});
    setUserInput('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setPartialCreditResult(null);
    setShowHint(false);
    setExpandedRationaleIds(new Set());
    setIsAiModalOpen(false);

    if (item.type === 'multiple-choice' && item.options.length === 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [item.id, cardIndex]);

  // Audio pronunciation
  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Toggle rationale accordion for micro-explanation
  const toggleRationale = (optId: string) => {
    setExpandedRationaleIds(prev => {
      const next = new Set(prev);
      if (next.has(optId)) {
        next.delete(optId);
      } else {
        next.add(optId);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // INTERACTION HANDLERS
  // ---------------------------------------------------------------------------

  // A. Single Choice (Radio)
  const handleSelectSingle = (optId: string) => {
    if (isSubmitted) return;
    setSelectedSingleId(optId);
  };

  // B. Multiple Response (Checkbox)
  const handleToggleMultiple = (optId: string) => {
    if (isSubmitted) return;
    setSelectedMultipleIds(prev => {
      const next = new Set(prev);
      if (next.has(optId)) {
        next.delete(optId);
      } else {
        // Enforce max selections if configured
        if (item.maxSelections && next.size >= item.maxSelections) {
          return next;
        }
        next.add(optId);
      }
      return next;
    });
  };

  // C. True / False / Not Given
  const handleSelectTfng = (val: 'TRUE' | 'FALSE' | 'NOT_GIVEN') => {
    if (isSubmitted) return;
    setSelectedTfng(val);
  };

  // D. Category Matching
  const handleAssignCategory = (optId: string, categoryId: string) => {
    if (isSubmitted) return;
    setCategorizedMap(prev => ({
      ...prev,
      [optId]: categoryId
    }));
  };

  // ---------------------------------------------------------------------------
  // EVALUATION & SCORING SUBMISSION
  // ---------------------------------------------------------------------------
  const handleSubmitAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitted) {
      onNext(isCorrect);
      return;
    }

    let itemCorrect = false;

    if (item.type === 'multiple-choice') {
      if (item.options.length > 0) {
        if (!selectedSingleId) return;
        const selectedOpt = item.options.find(o => o.id === selectedSingleId);
        itemCorrect = Boolean(selectedOpt?.isCorrect);
      } else {
        // Cloze gap text input fallback
        const trimmed = userInput.trim().toLowerCase();
        if (!trimmed) return;
        const validAnswers = [
          (legacyCard.cloze_target || '').toLowerCase().trim(),
          ...(legacyCard.accepted_answers || []).map(a => a.toLowerCase().trim())
        ];
        itemCorrect = validAnswers.some(a => a === trimmed);
      }
    } else if (item.type === 'multiple-response') {
      if (selectedMultipleIds.size === 0) return;
      
      // Calculate Partial Credit with Guessing Penalty
      const selectedList: string[] = Array.from(selectedMultipleIds);
      const result = calculatePartialCreditScore(selectedList, item.options, 1.0);
      setPartialCreditResult(result);

      // In binary mastery transition: award correct if fully correct or score >= 0.8
      itemCorrect = result.isFullyCorrect || result.score >= 0.8;
    } else if (item.type === 'true-false-not-given') {
      if (!selectedTfng) return;
      const targetAns = (legacyCard.cloze_target || (item.options[0]?.text) || 'TRUE').toUpperCase().trim();
      const normalizedTarget = targetAns.includes('NOT') ? 'NOT_GIVEN' : targetAns.includes('FALSE') ? 'FALSE' : 'TRUE';
      itemCorrect = selectedTfng === normalizedTarget;
    } else if (item.type === 'category-matching') {
      const keys = Object.keys(categorizedMap);
      if (keys.length === 0) return;
      itemCorrect = item.options.every(opt => {
        if (!opt.category) return true;
        return categorizedMap[opt.id] === opt.category;
      });
    }

    setIsCorrect(itemCorrect);
    setIsSubmitted(true);

    // Expand all rationale micro-explanations upon submit
    const allOptIds = new Set(item.options.map(o => o.id));
    setExpandedRationaleIds(allOptIds);
  };

  // Check if current answer can be submitted
  const canSubmit = () => {
    if (item.type === 'multiple-choice') {
      return item.options.length > 0 ? selectedSingleId !== null : userInput.trim().length > 0;
    }
    if (item.type === 'multiple-response') {
      return selectedMultipleIds.size > 0;
    }
    if (item.type === 'true-false-not-given') {
      return selectedTfng !== null;
    }
    if (item.type === 'category-matching') {
      return Object.keys(categorizedMap).length > 0;
    }
    return userInput.trim().length > 0;
  };

  // Helper count for multiple-response dynamic counter
  const totalCorrectInItem = item.options.filter(o => o.isCorrect).length;

  // ---------------------------------------------------------------------------
  // RENDER QUESTION BODY BY TYPE
  // ---------------------------------------------------------------------------
  const renderInteractiveOptions = () => {
    // 1. Multiple-Choice (Radio buttons)
    if (item.type === 'multiple-choice' && item.options.length > 0) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5]">
              Select ONE correct option:
            </span>
            <span className="text-xs text-[#7C68A5] flex items-center gap-1">
              <Circle className="w-3.5 h-3.5" />
              <span>Single choice</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {item.options.map((opt) => {
              const isSelected = selectedSingleId === opt.id;
              
              // Pedagogy Tier 1: Multi-layered colored border
              let containerStyle = 'bg-white border-purple-200 text-[#3C2A63] hover:border-[#6B51A5] hover:bg-purple-50/50';
              let badgeText = '';
              let badgeColor = '';

              if (isSubmitted) {
                if (opt.isCorrect && isSelected) {
                  // Green: Correct selection
                  containerStyle = 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30';
                  badgeText = 'CORRECT';
                  badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                } else if (!opt.isCorrect && isSelected) {
                  // Red: Incorrect choice selected
                  containerStyle = 'bg-rose-50/90 border-rose-400 text-rose-950 ring-2 ring-rose-400/30';
                  badgeText = 'INCORRECT';
                  badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                } else if (opt.isCorrect && !isSelected) {
                  // Amber: Missed correct answer
                  containerStyle = 'bg-amber-50/90 border-amber-400 text-amber-950 ring-2 ring-amber-400/30';
                  badgeText = 'MISSED CORRECT';
                  badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                } else {
                  containerStyle = 'bg-slate-50 border-slate-200 text-slate-500 opacity-60';
                }
              } else if (isSelected) {
                containerStyle = 'bg-purple-50 border-[#6B51A5] text-[#3C2A63] ring-2 ring-[#6B51A5]/30 shadow-sm';
              }

              const isExpanded = expandedRationaleIds.has(opt.id);

              return (
                <div
                  key={opt.id}
                  className={`rounded-2xl border transition-all p-3.5 ${containerStyle}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSingle(opt.id)}
                    disabled={isSubmitted}
                    className="w-full text-left flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {/* Round Radio Indicator */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                        isSelected 
                          ? isSubmitted 
                            ? opt.isCorrect ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-500 bg-rose-500 text-white'
                            : 'border-[#6B51A5] bg-[#6B51A5] text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div>
                        <span className="text-sm font-semibold">{opt.text}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {badgeText && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      )}

                      {isSubmitted && opt.distractorRationale && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRationale(opt.id);
                          }}
                          className="p-1 text-slate-500 hover:text-[#6B51A5] rounded-md"
                          title="Toggle explanation"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </button>

                  {/* Tier 2: Micro-explanation / Distractor Rationale */}
                  {isSubmitted && opt.distractorRationale && isExpanded && (
                    <div className="mt-3 pt-2.5 border-t border-purple-100/60 text-xs leading-relaxed space-y-1 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-[#6B51A5]">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span>Analysis & Rationale:</span>
                      </div>
                      <p className="text-[#3C2A63] pl-5">{opt.distractorRationale}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 2. Multiple-Response (Checkboxes with dynamic counter & partial credit scoring)
    if (item.type === 'multiple-response') {
      const selectedCount = selectedMultipleIds.size;

      return (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5]">
              Select ALL correct options ({totalCorrectInItem} target answers):
            </span>

            {/* Dynamic Status Counter Badge */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                selectedCount === totalCorrectInItem
                  ? 'bg-purple-100 text-[#6B51A5] border-purple-300'
                  : 'bg-[#F5F2F9] text-[#503A7A] border-purple-200'
              }`}>
                Selected {selectedCount} / {totalCorrectInItem} answers (Đã chọn {selectedCount} / {totalCorrectInItem} đáp án)
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {item.options.map((opt) => {
              const isSelected = selectedMultipleIds.has(opt.id);

              // Pedagogy Tier 1: Multi-layered colored border
              let containerStyle = 'bg-white border-purple-200 text-[#3C2A63] hover:border-[#6B51A5] hover:bg-purple-50/50';
              let badgeText = '';
              let badgeColor = '';

              if (isSubmitted) {
                if (opt.isCorrect && isSelected) {
                  containerStyle = 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30';
                  badgeText = 'CORRECT CHOICE';
                  badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                } else if (!opt.isCorrect && isSelected) {
                  containerStyle = 'bg-rose-50/90 border-rose-400 text-rose-950 ring-2 ring-rose-400/30';
                  badgeText = 'TRAP / INCORRECT';
                  badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                } else if (opt.isCorrect && !isSelected) {
                  containerStyle = 'bg-amber-50/90 border-amber-400 text-amber-950 ring-2 ring-amber-400/30';
                  badgeText = 'MISSED (ĐÁP ÁN BỎ SÓT)';
                  badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                } else {
                  containerStyle = 'bg-slate-50 border-slate-200 text-slate-500 opacity-60';
                }
              } else if (isSelected) {
                containerStyle = 'bg-purple-50 border-[#6B51A5] text-[#3C2A63] ring-2 ring-[#6B51A5]/30 shadow-sm';
              }

              const isExpanded = expandedRationaleIds.has(opt.id);

              return (
                <div
                  key={opt.id}
                  className={`rounded-2xl border transition-all p-3.5 ${containerStyle}`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleMultiple(opt.id)}
                    disabled={isSubmitted}
                    className="w-full text-left flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {/* Square Checkbox Indicator */}
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                        isSelected 
                          ? isSubmitted 
                            ? opt.isCorrect ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-500 bg-rose-500 text-white'
                            : 'border-[#6B51A5] bg-[#6B51A5] text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div>
                        <span className="text-sm font-semibold">{opt.text}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {badgeText && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      )}

                      {isSubmitted && opt.distractorRationale && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRationale(opt.id);
                          }}
                          className="p-1 text-slate-500 hover:text-[#6B51A5] rounded-md"
                          title="Toggle explanation"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </button>

                  {/* Tier 2: Micro-explanation / Distractor Rationale */}
                  {isSubmitted && opt.distractorRationale && isExpanded && (
                    <div className="mt-3 pt-2.5 border-t border-purple-100/60 text-xs leading-relaxed space-y-1 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-[#6B51A5]">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span>Option Analysis:</span>
                      </div>
                      <p className="text-[#3C2A63] pl-5">{opt.distractorRationale}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Partial Credit Scoring Formula Breakdown */}
          {isSubmitted && partialCreditResult && (
            <div className="p-4 bg-[#F5F2F9] border border-purple-200 rounded-2xl space-y-2 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#503A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#6B51A5]" />
                  <span>Partial Credit Scoring Engine (Phạt đoán mò nhẹ)</span>
                </span>
                <span className="text-sm font-black font-mono text-[#6B51A5] px-2.5 py-0.5 bg-white rounded-lg border border-purple-200">
                  Earned: {partialCreditResult.score} / {partialCreditResult.maxPoints} pts
                </span>
              </div>

              <div className="text-xs text-[#3C2A63] font-mono bg-white p-2.5 rounded-xl border border-purple-100">
                Score = max(0, ({partialCreditResult.cSelected}/{partialCreditResult.cTotal}) - ({partialCreditResult.iSelected}/{partialCreditResult.iTotal || 1})) × {partialCreditResult.maxPoints} = <strong>{partialCreditResult.score} pts</strong>
              </div>

              <p className="text-[11px] text-[#7C68A5] leading-relaxed">
                {partialCreditResult.cSelected === partialCreditResult.cTotal && partialCreditResult.iSelected === 0 ? (
                  <span className="text-emerald-700 font-bold">✓ Perfect response: All correct options identified without selecting any distractors.</span>
                ) : partialCreditResult.score > 0 ? (
                  <span className="text-purple-700 font-bold">ℹ Partial credit granted: {partialCreditResult.cSelected} of {partialCreditResult.cTotal} correct answers found.</span>
                ) : (
                  <span className="text-rose-700 font-bold">⚠ 0 points awarded: Selecting all options or choosing more distractors than correct answers triggers the anti-blind guessing penalty.</span>
                )}
              </p>
            </div>
          )}
        </div>
      );
    }

    // 3. True / False / Not Given (Row of 3 semantic buttons)
    if (item.type === 'true-false-not-given') {
      const targetAns = (legacyCard.cloze_target || (item.options[0]?.text) || 'TRUE').toUpperCase().trim();
      const normalizedTarget = targetAns.includes('NOT') ? 'NOT_GIVEN' : targetAns.includes('FALSE') ? 'FALSE' : 'TRUE';

      const tfngOptions: Array<{
        key: 'TRUE' | 'FALSE' | 'NOT_GIVEN';
        label: string;
        subtext: string;
        baseColor: string;
        activeColor: string;
        icon: any;
      }> = [
        {
          key: 'TRUE',
          label: 'TRUE',
          subtext: 'Xác nhận đúng sự thật (Confirmed fact)',
          baseColor: 'border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-emerald-900',
          activeColor: 'bg-emerald-100 border-emerald-600 text-emerald-950 ring-2 ring-emerald-500/30',
          icon: CheckCircle2
        },
        {
          key: 'FALSE',
          label: 'FALSE',
          subtext: 'Mâu thuẫn sự thật (Contradicts facts)',
          baseColor: 'border-rose-200 hover:border-rose-500 hover:bg-rose-50/50 text-rose-900',
          activeColor: 'bg-rose-100 border-rose-600 text-rose-950 ring-2 ring-rose-500/30',
          icon: XCircle
        },
        {
          key: 'NOT_GIVEN',
          label: 'NOT GIVEN',
          subtext: 'Không đề cập (Not mentioned in text)',
          baseColor: 'border-sky-200 hover:border-sky-500 hover:bg-sky-50/50 text-sky-900',
          activeColor: 'bg-sky-100 border-sky-600 text-sky-950 ring-2 ring-sky-500/30',
          icon: HelpCircle
        }
      ];

      return (
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5] block">
            Evaluate statement truth value:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tfngOptions.map(opt => {
              const isSelected = selectedTfng === opt.key;
              const isTarget = normalizedTarget === opt.key;
              const Icon = opt.icon;

              let style = opt.baseColor;
              if (isSubmitted) {
                if (isTarget && isSelected) {
                  style = 'bg-emerald-100 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/40 shadow-sm';
                } else if (!isTarget && isSelected) {
                  style = 'bg-rose-100 border-rose-500 text-rose-950 ring-2 ring-rose-500/40';
                } else if (isTarget && !isSelected) {
                  style = 'bg-amber-100 border-amber-500 text-amber-950 ring-2 ring-amber-500/40';
                } else {
                  style = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                }
              } else if (isSelected) {
                style = opt.activeColor;
              }

              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectTfng(opt.key)}
                  disabled={isSubmitted}
                  className={`p-4 rounded-2xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${style}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-base font-black tracking-wide">{opt.label}</span>
                  <span className="text-[10px] opacity-80 font-medium">{opt.subtext}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // 4. Category Matching (Word-Class / Group Classification)
    if (item.type === 'category-matching') {
      const categories = item.categories || [
        { id: 'noun', name: 'Noun (Danh từ)' },
        { id: 'verb', name: 'Verb (Động từ)' },
        { id: 'adjective', name: 'Adjective (Tính từ)' }
      ];

      return (
        <div className="space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5] block">
            Classify and match each term to its correct category:
          </span>

          <div className="space-y-3">
            {item.options.map(opt => {
              const assignedCat = categorizedMap[opt.id];
              const isCorrectCat = opt.category ? assignedCat === opt.category : true;

              let cardStyle = 'bg-white border-purple-200';
              if (isSubmitted) {
                cardStyle = isCorrectCat 
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950' 
                  : 'bg-rose-50 border-rose-400 text-rose-950';
              }

              return (
                <div key={opt.id} className={`p-3.5 rounded-2xl border transition space-y-2 ${cardStyle}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#3C2A63]">{opt.text}</span>
                    {isSubmitted && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                        isCorrectCat ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {isCorrectCat ? 'CORRECT MATCH' : `EXPECTED: ${opt.category || 'N/A'}`}
                      </span>
                    )}
                  </div>

                  {/* Category Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {categories.map(cat => {
                      const isChosen = assignedCat === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => handleAssignCategory(opt.id, cat.id)}
                          className={`px-3 py-1 text-xs rounded-xl border font-semibold transition cursor-pointer ${
                            isChosen
                              ? 'bg-[#6B51A5] text-white border-[#6B51A5] shadow-xs'
                              : 'bg-[#F5F2F9] text-[#503A7A] border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>

                  {isSubmitted && opt.distractorRationale && (
                    <p className="text-xs text-[#503A7A] pt-1 border-t border-purple-100/60 pl-2 italic">
                      💡 {opt.distractorRationale}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Default: Fallback Cloze Input for traditional practice cards
    return null;
  };

  // Render sentence with cloze gap
  const renderSentenceWithInput = () => {
    const rawSentence = item.stimulusText || legacyCard.sentence_en || '';
    const parts = rawSentence.split(/_+/);
    if (parts.length < 2) {
      return (
        <div className="text-base md:text-lg font-medium text-[#3C2A63] leading-relaxed">
          {rawSentence}
        </div>
      );
    }

    // If options are rendered in interactive mode, display clean sentence without inline input
    if (item.options.length > 0) {
      return (
        <div className="text-lg md:text-xl font-medium text-[#3C2A63] leading-loose flex flex-wrap items-center gap-x-2 gap-y-2 font-sans">
          <span>{parts[0]}</span>
          <span className="px-3 py-1 bg-purple-100 text-[#6B51A5] font-black rounded-xl border border-purple-200 underline decoration-2 underline-offset-4 font-mono">
            {isSubmitted 
              ? (item.targetWord || legacyCard.cloze_target) 
              : '[ ________ ]'}
          </span>
          <span>{parts.slice(1).join(' ')}</span>
        </div>
      );
    }

    return (
      <div className="text-lg md:text-2xl font-medium text-[#3C2A63] leading-loose flex flex-wrap items-center gap-x-2 gap-y-3 font-sans">
        <span>{parts[0]}</span>
        
        {/* Inline Cloze Input / Result */}
        <span className="inline-flex items-center relative">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => !isSubmitted && setUserInput(e.target.value)}
            disabled={isSubmitted}
            placeholder={item.targetWord ? `${item.targetWord.charAt(0)}...` : '...'}
            className={`min-w-[140px] max-w-[220px] px-3.5 py-1.5 rounded-xl text-center font-bold text-lg md:text-xl border-2 transition-all duration-200 focus:outline-none ${
              !isSubmitted
                ? 'bg-white border-[#6B51A5] text-[#6B51A5] focus:border-[#503A7A] focus:ring-4 focus:ring-purple-100 shadow-sm'
                : isCorrect
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm shadow-emerald-500/10'
                : 'bg-rose-50 border-rose-400 text-rose-800 shadow-sm shadow-rose-500/10 line-through'
            }`}
          />

          {isSubmitted && !isCorrect && (
            <span className="ml-2 px-3 py-1 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800 font-bold text-base md:text-lg animate-fade-in font-sans">
              {item.targetWord || legacyCard.cloze_target}
            </span>
          )}
        </span>

        <span>{parts.slice(1).join(' ')}</span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 animate-fade-in">
      
      {/* Main Flashcard Container */}
      <div className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-950/5 relative overflow-hidden">
        
        {/* Subtle Ambient Glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-purple-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header with Question Type Badge & Cognitive Level */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-purple-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-[#F5F2F9] border border-purple-200 text-[#503A7A] font-mono text-xs font-bold rounded-xl">
              Card {cardIndex + 1} / {totalCards}
            </span>

            {/* Question Type Indicator */}
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg uppercase tracking-wide">
              {item.type.replace(/-/g, ' ')}
            </span>

            {item.partOfSpeech && (
              <span className="px-2.5 py-0.5 bg-purple-50 border border-purple-200 text-[#6B51A5] text-xs font-semibold rounded-lg uppercase">
                {item.partOfSpeech}
              </span>
            )}

            {isMastered && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Mastered</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#7C68A5] uppercase tracking-wider">
              {item.cognitiveLevel}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="relative z-10 py-6 space-y-5">
          
          {/* Context & Paraphrase Meaning Guide */}
          {legacyCard.sentence_vi && (
            <div className="flex items-start justify-between gap-3 p-4 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block mb-1">
                  Context & Meaning:
                </span>
                <p className="text-sm md:text-base font-medium text-[#3C2A63] leading-relaxed">
                  {legacyCard.sentence_vi}
                </p>
                {item.hints && showHint && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl mt-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>Hint: {item.hints}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {!showHint && item.hints && (
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="p-2 text-[#7C68A5] hover:text-amber-700 hover:bg-amber-50 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer border border-transparent hover:border-amber-200"
                    title="Show hint"
                  >
                    <Lightbulb className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => handleSpeak(item.stimulusText.replace(/_+/g, item.targetWord || ''))}
                  className="p-2 text-[#7C68A5] hover:text-[#6B51A5] hover:bg-purple-100/60 rounded-xl transition cursor-pointer border border-transparent hover:border-purple-200"
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Interactive Stimulus Sentence */}
          <form onSubmit={handleSubmitAnswer} className="space-y-5">
            <div className="p-6 bg-[#F5F2F9] border border-purple-100 rounded-2xl space-y-2">
              {item.promptPrefix && (
                <span className="text-xs font-bold text-[#6B51A5] block">
                  {item.promptPrefix}
                </span>
              )}
              {renderSentenceWithInput()}
              {item.promptSuffix && (
                <span className="text-xs text-[#503A7A] block pt-1">
                  {item.promptSuffix}
                </span>
              )}
            </div>

            {/* Differentiated Question Types View */}
            {renderInteractiveOptions()}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-[#7C68A5]">
                {!isSubmitted ? (
                  <span>Select an answer and click <strong>Check Answer</strong></span>
                ) : (
                  <span>Review feedback and proceed to the next card</span>
                )}
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                {!isSubmitted ? (
                  <button
                    type="submit"
                    disabled={!canSubmit()}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#6B51A5] hover:bg-[#503A7A] disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-[#6B51A5]/20 flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    <span>Check Answer</span>
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNext(isCorrect)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    <span>{isLast ? 'Finish Practice' : 'Next Question'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Multi-layered Pedagogical Feedback Drawer */}
          {isSubmitted && (
            <div className={`p-5 rounded-2xl border transition-all animate-fade-in space-y-4 ${
              isCorrect
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : partialCreditResult && partialCreditResult.score > 0
                ? 'bg-purple-50/90 border-purple-200 text-purple-950'
                : 'bg-rose-50/90 border-rose-200 text-rose-950'
            }`}>
              
              {/* Header result banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Outstanding! Accurate syntactic and lexical application.</span>
                    </>
                  ) : partialCreditResult && partialCreditResult.score > 0 ? (
                    <>
                      <Sparkles className="w-5 h-5 text-[#6B51A5] shrink-0" />
                      <span>Partial Credit Awarded: {partialCreditResult.score} / {partialCreditResult.maxPoints} pts</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>Incorrect. Review the detailed feedback and micro-explanations below.</span>
                    </>
                  )}
                </div>

                {/* TIER 3: MACRO-SUMMARY & AI GAP ANALYSIS BUTTON */}
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="px-3.5 py-1.5 bg-white text-[#6B51A5] border border-purple-200 hover:border-[#6B51A5] hover:bg-purple-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>AI Gap Analysis (Chẩn đoán lỗ hổng nhận thức)</span>
                </button>
              </div>

              {/* Explanations & Notes */}
              {item.explanation && (
                <p className="text-xs md:text-sm text-[#3C2A63] leading-relaxed font-sans pt-1">
                  {item.explanation}
                </p>
              )}

              {item.grammarPoints && item.grammarPoints.length > 0 && (
                <div className="pt-2 border-t border-purple-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block">
                    Key Grammar & Usage Notes:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {item.grammarPoints.map((pt, idx) => (
                      <span key={idx} className="text-xs px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-[#6B51A5] font-medium">
                        ✓ {pt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TIER 3 MODAL: Gemini AI Cognitive Gap Analysis */}
      <GeminiAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        sentence={item.stimulusText || legacyCard.sentence_en || ''}
        targetWord={item.targetWord || legacyCard.cloze_target}
      />
    </div>
  );
};
