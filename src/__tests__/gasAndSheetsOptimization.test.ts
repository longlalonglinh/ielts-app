import { describe, it, expect, beforeEach, vi } from 'vitest';
import vm from 'vm';
import { GOOGLE_APPS_SCRIPT_CODE, gasScriptCodeTemplate } from '../data/gasScriptCode';
import {
  safeSaveSubmissionsToLocalStorage,
  buildExamFromGasRawResponse,
  fetchExam,
  clearExamCache
} from '../services/api';

describe('GAS V3.0 & Google Sheets Storage Optimization Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Compiles GOOGLE_APPS_SCRIPT_CODE cleanly with zero JS syntax errors', () => {
    expect(() => new vm.Script(GOOGLE_APPS_SCRIPT_CODE)).not.toThrow();
    expect(gasScriptCodeTemplate).toBe(GOOGLE_APPS_SCRIPT_CODE);
  });

  it('2. Verifies batch I/O helpers and eliminates row-by-row deleteRow/appendRow loops in mutations', () => {
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function batchAppendRows_(');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function replaceRowsByKey_(');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function optimizeSheetsStorage(');

    // Ensure uploadexam, initpracticedb, and savepracticedeck do not call deleteRow or appendRow directly
    const doPostSection = GOOGLE_APPS_SCRIPT_CODE.slice(
      GOOGLE_APPS_SCRIPT_CODE.indexOf('function doPost(e)')
    );
    expect(doPostSection).not.toContain('.deleteRow(');
    expect(doPostSection).not.toContain('.appendRow(');
  });

  it('3. Verifies chunk-safe CacheService, cell overflow/formula sanitization, and STUDENT_PROGRESS handlers', () => {
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function putCacheSafe_(');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function getCacheSafe_(');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function sanitizeCell_(');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain("action === 'syncstudentprogress'");
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain("action === 'getstudentprogress'");
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain("action === 'optimizesheets'");
    // Fixes get_exams created_at column index bug (must read J:K instead of Col I image)
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('sheetE.getRange(2, 10, lastExRow - 1, 2).getValues()');
    // Prevents 10-minute negative caching of empty get_exam responses
    expect(gasScriptCodeTemplate).toContain('if (examCode && (examMeta !== null || questions.length > 0))');
  });

  it('4. safeSaveSubmissionsToLocalStorage strips heavy detailed_results and caps array length', () => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => {},
      length: 0,
      key: () => null
    };
    const prevWin = (globalThis as any).window;
    const prevLS = (globalThis as any).localStorage;
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = mockStorage;

    try {
      const dummySubs = Array.from({ length: 75 }, (_, i) => ({
        submission_id: `SUB_${i}`,
        sbd: `SBD_${i}`,
        exam_code: 'TEST01',
        test_mode: 'TEST' as const,
        listening_answers: {},
        reading_answers: {},
        submitted_at: new Date().toISOString(),
        detailed_results: { Q1: { huge: 'payload'.repeat(200) } }
      }));

      safeSaveSubmissionsToLocalStorage(dummySubs as any);

      const saved = JSON.parse(store['ielts_student_submissions']);
      expect(saved.length).toBe(50);
      expect(saved[0].detailed_results).toBeUndefined();
      expect(saved[0].submission_id).toBe('SUB_0');
    } finally {
      (globalThis as any).window = prevWin;
      (globalThis as any).localStorage = prevLS;
    }
  });

  it('5. buildExamFromGasRawResponse reconstructs passage-only (multi-passage) and image-only exams, rejecting empty hits', () => {
    // Empty GAS hit must return null
    const emptyHit = buildExamFromGasRawResponse(
      { status: 'success', success: true, exam_code: 'NOPE', exam_meta: null, questions: [] },
      'NOPE'
    );
    expect(emptyHit).toBeNull();

    // Reading-passage-only exam with --- Passage Divider --- and 0 objective questions
    const passageExam = buildExamFromGasRawResponse(
      {
        status: 'success',
        success: true,
        exam_code: 'READONLY1',
        exam_meta: {
          exam_code: 'READONLY1',
          title: 'Reading Only Multi-Passage',
          duration_mins: 60,
          reading_passage: 'Passage One Body --- Passage Divider --- Passage Two Body'
        },
        questions: []
      },
      'READONLY1'
    );
    expect(passageExam).not.toBeNull();
    expect(passageExam!.passages.length).toBe(2);
    expect(passageExam!.passages[0].text).toBe('Passage One Body');
    expect(passageExam!.passages[1].text).toBe('Passage Two Body');
    expect(passageExam!.duration_mins).toBe(60);

    // Writing-image-only exam with 0 objective questions and empty prompts
    const imageWritingExam = buildExamFromGasRawResponse(
      {
        status: 'success',
        success: true,
        exam_code: 'WRTIMG1',
        exam_meta: {
          exam_code: 'WRTIMG1',
          title: 'Task 1 Chart Only',
          writing_task1_image: 'https://example.com/chart.png'
        },
        questions: []
      },
      'WRTIMG1'
    );
    expect(imageWritingExam).not.toBeNull();
    expect(imageWritingExam!.writing_task1_image).toBe('https://example.com/chart.png');
    expect(imageWritingExam!.skills).toContain('writing');
  });

  it('6. fetchExam passes ?force=true on forceFresh and succeeds from GAS with reading_passage', async () => {
    const calledUrls: string[] = [];
    const fakeGasUrl = 'https://script.google.com/macros/s/AKfycbzLiveTestDeployment/exec';
    const prevFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      calledUrls.push(url);
      if (url.includes('/api/exams/SHEETPASS01') && !url.includes('save')) {
        return new Response(JSON.stringify({ success: false, error: 'Not in local cache' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith(fakeGasUrl)) {
        return new Response(
          JSON.stringify({
            status: 'success',
            success: true,
            exam_code: 'SHEETPASS01',
            exam_meta: {
              exam_code: 'SHEETPASS01',
              title: 'Synced Sheet Exam',
              duration_mins: 90,
              reading_passage: 'Solo passage from Sheet'
            },
            questions: []
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;

    try {
      await clearExamCache('SHEETPASS01');
      const res = await fetchExam(fakeGasUrl, 'SHEETPASS01', true);
      expect(res.success).toBe(true);
      expect(res.source).toBe('gas');
      expect(res.exam?.passages.length).toBeGreaterThanOrEqual(1);
      expect(res.exam?.passages[0].text).toBe('Solo passage from Sheet');
      expect(calledUrls.some(u => u.includes('/api/exams/SHEETPASS01?force=true'))).toBe(true);
    } finally {
      await clearExamCache('SHEETPASS01');
      globalThis.fetch = prevFetch;
    }
  });

  it('7. Server /api/sync-sheet supports GAS fallback and Google Sheets sync explicitly marks exams published', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
    const sheetsSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/googleSheetsService.ts'), 'utf-8');

    expect(serverSrc).toContain('async function fetchExamFromGasBridge(');
    expect(serverSrc).toContain("source: 'gas_bridge'");
    expect(sheetsSrc).toContain("status: 'published'");
    expect(sheetsSrc).toContain('is_draft: false');
  });

  it('8. buildExamFromGasRawResponse rejects empty GAS responses even when existingCached has a Task 1 diagram', () => {
    const existingCached = {
      exam_code: 'TEST01',
      title: 'Cached Exam',
      writing_task1_image: 'https://example.com/cached-chart.png',
      listening_questions: [{ question_id: 'L1', section: 'listening', question_text: 'Q1', question_type: 'multiple_choice', correct_answer: 'A', max_score: 1 }],
      reading_questions: []
    } as any;

    const emptyDataArray = buildExamFromGasRawResponse({ success: true, data: [] }, 'TEST01', existingCached);
    expect(emptyDataArray).toBeNull();

    const emptyMetaNull = buildExamFromGasRawResponse(
      { status: 'success', success: true, exam_code: 'TEST01', exam_meta: null, questions: [] },
      'TEST01',
      existingCached
    );
    expect(emptyMetaNull).toBeNull();
  });

  it('9. fetchExam does not re-hit /api/exams/:code in Tier 8 when Tier 2 returned authoritative 404', async () => {
    const calledUrls: string[] = [];
    const fakeGasUrl = 'https://script.google.com/macros/s/AKfycbzLiveTestDeployment/exec';
    const prevFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      calledUrls.push(url);
      if (url.includes('/api/exams/MISSING999')) {
        return new Response(JSON.stringify({ success: false, error: 'Exam not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith(fakeGasUrl)) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    try {
      await clearExamCache('MISSING999');
      const res = await fetchExam(fakeGasUrl, 'MISSING999', false);
      expect(res.success).toBe(false);
      const apiExamCalls = calledUrls.filter(u => u.includes('/api/exams/MISSING999'));
      expect(apiExamCalls.length).toBe(1);
    } finally {
      await clearExamCache('MISSING999');
      globalThis.fetch = prevFetch;
    }
  });
});
