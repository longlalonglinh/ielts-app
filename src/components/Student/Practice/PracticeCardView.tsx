import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PracticeCard, PracticeCardItem } from '../../../types/practice';
import { calculatePartialCreditScore, PartialCreditResult } from '../../../services/answerScoring';
import {
  normalizeToCardItem,
  resolveCategoriesForItem,
  doesCategoryMatch,
  resolveDragDropSetup,
  evaluateDragDropAnswer,
  splitSentenceBlanks,
  DragDropEvaluation
} from '../../../utils/practiceHelpers';
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
  BookOpen,
  Sparkles,
  Circle,
  XCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  GripVertical
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

export const PracticeCardView: React.FC<PracticeCardViewProps> = ({
  card,
  cardIndex,
  totalCards,
  onNext,
  isLast = false,
  isMastered = false
}) => {
  const item = useMemo(() => normalizeToCardItem(card), [card]);
  const legacyCard = card as PracticeCard;
  const dndSetup = useMemo(
    () => (item.type === 'drag-and-drop' ? resolveDragDropSetup(item, legacyCard) : null),
    [item, legacyCard]
  );

  // Selection states for different interaction models
  const [selectedSingleId, setSelectedSingleId] = useState<string | null>(null);
  const [selectedMultipleIds, setSelectedMultipleIds] = useState<Set<string>>(new Set());
  const [selectedTfng, setSelectedTfng] = useState<'TRUE' | 'FALSE' | 'NOT_GIVEN' | null>(null);
  const [categorizedMap, setCategorizedMap] = useState<Record<string, string>>({});
  const [userInput, setUserInput] = useState('');

  // Drag-and-Drop states
  const [dndSlotMap, setDndSlotMap] = useState<Record<number, string>>({});
  const [dndCategoryMap, setDndCategoryMap] = useState<Record<string, string>>({});
  const [activeChipId, setActiveChipId] = useState<string | null>(null);
  const [draggedChipId, setDraggedChipId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [dndEvaluation, setDndEvaluation] = useState<DragDropEvaluation | null>(null);

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
    setDndSlotMap({});
    setDndCategoryMap({});
    setActiveChipId(null);
    setDraggedChipId(null);
    setDragOverTarget(null);
    setDndEvaluation(null);
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
        if (item.maxSelections && next.size >= item.maxSelections) {
          return prev;
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

  // E. Drag-and-Drop (Supports both native HTML5 DnD and Click/Tap accessibility fallback)
  const placeChipInSlot = (slotIdx: number, optId: string) => {
    if (isSubmitted || !optId) return;
    setDndSlotMap(prev => {
      const next: Record<number, string> = { ...prev };
      const previousOwnerSlot = Object.keys(next).find(k => next[Number(k)] === optId);
      const displacedChip = next[slotIdx];
      if (previousOwnerSlot !== undefined) {
        const prevIdx = Number(previousOwnerSlot);
        if (displacedChip && prevIdx !== slotIdx) {
          next[prevIdx] = displacedChip;
        } else {
          delete next[prevIdx];
        }
      }
      next[slotIdx] = optId;
      return next;
    });
    setActiveChipId(null);
  };

  const removeChipFromSlot = (slotIdx: number) => {
    if (isSubmitted) return;
    setDndSlotMap(prev => {
      const next = { ...prev };
      delete next[slotIdx];
      return next;
    });
  };

  const placeChipInCategory = (catId: string, optId: string) => {
    if (isSubmitted || !optId) return;
    setDndCategoryMap(prev => ({
      ...prev,
      [optId]: catId
    }));
    setActiveChipId(null);
  };

  const removeChipFromCategory = (optId: string) => {
    if (isSubmitted) return;
    setDndCategoryMap(prev => {
      const next = { ...prev };
      delete next[optId];
      return next;
    });
  };

  const handleResetDragDrop = () => {
    if (isSubmitted) return;
    setDndSlotMap({});
    setDndCategoryMap({});
    setActiveChipId(null);
    setDraggedChipId(null);
    setDragOverTarget(null);
  };

  const handleDragStartChip = (e: React.DragEvent, optId: string) => {
    if (isSubmitted) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', optId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedChipId(optId);
    setActiveChipId(optId);
  };

  const readDraggedOptId = (e: React.DragEvent): string => {
    return e.dataTransfer.getData('text/plain') || draggedChipId || activeChipId || '';
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
        const selectedOpt = item.options.find((o, idx) => {
          const oId = (typeof o === 'object' && o !== null && o.id) ? String(o.id) : `opt_auto_${idx + 1}`;
          return oId === selectedSingleId;
        });
        itemCorrect = Boolean(selectedOpt?.isCorrect);
      } else {
        const trimmed = userInput.trim().toLowerCase();
        if (!trimmed) return;
        const validAnswers = [
          String(legacyCard.cloze_target || '').toLowerCase().trim(),
          ...(legacyCard.accepted_answers || []).map(a => String(a || '').toLowerCase().trim())
        ];
        itemCorrect = validAnswers.some(a => a === trimmed);
      }
    } else if (item.type === 'multiple-response') {
      if (selectedMultipleIds.size === 0) return;

      const selectedList: string[] = Array.from(selectedMultipleIds);
      const result = calculatePartialCreditScore(selectedList, item.options, 1.0);
      setPartialCreditResult(result);

      itemCorrect = result.isFullyCorrect || result.score >= 0.8;
    } else if (item.type === 'true-false-not-given') {
      if (!selectedTfng) return;
      const targetAns = String(legacyCard.cloze_target || (item.options.find(o => o.isCorrect)?.text) || (item.options[0]?.text) || 'TRUE').toUpperCase().trim();
      const normalizedTarget = targetAns.includes('NOT') ? 'NOT_GIVEN' : targetAns.includes('FALSE') ? 'FALSE' : 'TRUE';
      itemCorrect = selectedTfng === normalizedTarget;
    } else if (item.type === 'category-matching') {
      const categories = resolveCategoriesForItem(item);
      if (Object.keys(categorizedMap).length === 0) return;
      itemCorrect = item.options.every((opt, idx) => {
        const optId = (typeof opt === 'object' && opt !== null && opt.id) ? String(opt.id) : `opt_auto_${idx + 1}`;
        return doesCategoryMatch(categorizedMap[optId], opt.category, categories);
      });
    } else if (item.type === 'drag-and-drop' && dndSetup) {
      if (!canSubmit()) return;
      const evaluation = evaluateDragDropAnswer(dndSetup, item, dndSlotMap, dndCategoryMap);
      setDndEvaluation(evaluation);
      itemCorrect = evaluation.isFullyCorrect;
    }

    setIsCorrect(itemCorrect);
    setIsSubmitted(true);

    const allOptIds = new Set(item.options.map((o, idx) => (typeof o === 'object' && o !== null && o.id) ? String(o.id) : `opt_auto_${idx + 1}`));
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
      const requiredCount = item.options.filter(o => Boolean(o.category)).length || item.options.length;
      return requiredCount > 0 && Object.keys(categorizedMap).length >= requiredCount;
    }
    if (item.type === 'drag-and-drop' && dndSetup) {
      if (dndSetup.mode === 'categories') {
        return item.options.length > 0 && Object.keys(dndCategoryMap).length >= item.options.length;
      }
      for (let i = 0; i < dndSetup.blankCount; i++) {
        if (!dndSlotMap[i]) return false;
      }
      return dndSetup.blankCount > 0;
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
            {item.options.map((opt, idx) => {
              const optId = (typeof opt === 'object' && opt !== null && opt.id) 
                ? String(opt.id) 
                : `opt_auto_${idx + 1}`;
              const optText = (typeof opt === 'string' ? opt : (opt.text || '')).trim() || `Option ${idx + 1}`;
              const isSelected = selectedSingleId === optId;
              
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

              const isExpanded = expandedRationaleIds.has(optId);

              return (
                <div
                  key={optId}
                  className={`rounded-2xl border transition-all p-3.5 ${containerStyle}`}
                >
                  <div className="w-full flex items-start justify-between gap-3">
                    <div
                      role="button"
                      tabIndex={isSubmitted ? -1 : 0}
                      aria-disabled={isSubmitted}
                      onClick={() => !isSubmitted && handleSelectSingle(optId)}
                      onKeyDown={(e) => {
                        if (!isSubmitted && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleSelectSingle(optId);
                        }
                      }}
                      className={`flex-1 text-left flex items-start justify-between gap-3 ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
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
                          <span className="text-sm font-semibold">{optText}</span>
                        </div>
                      </div>

                      {badgeText && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${badgeColor}`}>
                          {badgeText}
                        </span>
                      )}
                    </div>

                    {isSubmitted && opt.distractorRationale && (
                      <button
                        type="button"
                        onClick={() => toggleRationale(optId)}
                        className="p-1 text-slate-500 hover:text-[#6B51A5] rounded-md cursor-pointer shrink-0"
                        title="Toggle explanation"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

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
            {item.options.map((opt, idx) => {
              const optId = (typeof opt === 'object' && opt !== null && opt.id) 
                ? String(opt.id) 
                : `opt_auto_${idx + 1}`;
              const optText = (typeof opt === 'string' ? opt : (opt.text || '')).trim() || `Option ${idx + 1}`;
              const isSelected = selectedMultipleIds.has(optId);

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

              const isExpanded = expandedRationaleIds.has(optId);

              return (
                <div
                  key={optId}
                  className={`rounded-2xl border transition-all p-3.5 ${containerStyle}`}
                >
                  <div className="w-full flex items-start justify-between gap-3">
                    <div
                      role="button"
                      tabIndex={isSubmitted ? -1 : 0}
                      aria-disabled={isSubmitted}
                      onClick={() => !isSubmitted && handleToggleMultiple(optId)}
                      onKeyDown={(e) => {
                        if (!isSubmitted && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleToggleMultiple(optId);
                        }
                      }}
                      className={`flex-1 text-left flex items-start justify-between gap-3 ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
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
                          <span className="text-sm font-semibold">{optText}</span>
                        </div>
                      </div>

                      {badgeText && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${badgeColor}`}>
                          {badgeText}
                        </span>
                      )}
                    </div>

                    {isSubmitted && opt.distractorRationale && (
                      <button
                        type="button"
                        onClick={() => toggleRationale(optId)}
                        className="p-1 text-slate-500 hover:text-[#6B51A5] rounded-md cursor-pointer shrink-0"
                        title="Toggle explanation"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

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
      const targetAns = String(legacyCard.cloze_target || (item.options[0]?.text) || 'TRUE').toUpperCase().trim();
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
      const categories = resolveCategoriesForItem(item);
      const assignedCount = Object.keys(categorizedMap).length;

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5] block">
              Classify and match each term to its correct category:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F5F2F9] text-[#503A7A] border border-purple-200">
              Matched {assignedCount} / {item.options.length}
            </span>
          </div>

          <div className="space-y-3">
            {item.options.map((opt, idx) => {
              const optId = (typeof opt === 'object' && opt !== null && opt.id)
                ? String(opt.id)
                : `opt_auto_${idx + 1}`;
              const optText = (typeof opt === 'string' ? opt : (opt.text || '')).trim() || `Option ${idx + 1}`;
              const assignedCat = categorizedMap[optId];
              const isCorrectCat = doesCategoryMatch(assignedCat, opt.category, categories);

              let cardStyle = 'bg-white border-purple-200';
              if (isSubmitted) {
                cardStyle = isCorrectCat
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border-rose-400 text-rose-950';
              }

              return (
                <div key={optId} className={`p-3.5 rounded-2xl border transition space-y-2 ${cardStyle}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#3C2A63]">{optText}</span>
                    {isSubmitted && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                        isCorrectCat ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {isCorrectCat ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{isCorrectCat ? 'CORRECT MATCH' : `EXPECTED: ${opt.category || 'N/A'}`}</span>
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
                          onClick={() => handleAssignCategory(optId, cat.id)}
                          className={`px-3 py-1.5 min-h-[36px] text-xs rounded-xl border font-semibold transition cursor-pointer ${
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
                      {opt.distractorRationale}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 5. Drag-and-Drop (Inline Blanks / Single Drop Box / Category Drop Zones)
    if (item.type === 'drag-and-drop' && dndSetup) {
      if (dndSetup.mode === 'categories') {
        const assignedIds = new Set(Object.keys(dndCategoryMap));
        const unassignedChips = dndSetup.bankOptions.filter(o => !assignedIds.has(o.id));

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5]">
                Drag each card into a category zone (hoặc chạm thẻ rồi chạm nhóm):
              </span>
              {!isSubmitted && Object.keys(dndCategoryMap).length > 0 && (
                <button
                  type="button"
                  onClick={handleResetDragDrop}
                  className="text-xs font-bold text-[#6B51A5] hover:text-[#503A7A] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Word / Item Bank */}
            <div
              onDragOver={(e) => {
                if (!isSubmitted) {
                  e.preventDefault();
                  setDragOverTarget('cat_bank');
                }
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTarget(null);
                const optId = readDraggedOptId(e);
                if (optId) removeChipFromCategory(optId);
              }}
              className={`p-3.5 rounded-2xl border-2 border-dashed transition ${
                dragOverTarget === 'cat_bank'
                  ? 'border-[#6B51A5] bg-purple-50'
                  : 'border-purple-200 bg-[#F5F2F9]/70'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block mb-2">
                Word / Card Bank ({unassignedChips.length} remaining)
              </span>
              {unassignedChips.length === 0 ? (
                <p className="text-xs text-emerald-700 font-semibold py-1">
                  All cards placed into category zones. Click Check Answer or adjust below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unassignedChips.map((opt) => {
                    const isArmed = activeChipId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        draggable={!isSubmitted}
                        data-dnd-chip={opt.id}
                        onDragStart={(e) => handleDragStartChip(e, opt.id)}
                        onDragEnd={() => {
                          setDraggedChipId(null);
                          setDragOverTarget(null);
                        }}
                        onClick={() => !isSubmitted && setActiveChipId(prev => prev === opt.id ? null : opt.id)}
                        className={`min-h-[40px] px-3.5 py-2 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 transition select-none ${
                          isSubmitted
                            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-default'
                            : isArmed
                            ? 'bg-[#6B51A5] border-[#503A7A] text-white shadow-md ring-2 ring-[#6B51A5]/30 cursor-pointer'
                            : 'bg-white border-purple-200 text-[#3C2A63] hover:border-[#6B51A5] hover:bg-purple-50 cursor-grab active:cursor-grabbing shadow-xs'
                        }`}
                      >
                        <GripVertical className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Drop Zones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dndSetup.categories.map((cat) => {
                const itemsInCat = item.options.filter(o => dndCategoryMap[o.id] === cat.id);
                const isOver = dragOverTarget === `cat_${cat.id}`;
                return (
                  <div
                    key={cat.id}
                    data-dnd-cat-zone={cat.id}
                    onDragOver={(e) => {
                      if (!isSubmitted) {
                        e.preventDefault();
                        setDragOverTarget(`cat_${cat.id}`);
                      }
                    }}
                    onDragLeave={() => setDragOverTarget(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverTarget(null);
                      const optId = readDraggedOptId(e);
                      if (optId) placeChipInCategory(cat.id, optId);
                    }}
                    onClick={() => {
                      if (!isSubmitted && activeChipId) {
                        placeChipInCategory(cat.id, activeChipId);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border-2 min-h-[104px] transition flex flex-col gap-2 ${
                      isOver
                        ? 'border-[#6B51A5] bg-purple-50 ring-2 ring-[#6B51A5]/20'
                        : activeChipId && !isSubmitted
                        ? 'border-dashed border-[#6B51A5] bg-purple-50/40 cursor-pointer hover:bg-purple-50'
                        : 'border-purple-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                      <span className="text-xs font-extrabold text-[#3C2A63]">{cat.name}</span>
                      <span className="text-[10px] font-mono text-[#7C68A5]">{itemsInCat.length} item(s)</span>
                    </div>

                    {itemsInCat.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[11px] text-[#7C68A5] italic py-2">
                        {activeChipId && !isSubmitted ? 'Tap here to drop selected card' : 'Drop cards here'}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {itemsInCat.map((placedOpt) => {
                          const ok = dndEvaluation?.optionResults[placedOpt.id];
                          let pillClass = 'bg-purple-100 border-[#6B51A5] text-[#3C2A63]';
                          if (isSubmitted) {
                            pillClass = ok
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                              : 'bg-rose-100 border-rose-400 text-rose-950';
                          }
                          return (
                            <div
                              key={placedOpt.id}
                              draggable={!isSubmitted}
                              onDragStart={(e) => handleDragStartChip(e, placedOpt.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isSubmitted) removeChipFromCategory(placedOpt.id);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${pillClass} ${
                                isSubmitted ? 'cursor-default' : 'cursor-pointer hover:opacity-90'
                              }`}
                              title={isSubmitted ? (ok ? 'Correct' : `Expected: ${placedOpt.category}`) : 'Click or drag to remove'}
                            >
                              {isSubmitted && (
                                ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                              )}
                              <span>{placedOpt.text}</span>
                              {!isSubmitted && <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submitted Breakdown for Categories */}
            {isSubmitted && (
              <div className="space-y-1.5 pt-1">
                {item.options.map((opt) => {
                  const ok = dndEvaluation?.optionResults[opt.id];
                  return (
                    <div
                      key={opt.id}
                      className={`px-3 py-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                        ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1.5">
                        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                        <span>{opt.text}</span>
                      </span>
                      <span className="font-mono font-semibold">
                        Expected: {opt.category || 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      // Blanks or Single-Box Word Bank
      const placedOptionIds = new Set(Object.values(dndSlotMap));
      const placedCount = Object.keys(dndSlotMap).length;
      const singleDropOpt = dndSetup.mode === 'single-box'
        ? item.options.find(o => o.id === dndSlotMap[0])
        : null;

      return (
        <div className="space-y-4">
          {dndSetup.mode === 'single-box' && (
            <div
              data-dnd-slot="0"
              onDragOver={(e) => {
                if (!isSubmitted) {
                  e.preventDefault();
                  setDragOverTarget('slot_0');
                }
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTarget(null);
                const optId = readDraggedOptId(e);
                if (optId) placeChipInSlot(0, optId);
              }}
              onClick={() => {
                if (isSubmitted) return;
                if (activeChipId) {
                  placeChipInSlot(0, activeChipId);
                } else if (singleDropOpt) {
                  removeChipFromSlot(0);
                }
              }}
              className={`p-4 rounded-2xl border-2 min-h-[68px] flex items-center justify-center transition ${
                isSubmitted
                  ? dndEvaluation?.slotResults[0]
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                    : 'bg-rose-50 border-rose-400 text-rose-950'
                  : dragOverTarget === 'slot_0'
                  ? 'border-[#6B51A5] bg-purple-100 ring-2 ring-[#6B51A5]/30'
                  : singleDropOpt
                  ? 'border-[#6B51A5] bg-purple-50 cursor-pointer'
                  : activeChipId
                  ? 'border-dashed border-[#6B51A5] bg-purple-50/50 cursor-pointer'
                  : 'border-dashed border-purple-300 bg-white'
              }`}
            >
              {singleDropOpt ? (
                <div className="flex items-center gap-2 font-bold text-sm">
                  {isSubmitted && (
                    dndEvaluation?.slotResults[0]
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{singleDropOpt.text}</span>
                  {!isSubmitted && <X className="w-4 h-4 opacity-60" />}
                  {isSubmitted && !dndEvaluation?.slotResults[0] && (
                    <span className="ml-2 px-2.5 py-0.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs">
                      Expected: {(dndSetup.expectedBySlot[0] || []).join(' / ')}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs font-semibold text-[#7C68A5]">
                  {activeChipId ? 'Tap here to drop selected word' : 'Drag and drop the matching answer here'}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5]">
              Word Bank ({placedCount} / {dndSetup.blankCount} blanks filled):
            </span>
            {!isSubmitted && placedCount > 0 && (
              <button
                type="button"
                onClick={handleResetDragDrop}
                className="text-xs font-bold text-[#6B51A5] hover:text-[#503A7A] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div
            onDragOver={(e) => {
              if (!isSubmitted) {
                e.preventDefault();
                setDragOverTarget('word_bank');
              }
            }}
            onDragLeave={() => setDragOverTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverTarget(null);
              const optId = readDraggedOptId(e);
              if (optId) {
                const ownerSlot = Object.keys(dndSlotMap).find(k => dndSlotMap[Number(k)] === optId);
                if (ownerSlot !== undefined) {
                  removeChipFromSlot(Number(ownerSlot));
                }
              }
            }}
            className={`p-4 rounded-2xl border-2 transition ${
              dragOverTarget === 'word_bank'
                ? 'border-[#6B51A5] bg-purple-50'
                : 'border-purple-200 bg-[#F5F2F9]/60'
            }`}
          >
            <div className="flex flex-wrap gap-2.5">
              {dndSetup.bankOptions.map((opt) => {
                const isUsed = placedOptionIds.has(opt.id);
                const isArmed = activeChipId === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    draggable={!isSubmitted && !isUsed}
                    disabled={isUsed && !isSubmitted}
                    data-dnd-chip={opt.id}
                    onDragStart={(e) => handleDragStartChip(e, opt.id)}
                    onDragEnd={() => {
                      setDraggedChipId(null);
                      setDragOverTarget(null);
                    }}
                    onClick={() => {
                      if (isSubmitted || isUsed) return;
                      if (activeChipId === opt.id) {
                        setActiveChipId(null);
                      } else {
                        // Also allow quick-fill into next empty blank if user double-taps, or select chip
                        setActiveChipId(opt.id);
                      }
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-xl border-2 text-sm font-bold flex items-center gap-2 transition select-none ${
                      isUsed
                        ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed line-through'
                        : isSubmitted
                        ? opt.isCorrect
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-default'
                          : 'bg-white border-slate-200 text-slate-500 cursor-default'
                        : isArmed
                        ? 'bg-[#6B51A5] border-[#503A7A] text-white shadow-md ring-2 ring-[#6B51A5]/30 cursor-pointer'
                        : 'bg-white border-purple-200 text-[#3C2A63] hover:border-[#6B51A5] hover:bg-purple-50 cursor-grab active:cursor-grabbing shadow-xs'
                    }`}
                  >
                    {!isUsed && !isSubmitted && <GripVertical className="w-3.5 h-3.5 opacity-60 shrink-0" />}
                    <span>{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {!isSubmitted && (
              <p className="text-[11px] text-[#7C68A5] mt-3">
                {activeChipId
                  ? 'Đã chọn từ. Hãy bấm vào ô trống [ ___ ] ở trên để thả vào (hoặc kéo trực tiếp).'
                  : 'Kéo từ vào ô trống trong câu ở trên, hoặc bấm chọn từ rồi bấm vào ô trống.'}
              </p>
            )}
          </div>

          {/* Post-submit micro-rationale */}
          {isSubmitted && (
            <div className="space-y-2 pt-1">
              {item.options.filter(o => o.distractorRationale).map((opt) => (
                <div
                  key={opt.id}
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    opt.isCorrect
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-0.5">
                    {opt.isCorrect ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">Distractor</span>
                    )}
                    <span>{opt.text}</span>
                  </div>
                  <p className="pl-5">{opt.distractorRationale}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Default: Fallback Cloze Input for traditional practice cards
    return null;
  };

  // Render sentence with cloze gap
  const renderSentenceWithInput = () => {
    const rawSentence = item.stimulusText || legacyCard.sentence_en || '';
    const { segments, blankCount } = splitSentenceBlanks(rawSentence);
    if (blankCount === 0) {
      return (
        <div className="text-base md:text-lg font-medium text-[#3C2A63] leading-relaxed">
          {rawSentence}
        </div>
      );
    }

    // Interactive Drag-and-Drop inline sentence blanks
    if (item.type === 'drag-and-drop' && dndSetup && dndSetup.mode === 'blanks') {
      return (
        <div className="text-lg md:text-xl font-medium text-[#3C2A63] leading-loose flex flex-wrap items-center gap-x-2 gap-y-2.5 font-sans">
          {segments.map((seg, segIdx) => {
            const hasBlankAfter = segIdx < blankCount;
            const placedOptId = dndSlotMap[segIdx];
            const placedOpt = placedOptId ? item.options.find(o => o.id === placedOptId) : undefined;
            const slotOk = dndEvaluation?.slotResults[segIdx];
            const isOver = dragOverTarget === `slot_${segIdx}`;
            const expectedText = (dndSetup.expectedBySlot[segIdx] || []).join(' / ');

            return (
              <React.Fragment key={segIdx}>
                {seg && <span>{seg}</span>}
                {hasBlankAfter && (
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    <span
                      role="button"
                      tabIndex={isSubmitted ? -1 : 0}
                      data-dnd-slot={segIdx}
                      draggable={!isSubmitted && Boolean(placedOpt)}
                      onDragStart={(e) => {
                        if (placedOpt && !isSubmitted) {
                          handleDragStartChip(e, placedOpt.id);
                        }
                      }}
                      onDragOver={(e) => {
                        if (!isSubmitted) {
                          e.preventDefault();
                          setDragOverTarget(`slot_${segIdx}`);
                        }
                      }}
                      onDragLeave={() => setDragOverTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverTarget(null);
                        const optId = readDraggedOptId(e);
                        if (optId) placeChipInSlot(segIdx, optId);
                      }}
                      onClick={() => {
                        if (isSubmitted) return;
                        if (activeChipId) {
                          placeChipInSlot(segIdx, activeChipId);
                        } else if (placedOpt) {
                          removeChipFromSlot(segIdx);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!isSubmitted && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          if (activeChipId) {
                            placeChipInSlot(segIdx, activeChipId);
                          } else if (placedOpt) {
                            removeChipFromSlot(segIdx);
                          }
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 min-w-[116px] min-h-[38px] justify-center px-3.5 py-1 rounded-xl border-2 text-sm md:text-base font-bold transition select-none ${
                        isSubmitted
                          ? slotOk
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                            : 'bg-rose-100 border-rose-400 text-rose-950'
                          : isOver
                          ? 'bg-purple-200 border-[#6B51A5] text-[#3C2A63] scale-[1.03] ring-2 ring-[#6B51A5]/30 cursor-pointer'
                          : placedOpt
                          ? 'bg-[#6B51A5] border-[#503A7A] text-white shadow-sm cursor-pointer hover:bg-[#503A7A]'
                          : activeChipId
                          ? 'bg-purple-100/80 border-dashed border-[#6B51A5] text-[#6B51A5] cursor-pointer hover:bg-purple-200/70'
                          : 'bg-white border-dashed border-purple-300 text-[#7C68A5] cursor-pointer hover:border-[#6B51A5]'
                      }`}
                      title={
                        isSubmitted
                          ? (slotOk ? 'Correct' : `Expected: ${expectedText}`)
                          : placedOpt
                          ? 'Click to remove back to bank'
                          : activeChipId
                          ? 'Click to place selected word'
                          : `Drop word for blank #${segIdx + 1}`
                      }
                    >
                      {placedOpt ? (
                        <>
                          {isSubmitted && (
                            slotOk
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                              : <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
                          )}
                          <span className={isSubmitted && !slotOk ? 'line-through' : ''}>{placedOpt.text}</span>
                          {!isSubmitted && <X className="w-3.5 h-3.5 opacity-75 hover:opacity-100 shrink-0" />}
                        </>
                      ) : (
                        <span className="font-mono text-xs">{`[ ${segIdx + 1} ]`}</span>
                      )}
                    </span>

                    {isSubmitted && !slotOk && expectedText && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 font-bold text-sm">
                        {expectedText}
                      </span>
                    )}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    // If options are rendered in interactive mode, display clean sentence without inline input
    if (item.options.length > 0) {
      return (
        <div className="text-lg md:text-xl font-medium text-[#3C2A63] leading-loose flex flex-wrap items-center gap-x-2 gap-y-2 font-sans">
          <span>{segments[0]}</span>
          <span className="px-3 py-1 bg-purple-100 text-[#6B51A5] font-black rounded-xl border border-purple-200 underline decoration-2 underline-offset-4 font-mono">
            {isSubmitted
              ? (item.targetWord || legacyCard.cloze_target)
              : '[ ________ ]'}
          </span>
          <span>{segments.slice(1).join(' ')}</span>
        </div>
      );
    }

    return (
      <div className="text-lg md:text-2xl font-medium text-[#3C2A63] leading-loose flex flex-wrap items-center gap-x-2 gap-y-3 font-sans">
        <span>{segments[0]}</span>
        
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

        <span>{segments.slice(1).join(' ')}</span>
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
                  onClick={() => {
                    let blankIdx = 0;
                    const filledText = item.stimulusText.replace(/_+|\[blank(?:\s*\d*)?\]|\[\s*_{2,}\s*\]|\[\d+\]/gi, () => {
                      const expected = dndSetup?.expectedBySlot[blankIdx]?.[0] || item.targetWord || '';
                      blankIdx++;
                      return expected;
                    });
                    handleSpeak(filledText);
                  }}
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
