import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { ChevronDown, Check, Sparkles } from 'lucide-react';

export interface WordBankItemMeta {
  id: string; // e.g. "A", "B" or word
  text: string;
}

interface BlankInputCellProps {
  qNum: number;
  value: string;
  disabled?: boolean;
  wordLimit?: number;
  wordBank?: WordBankItemMeta[];
  onChange: (questionKey: string, val: string) => void;
  onFocusBlank?: (questionKey: string) => void;
  isActiveBlank?: boolean;
}

/**
 * Isolated Memoized Debounced Blank Input Cell (DebouncedInputCell)
 * Manages local state with 280ms debounce + onBlur flush to prevent re-renders,
 * cursor loss, and typing lag across complex markdown tables and summaries.
 */
const BlankInputCell = memo(({
  qNum,
  value,
  disabled = false,
  wordLimit,
  wordBank,
  onChange,
  onFocusBlank,
  isActiveBlank = false
}: BlankInputCellProps) => {
  const [localVal, setLocalVal] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qKey = String(qNum);

  // Sync with external value changes (e.g. click-to-fill from word bank or clear)
  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const flushChange = useCallback((val: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onChange(qKey, val);
  }, [qKey, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setLocalVal(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(qKey, nextVal);
    }, 280);
  };

  const handleBlur = () => {
    flushChange(localVal);
  };

  // Keyboard Navigation: TAB or ENTER advances to next blank
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      flushChange(localVal);
      // Locate all ielts blanks in current document
      const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[data-ielts-blank="true"]')
      );
      const currentIndex = allInputs.indexOf(e.currentTarget);
      if (currentIndex !== -1 && currentIndex + 1 < allInputs.length) {
        allInputs[currentIndex + 1].focus();
        allInputs[currentIndex + 1].select();
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      flushChange(localVal);
      const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[data-ielts-blank="true"]')
      );
      const currentIndex = allInputs.indexOf(e.currentTarget);
      if (currentIndex > 0) {
        allInputs[currentIndex - 1].focus();
        allInputs[currentIndex - 1].select();
      }
    }
  };

  // Compute responsive width according to word limit
  let widthClass = 'w-28 sm:w-36';
  if (wordLimit === 1) widthClass = 'w-24 sm:w-28';
  else if (wordLimit === 2) widthClass = 'w-32 sm:w-40';
  else if (wordLimit && wordLimit >= 3) widthClass = 'w-40 sm:w-52';

  // If wordBank is available, can also support quick dropdown
  const hasWordBank = Boolean(wordBank && wordBank.length > 0);

  return (
    <span className="inline-flex items-center mx-1 my-0.5 align-middle select-none relative group">
      {/* Question Number Badge */}
      <span 
        className={`px-1.5 py-1 text-[11px] font-mono font-black border rounded-l-lg transition-colors flex items-center justify-center shrink-0 ${
          isActiveBlank 
            ? 'bg-[#6B51A5] text-white border-[#6B51A5]' 
            : 'bg-purple-100 text-[#503A7A] border-purple-200 group-hover:bg-purple-200'
        }`}
        title={`Question ${qNum}`}
      >
        {qNum}
      </span>

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        data-ielts-blank="true"
        data-q-num={qNum}
        value={localVal}
        disabled={disabled}
        onFocus={() => onFocusBlank?.(qKey)}
        onBlur={handleBlur}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={`[${qNum}]`}
        className={`${widthClass} text-xs md:text-sm px-2.5 py-1 border border-l-0 rounded-r-lg font-bold text-[#3C2A63] bg-white placeholder-[#A38DBE] transition-all focus:outline-none focus:bg-purple-50/50 ${
          isActiveBlank
            ? 'border-[#6B51A5] ring-2 ring-purple-300 shadow-sm'
            : 'border-purple-200 focus:border-[#6B51A5] focus:ring-1 focus:ring-[#6B51A5]'
        }`}
      />

      {/* Optional Quick Word Bank Dropdown Trigger */}
      {hasWordBank && (
        <div className="relative inline-block ml-1">
          <select
            value=""
            disabled={disabled}
            onChange={(e) => {
              if (e.target.value) {
                setLocalVal(e.target.value);
                flushChange(e.target.value);
              }
            }}
            className="opacity-0 absolute inset-0 w-5 h-full cursor-pointer z-10"
            title="Pick word from Word Bank"
          >
            <option value="">Select word...</option>
            {wordBank!.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}. {item.text}
              </option>
            ))}
          </select>
          <span className="w-5 h-6 rounded bg-purple-100 text-[#6B51A5] flex items-center justify-center text-[10px] cursor-pointer hover:bg-purple-200 transition">
            <ChevronDown className="w-3 h-3" />
          </span>
        </div>
      )}
    </span>
  );
});

BlankInputCell.displayName = 'BlankInputCell';

export interface InlineBlankRendererProps {
  content: string;
  userAnswers: Record<string, string>;
  onAnswerChange: (questionKey: string, value: string) => void;
  disabled?: boolean;
  wordLimit?: number;
  wordBank?: WordBankItemMeta[] | string[];
  activeBlankNum?: number | string | null;
  onFocusBlank?: (questionKey: string) => void;
  className?: string;
}

/**
 * Universal Token Matrix Blank Renderer
 * Converts text containing [blank_X] into active, focus-stabilized inputs.
 */
export const InlineBlankRenderer: React.FC<InlineBlankRendererProps> = ({
  content,
  userAnswers,
  onAnswerChange,
  disabled = false,
  wordLimit,
  wordBank,
  activeBlankNum,
  onFocusBlank,
  className = ''
}) => {
  if (!content) return null;

  // Normalize Word Bank items
  const normalizedWordBank: WordBankItemMeta[] | undefined = wordBank ? wordBank.map(item => {
    if (typeof item === 'string') {
      const match = item.match(/^([A-Za-z0-9]+)[\.\:\s]\s*(.*)$/);
      if (match) {
        return { id: match[1].toUpperCase(), text: match[2].trim() };
      }
      return { id: item.slice(0, 1).toUpperCase(), text: item };
    }
    return item;
  }) : undefined;

  // Split string strictly on [blank_X] token matrix
  // Matches [blank_1], [blank_12], etc.
  const parts = content.split(/(\[blank_\d+\])/g);

  return (
    <span className={`leading-loose text-[#3C2A63] ${className}`}>
      {parts.map((part, index) => {
        const match = part.match(/\[blank_(\d+)\]/i);
        if (match) {
          const qNum = parseInt(match[1], 10);
          const qKey = String(qNum);
          // Look up user answer by string key (e.g. "5", "R5", "L5") converting qNum to String(qNum) to maintain consistency with ReadingModule state
          const currentVal = userAnswers[String(qNum)] ?? 
                             userAnswers[qKey] ?? 
                             userAnswers[`R${String(qNum)}`] ?? 
                             userAnswers[`L${String(qNum)}`] ?? 
                             '';

          const isActive = activeBlankNum !== undefined && activeBlankNum !== null
            ? String(activeBlankNum) === String(qNum) || String(activeBlankNum) === qKey
            : false;

          return (
            <BlankInputCell
              key={`blank_${qNum}_${index}`}
              qNum={qNum}
              value={currentVal}
              disabled={disabled}
              wordLimit={wordLimit}
              wordBank={normalizedWordBank}
              onChange={onAnswerChange}
              onFocusBlank={onFocusBlank}
              isActiveBlank={isActive}
            />
          );
        }

        // Standard text snippet: preserve whitespace and line breaks
        if (part.includes('\n')) {
          const sublines = part.split('\n');
          return (
            <React.Fragment key={index}>
              {sublines.map((sl, sIdx) => (
                <React.Fragment key={sIdx}>
                  {sl}
                  {sIdx < sublines.length - 1 && <br className="my-1" />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

