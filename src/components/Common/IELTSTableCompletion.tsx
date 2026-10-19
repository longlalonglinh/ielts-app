import React, { useMemo } from 'react';
import { TableData, Question } from '../../types';
import { Table as TableIcon } from 'lucide-react';
import { InlineBlankRenderer } from './InlineBlankRenderer';

interface IELTSTableCompletionProps {
  tableData?: TableData;
  question: Question;
  questionNumber: number;
  userAnswer: string;
  onAnswerChange: (questionId: string, answer: string) => void;
  // If multiple questions share this table:
  allUserAnswers?: Record<string, string>;
  disabled?: boolean;
}

interface ParsedMarkdownTable {
  headers: string[];
  rows: string[][];
}

/**
 * Parses markdown table strings (pipes | and line breaks) into structured matrix
 */
function parseMarkdownTableString(raw: string): ParsedMarkdownTable | null {
  if (!raw || !raw.includes('|')) return null;
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 2) return null;

  // Filter out markdown separator line e.g. |---|---|
  const nonSeparatorLines = lines.filter(l => !/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(l));
  if (nonSeparatorLines.length === 0) return null;

  const headerLine = nonSeparatorLines[0];
  const headers = headerLine
    .slice(1, -1)
    .split('|')
    .map(c => c.trim());

  const rows = nonSeparatorLines.slice(1).map(rowLine => {
    return rowLine
      .slice(1, -1)
      .split('|')
      .map(c => c.trim());
  });

  return { headers, rows };
}

export const IELTSTableCompletion: React.FC<IELTSTableCompletionProps> = ({
  tableData,
  question,
  questionNumber,
  userAnswer,
  onAnswerChange,
  allUserAnswers = {},
  disabled = false
}) => {
  // Handler that converts question numbers/keys back to question IDs (e.g. "5" -> "R5" or existing questionId)
  const handleBlankChange = (qKey: string, value: string) => {
    const qNum = parseInt(qKey, 10);
    // If the question matches current questionNumber
    if (qNum === questionNumber || qKey === question.question_id || qKey === String(questionNumber)) {
      onAnswerChange(question.question_id, value);
      return;
    }

    // Try finding matching questionId in allUserAnswers or section format
    const sectionPrefix = question.section === 'listening' ? 'L' : 'R';
    const targetQId = `${sectionPrefix}${qKey}`;
    onAnswerChange(targetQId, value);
  };

  // 1. Check for Markdown Table in context_content or question_text
  const markdownTable = useMemo(() => {
    const contextContent = (question as any).context_content;
    if (contextContent && contextContent.includes('|')) {
      const parsed = parseMarkdownTableString(contextContent);
      if (parsed) return parsed;
    }
    const rawText = question.question_text || '';
    if (rawText.includes('|')) {
      const parsed = parseMarkdownTableString(rawText);
      if (parsed) return parsed;
    }
    return null;
  }, [question]);

  // Combined answers map
  const answersMap: Record<string | number, string> = {
    ...allUserAnswers,
    [questionNumber]: userAnswer,
    [question.question_id]: userAnswer
  };

  // Case 1: Structured tableData
  if (tableData && tableData.headers && tableData.headers.length > 0) {
    return (
      <div className="my-3 overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
        {tableData.title && (
          <div className="bg-[#503A7A] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-purple-200" />
            <span>{tableData.title}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-purple-100/80 border-b border-purple-200">
                {tableData.headers.map((h, i) => (
                  <th key={i} className="p-3 font-extrabold text-[#3C2A63] border-r border-purple-200 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {tableData.rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAF8FD]'}>
                  {row.cells.map((cell, cIdx) => {
                    const isTargetBlank = cell.is_blank;
                    const cellQId = cell.question_id || question.question_id;
                    const explicitQNum = cell.question_id ? parseInt(cell.question_id.replace(/\D/g, ''), 10) || questionNumber : questionNumber;
                    
                    // If cell text contains token or is blank
                    const cellContent = isTargetBlank 
                      ? (cell.text ? `${cell.text} [blank_${explicitQNum}]` : `[blank_${explicitQNum}]`)
                      : (cell.text || '-');

                    return (
                      <td key={cIdx} className="p-3 align-middle border-r border-purple-100 last:border-r-0 font-medium text-[#3C2A63]">
                        <InlineBlankRenderer
                          content={cellContent}
                          userAnswers={answersMap}
                          onAnswerChange={(qKey, val) => {
                            if (cellQId) onAnswerChange(cellQId, val);
                            else handleBlankChange(qKey, val);
                          }}
                          disabled={disabled}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Case 2: Markdown Table parsed from context_content or question_text
  if (markdownTable && markdownTable.headers.length > 0) {
    return (
      <div className="my-3 overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
        <div className="bg-[#503A7A] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-purple-200" />
          <span>IELTS Table Completion</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-purple-100/80 border-b border-purple-200">
                {markdownTable.headers.map((h, i) => (
                  <th key={i} className="p-3 font-extrabold text-[#3C2A63] border-r border-purple-200 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {markdownTable.rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAF8FD]'}>
                  {row.map((cellText, cIdx) => {
                    // Check if cell has [blank_X] or legacy blanks
                    let cellWithToken = cellText;
                    if (!cellWithToken.includes('[blank_') && /_{3,}|\.{3,}|\[\.+\]/i.test(cellWithToken)) {
                      cellWithToken = cellWithToken.replace(/_{3,}|\.{3,}|\[\.+\]/gi, `[blank_${questionNumber}]`);
                    }

                    return (
                      <td key={cIdx} className="p-3 align-middle border-r border-purple-100 last:border-r-0 font-medium text-[#3C2A63]">
                        <InlineBlankRenderer
                          content={cellWithToken}
                          userAnswers={answersMap}
                          onAnswerChange={handleBlankChange}
                          disabled={disabled}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Case 3: Standard Table Card with Token Matrix Blank Renderer
  const fallbackText = question.question_text?.includes('[blank_') 
    ? question.question_text 
    : `${question.question_text || 'Table completion row:'} [blank_${questionNumber}]`;

  return (
    <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-2">
      <div className="flex items-center gap-2 text-xs font-extrabold text-[#503A7A]">
        <TableIcon className="w-4 h-4 text-[#6B51A5]" />
        <span>Table Completion: Enter word(s) in the table matrix</span>
      </div>
      <div className="p-3 bg-white rounded-xl border border-purple-100">
        <InlineBlankRenderer
          content={fallbackText}
          userAnswers={answersMap}
          onAnswerChange={handleBlankChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
