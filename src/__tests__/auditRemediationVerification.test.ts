import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseExamRows,
  resolveExamTypeAndDuration,
  resolveSubmissionWriteChannel
} from '../../server/googleSheetsService';
import { persistBase64Image } from '../../server/storage';
import { FileStorageRepository } from '../../server/repositories/storageRepository';
import {
  ExamProvider,
  ExamProviderChain,
  normalizeExamPayload,
  sanitizeExamQuestions
} from '../services/examProviders';
import { fetchAnswerKeyViaGviz, setStoredSpreadsheetId } from '../services/gvizService';
import { submitExamPayload } from '../services/api';
import { isAnswerCorrect } from '../services/answerScoring';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/gasScriptCode';
import { ExamData, IELTSQuestionType, canonicalizeQuestionType } from '../types';

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('Priority 1: Google Sheets Data Integrity Remediation', () => {
  it('1. Auto-detects swapped TEST_TYPE and DURATION_MINS columns in parseExamRows()', () => {
    const rows = [
      // Legacy swapped row: col 2 is numeric duration (30), col 3 is test_type ('PRACTICE')
      ['PRAC_IELTS_01', 'Quick Practice Reading', '30', 'PRACTICE', '', 'Passage text', '', '', '', '', '2026-11-19'],
      // Standard row: col 2 is test_type ('TEST'), col 3 is duration (120)
      ['IELTS_RND_01', 'Full Academic Mock', 'TEST', 120, '', 'Passage text', '', '', '', '', '2026-11-19'],
      // Legacy Academic label with numeric duration
      ['IELTS_AC_02', 'Cambridge 19 Test 1', 'Academic', '60', '', '', '', '', '', '', '']
    ];

    const parsed = parseExamRows(rows);
    expect(parsed).toHaveLength(3);

    expect(parsed[0].exam_code).toBe('PRAC_IELTS_01');
    expect(parsed[0].test_type).toBe('PRACTICE');
    expect(parsed[0].duration_mins).toBe(30);

    expect(parsed[1].exam_code).toBe('IELTS_RND_01');
    expect(parsed[1].test_type).toBe('TEST');
    expect(parsed[1].duration_mins).toBe(120);

    expect(parsed[2].exam_code).toBe('IELTS_AC_02');
    expect(parsed[2].test_type).toBe('TEST');
    expect(parsed[2].duration_mins).toBe(60);

    // Edge case: missing duration falls back cleanly
    expect(resolveExamTypeAndDuration('PRACTICE', '', 90)).toEqual({
      test_type: 'PRACTICE',
      duration_mins: 90
    });
  });

  it('2. Enforces single-channel Google Sheets submission write (never dual-writes Sheets API v4 + GAS)', () => {
    // When Service Account + Spreadsheet ID are configured, ONLY Sheets API v4 runs even if GAS URL is set
    expect(
      resolveSubmissionWriteChannel(
        true,
        '1abcSpreadsheetIdXYZ',
        'https://script.google.com/macros/s/AKfycbRealDeploy/exec'
      )
    ).toBe('sheets_api');

    // When Service Account is NOT configured, falls back to GAS ONLY if a real URL is configured
    expect(
      resolveSubmissionWriteChannel(
        false,
        '',
        'https://script.google.com/macros/s/AKfycbRealDeploy/exec'
      )
    ).toBe('gas_fallback');

    // When neither is configured (or mock URL), stays local_only
    expect(resolveSubmissionWriteChannel(false, '', '')).toBe('local_only');
    expect(resolveSubmissionWriteChannel(false, '', 'https://script.google.com/macros/s/AKfycbx_mock/exec')).toBe('local_only');

    // Verify hardcoded production GAS URL is removed from server/storage.ts
    const storageSrc = readProjectFile('server/storage.ts');
    expect(storageSrc).not.toContain('AKfycbySNk5foVr4UMC5ZVP1YTlxjxT9qFgdI85cH5nyQ63ffqXdYVZ7SJKbmD0B3xNO3DEe');
    expect(storageSrc).toContain("process.env.GAS_WEB_APP_URL || ''");

    // Verify server.ts routes both submission endpoints through dispatchSubmissionToSheets
    const serverSrc = readProjectFile('server.ts');
    expect(serverSrc).toContain('dispatchSubmissionToSheets(saved, saved)');
    expect(serverSrc).toContain('dispatchSubmissionToSheets(saved, submissionRecord)');
  });

  it('3. Aligns GAS CHEATLOGS to 6-column schema with dynamic 6/7-col detection & protects STUDENT_PROGRESS DECK_ID from Date coercion', () => {
    // 6-column default header matching production sheet
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain("'LOG_ID', 'SBD', 'EXAM_CODE', 'VIOLATION_TYPE', 'VIOLATION_COUNT', 'TIMESTAMP'");
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function detectCheatLogsSchema_(sheet)');

    // Swapped EXAMS column auto-detection in GAS
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function parseExamTypeAndDuration_(col2, col3, fallbackMins)');

    // STUDENT_PROGRESS plain-text Date guard
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function normalizeDeckIdCell_(val)');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function forcePlainTextCell_(val)');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain(".setNumberFormat('@')");
  });
});

describe('Priority 2: Server Security & AI Safeguards', () => {
  it('1. Blocks raw SVG payloads in persistBase64Image and protects /api/upload-image with Admin auth', () => {
    const svgXss = 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
    expect(persistBase64Image(svgXss, 'XSS_TEST')).toBe('');

    const serverSrc = readProjectFile('server.ts');
    expect(serverSrc).toContain("app.post('/api/upload-image', requireAdminMiddleware");
    expect(serverSrc).toContain('UNSUPPORTED_IMAGE_FORMAT');
    expect(serverSrc).toContain("res.setHeader('X-Content-Type-Options', 'nosniff')");

    const apiSrc = readProjectFile('src/services/api.ts');
    expect(apiSrc).toContain("getAdminAuthHeaders({ 'Content-Type': 'application/json' })");
  });

  it('2. Enforces HMAC-signed submission access token on GET /api/submissions/:id & hardens Admin auth', () => {
    const serverSrc = readProjectFile('server.ts');
    expect(serverSrc).toContain('signSubmissionAccessToken');
    expect(serverSrc).toContain('verifySubmissionAccessToken');
    expect(serverSrc).toContain('crypto.timingSafeEqual');
    expect(serverSrc).toContain("req.headers['x-submission-token']");
    expect(serverSrc).toContain('HAS_EXPLICIT_ADMIN_TOKEN');

    const envExample = readProjectFile('.env.example');
    expect(envExample).not.toContain('ADMIN_TOKEN="admin-secret"');
    expect(envExample).toContain('SESSION_SECRET=""');

    const deployYml = readProjectFile('.github/workflows/deploy.yml');
    expect(deployYml).not.toContain('VITE_GEMINI_API_KEY');
  });
});

describe('Priority 3: OOP + FP Architectural Modularization', () => {
  it('1. FileStorageRepository exposes clean Repository Pattern contracts', () => {
    const repo = new FileStorageRepository();
    expect(typeof repo.exams.findAll).toBe('function');
    expect(typeof repo.submissions.findById).toBe('function');
    expect(typeof repo.cheatLogs.append).toBe('function');
    expect(typeof repo.practiceDecks.save).toBe('function');
    expect(typeof repo.config.get).toBe('function');
  });

  it('2. ExamProviderChain resolves ordered Strategy providers and normalizes duplicate question IDs immutably', async () => {
    const sampleExam: ExamData = {
      exam_code: '  ielts_99  ',
      title: 'Strategy Pattern Test',
      passages: [],
      listening_questions: [
        {
          question_id: 'Q1',
          section: 'listening',
          question_type: IELTSQuestionType.MULTIPLE_CHOICE,
          question_text: 'First',
          options: ['A', 'B'],
          correct_answer: 'A',
          max_score: 1
        },
        {
          question_id: 'Q1',
          section: 'listening',
          question_type: IELTSQuestionType.MULTIPLE_CHOICE,
          question_text: 'Duplicate ID',
          options: ['A', 'B'],
          correct_answer: 'B',
          max_score: 1
        }
      ],
      reading_questions: []
    };

    const failingProvider: ExamProvider = {
      name: 'failing-cache',
      async fetch() {
        throw new Error('Cache offline');
      }
    };

    const emptyProvider: ExamProvider = {
      name: 'empty-primary',
      async fetch() {
        return null;
      }
    };

    const fallbackProvider: ExamProvider = {
      name: 'local-vault',
      async fetch() {
        return { source: 'local-vault', exam: sampleExam };
      }
    };

    const chain = new ExamProviderChain([failingProvider, emptyProvider, fallbackProvider]);
    const resolved = await chain.resolve({ examCode: 'ielts_99' });

    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe('local-vault');
    expect(resolved!.exam.exam_code).toBe('IELTS_99');
    expect(resolved!.exam.listening_questions?.map(q => q.question_id)).toEqual(['Q1', 'Q1_dup_1']);

    // Pure helpers do not mutate original question array
    const sanitized = sanitizeExamQuestions(sampleExam.listening_questions, 'l');
    expect(sanitized[1].question_id).toBe('Q1_dup_1');
    expect(sampleExam.listening_questions?.[1].question_id).toBe('Q1');
    expect(normalizeExamPayload(sampleExam).exam_code).toBe('IELTS_99');
  });

  it('3. App.tsx consumes modular useExamMetrics (useMemo) and useAdminSession hooks', () => {
    const appSrc = readProjectFile('src/App.tsx');
    expect(appSrc).toContain("from './hooks/useAdminSession'");
    expect(appSrc).toContain("from './hooks/useExamMetrics'");
    expect(appSrc).toContain('useAdminSession(setActiveView)');
    expect(appSrc).toContain('useExamMetrics(examData, retakeMode, targetSkill)');

    const metricsHookSrc = readProjectFile('src/hooks/useExamMetrics.ts');
    expect(metricsHookSrc).toContain('useMemo');
  });
});

describe('Static GitHub Pages Grading & Fill-in-Blank Safeguards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Keeps Col G omitted during fetchExamViaGviz while supporting post-submit fetchAnswerKeyViaGviz', async () => {
    const gvizSrc = readProjectFile('src/services/gvizService.ts');
    expect(gvizSrc).toContain("SELECT A, B, C, D, E, F, H WHERE UPPER(A) = '${cleanCode}'");
    expect(gvizSrc).toContain("SELECT A, B, G, H WHERE UPPER(A) = '${cleanCode}'");

    const mockKeyTable = {
      status: 'ok',
      table: {
        rows: [
          { c: [{ v: 'READING_SILK_01' }, { v: 'R1' }, { v: 'white' }, { v: 1 }] },
          { c: [{ v: 'READING_SILK_01' }, { v: 'R2' }, { v: 'paper' }, { v: 1 }] },
          { c: [{ v: 'READING_SILK_01' }, { v: 'R3' }, { v: 'industrialised' }, { v: 1 }] }
        ]
      }
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(mockKeyTable)});`
    } as Response);

    const res = await fetchAnswerKeyViaGviz('1AbCdEfGhIjKlMnOpQrStUvWxYz', 'READING_SILK_01');
    expect(res.success).toBe(true);
    expect(res.answerKeys['R1']).toEqual({ correct_answer: 'white', max_score: 1 });
    expect(res.answerKeys['R2']).toEqual({ correct_answer: 'paper', max_score: 1 });
    expect(res.answerKeys['R3']).toEqual({ correct_answer: 'industrialised', max_score: 1 });
  });

  it('2. submitExamPayload uses GAS question_results when readable AND falls back to post-submit GViz when opaque/static', async () => {
    const silkExamWithoutKeys: ExamData = {
      exam_code: 'READING_SILK_01',
      title: 'The Story of Silk',
      passages: [
        {
          passage_index: 1,
          title: 'Passage 1',
          text: 'Silk history passage.',
          questions: [
            {
              question_id: 'R1',
              section: 'reading',
              question_type: 'fill_in_blank',
              question_text: 'Silk threads were originally _____ in colour.',
              max_score: 1
            },
            {
              question_id: 'R2',
              section: 'reading',
              question_type: 'fill_in_blank',
              question_text: 'Silk was used to make _____ and currency.',
              max_score: 1
            },
            {
              question_id: 'R3',
              section: 'reading',
              question_type: 'fill_in_blank',
              question_text: 'Production later became _____.',
              max_score: 1
            }
          ]
        }
      ],
      listening_questions: [],
      reading_questions: []
    };

    setStoredSpreadsheetId('1AbCdEfGhIjKlMnOpQrStUvWxYz');

    // Scenario A: Static site without Node backend, GAS returns opaque/unavailable -> post-submit GViz hydrates Col G
    const mockKeyTable = {
      status: 'ok',
      table: {
        rows: [
          { c: [{ v: 'READING_SILK_01' }, { v: 'R1' }, { v: 'white' }, { v: 1 }] },
          { c: [{ v: 'READING_SILK_01' }, { v: 'R2' }, { v: 'paper' }, { v: 1 }] },
          { c: [{ v: 'READING_SILK_01' }, { v: 'R3' }, { v: 'industrialised' }, { v: 1 }] }
        ]
      }
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/api/submit')) {
        return { ok: false, status: 404, text: async () => '' } as Response;
      }
      if (u.includes('gviz/tq')) {
        return {
          ok: true,
          status: 200,
          text: async () => `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(mockKeyTable)});`
        } as Response;
      }
      return { ok: false, status: 500, text: async () => '' } as Response;
    });

    const resultA = await submitExamPayload(
      '',
      {
        sbd: 'SILK_CAND_01',
        exam_code: 'READING_SILK_01',
        test_mode: 'PRACTICE',
        answers: { R1: 'white', R2: 'wood', R3: 'industrialized' },
        reading_answers: { R1: 'white', R2: 'wood', R3: 'industrialized' },
        writing_task1_text: '',
        writing_task2_text: ''
      },
      silkExamWithoutKeys
    );

    expect(resultA.reading_raw_score).toBe(2);
    expect(resultA.reading_max_score).toBe(3);
    expect(resultA.detailed_results?.['R1']?.is_correct).toBe(true);
    expect(resultA.detailed_results?.['R1']?.acceptable_answers).toContain('white');
    expect(resultA.detailed_results?.['R2']?.is_correct).toBe(false);
    expect(resultA.detailed_results?.['R2']?.acceptable_answers).toContain('paper');
    // US/UK spelling equivalence: 'industrialized' matches 'industrialised'
    expect(resultA.detailed_results?.['R3']?.is_correct).toBe(true);
    expect(isAnswerCorrect('industrialized', 'industrialised')).toBe(true);

    // Scenario B: GAS returns readable authoritative question_results directly (Cách 2)
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/api/submit')) {
        return { ok: false, status: 404, text: async () => '' } as Response;
      }
      if (u.includes('script.google.com')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'success',
              success: true,
              submission_id: 'GAS_GRADED_01',
              reading_raw_score: 3,
              reading_max_score: 3,
              reading_band: 9.0,
              overall_band: 9.0,
              question_results: [
                { question_id: 'R1', section: 'reading', user_answer: 'white', correct_answer: 'white', acceptable_answers: ['white'], is_correct: true, max_score: 1, earned_score: 1 },
                { question_id: 'R2', section: 'reading', user_answer: 'paper', correct_answer: 'paper', acceptable_answers: ['paper'], is_correct: true, max_score: 1, earned_score: 1 },
                { question_id: 'R3', section: 'reading', user_answer: 'industrialised', correct_answer: 'industrialised', acceptable_answers: ['industrialised'], is_correct: true, max_score: 1, earned_score: 1 }
              ]
            })
        } as Response;
      }
      throw new Error('Unexpected fetch call: ' + u);
    });

    const resultB = await submitExamPayload(
      'https://script.google.com/macros/s/AKfycbTestDeploy/exec',
      {
        sbd: 'SILK_CAND_02',
        exam_code: 'READING_SILK_01',
        test_mode: 'TEST',
        answers: { R1: 'white', R2: 'paper', R3: 'industrialised' },
        reading_answers: { R1: 'white', R2: 'paper', R3: 'industrialised' },
        writing_task1_text: '',
        writing_task2_text: ''
      },
      silkExamWithoutKeys
    );

    expect(resultB.reading_raw_score).toBe(3);
    expect(resultB.reading_band).toBe(9.0);
    expect(resultB.detailed_results?.['R2']?.correct_answer).toBe('paper');
    expect(resultB.detailed_results?.['R2']?.is_correct).toBe(true);
  });

  it('3. Normalizes whitespace and completion aliases for fill-in-blank inputs & updates GAS script grading', () => {
    expect(canonicalizeQuestionType('  fill_in_blank  ')).toBe(IELTSQuestionType.FILL_IN_THE_BLANK);
    expect(canonicalizeQuestionType(' FILL IN BLANK ')).toBe(IELTSQuestionType.FILL_IN_THE_BLANK);
    expect(canonicalizeQuestionType(' note_completion ')).toBe(IELTSQuestionType.FILL_IN_THE_BLANK);
    expect(canonicalizeQuestionType('gap_fill')).toBe(IELTSQuestionType.FILL_IN_THE_BLANK);

    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('detailed_results: detailedResults');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('question_results: questionResults');

    const resultPageSrc = readProjectFile('src/components/Student/ResultPage.tsx');
    expect(resultPageSrc).toContain('qRes?.correct_answer');
  });
});

