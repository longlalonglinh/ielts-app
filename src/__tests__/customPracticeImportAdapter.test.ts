import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';

// In-memory LocalStorage polyfill for headless Node.js test runner
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
(globalThis as any).window.localStorage = localStorageMock;

import { practiceService } from '../services/practiceService';
import { CustomPracticeDeck } from '../types/practice';

describe('Smart Multi-Format Practice JSON Import Adapter', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ielts_practice_wipe_v2_blank_slate', 'true');
    practiceService.clearAllPracticeDecks();
  });

  it('1. Imports single deck with alternate keys (id, code, questions) and maps to CustomPracticeDeck', async () => {
    const rawDeck = {
      id: 'TEST_DECK_01',
      code: 'VOCAB_B2',
      title: 'Academic Vocabulary B2',
      category: 'Vocabulary',
      level: 'B1 - B2',
      description: 'Core B2 Academic words',
      questions: [
        {
          id: 'q_1',
          type: 'multi-response',
          cognitiveLevel: 'applying',
          sentence: 'Which measures help reduce urban traffic congestion?',
          translation: 'Biện pháp nào giúp giảm ùn tắc giao thông đô thị?',
          minSelections: 2,
          maxSelections: 2,
          options: [
            { id: 'opt_1', text: 'Expanding bus rapid transit', isCorrect: true, distractorRationale: 'Proven mass transit' },
            { id: 'opt_2', text: 'Congestion pricing zone', isCorrect: true, distractorRationale: 'Economic disincentive' },
            { id: 'opt_3', text: 'Removing traffic signals', isCorrect: false, distractorRationale: 'Dangerous' }
          ],
          targetWord: 'congestion',
          ipa: '/kənˈdʒes.tʃən/',
          hints: 'traffic, transit',
          grammarExplanation: 'Noun collocation with urban'
        }
      ]
    };

    const sanitizedDeck: CustomPracticeDeck = {
      deck_id: rawDeck.id.toUpperCase(),
      title: rawDeck.title,
      category: 'Vocabulary',
      level: 'B1-B2',
      description: rawDeck.description,
      target_language: 'en',
      native_language: 'vi',
      cards: rawDeck.questions.map((q: any) => ({
        id: q.id,
        sentence_en: q.sentence,
        sentence_vi: q.translation,
        cloze_target: q.targetWord,
        target_word: q.targetWord,
        phonetic: q.ipa,
        hints: q.hints,
        accepted_answers: ['Expanding bus rapid transit', 'Congestion pricing zone'],
        explanation: q.grammarExplanation,
        type: q.type === 'multi-response' ? 'multiple-response' : q.type,
        cognitive_level: q.cognitiveLevel,
        options_data: q.options,
        options: q.options.map((o: any) => o.text),
        min_selections: q.minSelections,
        max_selections: q.maxSelections
      })),
      is_custom: true
    };

    practiceService.saveDeck(sanitizedDeck);
    const retrieved = await practiceService.getDeckById('TEST_DECK_01');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.deck_id).toBe('TEST_DECK_01');
    expect(retrieved?.cards.length).toBe(1);
    expect(retrieved?.cards[0].type).toBe('multiple-response');
    expect(retrieved?.cards[0].sentence_en).toBe('Which measures help reduce urban traffic congestion?');
  });

  it('2. Auto-converts string array options into PracticeOption objects with correct answers', () => {
    const rawOptions = [
      'A. Photosynthesis',
      'B. Cellular respiration',
      'C. Fermentation',
      'D. Combustion'
    ];
    const correctAnswer = 'A';

    const normalizedOptions = rawOptions.map((optStr, optIdx) => {
      const optLetter = String.fromCharCode(65 + optIdx);
      const cleanText = optStr.replace(/^[A-F]\.\s*/i, '').trim();
      const isCorrect = correctAnswer === optLetter;
      return {
        id: `opt_${optIdx + 1}`,
        text: cleanText,
        isCorrect,
        distractorRationale: ''
      };
    });

    expect(normalizedOptions.length).toBe(4);
    expect(normalizedOptions[0].text).toBe('Photosynthesis');
    expect(normalizedOptions[0].isCorrect).toBe(true);
    expect(normalizedOptions[1].isCorrect).toBe(false);
  });

  it('3. Auto-wraps a pure array of question items into a default deck', () => {
    const rawQuestions = [
      {
        question: 'The scientist conducted an _____ on plant biology.',
        targetWord: 'experiment',
        options: ['experiment', 'experience', 'expert', 'exposure'],
        correctAnswer: 'A'
      }
    ];

    const wrappedDeck: CustomPracticeDeck = {
      deck_id: 'IMPORTED_TEST_01',
      title: 'Imported Question Bank',
      category: 'Vocabulary',
      level: 'B1-B2',
      description: 'Auto-wrapped questions',
      target_language: 'en',
      native_language: 'vi',
      cards: rawQuestions.map((q, idx) => ({
        id: `card_${idx + 1}`,
        sentence_en: q.question,
        sentence_vi: '',
        cloze_target: q.targetWord,
        accepted_answers: [q.targetWord],
        explanation: '',
        type: 'multiple-choice',
        options: q.options
      })),
      is_custom: true
    };

    practiceService.saveDeck(wrappedDeck);
    const all = practiceService.getAllDecks();
    expect(all.length).toBe(1);
    expect(all[0].cards[0].cloze_target).toBe('experiment');
  });
});
