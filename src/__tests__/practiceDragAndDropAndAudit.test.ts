import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeToCardItem,
  normalizeQuestionType,
  resolveCategoriesForItem,
  doesCategoryMatch,
  resolveDragDropSetup,
  evaluateDragDropAnswer,
  shuffleDeterministic,
  splitSentenceBlanks
} from '../utils/practiceHelpers';
import { PracticeCard } from '../types/practice';
import { practiceService } from '../services/practiceService';
import { toIsoDateKey } from '../utils/dateFormatter';
import { safeLocalStorage, safeSessionStorage, safeJsonParse } from '../utils/safeStorage';
import { deduplicateSubmissions, deduplicateCheatLogs, setAdminToken, getAdminToken, clearAdminToken } from '../services/api';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = localStorageMock;
(window as any).localStorage = localStorageMock;

describe('Practice Audit Fixes & Drag-and-Drop Question Type', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = localStorageMock;
    (window as any).localStorage = localStorageMock;
    localStorageMock.clear();
    localStorage.setItem('ielts_practice_wipe_v2_blank_slate', 'true');
  });

  it('normalizes drag-and-drop type aliases and prevents substring false-positives on distractors', () => {
    expect(normalizeQuestionType('drag-and-drop')).toBe('drag-and-drop');
    expect(normalizeQuestionType('drag_and_drop')).toBe('drag-and-drop');
    expect(normalizeQuestionType('dragdrop')).toBe('drag-and-drop');

    const card: PracticeCard = {
      id: 'c_mc_exact',
      type: 'multiple-choice',
      sentence_en: 'Scholars chose to _____ the framework.',
      sentence_vi: 'Các học giả chọn áp dụng khung.',
      cloze_target: 'adopt',
      accepted_answers: ['adopt'],
      explanation: 'adopt is a verb.',
      options: ['adopt', 'adoption', 'adopted', 'adapt']
    };

    const item = normalizeToCardItem(card);
    const correctOpts = item.options.filter(o => o.isCorrect);
    expect(correctOpts.map(o => o.text)).toEqual(['adopt']);
  });

  it('fixes category-matching by deriving missing categories and matching both cat.id and cat.name', () => {
    const cardWithIdsAndNames: PracticeCard = {
      id: 'c_cat_1',
      type: 'category-matching',
      sentence_en: 'Classify connectors:',
      sentence_vi: 'Phân loại từ nối:',
      cloze_target: 'Addition, Contrast',
      accepted_answers: ['Furthermore', 'In contrast'],
      explanation: 'Connectors',
      categories: [
        { id: 'cat_add', name: 'Addition (Bổ sung)' },
        { id: 'cat_contrast', name: 'Contrast (Tương phản)' }
      ],
      options_data: [
        { id: 'opt_1', text: 'Furthermore', category: 'Addition (Bổ sung)', isCorrect: true },
        { id: 'opt_2', text: 'In contrast', category: 'Contrast (Tương phản)', isCorrect: true }
      ]
    };

    const item1 = normalizeToCardItem(cardWithIdsAndNames);
    const cats1 = resolveCategoriesForItem(item1);
    expect(doesCategoryMatch('cat_add', 'Addition (Bổ sung)', cats1)).toBe(true);
    expect(doesCategoryMatch('cat_contrast', 'Addition (Bổ sung)', cats1)).toBe(false);

    // Without explicit item.categories (e.g. CustomPracticeManager addCard / GAS sheet import)
    const cardWithoutExplicitCategories: PracticeCard = {
      id: 'c_cat_2',
      type: 'category-matching',
      sentence_en: 'Classify:',
      sentence_vi: 'Phân loại:',
      cloze_target: '',
      accepted_answers: [],
      explanation: '',
      options_data: [
        { id: 'opt_1', text: 'Furthermore', category: 'Addition (Bổ sung)', isCorrect: true },
        { id: 'opt_2', text: 'Consequently', category: 'Result (Kết quả)', isCorrect: true }
      ]
    };
    const item2 = normalizeToCardItem(cardWithoutExplicitCategories);
    const cats2 = resolveCategoriesForItem(item2);
    expect(cats2.map(c => c.name)).toEqual(['Addition (Bổ sung)', 'Result (Kết quả)']);
    expect(doesCategoryMatch('Addition (Bổ sung)', 'Addition (Bổ sung)', cats2)).toBe(true);
  });

  it('supports multi-blank drag-and-drop setup, deterministic bank order, and ordered slot grading', () => {
    const dndCard: PracticeCard = {
      id: 'c_dnd_multi',
      type: 'drag-and-drop',
      sentence_en: 'Governments must _____ carbon emissions and _____ renewable energy.',
      sentence_vi: 'Chính phủ phải giảm khí thải và trợ cấp năng lượng tái tạo.',
      cloze_target: 'curb, subsidize',
      accepted_answers: ['curb', 'subsidize'],
      explanation: 'Environmental collocations',
      options_data: [
        { id: 'opt_1', text: 'curb', isCorrect: true, distractorRationale: 'Blank 1' },
        { id: 'opt_2', text: 'subsidize', isCorrect: true, distractorRationale: 'Blank 2' },
        { id: 'opt_3', text: 'exaggerate', isCorrect: false, distractorRationale: 'Distractor' },
        { id: 'opt_4', text: 'neglect', isCorrect: false, distractorRationale: 'Distractor' }
      ]
    };

    const item = normalizeToCardItem(dndCard);
    expect(item.type).toBe('drag-and-drop');

    const { blankCount } = splitSentenceBlanks(item.stimulusText);
    expect(blankCount).toBe(2);

    const setup = resolveDragDropSetup(item, dndCard);
    expect(setup.mode).toBe('blanks');
    expect(setup.blankCount).toBe(2);
    expect(setup.expectedBySlot).toEqual([['curb'], ['subsidize']]);

    // Deterministic shuffle produces identical ordering for same seed
    expect(shuffleDeterministic(item.options, item.id).map(o => o.id))
      .toEqual(setup.bankOptions.map(o => o.id));

    // Correct placement
    const okEval = evaluateDragDropAnswer(setup, item, { 0: 'opt_1', 1: 'opt_2' }, {});
    expect(okEval.isFullyCorrect).toBe(true);
    expect(okEval.slotResults).toEqual({ 0: true, 1: true });

    // Swapped order fails both slots
    const swappedEval = evaluateDragDropAnswer(setup, item, { 0: 'opt_2', 1: 'opt_1' }, {});
    expect(swappedEval.isFullyCorrect).toBe(false);
    expect(swappedEval.slotResults).toEqual({ 0: false, 1: false });
  });

  it('supports drag-and-drop category drop-zone mode when sentence has no blanks', () => {
    const dndCatCard: PracticeCard = {
      id: 'c_dnd_cat',
      type: 'drag-and-drop',
      sentence_en: 'Sort each word into its part of speech zone:',
      sentence_vi: 'Kéo từ vào đúng nhóm từ loại:',
      cloze_target: 'Noun, Verb',
      accepted_answers: ['analysis', 'evaluate'],
      explanation: 'Word classes',
      options_data: [
        { id: 'opt_1', text: 'analysis', category: 'Noun', isCorrect: true },
        { id: 'opt_2', text: 'evaluate', category: 'Verb', isCorrect: true }
      ]
    };

    const item = normalizeToCardItem(dndCatCard);
    const setup = resolveDragDropSetup(item, dndCatCard);
    expect(setup.mode).toBe('categories');
    expect(setup.categories.map(c => c.name)).toEqual(['Noun', 'Verb']);

    const passEval = evaluateDragDropAnswer(setup, item, {}, { opt_1: 'Noun', opt_2: 'Verb' });
    expect(passEval.isFullyCorrect).toBe(true);

    const failEval = evaluateDragDropAnswer(setup, item, {}, { opt_1: 'Verb', opt_2: 'Verb' });
    expect(failEval.isFullyCorrect).toBe(false);
    expect(failEval.optionResults).toEqual({ opt_1: false, opt_2: true });
  });

  it('initializes clean zeroed learner stats and includes drag-and-drop in generated decks', async () => {
    const stats = practiceService.getUserStats('HV01');
    expect(stats.daily_streak).toBe(0);
    expect(stats.best_streak).toBe(0);
    expect(stats.correct_repeats_pct).toBe(0);
    expect(stats.total_cards_mastered).toBe(0);

    const afterFirst = practiceService.recordPracticeSession('PRACTICE_01', 'Test Deck', 4, 3, {
      c1: true,
      c2: true,
      c3: true,
      c4: false
    }, 'HV01');
    expect(afterFirst.correct_repeats_pct).toBe(75);
    expect(afterFirst.daily_streak).toBe(1);

    const generated = await practiceService.generateDeck('Climate Policy', 'Vocabulary', 'B1-B2', 5);
    expect(generated.cards.some(c => c.type === 'drag-and-drop')).toBe(true);
  });

  it('excludes dropdown from drag-and-drop and safely normalizes numeric/object timestamps via toIsoDateKey', () => {
    expect(normalizeQuestionType('dropdown')).toBe('multiple-choice');
    expect(normalizeQuestionType('dnd')).toBe('drag-and-drop');

    expect(toIsoDateKey('2026-11-16T15:00:00.000Z')).toBe('2026-11-16');
    expect(toIsoDateKey(1794841200000)).toBe('2026-11-16');
    expect(toIsoDateKey(1794841200)).toBe('2026-11-16');
    expect(toIsoDateKey('18:50:00 16/11/2026')).toBe('2026-11-16');
    expect(toIsoDateKey(new Date('2026-11-16T00:00:00.000Z'))).toBe('2026-11-16');
    expect(toIsoDateKey(null)).toBe('');
    expect(toIsoDateKey(undefined)).toBe('');
    expect(toIsoDateKey({ bad: true })).toBe('');
  });

  it('survives harsh sandboxed iframe storage blocks (SecurityError / QuotaExceededError) and corrupted JSON', () => {
    const hostileStorage = {
      getItem: () => { throw new Error('SecurityError: The operation is insecure.'); },
      setItem: () => { throw new Error('QuotaExceededError: Storage quota exceeded.'); },
      removeItem: () => { throw new Error('SecurityError'); },
      key: () => { throw new Error('SecurityError'); },
      length: 0
    };

    const prevLocal = (globalThis as any).localStorage;
    const prevSession = (globalThis as any).sessionStorage;
    try {
      (globalThis as any).localStorage = hostileStorage;
      (globalThis as any).sessionStorage = hostileStorage;

      // safeLocalStorage & safeSessionStorage fall back to memory seamlessly
      safeLocalStorage.setItem('sandbox_key', 'resilient_val');
      expect(safeLocalStorage.getItem('sandbox_key')).toBe('resilient_val');
      safeLocalStorage.removeItem('sandbox_key');
      expect(safeLocalStorage.getItem('sandbox_key')).toBeNull();

      // Admin token auth still works in-memory even if sessionStorage throws SecurityError
      setAdminToken('sandbox_admin_token_xyz');
      expect(getAdminToken()).toBe('sandbox_admin_token_xyz');
      clearAdminToken();
      expect(getAdminToken()).toBe('');

      // Learner switching & practice service never throw in hostile sandbox
      const learners = practiceService.getLearners();
      expect(learners.length).toBe(3);
      const switched = practiceService.setCurrentLearner('HV02');
      expect(switched.student_id).toBe('HV02');

      // safeJsonParse handles malformed JSON gracefully
      expect(safeJsonParse('{broken json', ['fallback'])).toEqual(['fallback']);
      expect(safeJsonParse(null, 42)).toBe(42);
    } finally {
      (globalThis as any).localStorage = prevLocal;
      (globalThis as any).sessionStorage = prevSession;
    }
  });

  it('coerces adversarial non-string Google Sheets rows in deduplicateSubmissions and deduplicateCheatLogs', () => {
    const rawSubs: any[] = [
      null,
      undefined,
      {
        submission_id: 1001,
        sbd: 998877,
        exam_code: 202601,
        submitted_at: 1794841200000,
        received_at: 1794841200,
        listening_band: 7.5,
        reading_band: 8.0
      }
    ];
    const cleanSubs = deduplicateSubmissions(rawSubs);
    expect(cleanSubs).toHaveLength(1);
    expect(typeof cleanSubs[0].sbd).toBe('string');
    expect(cleanSubs[0].sbd).toBe('998877');
    expect(cleanSubs[0].exam_code).toBe('202601');
    expect(toIsoDateKey(cleanSubs[0].submitted_at)).toBe('2026-11-16');

    const rawLogs: any[] = [
      null,
      {
        log_id: 505,
        sbd: 12345,
        exam_code: 101,
        event: 'TAB_SWITCH',
        timestamp: 1794841200000
      }
    ];
    const cleanLogs = deduplicateCheatLogs(rawLogs);
    expect(cleanLogs).toHaveLength(1);
    expect(cleanLogs[0].sbd).toBe('12345');
    expect(cleanLogs[0].exam_code).toBe('101');
    expect(typeof cleanLogs[0].timestamp).toBe('string');
  });
});

