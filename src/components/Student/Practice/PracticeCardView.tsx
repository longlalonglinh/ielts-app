import React, { useState, useEffect, useRef } from 'react';
import { PracticeCard } from '../../../types/practice';
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
  BookOpen
} from 'lucide-react';

interface PracticeCardViewProps {
  card: PracticeCard;
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
  onPrev,
  isFirst = false,
  isLast = false,
  isMastered = false
}) => {
  const [userInput, setUserInput] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when card changes
  useEffect(() => {
    setUserInput('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setShowHint(false);
    setShowExplanation(false);

    // Auto-focus input on card transition
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  }, [card.id]);

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCheckAnswer = (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    if (isSubmitted) {
      // If already submitted, next card
      onNext(isCorrect);
      return;
    }

    const trimmed = (overrideInput !== undefined ? overrideInput : userInput).trim().toLowerCase();
    if (!trimmed) return;

    // Check against target & accepted answers
    let correct = false;
    if (card.options && card.options.length > 0) {
      // In multiple-choice mode, strictly evaluate against the specific target word
      correct = trimmed === card.cloze_target.toLowerCase().trim();
    } else {
      // In free text mode, allow accepted synonyms
      const validAnswers = [
        card.cloze_target.toLowerCase().trim(),
        ...(card.accepted_answers || []).map(a => a.toLowerCase().trim())
      ];
      correct = validAnswers.some(ans => ans === trimmed);
    }

    setIsCorrect(correct);
    setIsSubmitted(true);
    setShowExplanation(true);
    // Auto-voice is permanently DISABLED per user request. User can click the speaker icon manually.
  };

  const handleSelectOption = (opt: string) => {
    if (isSubmitted) return;
    setUserInput(opt);
    // Instant submission and immediate explanation box on option click
    handleCheckAnswer(undefined, opt);
  };

  // Render sentence with cloze gap
  const renderSentenceWithInput = () => {
    const parts = card.sentence_en.split(/_+/);
    if (parts.length < 2) {
      return (
        <div className="text-base md:text-lg font-medium text-[#3C2A63]">
          {card.sentence_en}
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
            placeholder={card.target_word ? `${card.target_word.charAt(0)}...` : '...'}
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
              {card.cloze_target}
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

        {/* Card Header */}
        <div className="relative z-10 flex items-center justify-between gap-4 pb-5 border-b border-purple-100">
          <div className="flex items-center space-x-2.5">
            <span className="px-3 py-1 bg-[#F5F2F9] border border-purple-200 text-[#503A7A] font-mono text-xs font-bold rounded-xl">
              Card {cardIndex + 1} / {totalCards}
            </span>

            {card.part_of_speech && (
              <span className="px-2.5 py-0.5 bg-purple-50 border border-purple-200 text-[#6B51A5] text-xs font-semibold rounded-lg uppercase">
                {card.part_of_speech}
              </span>
            )}

            {isMastered && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Mastered</span>
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="relative z-10 py-6 space-y-5">
          
          {/* Context & Paraphrase Meaning Guide */}
          <div className="flex items-start justify-between gap-3 p-4 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block mb-1">
                Context & Meaning:
              </span>
              <p className="text-sm md:text-base font-medium text-[#3C2A63] leading-relaxed">
                {card.sentence_vi}
              </p>
              {card.hints && showHint && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl mt-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Hint: {card.hints}</span>
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {!showHint && card.hints && (
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
                onClick={() => handleSpeak(card.sentence_en.replace(/_+/g, card.cloze_target))}
                className="p-2 text-[#7C68A5] hover:text-[#6B51A5] hover:bg-purple-100/60 rounded-xl transition cursor-pointer border border-transparent hover:border-purple-200"
                title="Listen to pronunciation"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Sentence with Cloze Gap */}
          <form onSubmit={handleCheckAnswer} className="space-y-5">
            <div className="p-6 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
              {renderSentenceWithInput()}
            </div>

            {/* Multiple Choice Options */}
            {card.options && card.options.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5]">
                  {isSubmitted ? 'Answer Options:' : 'Quick Select:'}
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {card.options.map((opt, idx) => {
                    const optLower = opt.toLowerCase().trim();
                    const isTarget = optLower === card.cloze_target.toLowerCase().trim();
                    const isUserChoice = userInput.toLowerCase().trim() === optLower;

                    let btnStyle = 'bg-white text-[#3C2A63] border-purple-200 hover:bg-purple-50 hover:border-[#6B51A5] cursor-pointer shadow-sm';

                    if (isSubmitted) {
                      if (isTarget) {
                        btnStyle = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold shadow-sm shadow-emerald-500/10';
                      } else if (isUserChoice && !isCorrect) {
                        btnStyle = 'bg-rose-100 border-rose-300 text-rose-900 line-through opacity-80';
                      } else {
                        btnStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                      }
                    } else if (isUserChoice) {
                      btnStyle = 'bg-[#6B51A5] text-white border-[#6B51A5] shadow-md shadow-[#6B51A5]/20 font-bold';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        disabled={isSubmitted}
                        className={`p-3 text-xs font-semibold rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${btnStyle}`}
                      >
                        {isSubmitted && isTarget && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        {isSubmitted && isUserChoice && !isCorrect && <X className="w-3.5 h-3.5 text-rose-600" />}
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-[#7C68A5]">
                {!isSubmitted ? (
                  <span>Press <kbd className="px-2 py-0.5 bg-[#F5F2F9] border border-purple-200 rounded text-[#503A7A] font-mono text-[10px]">Enter</kbd> to check answer</span>
                ) : (
                  <span>Press <kbd className="px-2 py-0.5 bg-[#F5F2F9] border border-purple-200 rounded text-[#503A7A] font-mono text-[10px]">Enter</kbd> or Next for next question</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {!isSubmitted ? (
                  <button
                    type="submit"
                    disabled={!userInput.trim()}
                    className="px-6 py-2.5 bg-[#6B51A5] hover:bg-[#503A7A] disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-[#6B51A5]/20 flex items-center space-x-2 transition cursor-pointer"
                  >
                    <span>Check Answer</span>
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNext(isCorrect)}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition cursor-pointer"
                  >
                    <span>{isLast ? 'Finish Practice' : 'Next Question'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Explanation Drawer after submission */}
          {showExplanation && (
            <div className={`p-5 rounded-2xl border transition-all animate-fade-in space-y-3 ${
              isCorrect
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/90 border-rose-200 text-rose-950'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Correct! Accurate syntax and vocabulary.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                      <span>Incorrect. The correct answer is: <strong>{card.cloze_target}</strong></span>
                    </>
                  )}
                </div>
              </div>

              {card.explanation && (
                <p className="text-xs md:text-sm text-[#3C2A63] leading-relaxed font-sans pt-1">
                  {card.explanation}
                </p>
              )}

              {card.grammar_points && card.grammar_points.length > 0 && (
                <div className="pt-2 border-t border-purple-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block">
                    Key Grammar & Usage Notes:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {card.grammar_points.map((pt, idx) => (
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
    </div>
  );
};
