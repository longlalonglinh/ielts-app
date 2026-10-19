import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gasScriptCodeTemplate } from '../data/gasScriptCode';
import { fetchExamViaGviz } from '../services/gvizService';
import { postToGasWithLockRetry } from '../services/api';

describe('Diagnostics & Verification Suite: Static Mode, Schema Parity & Auto-Resync', () => {

  describe('1. Schema Parity & Synchronization (GAS vs Backend vs GViz)', () => {
    it('verifies EXAMS tab contains all 11 standardized columns including AUDIO_TITLE', () => {
      // Check GAS template contains 11 columns for EXAMS
      expect(gasScriptCodeTemplate).toContain("'EXAM_CODE', 'TITLE', 'TEST_TYPE', 'DURATION_MINS'");
      expect(gasScriptCodeTemplate).toContain("'AUDIO_TITLE'");
      expect(gasScriptCodeTemplate).toContain("'CREATED_AT'");
      
      // Check EXAMS header columns definition in GAS
      const examsHeaderMatch = gasScriptCodeTemplate.match(/sheetExams\.appendRow\(\[\s*([\s\S]*?)\s*\]\);/);
      expect(examsHeaderMatch).toBeTruthy();
      const headers = examsHeaderMatch![1].replace(/['"\s]/g, '').split(',');
      expect(headers).toEqual([
        'EXAM_CODE',
        'TITLE',
        'TEST_TYPE',
        'DURATION_MINS',
        'AUDIO_URL',
        'READING_PASSAGE',
        'WRITING_TASK1_PROMPT',
        'WRITING_TASK2_PROMPT',
        'WRITING_TASK1_IMAGE',
        'AUDIO_TITLE',
        'CREATED_AT'
      ]);
      expect(headers.length).toBe(11);
    });

    it('verifies SUBMISSIONS tab contains 18 standardized columns A:R across GAS template', () => {
      const submissionsHeaderMatch = gasScriptCodeTemplate.match(/sheetSubmissions\.appendRow\(\[\s*([\s\S]*?)\s*\]\);/);
      expect(submissionsHeaderMatch).toBeTruthy();
      const headers = submissionsHeaderMatch![1].replace(/['"\s]/g, '').split(',');
      expect(headers).toEqual([
        'SUBMISSION_ID',
        'SBD',
        'STUDENT_NAME',
        'EXAM_CODE',
        'TEST_MODE',
        'LISTENING_RAW',
        'LISTENING_BAND',
        'READING_RAW',
        'READING_BAND',
        'WRITING_TASK1_TEXT',
        'WRITING_TASK2_TEXT',
        'ANSWERS_JSON',
        'WRITING_SCORES_JSON',
        'WRITING_BAND',
        'OVERALL_BAND',
        'STATUS',
        'SUBMITTED_AT',
        'VIOLATIONS_COUNT'
      ]);
      expect(headers.length).toBe(18);
    });

    it('verifies GViz EXAMS query specifies exactly columns A through K (11 columns)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const gvizContent = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'gvizService.ts'), 'utf-8');
      expect(gvizContent).toContain("SELECT A, B, C, D, E, F, G, H, I, J, K WHERE UPPER(A) =");
    });
  });

  describe('2. GViz Backward Compatibility (QUESTIONS Parsing Engine)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('correctly unwraps legacy JSON in Column F when Column D is a short token (A, B, C, D, TRUE, FALSE)', async () => {
      // Mock global fetch for GViz JSONP responses
      const mockExamTable = {
        status: 'ok',
        table: {
          rows: [
            {
              c: [
                { v: 'TEST_LEGACY' },
                { v: 'Legacy IELTS Test' },
                { v: 'TEST' },
                { v: 120 },
                { v: 'https://example.com/audio.mp3' },
                { v: 'Passage text...' },
                { v: 'Task 1 Prompt' },
                { v: 'Task 2 Prompt' },
                { v: '' },
                { v: 'Audio Part 1 Track' },
                { v: '2026-10-11' }
              ]
            }
          ]
        }
      };

      // Legacy question row where Col D (index 3) is "A" and Col F (index 5) is a JSON object with question_text
      const mockQuestionsTable = {
        status: 'ok',
        table: {
          rows: [
            {
              c: [
                { v: 'TEST_LEGACY' },
                { v: 'L1' },
                { v: 'listening' },
                { v: 'A' }, // Short token in Col D!
                { v: 'multiple_choice' },
                { 
                  v: JSON.stringify({
                    question_text: 'What did the speaker mention about urban transit systems?',
                    question_type: 'multiple_choice',
                    options: ['Underground tunnels', 'Light rail systems', 'Electric bus routes']
                  })
                },
                { v: 1 }
              ]
            },
            {
              c: [
                { v: 'TEST_LEGACY' },
                { v: 'R1' },
                { v: 'reading' },
                { v: 'TRUE' }, // Short token in Col D!
                { v: 'true_false_not_given' },
                { 
                  v: JSON.stringify({
                    question_text: 'The study was completed within a twelve-month observation cycle.',
                    question_type: 'true_false_not_given',
                    options: ['TRUE', 'FALSE', 'NOT GIVEN']
                  })
                },
                { v: 1 }
              ]
            }
          ]
        }
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('sheet=EXAMS')) {
          return {
            ok: true,
            status: 200,
            text: async () => `/*O_o*/ google.visualization.Query.setResponse(${JSON.stringify(mockExamTable)});`
          } as Response;
        } else if (urlStr.includes('sheet=QUESTIONS')) {
          return {
            ok: true,
            status: 200,
            text: async () => `/*O_o*/ google.visualization.Query.setResponse(${JSON.stringify(mockQuestionsTable)});`
          } as Response;
        }
        return { ok: false, status: 404, text: async () => '' } as Response;
      });

      const result = await fetchExamViaGviz('1234567890abcdef', 'TEST_LEGACY');
      expect(result.success).toBe(true);
      expect(result.exam).toBeDefined();

      const listeningQs = result.exam!.listening_questions;
      expect(listeningQs.length).toBe(1);
      // The short "A" token must have been superseded by the full text from the legacy JSON!
      expect(listeningQs[0].question_text).toBe('What did the speaker mention about urban transit systems?');
      expect(listeningQs[0].options).toEqual(['Underground tunnels', 'Light rail systems', 'Electric bus routes']);

      const readingQs = result.exam!.reading_questions;
      expect(readingQs.length).toBe(1);
      // The short "TRUE" token must have been superseded by the full text from the legacy JSON!
      expect(readingQs[0].question_text).toBe('The study was completed within a twelve-month observation cycle.');
      expect(readingQs[0].options).toEqual(['TRUE', 'FALSE', 'NOT GIVEN']);

      // Audio title column 10 (index 9) must be parsed accurately
      expect(result.exam!.audio_title).toBe('Audio Part 1 Track');
    });
  });

  describe('3. CORS & Redirect Resilience (postToGasWithLockRetry)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('falls back seamlessly to mode "no-cors" when browser triggers CORS error during 302 redirect', async () => {
      let fetchCallCount = 0;
      let usedNoCorsInSecondAttempt = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init?: any) => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // First attempt: simulate browser throwing TypeError on CORS redirect
          throw new TypeError('Failed to fetch (CORS preflight or redirect blocked)');
        }
        // Second attempt: verify fallback used mode 'no-cors'
        if (init?.mode === 'no-cors') {
          usedNoCorsInSecondAttempt = true;
          return {
            type: 'opaque',
            ok: false,
            status: 0,
            text: async () => ''
          } as Response;
        }
        return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'success' }) } as Response;
      });

      const response = await postToGasWithLockRetry(
        'https://script.google.com/macros/s/AKfycbz_test/exec',
        { action: 'submitExam', submission_id: 'SUB_01' }
      );

      expect(fetchCallCount).toBe(2);
      expect(usedNoCorsInSecondAttempt).toBe(true);
      expect(response).toEqual({
        status: 'success',
        message: 'Submission successfully received by Google Apps Script (no-cors mode).',
        is_opaque: true
      });
    });
  });

  describe('4. GitHub Pages SPA Redirection and Deep Links', () => {
    it('verifies public/404.html handles query-string path encoding for SPA routing', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.join(process.cwd(), 'public', '404.html');
      
      expect(fs.existsSync(htmlPath)).toBe(true);
      const content = fs.readFileSync(htmlPath, 'utf-8');
      expect(content).toContain('Single Page Apps for GitHub Pages');
      expect(content).toContain('l.replace(');
    });

    it('verifies index.html contains SPA redirect decoder script', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.join(process.cwd(), 'index.html');
      
      const content = fs.readFileSync(htmlPath, 'utf-8');
      expect(content).toContain('window.history.replaceState(');
    });
  });
});
