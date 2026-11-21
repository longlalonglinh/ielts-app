import { ExamData, Question } from '../types';

export interface ExamFetchContext {
  readonly examCode: string;
  readonly gasUrl?: string;
  readonly spreadsheetId?: string;
  readonly forceRefresh?: boolean;
}

export interface ExamProviderResult {
  readonly exam: ExamData;
  readonly source: string;
}

/**
 * Strategy Pattern contract for multi-tier IELTS exam data providers
 * (RAM Cache -> Central API -> Public GViz -> GAS Webhook -> Local Vault).
 */
export interface ExamProvider {
  readonly name: string;
  fetch(ctx: ExamFetchContext): Promise<ExamProviderResult | null>;
}

/**
 * Pure helper: normalizes an exam code consistently across providers.
 */
export function normalizeExamCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

/**
 * Pure helper: ensures all questions in an array have unique non-empty IDs without mutating input.
 */
export function sanitizeExamQuestions(questions: Question[] | undefined, prefix: string): Question[] {
  if (!Array.isArray(questions)) return [];
  const seen = new Set<string>();
  return questions.map((q, idx) => {
    let qid = q.question_id || `${prefix}${idx + 1}`;
    if (seen.has(qid)) {
      qid = `${qid}_dup_${idx}`;
    }
    seen.add(qid);
    return { ...q, question_id: qid };
  });
}

/**
 * Pure helper: checks whether an exam payload contains at least one playable IELTS skill.
 */
export function isValidExamPayload(exam: ExamData | null | undefined): exam is ExamData {
  if (!exam || !exam.exam_code) return false;
  const hasListening = (exam.listening_questions?.length ?? 0) > 0;
  const hasReading = (exam.reading_questions?.length ?? 0) > 0 || (exam.passages?.length ?? 0) > 0;
  const hasWriting = Boolean(exam.writing_task1_prompt || exam.writing_task2_prompt);
  return hasListening || hasReading || hasWriting;
}

/**
 * Pure helper: returns a sanitized, immutable ExamData copy with deduplicated question IDs.
 */
export function normalizeExamPayload(exam: ExamData): ExamData {
  return {
    ...exam,
    exam_code: normalizeExamCode(exam.exam_code),
    listening_questions: sanitizeExamQuestions(exam.listening_questions, 'l'),
    reading_questions: sanitizeExamQuestions(exam.reading_questions, 'r')
  };
}

/**
 * Orchestrates ordered Strategy providers, returning the first valid exam payload
 * while isolating individual provider failures cleanly.
 */
export class ExamProviderChain {
  private readonly providers: readonly ExamProvider[];

  constructor(providers: ExamProvider[]) {
    this.providers = [...providers];
  }

  public async resolve(rawCtx: ExamFetchContext): Promise<ExamProviderResult | null> {
    const ctx: ExamFetchContext = {
      ...rawCtx,
      examCode: normalizeExamCode(rawCtx.examCode)
    };
    if (!ctx.examCode) return null;

    for (const provider of this.providers) {
      try {
        const result = await provider.fetch(ctx);
        if (result && isValidExamPayload(result.exam)) {
          return {
            source: result.source || provider.name,
            exam: normalizeExamPayload(result.exam)
          };
        }
      } catch (err) {
        console.warn(`[ExamProviderChain] Provider "${provider.name}" failed for ${ctx.examCode}:`, err);
      }
    }

    return null;
  }
}
