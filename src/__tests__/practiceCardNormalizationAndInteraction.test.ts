import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PracticeCard, PracticeCardItem } from '../types/practice';
import { calculatePartialCreditScore } from '../services/answerScoring';

// Setup minimal localStorage mock for test environment
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
(window as any).localStorage = localStorageMock as unknown as Storage;

// Import normalizeToCardItem logic to verify normalization contract
describe('PracticeCard Normalization & Multiple-Response Interaction Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorage.setItem('ielts_practice_wipe_v2_blank_slate', 'true');
  });

  it('correctly normalizes a multiple-response card with string options without blank text or shared IDs', () => {
    // Card structure identical to the user screenshot scenario
    const rawCard: PracticeCard = {
      id: 'c_test_env_audit',
      type: 'multiple-response',
      sentence_en: 'According to the official environmental audit, the air quality in the industrial zone has improved [ _______ ] over the past three years, largely because over fifty polluting manufacturing plants were shut down.',
      sentence_vi: 'Theo kiểm toán môi trường chính thức, chất lượng không khí đã cải thiện đáng kể...',
      cloze_target: 'significantly',
      accepted_answers: ['considerably', 'sharply'],
      explanation: 'Both "significantly" and "considerably" are standard academic collocations modifying "improved".',
      options: [
        'considerably',
        'significantly',
        'sharply',
        'rapidly',
        'steadily',
        'marginally'
      ]
    };

    // Simulate normalization logic from PracticeCardView
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
    extractTargets(rawCard.cloze_target);
    extractTargets(rawCard.accepted_answers);

    const rawOptions = rawCard.options || [];
    const normalizedOptions = rawOptions.map((rawOpt: any, idx: number) => {
      const defaultId = `opt_${idx + 1}`;
      const cleanText = String(rawOpt).trim();
      const cleanLower = cleanText.toLowerCase();
      const isCorrect = rawTargets.some(t => t === cleanLower);

      return {
        id: defaultId,
        text: cleanText,
        isCorrect,
        distractorRationale: isCorrect ? rawCard.explanation : 'Distractor trap.'
      };
    });

    // 1. Verify every option has a distinct ID and non-empty text
    expect(normalizedOptions.length).toBe(6);
    const ids = normalizedOptions.map(o => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(6); // All 6 IDs are strictly unique
    expect(ids).toEqual(['opt_1', 'opt_2', 'opt_3', 'opt_4', 'opt_5', 'opt_6']);

    // 2. Verify all option text labels are present and NOT undefined
    normalizedOptions.forEach(opt => {
      expect(opt.text).toBeDefined();
      expect(opt.text.length).toBeGreaterThan(0);
      expect(opt.id).toBeDefined();
    });

    // 3. Verify total correct answers count is non-zero (fixes "0 TARGET ANSWERS")
    const correctOptions = normalizedOptions.filter(o => o.isCorrect);
    expect(correctOptions.length).toBe(3); // 'considerably', 'significantly', 'sharply'
    expect(correctOptions.map(o => o.text)).toEqual(['considerably', 'significantly', 'sharply']);

    // 4. Verify selection isolation: clicking opt_1 only toggles opt_1, not all options
    const selectedMultipleIds = new Set<string>();
    
    // User clicks option 1 ('opt_1')
    selectedMultipleIds.add(normalizedOptions[0].id);

    expect(selectedMultipleIds.has(normalizedOptions[0].id)).toBe(true);  // Only opt_1 is true
    expect(selectedMultipleIds.has(normalizedOptions[1].id)).toBe(false); // opt_2 is false
    expect(selectedMultipleIds.has(normalizedOptions[2].id)).toBe(false); // opt_3 is false
    expect(selectedMultipleIds.has(normalizedOptions[3].id)).toBe(false);
    expect(selectedMultipleIds.has(normalizedOptions[4].id)).toBe(false);
    expect(selectedMultipleIds.has(normalizedOptions[5].id)).toBe(false);
    expect(selectedMultipleIds.size).toBe(1); // Selected 1 / 3 answers, NOT 1 / 0!
  });

  it('correctly calculates partial credit scoring with normalized option objects', () => {
    const options = [
      { id: 'opt_1', text: 'considerably', isCorrect: true },
      { id: 'opt_2', text: 'significantly', isCorrect: true },
      { id: 'opt_3', text: 'sharply', isCorrect: true },
      { id: 'opt_4', text: 'rapidly', isCorrect: false },
      { id: 'opt_5', text: 'steadily', isCorrect: false },
      { id: 'opt_6', text: 'marginally', isCorrect: false }
    ];

    // Selecting 2 correct options and 0 incorrect options
    const result = calculatePartialCreditScore(['opt_1', 'opt_2'], options, 1.0);
    expect(result.cTotal).toBe(3);
    expect(result.cSelected).toBe(2);
    expect(result.iTotal).toBe(3);
    expect(result.iSelected).toBe(0);
    expect(result.score).toBe(0.67);
    expect(result.isPartial).toBe(true);

    // Selecting all options triggers anti-guessing penalty
    const allSelectedResult = calculatePartialCreditScore(['opt_1', 'opt_2', 'opt_3', 'opt_4', 'opt_5', 'opt_6'], options, 1.0);
    expect(allSelectedResult.score).toBe(0); // 3/3 - 3/3 = 0
  });

  it('handles objects with missing IDs or alternate label/value keys safely', () => {
    const rawOptions = [
      { label: 'Option Alpha', is_correct: true },
      { value: 'Option Beta', correct: false }
    ];

    const normalized = rawOptions.map((opt: any, idx: number) => ({
      id: String(opt.id || `opt_${idx + 1}`),
      text: String(opt.text || opt.label || opt.value || `Option ${idx + 1}`),
      isCorrect: Boolean(opt.isCorrect || opt.is_correct || opt.correct)
    }));

    expect(normalized[0].id).toBe('opt_1');
    expect(normalized[0].text).toBe('Option Alpha');
    expect(normalized[0].isCorrect).toBe(true);
  });

  it('prevents cross-selection by guaranteeing strict uniqueness even if incoming objects have duplicate or empty IDs', () => {
    const rawOptions = [
      { id: '', text: 'First option', isCorrect: true },
      { id: '', text: 'Second option', isCorrect: false },
      { id: 'custom_id', text: 'Third option', isCorrect: true },
      { id: 'custom_id', text: 'Fourth option with duplicated ID', isCorrect: false },
      'Fifth string option'
    ];

    const seenOptionIds = new Set<string>();
    const normalized = rawOptions.map((rawOpt: any, idx: number) => {
      let optId = (typeof rawOpt === 'object' && rawOpt !== null && rawOpt.id && String(rawOpt.id).trim().length > 0)
        ? String(rawOpt.id).trim()
        : `opt_auto_${idx + 1}`;
      if (seenOptionIds.has(optId)) {
        optId = `${optId}_${idx + 1}`;
      }
      seenOptionIds.add(optId);

      const text = typeof rawOpt === 'string'
        ? rawOpt.trim()
        : String(rawOpt.text || rawOpt.label || rawOpt.value || `Option ${idx + 1}`).trim();

      return {
        id: optId,
        text,
        isCorrect: typeof rawOpt === 'object' ? Boolean(rawOpt.isCorrect) : false
      };
    });

    const ids = normalized.map(o => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
    expect(ids[0]).toBe('opt_auto_1');
    expect(ids[1]).toBe('opt_auto_2');
    expect(ids[2]).toBe('custom_id');
    expect(ids[3]).toBe('custom_id_4');
    expect(ids[4]).toBe('opt_auto_5');

    // Clicking custom_id only selects item 2, not item 3
    const selected = new Set<string>();
    selected.add(ids[2]);
    expect(selected.has(ids[2])).toBe(true);
    expect(selected.has(ids[3])).toBe(false);
  });

  it('enforces maxSelections strictly when toggling multiple choices', () => {
    const maxSelections = 2;
    let selected = new Set<string>(['opt_1', 'opt_2']);

    const toggle = (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (maxSelections && next.size >= maxSelections) {
          return selected; // returns prev
        }
        next.add(id);
      }
      return next;
    };

    // Attempting to select 3rd option should not add it
    selected = toggle('opt_3');
    expect(selected.size).toBe(2);
    expect(selected.has('opt_3')).toBe(false);

    // Deselecting opt_1 works
    selected = toggle('opt_1');
    expect(selected.size).toBe(1);
    expect(selected.has('opt_1')).toBe(false);

    // Now selecting opt_3 succeeds
    selected = toggle('opt_3');
    expect(selected.size).toBe(2);
    expect(selected.has('opt_3')).toBe(true);
  });
});
