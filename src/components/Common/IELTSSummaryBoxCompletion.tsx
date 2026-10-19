import React, { useState } from 'react';
import { WordBankItem, Question } from '../../types';
import { Package, Check, Sparkles, X } from 'lucide-react';
import { InlineBlankRenderer, WordBankItemMeta } from './InlineBlankRenderer';

interface IELTSSummaryBoxCompletionProps {
  question: Question;
  questionNumber: number;
  userAnswer: string;
  onAnswerChange: (questionId: string, answer: string) => void;
  wordBank?: WordBankItem[];
  allUserAnswers?: Record<string, string>;
  disabled?: boolean;
}

export const IELTSSummaryBoxCompletion: React.FC<IELTSSummaryBoxCompletionProps> = ({
  question,
  questionNumber,
  userAnswer,
  onAnswerChange,
  wordBank,
  allUserAnswers = {},
  disabled = false
}) => {
  // Track which blank is currently focused/active for Click-to-Fill functionality
  const [activeBlankNum, setActiveBlankNum] = useState<number>(questionNumber);

  // Normalize available words from word_bank, matching_options, or options
  const items: WordBankItemMeta[] = [];
  if (wordBank && wordBank.length > 0) {
    wordBank.forEach(wb => items.push({ id: wb.id, text: wb.word }));
  } else if (question.word_bank && question.word_bank.length > 0) {
    question.word_bank.forEach(wb => items.push({ id: wb.id, text: wb.word }));
  } else if (question.matching_options && question.matching_options.length > 0) {
    question.matching_options.forEach(m => items.push({ id: m.id, text: m.text }));
  } else if (question.options && question.options.length > 0) {
    question.options.forEach((opt, idx) => {
      const match = opt.match(/^([A-Za-z0-9]+)[\.\:\s]\s*(.*)$/);
      if (match) {
        items.push({ id: match[1].toUpperCase(), text: match[2].trim() });
      } else {
        const letter = String.fromCharCode(65 + idx);
        items.push({ id: letter, text: opt });
      }
    });
  }

  // Determine word limit (e.g. "NO MORE THAN TWO WORDS" -> 2)
  let wordLimit: number | undefined;
  const wl = (question.word_limit || question.instruction || '').toLowerCase();
  if (wl.includes('one') || wl.includes('1 word')) wordLimit = 1;
  else if (wl.includes('two') || wl.includes('2 words')) wordLimit = 2;
  else if (wl.includes('three') || wl.includes('3 words')) wordLimit = 3;

  // Handle click on word from Word Bank -> Fills into active blank!
  const handleWordBankClick = (item: WordBankItemMeta) => {
    if (disabled) return;
    const targetQNum = activeBlankNum || questionNumber;
    if (targetQNum === questionNumber) {
      onAnswerChange(question.question_id, item.id);
    } else {
      const sectionPrefix = question.section === 'listening' ? 'L' : 'R';
      onAnswerChange(`${sectionPrefix}${targetQNum}`, item.id);
    }
  };

  // Content with [blank_X] token matrix
  const contextContent = (question as any).context_content || question.question_text || '';
  const contentToRender = contextContent.includes('[blank_') 
    ? contextContent 
    : `${contextContent} [blank_${questionNumber}]`;

  // Combined answers map
  const answersMap: Record<string | number, string> = {
    ...allUserAnswers,
    [questionNumber]: userAnswer,
    [question.question_id]: userAnswer
  };

  return (
    <div className="space-y-4 my-2">
      {/* 1. WORD BANK DISPLAY & CLICK-TO-FILL BAR */}
      {items.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50/60 rounded-2xl border border-purple-200 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider text-[#503A7A] mb-3 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#6B51A5]" />
              <span>Word Bank / List of Options (Click to fill active blank [{activeBlankNum}])</span>
            </span>
            <span className="text-[10px] text-[#6B51A5] font-extrabold bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-200">
              Active Blank: #{activeBlankNum}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {items.map((it) => {
              // Check if selected in current blank
              const isSelectedInActive = answersMap[activeBlankNum]?.toUpperCase() === it.id.toUpperCase() ||
                                         answersMap[question.question_id]?.toUpperCase() === it.id.toUpperCase();

              return (
                <button
                  type="button"
                  key={it.id}
                  disabled={disabled}
                  onClick={() => handleWordBankClick(it)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition select-none flex items-start gap-2 text-left ${
                    isSelectedInActive
                      ? 'bg-[#6B51A5] text-white border-[#6B51A5] shadow-sm font-bold scale-[1.02]'
                      : 'bg-white text-[#3C2A63] border-purple-100 hover:border-purple-300 hover:bg-purple-50/40 hover:shadow-xs'
                  }`}
                >
                  <span className={`font-mono font-black shrink-0 ${isSelectedInActive ? 'text-white' : 'text-[#6B51A5]'}`}>
                    {it.id}.
                  </span>
                  <span className="leading-tight flex-1 break-words">{it.text}</span>
                  {isSelectedInActive && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. INLINE TOKEN MATRIX RENDERER */}
      <div className="p-4 bg-white rounded-2xl border border-purple-100 shadow-xs leading-loose">
        <InlineBlankRenderer
          content={contentToRender}
          userAnswers={answersMap}
          onAnswerChange={(qKey, val) => {
            const parsedNum = parseInt(qKey, 10);
            if (parsedNum === questionNumber || qKey === question.question_id || qKey === String(questionNumber)) {
              onAnswerChange(question.question_id, val);
            } else {
              const sectionPrefix = question.section === 'listening' ? 'L' : 'R';
              onAnswerChange(`${sectionPrefix}${qKey}`, val);
            }
          }}
          wordLimit={wordLimit}
          wordBank={items}
          activeBlankNum={activeBlankNum}
          onFocusBlank={(qKey) => setActiveBlankNum(parseInt(qKey, 10))}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
