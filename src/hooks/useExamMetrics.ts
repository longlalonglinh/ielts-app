import { useMemo } from 'react';
import { ExamData } from '../types';

export type SkillModule = 'listening' | 'reading' | 'writing';

export interface ExamMetrics {
  readonly isRetake: boolean;
  readonly activeTargetSkill: SkillModule | undefined;
  readonly hasListening: boolean;
  readonly hasReading: boolean;
  readonly hasWriting: boolean;
  readonly readingQuestionsCount: number;
  readonly allReadingQuestionIds: string[];
  readonly defaultInitialModule: SkillModule;
}

/**
 * Pure memoized selector deriving active skills, reading question counts,
 * and initial module from ExamData without redundant per-render recomputation.
 */
export function useExamMetrics(
  examData: ExamData,
  retakeMode: boolean,
  targetSkill: SkillModule | undefined
): ExamMetrics {
  return useMemo(() => {
    const isRetake = Boolean(
      retakeMode ||
      examData.retakeMode ||
      examData.exam_type === 'one_skill' ||
      (examData.skills && examData.skills.length === 1)
    );

    const activeTargetSkill: SkillModule | undefined =
      targetSkill ||
      examData.targetSkill ||
      (examData.skills && examData.skills.length === 1
        ? (examData.skills[0] as SkillModule)
        : undefined) ||
      ((examData.exam_code || '').toUpperCase().startsWith('WT') ? 'writing' : undefined);

    const hasListening = isRetake
      ? activeTargetSkill === 'listening'
      : (examData.listening_questions?.length ?? 0) > 0;

    const hasReading = isRetake
      ? activeTargetSkill === 'reading'
      : (examData.reading_questions?.length ?? 0) > 0 || (examData.passages?.length ?? 0) > 0;

    const hasWriting = isRetake
      ? activeTargetSkill === 'writing'
      : Boolean(examData.writing_task1_prompt || examData.writing_task2_prompt);

    const readingQuestionsCount =
      examData.passages && examData.passages.length > 0
        ? examData.passages.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
        : examData.reading_questions?.length ?? 0;

    const allReadingQuestionIds =
      examData.passages && examData.passages.length > 0
        ? examData.passages.flatMap(p => (p.questions || []).map(q => q.question_id))
        : (examData.reading_questions || []).map(q => q.question_id);

    const defaultInitialModule: SkillModule = hasListening
      ? 'listening'
      : hasReading
      ? 'reading'
      : 'writing';

    return {
      isRetake,
      activeTargetSkill,
      hasListening,
      hasReading,
      hasWriting,
      readingQuestionsCount,
      allReadingQuestionIds,
      defaultInitialModule
    };
  }, [examData, retakeMode, targetSkill]);
}
