import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GEMINI_MODEL, isValidGeminiApiKey, getServerGeminiClient } from '../../server/geminiClient';
import { practiceService } from '../services/practiceService';
import { generateExamWithAI } from '../services/gemini';

function collectClientFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
        results.push(...collectClientFiles(full));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Server-Side Gemini API Migration Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Ensures zero client-side @google/genai imports, VITE_GEMINI_API_KEY, or generativelanguage URLs in src/', () => {
    const srcFiles = collectClientFiles(path.join(process.cwd(), 'src'));
    expect(srcFiles.length).toBeGreaterThan(0);

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain('@google/genai');
      expect(content).not.toContain('VITE_GEMINI_API_KEY');
      expect(content).not.toContain('generativelanguage.googleapis.com');
      expect(content).not.toContain('ielts_gemini_api_key');
    }
  });

  it('2. Validates server/geminiClient.ts configuration, model selection, and key guards', () => {
    expect(GEMINI_MODEL).toBe('gemini-4-hydrogen');
    expect(isValidGeminiApiKey('')).toBe(false);
    expect(isValidGeminiApiKey('MY_GEMINI_API_KEY')).toBe(false);
    expect(isValidGeminiApiKey('AQ.invalidOAuthTokenForGeminiAPI123456')).toBe(false);
    expect(isValidGeminiApiKey('AIzaSyDummyValidTestKeyForUnitTesting12345')).toBe(true);

    const prevKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      expect(getServerGeminiClient()).toBeNull();
      process.env.GEMINI_API_KEY = 'AIzaSyDummyValidTestKeyForUnitTesting12345';
      expect(getServerGeminiClient()).not.toBeNull();
    } finally {
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it('3. Routes practiceService.analyzeSentence, practiceService.generateDeck, and generateExamWithAI through server APIs', async () => {
    const requestedUrls: string[] = [];
    const prevFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      requestedUrls.push(url);

      if (url.includes('/api/gemini/analyze-grammar')) {
        return new Response(
          JSON.stringify({
            success: true,
            analysis: {
              original_sentence: 'She mitigated the risk.',
              target_word: 'mitigated',
              sentence_translation_vi: 'Cô ấy đã giảm thiểu rủi ro.',
              syntax_breakdown: {
                subject: 'She',
                main_verb: 'mitigated',
                object_or_complement: 'the risk',
                modifiers_or_clauses: ''
              },
              word_analysis: {
                target_word: 'mitigated',
                part_of_speech: 'verb',
                phonetic: '/ˈmɪt.ɪ.ɡeɪt/',
                definition_vi: 'giảm nhẹ',
                root_and_forms: ['mitigate', 'mitigation'],
                synonyms: ['alleviate'],
                antonyms: ['aggravate']
              },
              key_grammar_rules: ['Past simple transitive verb'],
              collocations_and_phrases: ['mitigate risk'],
              detailed_explanation_vi: 'Server analyzed explanation.',
              common_pitfalls: 'None',
              example_sentences: [{ en: 'We must mitigate risk.', vi: 'Chúng ta phải giảm rủi ro.' }]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/gemini/generate-practice-deck')) {
        return new Response(
          JSON.stringify({
            success: true,
            deck: {
              deck_id: 'PRACTICE_SERVER_01',
              title: 'Server Generated Deck',
              category: 'Vocabulary',
              description: 'From server',
              level: 'B1-B2',
              cards: [
                {
                  id: 'c1',
                  type: 'multiple-choice',
                  sentence_en: 'Test _____ blank.',
                  sentence_vi: 'Câu mẫu.',
                  cloze_target: 'word',
                  target_word: 'word',
                  part_of_speech: 'noun',
                  phonetic: '/wɜːd/',
                  hints: 'hint',
                  accepted_answers: ['word'],
                  explanation: 'exp',
                  options_data: [{ id: 'o1', text: 'word', isCorrect: true }]
                }
              ]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/gemini/generate-exam')) {
        return new Response(
          JSON.stringify({
            success: true,
            exam: {
              exam_code: 'IELTS_SRV_01',
              title: 'Server Generated Exam',
              test_type: 'TEST',
              duration_mins: 60,
              passages: [
                {
                  passage_index: 1,
                  title: 'Passage 1',
                  text: 'Academic text.',
                  questions: [
                    {
                      question_id: 'R1',
                      section: 'reading',
                      passage_index: 1,
                      question_text: 'Sample question?',
                      question_type: 'true_false_not_given',
                      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
                      correct_answer: 'TRUE',
                      max_score: 1
                    }
                  ]
                }
              ],
              questions: []
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;

    try {
      const analysis = await practiceService.analyzeSentence('She mitigated the risk.', 'mitigated');
      expect(analysis.detailed_explanation_vi).toBe('Server analyzed explanation.');

      const deck = await practiceService.generateDeck('Risk Management', 'Vocabulary', 'B1-B2', 4);
      expect(deck.deck_id).toBe('PRACTICE_SERVER_01');
      expect(deck.cards[0].options).toEqual(['word']);

      const examRes = await generateExamWithAI({ topic: 'Urban Design', skills: ['reading'] });
      expect(examRes.success).toBe(true);
      expect(examRes.exam.exam_code).toBe('IELTS_SRV_01');

      expect(requestedUrls.some(u => u.includes('/api/gemini/analyze-grammar'))).toBe(true);
      expect(requestedUrls.some(u => u.includes('/api/gemini/generate-practice-deck'))).toBe(true);
      expect(requestedUrls.some(u => u.includes('/api/gemini/generate-exam'))).toBe(true);
      expect(requestedUrls.some(u => u.includes('generativelanguage.googleapis.com'))).toBe(false);
    } finally {
      globalThis.fetch = prevFetch;
    }
  });
});
