import React, { useState } from 'react';
import { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { 
  Trash2, 
  Table, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Info, 
  CheckSquare, 
  Users, 
  ArrowRight, 
  Package, 
  GitFork,
  Sparkles
} from 'lucide-react';
import { 
  IELTSQuestionType, 
  canonicalizeQuestionType, 
  TableData, 
  MatchingOption, 
  WordBankItem, 
  FlowChartStep 
} from '../../types';
import { VisualTableEditor } from './VisualTableEditor';

interface QuestionEditorItemProps {
  prefix: string; // e.g. `passages.${selectedPassageIdx}.questions.${qIdx}`
  index: number;
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  onRemove: () => void;
  section: 'reading' | 'listening';
}

export const QuestionEditorItem: React.FC<QuestionEditorItemProps> = ({
  prefix,
  index,
  register,
  watch,
  setValue,
  onRemove,
  section
}) => {
  const [showTableEditor, setShowTableEditor] = useState<boolean>(false);

  const rawQType = watch(`${prefix}.question_type`) || 'multiple_choice';
  const qType = canonicalizeQuestionType(rawQType);

  const qId = watch(`${prefix}.question_id`) || (section === 'reading' ? `R${index + 1}` : `L${index + 1}`);
  const currentOptions: string[] = watch(`${prefix}.options`) || [];
  const currentTableData: TableData | undefined = watch(`${prefix}.table_data`);
  const currentNbCondition: boolean = Boolean(watch(`${prefix}.nb_condition`));
  const currentMultiCount: number = watch(`${prefix}.multi_select_count`) || 2;
  const currentMatchingOptions: MatchingOption[] = watch(`${prefix}.matching_options`) || [];
  const currentWordBank: WordBankItem[] = watch(`${prefix}.word_bank`) || [];
  const currentFlowChartSteps: FlowChartStep[] = watch(`${prefix}.flowchart_steps`) || [];

  // Options manager helper for Multiple Choice
  const handleAddOption = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const nextLetter = letters[currentOptions.length] || `Option ${currentOptions.length + 1}`;
    const newOpts = [...currentOptions, `${nextLetter}. New option text`];
    setValue(`${prefix}.options`, newOpts, { shouldDirty: true });
  };

  const handleUpdateOption = (optIdx: number, val: string) => {
    const updated = [...currentOptions];
    updated[optIdx] = val;
    setValue(`${prefix}.options`, updated, { shouldDirty: true });
  };

  const handleRemoveOption = (optIdx: number) => {
    const updated = currentOptions.filter((_, i) => i !== optIdx);
    setValue(`${prefix}.options`, updated, { shouldDirty: true });
  };

  // Matching Options manager (for Matching Features and Sentence Endings)
  const handleAddMatchingOption = (defaultPrefix = 'Feature/Ending') => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const nextLetter = letters[currentMatchingOptions.length] || String(currentMatchingOptions.length + 1);
    const newOptions: MatchingOption[] = [
      ...currentMatchingOptions,
      { id: nextLetter, text: `${defaultPrefix} ${nextLetter}` }
    ];
    setValue(`${prefix}.matching_options`, newOptions, { shouldDirty: true });
  };

  const handleUpdateMatchingOptionText = (optIdx: number, text: string) => {
    const updated = [...currentMatchingOptions];
    updated[optIdx] = { ...updated[optIdx], text };
    setValue(`${prefix}.matching_options`, updated, { shouldDirty: true });
  };

  const handleRemoveMatchingOption = (optIdx: number) => {
    const updated = currentMatchingOptions.filter((_, i) => i !== optIdx);
    setValue(`${prefix}.matching_options`, updated, { shouldDirty: true });
  };

  // Word Bank manager for Summary Box Completion
  const handleAddWordBankItem = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const nextLetter = letters[currentWordBank.length] || String(currentWordBank.length + 1);
    const newBank: WordBankItem[] = [
      ...currentWordBank,
      { id: nextLetter, word: `term_${nextLetter.toLowerCase()}` }
    ];
    setValue(`${prefix}.word_bank`, newBank, { shouldDirty: true });
  };

  const handleUpdateWordBankItem = (wIdx: number, word: string) => {
    const updated = [...currentWordBank];
    updated[wIdx] = { ...updated[wIdx], word };
    setValue(`${prefix}.word_bank`, updated, { shouldDirty: true });
  };

  const handleRemoveWordBankItem = (wIdx: number) => {
    const updated = currentWordBank.filter((_, i) => i !== wIdx);
    setValue(`${prefix}.word_bank`, updated, { shouldDirty: true });
  };

  // 1-Click Quick Preset for Table Completion
  const handleQuickPresetTable = () => {
    const template: TableData = {
      title: 'Summary Table',
      headers: ['Category / Aspect', 'Key Finding', 'Period'],
      rows: [
        {
          cells: [
            { text: 'Solar Energy', is_blank: false },
            { text: '', is_blank: true, question_id: qId, placeholder: 'Enter finding...' },
            { text: '19th Century', is_blank: false }
          ]
        },
        {
          cells: [
            { text: 'Wind Turbine', is_blank: false },
            { text: 'High kinetic efficiency', is_blank: false },
            { text: 'Modern Era', is_blank: false }
          ]
        }
      ]
    };
    setValue(`${prefix}.table_data`, template, { shouldDirty: true });
    setShowTableEditor(true);
  };

  return (
    <div className="p-4 sm:p-5 bg-[#F8F6FC] rounded-2xl border border-purple-100/90 space-y-3 relative hover:border-purple-300 transition-all shadow-xs">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#3C2A63] text-white font-black text-[11px] flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <input
            type="text"
            {...register(`${prefix}.question_id`)}
            placeholder="Question ID (e.g. R1)"
            className="px-2.5 py-1 bg-white rounded-xl border border-purple-200 text-xs font-mono font-bold text-[#3C2A63] w-28 focus:outline-none focus:ring-1 focus:ring-[#6B51A5]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Grouped IELTS Question Type Selector */}
          <select
            {...register(`${prefix}.question_type`)}
            className="px-3 py-1.5 bg-white rounded-xl border border-purple-200 text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5] cursor-pointer"
          >
            <optgroup label="1. Trắc nghiệm (Multiple Choice)">
              <option value={IELTSQuestionType.MULTIPLE_CHOICE}>Multiple Choice (Single Choice)</option>
              <option value={IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS}>Multiple Choice (Choose 2 or 3)</option>
            </optgroup>
            <optgroup label="2. Đúng / Sai / Không đề cập">
              <option value={IELTSQuestionType.TRUE_FALSE_NOT_GIVEN}>True / False / Not Given</option>
              <option value={IELTSQuestionType.YES_NO_NOT_GIVEN}>Yes / No / Not Given</option>
            </optgroup>
            <optgroup label="3. Dạng bài Nối (Matching)">
              <option value={IELTSQuestionType.MATCHING_HEADINGS}>Matching Headings (Tiêu đề đoạn văn)</option>
              <option value={IELTSQuestionType.MATCHING_INFORMATION}>Matching Information (Đoạn chứa thông tin - có NB)</option>
              <option value={IELTSQuestionType.MATCHING_FEATURES}>Matching Features (Nối đối tượng / Nhà khoa học)</option>
              <option value={IELTSQuestionType.MATCHING_SENTENCE_ENDINGS}>Matching Sentence Endings (Nửa đầu - nửa cuối câu)</option>
            </optgroup>
            <optgroup label="4. Dạng bài Điền từ & Hoàn thành (Completion)">
              <option value={IELTSQuestionType.FILL_IN_THE_BLANK}>Fill in the Blank (Sentence / Note Completion)</option>
              <option value={IELTSQuestionType.SUMMARY_COMPLETION_TEXT}>Summary Completion (Lấy từ bài đọc)</option>
              <option value={IELTSQuestionType.SUMMARY_COMPLETION_BOX}>Summary Completion (Chọn từ hộp từ vựng A–I)</option>
              <option value={IELTSQuestionType.TABLE_COMPLETION}>Table Completion (Bảng biểu dữ liệu)</option>
              <option value={IELTSQuestionType.FLOW_CHART_COMPLETION}>Flow-Chart Completion (Sơ đồ quy trình)</option>
              <option value={IELTSQuestionType.DIAGRAM_LABEL_COMPLETION}>Diagram Label Completion (Gán nhãn sơ đồ)</option>
            </optgroup>
            <optgroup label="5. Câu trả lời ngắn">
              <option value={IELTSQuestionType.SHORT_ANSWER}>Short Answer Questions</option>
            </optgroup>
          </select>

          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
            title="Delete question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Question Prompt */}
      <div>
        <label className="block text-[11px] font-black text-[#503A7A] mb-1">
          Question Prompt / Sentence:
        </label>
        <input
          type="text"
          {...register(`${prefix}.question_text`)}
          placeholder={
            qType === IELTSQuestionType.TABLE_COMPLETION
              ? 'Complete the table below (e.g. Focus on solar technology development...)'
              : 'Question sentence (use _____ for inline blanks if applicable)...'
          }
          className="w-full px-3.5 py-2 bg-white rounded-xl border border-purple-200 text-xs font-medium text-[#3C2A63] focus:outline-none focus:ring-1 focus:ring-[#6B51A5]"
        />
      </div>

      {/* Correct Answer & Score */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-black text-[#503A7A] mb-1">
            Correct Answer:
            <span className="text-[10px] text-[#7C68A5] font-normal ml-1.5">
              {qType === IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS
                ? '(e.g. A, C or B, D)'
                : qType === IELTSQuestionType.TRUE_FALSE_NOT_GIVEN
                ? '(TRUE / FALSE / NOT GIVEN)'
                : qType === IELTSQuestionType.YES_NO_NOT_GIVEN
                ? '(YES / NO / NOT GIVEN)'
                : '(exact text or pipe-separated: word1|word2)'}
            </span>
          </label>
          <input
            type="text"
            {...register(`${prefix}.correct_answer`)}
            placeholder={
              qType === IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS
                ? 'A, C'
                : qType === IELTSQuestionType.TRUE_FALSE_NOT_GIVEN
                ? 'TRUE'
                : 'e.g. renewable energy|clean energy'
            }
            className="w-full px-3 py-1.5 bg-white rounded-xl border border-purple-200 text-xs font-mono font-bold text-[#3C2A63] focus:outline-none focus:ring-1 focus:ring-[#6B51A5]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-black text-[#503A7A] mb-1">
            Score Weight (Points):
          </label>
          <input
            type="number"
            {...register(`${prefix}.max_score`, { valueAsNumber: true })}
            defaultValue={1}
            className="w-full px-3 py-1.5 bg-white rounded-xl border border-purple-200 text-xs font-mono font-bold text-[#3C2A63] focus:outline-none focus:ring-1 focus:ring-[#6B51A5]"
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* RICH DEDICATED EDITORS BY QUESTION TYPE                   */}
      {/* ========================================================= */}

      {/* 1. TABLE COMPLETION: Dedicated Visual Table Editor */}
      {qType === IELTSQuestionType.TABLE_COMPLETION && (
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between bg-purple-100/70 p-2.5 rounded-xl border border-purple-200 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-[#6B51A5]" />
              <span className="text-xs font-black text-[#3C2A63]">
                Table Completion Generator:
              </span>
              <span className="text-[11px] text-[#503A7A]">
                {currentTableData?.rows ? `${currentTableData.rows.length} rows × ${currentTableData.headers?.length || 0} cols` : 'No table created yet'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!currentTableData?.rows && (
                <button
                  type="button"
                  onClick={handleQuickPresetTable}
                  className="px-2.5 py-1 bg-white hover:bg-purple-50 text-[#6B51A5] border border-purple-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#6B51A5]" />
                  <span>Quick Template</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTableEditor(!showTableEditor)}
                className="px-3 py-1 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>{showTableEditor ? 'Close Table Editor' : 'Open Table Editor'}</span>
                {showTableEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showTableEditor && (
            <div className="mt-2">
              <VisualTableEditor
                initialData={currentTableData}
                questionId={qId}
                onChange={(tData) => setValue(`${prefix}.table_data`, tData, { shouldDirty: true })}
              />
            </div>
          )}
        </div>
      )}

      {/* 2. MATCHING INFORMATION: NB Flag Toggle */}
      {qType === IELTSQuestionType.MATCHING_INFORMATION && (
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-900">
              Condition: &quot;NB: You may use any letter more than once&quot;
            </span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={currentNbCondition}
              onChange={(e) => setValue(`${prefix}.nb_condition`, e.target.checked, { shouldDirty: true })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs font-extrabold text-amber-900">Enable NB</span>
          </label>
        </div>
      )}

      {/* 3. MULTIPLE CHOICE (Single or Multi-Answer Options Editor) */}
      {(qType === IELTSQuestionType.MULTIPLE_CHOICE || qType === IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS) && (
        <div className="space-y-2 pt-1 bg-white p-3.5 rounded-xl border border-purple-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#503A7A] flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-[#6B51A5]" />
              Multiple Choice Options List:
            </span>

            {qType === IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#7C68A5]">Required count:</span>
                <select
                  value={currentMultiCount}
                  onChange={(e) => setValue(`${prefix}.multi_select_count`, Number(e.target.value), { shouldDirty: true })}
                  className="px-2 py-0.5 rounded-lg border border-purple-200 text-xs font-bold text-[#3C2A63]"
                >
                  <option value={2}>Choose TWO (2)</option>
                  <option value={3}>Choose THREE (3)</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {(currentOptions.length > 0 ? currentOptions : ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4']).map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <span className="w-5 font-mono font-bold text-xs text-[#6B51A5] text-right">
                  {String.fromCharCode(65 + oIdx)}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleUpdateOption(oIdx, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + oIdx)} text...`}
                  className="flex-1 px-2.5 py-1 bg-[#FAF8FD] border border-purple-200 rounded-lg text-xs font-medium text-[#3C2A63] focus:outline-none focus:bg-white"
                />
                {currentOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(oIdx)}
                    className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                    title="Remove option"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddOption}
            className="text-xs text-[#6B51A5] hover:text-[#583F8F] font-bold flex items-center gap-1 cursor-pointer pt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Option ({String.fromCharCode(65 + currentOptions.length)})</span>
          </button>
        </div>
      )}

      {/* 4. MATCHING FEATURES: People / Scientists / Country options */}
      {qType === IELTSQuestionType.MATCHING_FEATURES && (
        <div className="space-y-2 pt-1 bg-white p-3.5 rounded-xl border border-purple-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#503A7A] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#6B51A5]" />
              Matching Features (List of People / Entities):
            </span>
            <button
              type="button"
              onClick={() => handleAddMatchingOption('Dr. / Researcher')}
              className="text-xs text-[#6B51A5] hover:text-[#583F8F] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Person</span>
            </button>
          </div>

          <p className="text-[11px] text-[#7C68A5]">
            Define the fixed list of entities/scientists (A, B, C...) that students will match to the statement.
          </p>

          <div className="space-y-1.5">
            {(currentMatchingOptions.length > 0 ? currentMatchingOptions : [
              { id: 'A', text: 'Dr. John Harrison' },
              { id: 'B', text: 'Prof. Marie Curie' },
              { id: 'C', text: 'Dr. Alexander Bell' }
            ]).map((item, mIdx) => (
              <div key={mIdx} className="flex items-center gap-2">
                <span className="w-6 font-mono font-bold text-xs text-[#6B51A5] text-center bg-purple-100 py-1 rounded">
                  {item.id}
                </span>
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => handleUpdateMatchingOptionText(mIdx, e.target.value)}
                  placeholder="Person or feature description..."
                  className="flex-1 px-2.5 py-1 bg-[#FAF8FD] border border-purple-200 rounded-lg text-xs font-medium text-[#3C2A63] focus:outline-none focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveMatchingOption(mIdx)}
                  className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                  title="Remove person"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MATCHING SENTENCE ENDINGS: List of ending clauses */}
      {qType === IELTSQuestionType.MATCHING_SENTENCE_ENDINGS && (
        <div className="space-y-2 pt-1 bg-white p-3.5 rounded-xl border border-purple-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#503A7A] flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#6B51A5]" />
              Matching Sentence Endings (List of Second Halves):
            </span>
            <button
              type="button"
              onClick={() => handleAddMatchingOption('ended in')}
              className="text-xs text-[#6B51A5] hover:text-[#583F8F] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ending</span>
            </button>
          </div>

          <p className="text-[11px] text-[#7C68A5]">
            List of alternative sentence endings (A, B, C...) for 1-to-1 matching with sentence beginnings.
          </p>

          <div className="space-y-1.5">
            {(currentMatchingOptions.length > 0 ? currentMatchingOptions : [
              { id: 'A', text: 'led to an unprecedented decrease in carbon emissions' },
              { id: 'B', text: 'was abandoned after unexpected financial constraints' },
              { id: 'C', text: 'sparked widespread commercial adoption globally' }
            ]).map((item, mIdx) => (
              <div key={mIdx} className="flex items-center gap-2">
                <span className="w-6 font-mono font-bold text-xs text-[#6B51A5] text-center bg-purple-100 py-1 rounded">
                  {item.id}
                </span>
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => handleUpdateMatchingOptionText(mIdx, e.target.value)}
                  placeholder="Sentence ending clause..."
                  className="flex-1 px-2.5 py-1 bg-[#FAF8FD] border border-purple-200 rounded-lg text-xs font-medium text-[#3C2A63] focus:outline-none focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveMatchingOption(mIdx)}
                  className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                  title="Remove ending"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. SUMMARY COMPLETION (BOX): Word Bank Box Editor */}
      {qType === IELTSQuestionType.SUMMARY_COMPLETION_BOX && (
        <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#503A7A] flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#6B51A5]" />
              Word Bank Box (Synonyms list for student dropdown):
            </span>
            <button
              type="button"
              onClick={handleAddWordBankItem}
              className="text-xs text-[#6B51A5] hover:text-[#583F8F] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Word</span>
            </button>
          </div>

          <p className="text-[11px] text-[#7C68A5]">
            Candidates select word letters A–I from this box rather than copying directly from passage text.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(currentWordBank.length > 0 ? currentWordBank : [
              { id: 'A', word: 'renewable' },
              { id: 'B', word: 'synthetic' },
              { id: 'C', word: 'atmospheric' },
              { id: 'D', word: 'depleted' },
              { id: 'E', word: 'emissions' },
              { id: 'F', word: 'efficiency' }
            ]).map((wb, wIdx) => (
              <div key={wIdx} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-purple-200">
                <span className="font-mono font-bold text-xs text-[#6B51A5] w-5 text-center">
                  {wb.id}:
                </span>
                <input
                  type="text"
                  value={wb.word}
                  onChange={(e) => handleUpdateWordBankItem(wIdx, e.target.value)}
                  placeholder="Word or phrase..."
                  className="flex-1 px-1.5 py-0.5 text-xs font-medium text-[#3C2A63] border-0 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveWordBankItem(wIdx)}
                  className="text-rose-500 hover:text-rose-700 p-0.5"
                  title="Remove word"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

