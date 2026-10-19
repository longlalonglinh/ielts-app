import React from 'react';
import { FlowChartStep, Question } from '../../types';
import { ArrowDown, GitFork } from 'lucide-react';

interface IELTSFlowChartCompletionProps {
  steps?: FlowChartStep[];
  question: Question;
  questionNumber: number;
  userAnswer: string;
  onAnswerChange: (questionId: string, answer: string) => void;
}

export const IELTSFlowChartCompletion: React.FC<IELTSFlowChartCompletionProps> = ({
  steps,
  question,
  questionNumber,
  userAnswer,
  onAnswerChange
}) => {
  // If structured flowchart steps exist
  if (steps && steps.length > 0) {
    return (
      <div className="my-3 p-4 bg-[#F8F6FC] rounded-2xl border border-purple-200 space-y-3">
        <div className="text-xs font-black uppercase tracking-wider text-[#503A7A] flex items-center gap-2">
          <GitFork className="w-4 h-4 text-[#6B51A5]" />
          <span>Process Flow-Chart</span>
        </div>

        <div className="space-y-2">
          {steps.map((st, idx) => {
            const isTargetBlank = st.is_blank || st.question_id === question.question_id;

            return (
              <React.Fragment key={idx}>
                <div className={`p-3.5 rounded-xl border transition ${
                  isTargetBlank ? 'bg-white border-[#6B51A5] shadow-xs ring-1 ring-purple-200' : 'bg-white/80 border-purple-100'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-[#503A7A]">
                      Step {st.step_number || idx + 1}
                    </span>
                    {st.title && (
                      <span className="text-xs font-extrabold text-[#3C2A63]">{st.title}</span>
                    )}
                  </div>

                  <p className="text-xs text-[#503A7A] mb-2">{st.description}</p>

                  {isTargetBlank && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-6 h-6 rounded-md bg-[#6B51A5] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {questionNumber}
                      </span>
                      <input
                        type="text"
                        value={userAnswer || ''}
                        onChange={(e) => onAnswerChange(question.question_id, e.target.value)}
                        placeholder="Complete this step..."
                        className="w-full px-3 py-1.5 bg-[#FAF8FD] border border-purple-200 rounded-lg text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5] focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                {idx < steps.length - 1 && (
                  <div className="flex justify-center my-0.5">
                    <div className="p-1 rounded-full bg-purple-100 text-[#6B51A5]">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback single card flow step
  return (
    <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-2">
      <div className="flex items-center gap-2 text-xs font-extrabold text-[#503A7A]">
        <GitFork className="w-4 h-4 text-[#6B51A5]" />
        <span>Flow-Chart Step Completion</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#503A7A] text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
          {questionNumber}
        </span>
        <input
          type="text"
          value={userAnswer || ''}
          onChange={(e) => onAnswerChange(question.question_id, e.target.value)}
          placeholder="Fill in the flow-chart blank..."
          className="flex-1 px-3.5 py-2 bg-white rounded-xl border border-purple-200 text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
        />
      </div>
    </div>
  );
};
