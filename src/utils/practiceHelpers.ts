import { PracticeCard, PracticeCardItem, PracticeOption, PracticeQuestionType } from '../types/practice';

const DEFAULT_FALLBACK_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: 'noun', name: 'Noun (Danh từ)' },
  { id: 'verb', name: 'Verb (Động từ)' },
  { id: 'adjective', name: 'Adjective (Tính từ)' }
];

const BLANK_TOKEN_REGEX = /(?:_{3,}|\[blank(?:\s*\d*)?\]|\[\s*_{2,}\s*\]|\[\d+\])/gi;

/**
 * Deterministic Fisher-Yates shuffle seeded by card id so word bank chips
 * never jump around on re-renders and never always place answers first.
 */
export function shuffleDeterministic<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  if (arr.length <= 1) return arr;

  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  for (let i = arr.length - 1; i > 0; i--) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const j = Math.abs(seed) % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  return arr;
}

export function normalizeQuestionType(rawType: any): PracticeQuestionType {
  const t = String(rawType || '').trim().toLowerCase();
  if (t.includes('multi-response') || t.includes('multi_response') || t.includes('multiple-response')) {
    return 'multiple-response';
  }
  if (t.includes('true-false') || t.includes('tfng') || t.includes('t/f/ng') || t.includes('true_false')) {
    return 'true-false-not-given';
  }
  if (t.includes('drag') || t.includes('drop')) {
    return 'drag-and-drop';
  }
  if (t.includes('category') || t.includes('matching')) {
    return 'category-matching';
  }
  return 'multiple-choice';
}

/**
 * Normalizes either legacy PracticeCard or structured PracticeCardItem into a unified PracticeCardItem model.
 * Robust against raw string arrays, missing IDs, unmapped targets, and multi-format JSON imports.
 */
export function normalizeToCardItem(input: PracticeCard | PracticeCardItem): PracticeCardItem {
  const legacy = input as any;

  // 1. Gather all possible target answers
  const rawTargets: string[] = [];
  const extractTargets = (val: any) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(v => extractTargets(v));
    } else if (typeof val === 'string') {
      val.split(/[,|]/).forEach(s => {
        const trimmed = s.trim().toLowerCase();
        if (trimmed) rawTargets.push(trimmed);
      });
    }
  };

  extractTargets(legacy.cloze_target);
  extractTargets(legacy.target_word);
  extractTargets(legacy.targetWord);
  extractTargets(legacy.accepted_answers);
  extractTargets(legacy.acceptedAnswers);
  extractTargets(legacy.correct_answer);
  extractTargets(legacy.correctAnswer);
  extractTargets(legacy.correct_answers);
  extractTargets(legacy.correctAnswers);
  if (legacy.item) {
    extractTargets(legacy.item.targetWord);
    extractTargets(legacy.item.acceptedAnswers);
  }

  // 2. Resolve raw options list from any available property
  let rawOptions: any[] = [];
  if (Array.isArray(legacy.options_data) && legacy.options_data.length > 0) {
    rawOptions = legacy.options_data;
  } else if (Array.isArray(legacy.options) && legacy.options.length > 0) {
    rawOptions = legacy.options;
  } else if (legacy.item && Array.isArray(legacy.item.options) && legacy.item.options.length > 0) {
    rawOptions = legacy.item.options;
  } else if (Array.isArray(legacy.choices) && legacy.choices.length > 0) {
    rawOptions = legacy.choices;
  }

  // 3. Determine base question type
  let type: PracticeQuestionType = normalizeQuestionType(legacy.type || legacy.item?.type || 'multiple-choice');

  // 4. Normalize every option into a complete PracticeOption object with non-empty id, text, and isCorrect
  const seenOptionIds = new Set<string>();
  const normalizedOptions: PracticeOption[] = rawOptions.map((rawOpt: any, idx: number) => {
    let optId = (typeof rawOpt === 'object' && rawOpt !== null && rawOpt.id && String(rawOpt.id).trim().length > 0)
      ? String(rawOpt.id).trim()
      : `opt_auto_${idx + 1}`;

    if (seenOptionIds.has(optId)) {
      optId = `${optId}_${idx + 1}`;
    }
    seenOptionIds.add(optId);

    if (typeof rawOpt === 'string') {
      const cleanText = rawOpt.trim();
      const cleanLower = cleanText.toLowerCase();
      const isCorrect = rawTargets.some(t => t === cleanLower);

      let rationale = '';
      if (isCorrect) {
        rationale = legacy.explanation || `Correct lexical choice: "${cleanText}" aligns with the academic context and collocation.`;
      } else {
        if (cleanLower.endsWith('ly')) {
          rationale = `Adverb form ("-ly" suffix): Incorrect syntactic position; a noun/verb/adjective is required in this context.`;
        } else if (cleanLower.endsWith('tion') || cleanLower.endsWith('ment') || cleanLower.endsWith('ness')) {
          rationale = `Noun derivative: The sentence structure demands a different part of speech.`;
        } else if (cleanLower.endsWith('ed') || cleanLower.endsWith('ing')) {
          rationale = `Participle form: Tense or voice mismatch with the governing clause structure.`;
        } else {
          rationale = `Distractor trap: Does not satisfy the collocations or semantic constraints of the context.`;
        }
      }

      return {
        id: optId,
        text: cleanText || `Option ${idx + 1}`,
        isCorrect,
        distractorRationale: rationale
      };
    }

    if (rawOpt && typeof rawOpt === 'object') {
      const text = String(rawOpt.text || rawOpt.label || rawOpt.value || rawOpt.content || rawOpt.title || `Option ${idx + 1}`).trim();
      const cleanLower = text.toLowerCase();

      let isCorrect: boolean;
      if (typeof rawOpt.isCorrect === 'boolean') {
        isCorrect = rawOpt.isCorrect;
      } else if (typeof rawOpt.is_correct === 'boolean') {
        isCorrect = rawOpt.is_correct;
      } else if (typeof rawOpt.correct === 'boolean') {
        isCorrect = rawOpt.correct;
      } else {
        isCorrect = rawTargets.some(t => t === cleanLower);
      }

      let rationale = rawOpt.distractorRationale || rawOpt.explanation || '';
      if (!rationale) {
        rationale = isCorrect
          ? (legacy.explanation || `Correct choice: "${text}" satisfies all syntactic and semantic constraints.`)
          : `Distractor trap: Does not satisfy the collocations or semantic constraints of the context.`;
      }

      return {
        id: optId,
        text: text || `Option ${idx + 1}`,
        isCorrect,
        distractorRationale: rationale,
        category: rawOpt.category ? String(rawOpt.category).trim() : undefined
      };
    }

    return {
      id: optId,
      text: `Option ${idx + 1}`,
      isCorrect: false
    };
  });

  // 5. Check if multiple correct answers exist or min_selections indicates multi-response (only promote multiple-choice)
  const correctCount = normalizedOptions.filter(o => o.isCorrect).length;
  if (
    type === 'multiple-choice' &&
    (correctCount > 1 || (legacy.min_selections && legacy.min_selections > 1) || (legacy.minSelections && legacy.minSelections > 1))
  ) {
    type = 'multiple-response';
  }

  // 6. Safeguards against 0 correct options
  if (type === 'multiple-choice' && normalizedOptions.length > 0 && !normalizedOptions.some(o => o.isCorrect)) {
    const matchIdx = normalizedOptions.findIndex(o => rawTargets.includes(o.text.toLowerCase()));
    if (matchIdx !== -1) {
      normalizedOptions[matchIdx].isCorrect = true;
    } else {
      normalizedOptions[0].isCorrect = true;
    }
  }

  if (type === 'multiple-response' && normalizedOptions.length > 0 && !normalizedOptions.some(o => o.isCorrect)) {
    let matched = false;
    normalizedOptions.forEach(o => {
      if (rawTargets.some(t => t === o.text.toLowerCase())) {
        o.isCorrect = true;
        matched = true;
      }
    });
    if (!matched) {
      const countToMark = Math.min(normalizedOptions.length, legacy.min_selections || legacy.minSelections || 2);
      for (let i = 0; i < countToMark; i++) {
        normalizedOptions[i].isCorrect = true;
      }
    }
  }

  if (type === 'drag-and-drop' && normalizedOptions.length > 0 && !normalizedOptions.some(o => o.isCorrect || o.category)) {
    let matched = false;
    normalizedOptions.forEach(o => {
      if (rawTargets.some(t => t === o.text.toLowerCase())) {
        o.isCorrect = true;
        matched = true;
      }
    });
    if (!matched) {
      normalizedOptions[0].isCorrect = true;
    }
  }

  const rawCategories = legacy.categories || legacy.item?.categories;
  const resolvedCategories = resolveCategoriesList(rawCategories, normalizedOptions);

  const minSelections = legacy.minSelections || legacy.min_selections || (type === 'multiple-response' ? Math.max(1, normalizedOptions.filter(o => o.isCorrect).length) : 1);
  const maxSelections = legacy.maxSelections || legacy.max_selections || (type === 'multiple-response' ? normalizedOptions.length : 1);

  const stimulusText = legacy.sentence_en || legacy.stimulusText || legacy.sentence || '';
  const defaultPrefix =
    type === 'multiple-response'
      ? 'Select ALL correct answers that apply:'
      : type === 'true-false-not-given'
      ? 'Evaluate statement truth value:'
      : type === 'category-matching'
      ? 'Classify and match each item to its category:'
      : type === 'drag-and-drop'
      ? (splitSentenceBlanks(stimulusText).blankCount > 0
          ? 'Drag and drop (or tap) the right word(s) into the blank(s):'
          : resolvedCategories.length > 0 && normalizedOptions.some(o => Boolean(o.category))
          ? 'Drag and drop (or tap) each item into its matching category zone:'
          : 'Drag and drop (or tap) the correct answer into the target box:')
      : 'Choose the most appropriate option:';

  return {
    id: legacy.id || `card_${Date.now()}`,
    type,
    cognitiveLevel: legacy.cognitive_level || legacy.cognitiveLevel || 'applying',
    learningOutcomeId: legacy.learning_outcome_id || legacy.learningOutcomeId || 'LO-IELTS-ACAD-01',
    promptPrefix: legacy.prompt_prefix || legacy.promptPrefix || defaultPrefix,
    stimulusText,
    promptSuffix: legacy.prompt_suffix || legacy.promptSuffix || '',
    options: normalizedOptions,
    minSelections,
    maxSelections,
    itemDifficulty: legacy.difficulty === 'hard' ? 1.5 : legacy.difficulty === 'easy' ? -0.8 : 0.0,
    targetWord: legacy.target_word || legacy.targetWord || legacy.cloze_target,
    partOfSpeech: legacy.part_of_speech || legacy.partOfSpeech,
    explanation: legacy.explanation,
    grammarPoints: legacy.grammar_points || legacy.grammarPoints,
    hints: legacy.hints,
    categories: resolvedCategories.length > 0 ? resolvedCategories : undefined
  };
}

function resolveCategoriesList(
  explicitCategories: Array<{ id?: string; name?: string } | string> | undefined,
  options: PracticeOption[]
): Array<{ id: string; name: string }> {
  const result: Array<{ id: string; name: string }> = [];
  const seenKeys = new Set<string>();

  const pushCategory = (idRaw: string, nameRaw: string) => {
    const cleanId = idRaw.trim();
    const cleanName = nameRaw.trim() || cleanId;
    if (!cleanId && !cleanName) return;
    const keyId = cleanId.toLowerCase();
    const keyName = cleanName.toLowerCase();
    if (seenKeys.has(keyId) || seenKeys.has(keyName)) return;
    seenKeys.add(keyId);
    seenKeys.add(keyName);
    result.push({ id: cleanId || cleanName, name: cleanName });
  };

  if (Array.isArray(explicitCategories) && explicitCategories.length > 0) {
    explicitCategories.forEach((cat, idx) => {
      if (typeof cat === 'string') {
        pushCategory(cat, cat);
      } else if (cat && typeof cat === 'object') {
        const idVal = String(cat.id || cat.name || `cat_${idx + 1}`);
        const nameVal = String(cat.name || cat.id || `Category ${idx + 1}`);
        pushCategory(idVal, nameVal);
      }
    });
  }

  options.forEach((opt) => {
    if (opt.category && String(opt.category).trim()) {
      const c = String(opt.category).trim();
      pushCategory(c, c);
    }
  });

  return result;
}

export function resolveCategoriesForItem(item: PracticeCardItem): Array<{ id: string; name: string }> {
  const resolved = resolveCategoriesList(item.categories, item.options);
  return resolved.length > 0 ? resolved : DEFAULT_FALLBACK_CATEGORIES;
}

export function doesCategoryMatch(
  assignedCatId: string | undefined,
  expectedCategory: string | undefined,
  categories: Array<{ id: string; name: string }>
): boolean {
  if (!expectedCategory || !expectedCategory.trim()) return true;
  if (!assignedCatId || !assignedCatId.trim()) return false;

  const expectedLower = expectedCategory.trim().toLowerCase();
  const assignedLower = assignedCatId.trim().toLowerCase();

  if (assignedLower === expectedLower) return true;

  const chosenCat = categories.find(
    (c) => c.id.trim().toLowerCase() === assignedLower || c.name.trim().toLowerCase() === assignedLower
  );
  if (!chosenCat) return false;

  return (
    chosenCat.id.trim().toLowerCase() === expectedLower ||
    chosenCat.name.trim().toLowerCase() === expectedLower
  );
}

export function splitSentenceBlanks(sentence: string): { segments: string[]; blankCount: number } {
  if (!sentence) return { segments: [''], blankCount: 0 };
  const matches = sentence.match(BLANK_TOKEN_REGEX);
  if (!matches || matches.length === 0) {
    return { segments: [sentence], blankCount: 0 };
  }
  const segments = sentence.split(BLANK_TOKEN_REGEX);
  return {
    segments,
    blankCount: segments.length - 1
  };
}

export interface DragDropSetup {
  mode: 'blanks' | 'categories' | 'single-box';
  blankCount: number;
  expectedBySlot: string[][]; // Allowed texts (normalized display form) for each slot index
  bankOptions: PracticeOption[];
  categories: Array<{ id: string; name: string }>;
}

export function resolveDragDropSetup(item: PracticeCardItem, legacyCard?: PracticeCard): DragDropSetup {
  const { blankCount } = splitSentenceBlanks(item.stimulusText || legacyCard?.sentence_en || '');
  const hasOptionCategories = item.options.some((o) => Boolean(o.category && o.category.trim()));
  const categories = resolveCategoriesList(item.categories, item.options);
  const bankOptions = shuffleDeterministic(item.options, item.id);

  if (blankCount > 0) {
    const correctOptions = item.options.filter((o) => o.isCorrect);
    const orderedTargets: string[] = [];

    if (correctOptions.length > 0) {
      correctOptions.forEach((o) => orderedTargets.push(o.text.trim()));
    } else {
      const rawTargetStr = String(item.targetWord || legacyCard?.cloze_target || '').trim();
      if (rawTargetStr) {
        rawTargetStr.split(/[,|]/).forEach((s) => {
          const clean = s.trim();
          if (clean) orderedTargets.push(clean);
        });
      }
      if (orderedTargets.length === 0 && Array.isArray(legacyCard?.accepted_answers)) {
        legacyCard!.accepted_answers.forEach((a) => {
          const clean = String(a || '').trim();
          if (clean) orderedTargets.push(clean);
        });
      }
    }

    const expectedBySlot: string[][] = [];
    if (blankCount === 1) {
      // Single blank: accept any marked correct answer / accepted answer
      const singleAccepted = new Set<string>(orderedTargets);
      (legacyCard?.accepted_answers || []).forEach((a) => {
        const clean = String(a || '').trim();
        if (clean) singleAccepted.add(clean);
      });
      expectedBySlot.push(Array.from(singleAccepted));
    } else {
      for (let i = 0; i < blankCount; i++) {
        const target = orderedTargets[i];
        expectedBySlot.push(target ? [target] : orderedTargets.length > 0 ? [orderedTargets[0]] : []);
      }
    }

    return {
      mode: 'blanks',
      blankCount,
      expectedBySlot,
      bankOptions,
      categories
    };
  }

  if (hasOptionCategories && categories.length > 0) {
    return {
      mode: 'categories',
      blankCount: 0,
      expectedBySlot: [],
      bankOptions,
      categories
    };
  }

  // Fallback: single drop box
  const correctTexts = item.options.filter((o) => o.isCorrect).map((o) => o.text.trim());
  if (correctTexts.length === 0 && item.targetWord) {
    correctTexts.push(item.targetWord.trim());
  }
  return {
    mode: 'single-box',
    blankCount: 1,
    expectedBySlot: [correctTexts],
    bankOptions,
    categories
  };
}

export interface DragDropEvaluation {
  isFullyCorrect: boolean;
  slotResults: Record<number, boolean>;
  optionResults: Record<string, boolean>;
  correctCount: number;
  totalCount: number;
}

export function evaluateDragDropAnswer(
  setup: DragDropSetup,
  item: PracticeCardItem,
  slotAssignments: Record<number, string>,
  categoryAssignments: Record<string, string>
): DragDropEvaluation {
  if (setup.mode === 'categories') {
    const optionResults: Record<string, boolean> = {};
    let correctCount = 0;
    const totalCount = item.options.length;

    item.options.forEach((opt) => {
      const assigned = categoryAssignments[opt.id];
      const ok = doesCategoryMatch(assigned, opt.category, setup.categories);
      optionResults[opt.id] = ok;
      if (ok) correctCount++;
    });

    return {
      isFullyCorrect: totalCount > 0 && correctCount === totalCount,
      slotResults: {},
      optionResults,
      correctCount,
      totalCount
    };
  }

  const slotResults: Record<number, boolean> = {};
  let correctCount = 0;
  const totalCount = setup.blankCount;

  for (let idx = 0; idx < totalCount; idx++) {
    const optId = slotAssignments[idx];
    const placedOpt = item.options.find((o) => o.id === optId);
    const placedText = placedOpt?.text.trim().toLowerCase() || '';
    const allowed = (setup.expectedBySlot[idx] || []).map((t) => t.trim().toLowerCase());
    const ok = Boolean(placedText && allowed.includes(placedText));
    slotResults[idx] = ok;
    if (ok) correctCount++;
  }

  return {
    isFullyCorrect: totalCount > 0 && correctCount === totalCount,
    slotResults,
    optionResults: {},
    correctCount,
    totalCount
  };
}
