import { ExamData, Question, canonicalizeQuestionType, IELTSQuestionType } from '../types';

export interface ShuffledDisplayOption {
  value: string;
  text: string;
}

/**
 * Deterministic 32-bit FNV-1a string hash.
 */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 deterministic PRNG from integer seed.
 */
export function createSeededRng(seedStr: string): () => number {
  let state = hashSeed(seedStr) || 1;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates deterministic shuffle without mutating input array.
 */
export function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  if (arr.length <= 1) return arr;
  const rng = createSeededRng(seedStr);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Parse option string like "B. City Centre" into canonical value ("B") and display text ("City Centre").
 */
export function parseOptionEntry(opt: string, index: number): ShuffledDisplayOption {
  const fallbackKey = String.fromCharCode(65 + index);
  const trimmed = String(opt || '').trim();
  const explicitMatch = trimmed.match(/^([A-Z])(?:[.)]\s+|\s*-\s+)(.+)$/i);
  if (explicitMatch && explicitMatch[2]) {
    return {
      value: explicitMatch[1].toUpperCase(),
      text: explicitMatch[2].trim()
    };
  }
  const letterPrefix = trimmed.match(/^([A-Z])[\.\s]/);
  if (letterPrefix) {
    const rest = trimmed.slice(letterPrefix[0].length).trim();
    return {
      value: letterPrefix[1].toUpperCase(),
      text: rest || trimmed
    };
  }
  return {
    value: fallbackKey,
    text: trimmed
  };
}

/**
 * Shuffles options of an MCQ question deterministically while preserving canonical option values.
 */
export function shuffleQuestionOptions(q: Question, seedPrefix: string): Question {
  const qType = canonicalizeQuestionType(q.question_type);
  const isMcq =
    qType === IELTSQuestionType.MULTIPLE_CHOICE ||
    qType === IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS;

  if (!isMcq || !Array.isArray(q.options) || q.options.length <= 1) {
    return q;
  }

  const parsedOptions = q.options.map((opt, idx) => parseOptionEntry(opt, idx));
  const shuffledDisplay = seededShuffle(parsedOptions, `${seedPrefix}::OPT::${q.question_id}`);

  return {
    ...q,
    display_options: shuffledDisplay
  };
}

function isStandaloneShuffleableMcq(q: Question): boolean {
  if (!q || q.is_example || q.multi_group_id) return false;
  const qType = canonicalizeQuestionType(q.question_type);
  if (qType !== IELTSQuestionType.MULTIPLE_CHOICE) return false;
  if (q.context_content || q.table_data || q.table_markdown || q.flowchart_steps) return false;
  if (/\[blank_\d+\]/i.test(q.question_text || '')) return false;
  return true;
}

/**
 * Shuffles contiguous blocks of standalone Reading MCQ questions without disturbing
 * passage boundaries, fill-in-the-blank contexts, tables, flowcharts, or multi-select groups.
 */
export function shuffleReadingMcqBlocks(questions: Question[], seedPrefix: string): Question[] {
  const result = questions.map((q) => shuffleQuestionOptions(q, seedPrefix));
  let i = 0;
  let blockIdx = 0;

  while (i < result.length) {
    if (!isStandaloneShuffleableMcq(result[i])) {
      i++;
      continue;
    }

    let j = i;
    while (j < result.length && isStandaloneShuffleableMcq(result[j])) {
      j++;
    }

    const blockLen = j - i;
    if (blockLen > 1) {
      const slice = result.slice(i, j);
      const shuffledBlock = seededShuffle(slice, `${seedPrefix}::QBLOCK::${blockIdx}`);
      for (let k = 0; k < blockLen; k++) {
        result[i + k] = shuffledBlock[k];
      }
      blockIdx++;
    }
    i = j;
  }

  return result;
}

/**
 * Applies candidate-specific seeded shuffling when testMode === 'TEST'.
 * - PRACTICE mode keeps canonical exam order untouched.
 * - Listening keeps chronological question order (aligned with audio playback) while shuffling MCQ options.
 * - Reading shuffles both MCQ options and contiguous standalone MCQ blocks within each passage.
 * Canonical question_id and option value keys remain 100% invariant for authoritative server scoring.
 */
export function applyCandidateExamShuffle(
  exam: ExamData,
  sbd: string,
  testMode: 'TEST' | 'PRACTICE'
): ExamData {
  if (!exam || testMode !== 'TEST') return exam;
  const cleanSbd = (sbd || '').trim().toUpperCase();
  const cleanCode = (exam.exam_code || '').trim().toUpperCase();
  if (!cleanSbd) return exam;

  const seedPrefix = `${cleanSbd}::${cleanCode}`;
  const clone: ExamData = JSON.parse(JSON.stringify(exam));

  if (Array.isArray(clone.listening_questions)) {
    clone.listening_questions = clone.listening_questions.map((q) => shuffleQuestionOptions(q, seedPrefix));
  }

  if (Array.isArray(clone.passages)) {
    clone.passages = clone.passages.map((p) => ({
      ...p,
      questions: Array.isArray(p.questions)
        ? shuffleReadingMcqBlocks(p.questions, `${seedPrefix}::P${p.passage_index}`)
        : []
    }));
  }

  if (Array.isArray(clone.reading_questions)) {
    // Realign top-level reading_questions with shuffled passage questions where IDs match,
    // otherwise apply standalone MCQ block shuffle directly.
    const passageQMap = new Map<string, Question>();
    clone.passages?.forEach((p) => {
      p.questions?.forEach((pq) => {
        if (pq.question_id) passageQMap.set(pq.question_id, pq);
      });
    });

    if (passageQMap.size > 0 && clone.reading_questions.every((rq) => passageQMap.has(rq.question_id))) {
      clone.reading_questions = clone.passages.flatMap((p) => p.questions || []);
    } else {
      clone.reading_questions = shuffleReadingMcqBlocks(clone.reading_questions, `${seedPrefix}::READ`);
    }
  }

  if (Array.isArray(clone.questions)) {
    const byId = new Map<string, Question>();
    clone.listening_questions?.forEach((q) => q.question_id && byId.set(q.question_id, q));
    clone.reading_questions?.forEach((q) => q.question_id && byId.set(q.question_id, q));
    clone.passages?.forEach((p) => p.questions?.forEach((q) => q.question_id && byId.set(q.question_id, q)));

    clone.questions = clone.questions.map((q) => byId.get(q.question_id) || shuffleQuestionOptions(q, seedPrefix));
  }

  return clone;
}
