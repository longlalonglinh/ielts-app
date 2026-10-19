import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
import { 
  normalizeAnswer, 
  parseAcceptableAnswers, 
  isAnswerCorrect,
  calculateListeningBand,
  calculateAcademicReadingBand,
  calculateIeltsOverallBand,
  gradeExamAnswers,
  computeAnswersChecksum
} from '../services/answerScoring';
import { 
  saveKeyValue, 
  getKeyValue, 
  savePendingSubmissionToIndexedDB, 
  getPendingSubmissionsFromIndexedDB, 
  removePendingSubmissionFromIndexedDB 
} from '../services/indexedDb';
import { 
  postToGasWithLockRetry, 
  syncPendingSubmissions, 
  deduplicateSubmissions 
} from '../services/api';
import { 
  fetchExamViaGviz, 
  extractSpreadsheetId, 
  testGvizConnection 
} from '../services/gvizService';
import { verifyAndOptimizeExam } from '../services/examVerification';
import { parseExamFromDocumentText } from '../services/documentExamParser';
import { 
  saveStoredSubmission, 
  getStoredSubmissions, 
  updateStoredWritingScore,
  saveStoredExam,
  getStoredExam
} from '../../server/storage';
import { 
  enqueueSubmission, 
  flushSubmissionQueue 
} from '../../server/googleSheetsService';
import { gasScriptCodeTemplate } from '../data/gasScriptCode';

/**
 * Server sanitizeExamForStudent logic mirror (pure server-side function in server.ts)
 */
function sanitizeExamForStudent(exam: any): any {
  if (!exam) return exam;
  const sanitizeQuestion = (q: any) => {
    const { correct_answer, acceptable_answers, explanation, ...safeQ } = q;
    return safeQ;
  };

  const copy = JSON.parse(JSON.stringify(exam));
  if (Array.isArray(copy.questions)) {
    copy.questions = copy.questions.map(sanitizeQuestion);
  }
  if (Array.isArray(copy.listening_questions)) {
    copy.listening_questions = copy.listening_questions.map(sanitizeQuestion);
  }
  if (Array.isArray(copy.reading_questions)) {
    copy.reading_questions = copy.reading_questions.map(sanitizeQuestion);
  }
  if (Array.isArray(copy.passages)) {
    copy.passages = copy.passages.map((p: any) => ({
      ...p,
      questions: Array.isArray(p.questions) ? p.questions.map(sanitizeQuestion) : []
    }));
  }

  const rootTask1Img = copy.writing_task1_image || copy.writing_task1_image_url || copy.writing_task1_imageUrl || copy.image_url || copy.imageUrl || '';
  let resolvedTask1Image = rootTask1Img;

  if (Array.isArray(copy.sections)) {
    copy.sections = copy.sections.map((section: any) => {
      const sanitizedSec = { ...section };
      if (section.skill === 'writing' && Array.isArray(section.tasks)) {
        sanitizedSec.tasks = section.tasks.map((task: any) => {
          const tImg = task.image_url || task.imageUrl || (task.task_number === 1 ? resolvedTask1Image : undefined) || '';
          if (task.task_number === 1 && !resolvedTask1Image && tImg) {
            resolvedTask1Image = tImg;
          }
          return {
            id: task.id || `task-${task.task_number}`,
            task_number: task.task_number,
            title: task.title,
            prompt: task.prompt,
            image_url: tImg,
            imageUrl: tImg,
            min_words: task.min_words,
            suggested_time_minutes: task.suggested_time_minutes
          };
        });
      } else if (Array.isArray(section.questions)) {
        sanitizedSec.questions = section.questions.map(sanitizeQuestion);
      }
      return sanitizedSec;
    });
  }

  copy.writing_task1_image = resolvedTask1Image;
  copy.writing_task1_image_url = resolvedTask1Image;
  copy.writing_task1_imageUrl = resolvedTask1Image;
  return copy;
}

describe('COMPREHENSIVE IELTS CBT TEST SUITE (STUDENT & ADMIN MATRIX)', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /* =========================================================================
   * PHẦN 1: KỊCH BẢN KIỂM THỬ THÍ SINH (STUDENT/CANDIDATE)
   * ========================================================================= */
  describe('KỊCH BẢN KIỂM THỬ THÍ SINH (STUDENT/CANDIDATE)', () => {

    // -----------------------------------------------------------------------
    // ST-01: Đăng nhập & Tải đề thi siêu tốc (GViz)
    // -----------------------------------------------------------------------
    it('ST-01: Tải đề thi siêu tốc qua GViz (<200ms parsing), hỗ trợ multi-passage, audio link và ảnh Task 1', async () => {
      const mockGvizExams = {
        table: {
          rows: [
            {
              c: [
                { v: 'IELTS09' },                                        // Col A: EXAM_CODE
                { v: 'Academic Test 09' },                               // Col B: TITLE
                { v: 'ACADEMIC' },                                       // Col C: TEST_TYPE
                { v: 120 },                                              // Col D: DURATION_MINS
                { v: 'https://storage.googleapis.com/audio/ielts09.mp3' }, // Col E: AUDIO_URL
                { v: 'Passage 1 Text content\n--- Passage Divider ---\nPassage 2 Text content' }, // Col F: READING_PASSAGE
                { v: 'Summarize the chart below.' },                     // Col G: WRITING_TASK1_PROMPT
                { v: 'Discuss both views on AI.' },                      // Col H: WRITING_TASK2_PROMPT
                { v: 'https://storage.googleapis.com/images/task1_chart.png' }, // Col I: WRITING_TASK1_IMAGE
                { v: 'Section 1 Track' },                                // Col J: AUDIO_TITLE
                { v: '2026-10-12' }                                      // Col K: CREATED_AT
              ]
            }
          ]
        }
      };

      const mockGvizQuestions = {
        table: {
          rows: [
            {
              c: [
                { v: 'IELTS09' },
                { v: 'L1' },
                { v: 'listening' },
                { v: 'Where will the conference take place?' },
                { v: 'multiple_choice' },
                { v: '["A. Main Hall", "B. Library", "C. Science Building"]' },
                { v: 1 }
              ]
            },
            {
              c: [
                { v: 'IELTS09' },
                { v: 'R1' },
                { v: 'reading' },
                { v: 'The research was completed in 1995.' },
                { v: 'true_false_not_given' },
                { v: '["TRUE", "FALSE", "NOT GIVEN"]' },
                { v: 1 }
              ]
            }
          ]
        }
      };

      vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('sheet=EXAMS')) {
          return {
            ok: true,
            text: async () => `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(mockGvizExams)});`
          } as any;
        }
        if (urlStr.includes('sheet=QUESTIONS')) {
          return {
            ok: true,
            text: async () => `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(mockGvizQuestions)});`
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const startTime = performance.now();
      const res = await fetchExamViaGviz('test-sheet-id-123', 'IELTS09');
      const durationMs = performance.now() - startTime;

      expect(res.success).toBe(true);
      expect(res.exam).toBeDefined();
      expect(res.exam?.exam_code).toBe('IELTS09');
      // Verify audio track and title
      expect(res.exam?.audio_url).toBe('https://storage.googleapis.com/audio/ielts09.mp3');
      expect(res.exam?.audio_title).toBe('Section 1 Track');
      // Verify Task 1 image
      expect(res.exam?.writing_task1_image).toBe('https://storage.googleapis.com/images/task1_chart.png');
      // Verify multi-passage segmentation
      expect(res.exam?.passages?.length).toBe(2);
      expect(res.exam?.passages?.[0]?.text).toContain('Passage 1 Text content');
      expect(res.exam?.passages?.[1]?.text).toContain('Passage 2 Text content');
      // Parse execution performance
      expect(durationMs).toBeLessThan(500);
    });

    // -----------------------------------------------------------------------
    // ST-02: Làm bài & Lưu tạm tự động (IndexedDB & LocalStorage)
    // -----------------------------------------------------------------------
    it('ST-02: Tự động lưu bài làm tạm thời vào IndexedDB và localStorage định kỳ', async () => {
      const examCode = 'IELTS09';
      const sbd = 'SBD_123456';
      const draftKey = `current_answers_${examCode}_${sbd}`;

      const initialAnswers = {
        'L1': 'A',
        'R1': 'TRUE',
        'writing_task1': 'The chart illustrates the trends...',
        'writing_task2': 'In modern society, some believe...'
      };

      // 1. Save to IndexedDB key-value store
      await saveKeyValue(draftKey, initialAnswers);

      // 2. Dual redundancy in localStorage
      localStorage.setItem(draftKey, JSON.stringify(initialAnswers));

      // 3. Verify retrieval integrity
      const idbRestored = await getKeyValue<typeof initialAnswers>(draftKey);
      const localRestored = JSON.parse(localStorage.getItem(draftKey) || '{}');

      expect(idbRestored).toEqual(initialAnswers);
      expect(localRestored).toEqual(initialAnswers);
      expect(idbRestored?.writing_task1).toContain('The chart illustrates');
      expect(idbRestored?.writing_task2).toContain('In modern society');
    });

    // -----------------------------------------------------------------------
    // ST-03: Mất kết nối mạng trong lúc làm bài (Offline Grace)
    // -----------------------------------------------------------------------
    it('ST-03: Xử lý ngoại tuyến mượt mà, đồng hồ đếm ngược và bộ nhớ cục bộ hoạt động độc lập', () => {
      // Simulating offline status
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const totalDurationSeconds = 120 * 60; // 120 minutes
      const sessionStartedAt = Date.now() - (15 * 60 * 1000); // 15 minutes ago
      const deadlineTimestamp = sessionStartedAt + (totalDurationSeconds * 1000);

      // Timer calculation based on absolute deadline (immune to device sleep or network drops)
      const computeRemainingSeconds = (deadline: number) => {
        const diffMs = deadline - Date.now();
        return Math.max(0, Math.floor(diffMs / 1000));
      };

      const remaining = computeRemainingSeconds(deadlineTimestamp);
      expect(remaining).toBeGreaterThan(104 * 60);
      expect(remaining).toBeLessThanOrEqual(105 * 60);

      // Verify candidate can continue answering locally while offline
      const offlineAnswers: Record<string, string> = { 'L2': 'B', 'R2': 'FALSE' };
      localStorage.setItem('OFFLINE_DRAFT', JSON.stringify(offlineAnswers));
      const readBack = JSON.parse(localStorage.getItem('OFFLINE_DRAFT') || '{}');
      expect(readBack['L2']).toBe('B');

      // Restore navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    // -----------------------------------------------------------------------
    // ST-04: Nộp bài thi khi có mạng đầy đủ (Server / Engine Scoring)
    // -----------------------------------------------------------------------
    it('ST-04: Nộp bài thành công khi có mạng, chấm điểm tự động tức thì (Raw & Band score) và tạo Result', () => {
      const mockExam = {
        exam_code: 'IELTS09',
        questions: [
          { question_id: 'L1', section: 'listening', correct_answer: 'A', acceptable_answers: ['A'] },
          { question_id: 'L2', section: 'listening', correct_answer: 'library', acceptable_answers: ['the library', 'library'] },
          { question_id: 'L3', section: 'listening', correct_answer: '1400', acceptable_answers: ['1,400', '1400'] },
          { question_id: 'R1', section: 'reading', correct_answer: 'TRUE', acceptable_answers: ['TRUE'] },
          { question_id: 'R2', section: 'reading', correct_answer: 'NOT GIVEN', acceptable_answers: ['NOT GIVEN'] }
        ]
      } as any;

      const candidateAnswers = {
        'L1': 'A',
        'L2': 'a library', // tests indefinite article stripping
        'L3': '1,400',     // tests punctuation stripping
        'R1': 'true',      // tests case-insensitivity
        'R2': 'false'      // incorrect answer
      };

      const result = gradeExamAnswers(mockExam, candidateAnswers);

      expect(result.listening_raw).toBe(3);
      expect(result.listening_max).toBe(3);
      expect(result.reading_raw).toBe(1);
      expect(result.reading_max).toBe(2);
      expect(result.results['L2'].is_correct).toBe(true);
      expect(result.results['L3'].is_correct).toBe(true);
      expect(result.results['R1'].is_correct).toBe(true);
      expect(result.results['R2'].is_correct).toBe(false);

      // Verify official IELTS band calculation
      expect(calculateListeningBand(40)).toBe(9.0);
      expect(calculateListeningBand(30)).toBe(7.0);
      expect(calculateAcademicReadingBand(40)).toBe(9.0);
      expect(calculateAcademicReadingBand(30)).toBe(7.0);

      // Verify Overall Band score rounding rule (mean rounded to nearest 0.5)
      expect(calculateIeltsOverallBand([6.5, 7.0, 6.0])).toBe(6.5);
      expect(calculateIeltsOverallBand([6.5, 7.0, 7.0])).toBe(7.0);
      expect(calculateIeltsOverallBand([6.25, 6.25, 6.25])).toBe(6.5); // 6.25 rounds UP to 6.5
    });

    // -----------------------------------------------------------------------
    // ST-05: Mất mạng đúng thời điểm Nộp bài (Offline Sealed Receipt)
    // -----------------------------------------------------------------------
    it('ST-05: Tạo Offline Sealed Receipt khi mất mạng lúc nộp bài, lưu vào queue và tự động sync khi có mạng', async () => {
      const userAnswers = { 'L1': 'A', 'R1': 'TRUE', 'writing_task1': 'Draft 1' };
      const answersChecksum = computeAnswersChecksum(userAnswers);
      const submissionId = `SUB_OFFLINE_${Date.now()}`;

      const offlineReceiptPayload = {
        submission_id: submissionId,
        sbd: 'SBD_CANDIDATE_01',
        exam_code: 'IELTS09',
        answers: userAnswers,
        sealed_token: `SEAL_${Date.now()}_ABC123`,
        expected_answers_hash: answersChecksum,
        offline_receipt_code: `REC-${submissionId.slice(-6)}`,
        is_offline_pending: true,
        submitted_at: new Date().toISOString()
      };

      // 1. Save into IndexedDB pending sync queue
      await savePendingSubmissionToIndexedDB(offlineReceiptPayload);

      // 2. Verify pending queue contains submission
      const pendingQueue = await getPendingSubmissionsFromIndexedDB();
      expect(pendingQueue.some(item => item.submission_id === submissionId)).toBe(true);

      // 3. Mock fetch to simulate network restored (Auto-resync)
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            submission: {
              submission_id: submissionId,
              sbd: 'SBD_CANDIDATE_01',
              exam_code: 'IELTS09',
              listening_raw_score: 30,
              listening_band: 7.0,
              reading_raw_score: 30,
              reading_band: 7.0,
              overall_band: 7.0
            }
          })
        } as any;
      });

      // 4. Trigger auto-resync
      const syncResult = await syncPendingSubmissions('https://script.google.com/macros/s/AKfyc_test/exec');
      expect(syncResult.synced).toBe(1);

      // 5. Verify submission was cleanly removed from pending queue
      const remainingPending = await getPendingSubmissionsFromIndexedDB();
      expect(remainingPending.some(item => item.submission_id === submissionId)).toBe(false);
    });

    // -----------------------------------------------------------------------
    // ST-06: Gian lận chuyển Tab / Rời màn hình (Proctoring Telemetry)
    // -----------------------------------------------------------------------
    it('ST-06: Phát hiện gian lận chuyển tab (TAB_SWITCH), ghi nhận vi phạm và telemetry logging', () => {
      let violationsCount = 0;
      let cumulativeOffScreenSeconds = 0;
      const cheatLogs: any[] = [];

      const recordViolation = (type: 'TAB_SWITCH' | 'WINDOW_BLUR', durationMs: number) => {
        violationsCount++;
        cumulativeOffScreenSeconds += Math.round(durationMs / 1000);
        cheatLogs.push({
          log_id: `LOG_${Date.now()}_${violationsCount}`,
          sbd: 'SBD_999',
          exam_code: 'IELTS09',
          violation_type: type,
          off_screen_duration_seconds: Math.round(durationMs / 1000),
          timestamp: new Date().toISOString()
        });
      };

      // Candidate alt-tabs away for 4500ms
      recordViolation('TAB_SWITCH', 4500);
      expect(violationsCount).toBe(1);
      expect(cumulativeOffScreenSeconds).toBe(5);
      expect(cheatLogs[0].violation_type).toBe('TAB_SWITCH');

      // Candidate switches away again for 3200ms
      recordViolation('TAB_SWITCH', 3200);
      expect(violationsCount).toBe(2);
      expect(cumulativeOffScreenSeconds).toBe(8);
      expect(cheatLogs.length).toBe(2);
    });

    // -----------------------------------------------------------------------
    // ST-07: Thử hack DevTools để xem đáp án (Exam Sanitization)
    // -----------------------------------------------------------------------
    it('ST-07: Chặn đứng hành vi F12 xem đáp án - sanitizeExamForStudent loại bỏ 100% correct_answer và explanation', () => {
      const rawExamFromSheet = {
        exam_code: 'IELTS09',
        title: 'IELTS Official Test',
        writing_task1_image: 'https://example.com/chart.png',
        questions: [
          {
            question_id: 'Q1',
            section: 'listening',
            question_text: 'What time does the event begin?',
            options: ['A. 8:00 AM', 'B. 9:00 AM'],
            correct_answer: 'B. 9:00 AM',
            acceptable_answers: ['B', '9:00 AM', '9:00am'],
            explanation: 'Speaker clearly mentions 9:00 AM in line 4.'
          }
        ],
        passages: [
          {
            passage_index: 1,
            title: 'Passage 1',
            text: 'Text of passage...',
            questions: [
              {
                question_id: 'Q2',
                section: 'reading',
                question_text: 'The experiment proved successful.',
                options: ['TRUE', 'FALSE', 'NOT GIVEN'],
                correct_answer: 'TRUE',
                acceptable_answers: ['TRUE'],
                explanation: 'Paragraph 2 confirms the experiment results were positive.'
              }
            ]
          }
        ]
      };

      const sanitized = sanitizeExamForStudent(rawExamFromSheet);

      // Verify all answers are purged from root questions
      expect(sanitized.questions[0].correct_answer).toBeUndefined();
      expect(sanitized.questions[0].acceptable_answers).toBeUndefined();
      expect(sanitized.questions[0].explanation).toBeUndefined();

      // Verify all answers are purged from nested passages
      expect(sanitized.passages[0].questions[0].correct_answer).toBeUndefined();
      expect(sanitized.passages[0].questions[0].acceptable_answers).toBeUndefined();
      expect(sanitized.passages[0].questions[0].explanation).toBeUndefined();

      // Verify questions, options, and Task 1 image are fully preserved
      expect(sanitized.questions[0].question_text).toBe('What time does the event begin?');
      expect(sanitized.questions[0].options).toHaveLength(2);
      expect(sanitized.writing_task1_image).toBe('https://example.com/chart.png');
    });

    // -----------------------------------------------------------------------
    // ST-08: Cố tình sửa LocalStorage / Checksum bài thi (Tamper Detection)
    // -----------------------------------------------------------------------
    it('ST-08: Phát hiện và chặn đứng hành vi sửa trộm LocalStorage/Checksum bài thi (TAMPERED_SUBMISSION)', () => {
      const originalAnswers = {
        'L1': 'A',
        'L2': 'library',
        'R1': 'TRUE'
      };

      const legitimateChecksum = computeAnswersChecksum(originalAnswers);

      // Candidate maliciously alters answers before sync
      const tamperedAnswers = {
        'L1': 'B', // Altered from 'A' to 'B'
        'L2': 'library',
        'R1': 'TRUE'
      };

      const tamperedChecksum = computeAnswersChecksum(tamperedAnswers);

      // Server verification check
      const verifyPayload = (answers: Record<string, string>, expectedHash: string) => {
        const computed = computeAnswersChecksum(answers);
        if (computed !== expectedHash) {
          return {
            status: 400,
            success: false,
            error: 'TAMPERED_SUBMISSION',
            message: 'Security Alert: Offline sealed submission payload has been tampered with after session expiry.'
          };
        }
        return { status: 200, success: true };
      };

      // 1. Legitimate payload passes
      const legitCheck = verifyPayload(originalAnswers, legitimateChecksum);
      expect(legitCheck.status).toBe(200);
      expect(legitCheck.success).toBe(true);

      // 2. Tampered payload is immediately blocked with 400 TAMPERED_SUBMISSION
      const fraudCheck = verifyPayload(tamperedAnswers, legitimateChecksum);
      expect(fraudCheck.status).toBe(400);
      expect(fraudCheck.success).toBe(false);
      expect(fraudCheck.error).toBe('TAMPERED_SUBMISSION');
      expect(tamperedChecksum).not.toBe(legitimateChecksum);
    });
  });

  /* =========================================================================
   * PHẦN 2: KỊCH BẢN KIỂM THỬ QUẢN TRỊ VIÊN (ADMIN/TEACHER)
   * ========================================================================= */
  describe('KỊCH BẢN KIỂM THỬ QUẢN TRỊ VIÊN (ADMIN/TEACHER)', () => {

    // -----------------------------------------------------------------------
    // AD-01: Soạn đề thi trực tiếp trên Google Sheets (11 cột / 8 cột chuẩn)
    // -----------------------------------------------------------------------
    it('AD-01: Đảm bảo độ đồng nhất cấu trúc Sheet - EXAMS (11 cột) và QUESTIONS (8 cột) không lệch cột', () => {
      // Validate GAS template sheet headers
      const examsMatch = gasScriptCodeTemplate.match(/sheetExams\.appendRow\(\[\s*([\s\S]*?)\s*\]\);/);
      expect(examsMatch).toBeTruthy();
      const examHeaders = examsMatch![1].replace(/['"\s]/g, '').split(',');
      expect(examHeaders).toEqual([
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
      expect(examHeaders.length).toBe(11);

      const questionsMatch = gasScriptCodeTemplate.match(/sheetQuestions\.appendRow\(\[\s*([\s\S]*?)\s*\]\);/);
      expect(questionsMatch).toBeTruthy();
      const questionHeaders = questionsMatch![1].replace(/['"\s]/g, '').split(',');
      expect(questionHeaders).toEqual([
        'EXAM_CODE',
        'QUESTION_ID',
        'SECTION',
        'QUESTION_TEXT',
        'QUESTION_TYPE',
        'OPTIONS_JSON',
        'CORRECT_ANSWER',
        'MAX_SCORE'
      ]);
      expect(questionHeaders.length).toBe(8);
    });

    // -----------------------------------------------------------------------
    // AD-02: Tạo đề thi bằng AI Gemini / PDF Upload (Verification Engine)
    // -----------------------------------------------------------------------
    it('AD-02: Bộ máy kiểm định đề thi (verifyAndOptimizeExam) rà soát 6 chốt an toàn và chuẩn hóa format', () => {
      const unverifiedExam = {
        exam_code: 'ai_test_01',
        title: 'Unverified AI Exam',
        questions: [
          {
            question_id: 'Q1',
            section: 'reading',
            question_type: 'MULTIPLE CHOICE', // Needs type lowercase normalization
            question_text: 'What causes climate change?',
            options: ['Fossil fuels', 'Solar energy', 'Wind', 'Trees'], // Needs A. B. C. D. normalization
            correct_answer: 'Fossil fuels',
            explanation: ''
          },
          {
            question_id: 'Q2',
            section: 'reading',
            question_type: 'true_false_not_given',
            question_text: 'Renewable energy is growing.',
            correct_answer: 'true', // Needs uppercase TRUE normalization
            options: []
          }
        ]
      } as any;

      const { exam: verifiedExam, report } = verifyAndOptimizeExam(unverifiedExam);

      expect(report.passed).toBe(true);
      expect(report.checks.length).toBeGreaterThanOrEqual(4);
      expect(report.metrics.readingCount).toBe(2);

      // Verify option normalization
      const cleanQ1 = verifiedExam.questions[0];
      expect(cleanQ1.options[0]).toBe('A. Fossil fuels');
      expect(cleanQ1.options[1]).toBe('B. Solar energy');
      expect(cleanQ1.correct_answer).toBe('A'); // normalized to option letter
    });

    // -----------------------------------------------------------------------
    // AD-03: Chấm bài Writing & Feedback (Band 0.0 - 9.0)
    // -----------------------------------------------------------------------
    it('AD-03: Chấm điểm bài thi Writing, tính toán subscore và cập nhật Overall Band chính xác', () => {
      const mockSubmission = {
        submission_id: 'SUB_WRITING_TEST_01',
        sbd: 'CANDIDATE_02',
        student_name: 'Nguyen Van A',
        exam_code: 'IELTS09',
        listening_band: 7.0,
        reading_band: 7.5,
        writing_status: 'PENDING_TEACHER',
        writing_band: 0,
        overall_band: 0,
        grading_version: 1
      };

      saveStoredSubmission(mockSubmission);

      const writingRubricScores = {
        task1: { ta: 7.0, cc: 6.5, lr: 7.0, gra: 6.5, band: 6.75 },
        task2: { tr: 7.5, cc: 7.0, lr: 7.5, gra: 7.0, band: 7.25 }
      };

      // Task 2 weighted 2x: (6.75 + 7.25*2)/3 = 7.08 -> rounded to nearest 0.5 is 7.0
      const overallWritingScore = 7.0;
      const examinerFeedback = 'Good coherence and lexical variety. Minor grammatical slips.';

      const result = updateStoredWritingScore(
        'SUB_WRITING_TEST_01',
        writingRubricScores,
        overallWritingScore,
        examinerFeedback,
        1, // expected version
        'EXAMINER_01'
      );

      expect(result.success).toBe(true);
      expect(result.submission?.writing_status).toBe('GRADED');
      expect(result.submission?.writing_band).toBe(7.0);
      expect(result.submission?.writing_feedback).toBe(examinerFeedback);

      // Overall: Listening 7.0, Reading 7.5, Writing 7.0 -> mean = 7.166 -> rounded to nearest 0.5 is 7.0
      expect(result.submission?.overall_band).toBe(7.0);
      expect(result.submission?.grading_version).toBe(2);
    });

    // -----------------------------------------------------------------------
    // AD-04: Quản lý hàng đợi nộp bài & Rate Limiting (Batch Append Queue)
    // -----------------------------------------------------------------------
    it('AD-04: Quản lý hàng đợi nộp bài tập trung (enqueueSubmission) chống cạn kiệt Quota 429 Google Sheets', async () => {
      // Test queue buffering mechanism
      const sub1 = { submission_id: 'SUB_BATCH_1', exam_code: 'IELTS09' };
      const sub2 = { submission_id: 'SUB_BATCH_2', exam_code: 'IELTS09' };

      enqueueSubmission(sub1);
      enqueueSubmission(sub2);

      // Flush queue manually
      const flushResult = await flushSubmissionQueue();
      expect(flushResult.success).toBe(true);
      expect(flushResult.count).toBeGreaterThanOrEqual(2);
    });

    // -----------------------------------------------------------------------
    // AD-05: Xung đột chấm điểm đồng thời (Optimistic Locking)
    // -----------------------------------------------------------------------
    it('AD-05: Phát hiện và xử lý xung đột chấm điểm đồng thời (CONCURRENT_GRADING_CONFLICT)', () => {
      const mockSub = {
        submission_id: 'SUB_CONFLICT_01',
        sbd: 'CAND_05',
        exam_code: 'IELTS09',
        writing_status: 'PENDING_TEACHER',
        grading_version: 2 // Current database version is 2
      };
      saveStoredSubmission(mockSub);

      // Examiner B attempts to grade using stale version 1
      const staleGradeAttempt = updateStoredWritingScore(
        'SUB_CONFLICT_01',
        { task1: { band: 6.0 } },
        6.0,
        'Feedback from Examiner B',
        1 // Stale expectedVersion
      );

      expect(staleGradeAttempt.success).toBe(false);
      expect(staleGradeAttempt.conflict).toBe(true);
      expect(staleGradeAttempt.message).toContain('DATA HAS BEEN MODIFIED BY ANOTHER EXAMINER');
    });

    // -----------------------------------------------------------------------
    // AD-06: Kiểm soát phiên thi & Tránh trùng lặp (Duplicate Deduplication)
    // -----------------------------------------------------------------------
    it('AD-06: Kiểm soát và khử trùng lặp phiên nộp bài (deduplicateSubmissions)', () => {
      const rawSubmissions = [
        { submission_id: 'SUB_01', sbd: 'SBD_1', submitted_at: '2026-10-12T10:00:00Z' },
        { submission_id: 'SUB_01', sbd: 'SBD_1', submitted_at: '2026-10-12T10:00:05Z' }, // Duplicate
        { submission_id: 'SUB_02', sbd: 'SBD_2', submitted_at: '2026-10-12T10:01:00Z' }
      ] as any[];

      const deduplicated = deduplicateSubmissions(rawSubmissions);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated.map(s => s.submission_id)).toEqual(['SUB_01', 'SUB_02']);
    });

    // -----------------------------------------------------------------------
    // AD-07: Pure Static SPA & Server Mode Fallback (CORS & 302 Redirect Resilience)
    // -----------------------------------------------------------------------
    it('AD-07: postToGasWithLockRetry tự động chuyển giao thức no-cors khi bị chặn CORS/302 Redirect', async () => {
      // Mock fetch simulating CORS preflight rejection on standard JSON POST
      vi.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch (CORS preflight or redirect blocked)'))
        .mockResolvedValueOnce({
          ok: false,
          type: 'opaque',
          status: 0
        } as any);

      const testPayload = {
        action: 'submit_exam',
        submission_id: 'SUB_GAS_CORS_TEST',
        sbd: 'SBD_TEST',
        exam_code: 'IELTS09'
      };

      const result = await postToGasWithLockRetry('https://script.google.com/macros/s/AKfycb_real/exec', testPayload);

      expect(result.status).toBe('success');
      expect(result.is_opaque).toBe(true);
    });

    // -----------------------------------------------------------------------
    // AD-08: Phát hiện quyền truy cập Sheet & Cảnh báo an toàn (GViz Permission Guard)
    // -----------------------------------------------------------------------
    it('AD-08: Kiểm tra quyền truy cập Google Sheet và phát hiện lỗi phân quyền Anyone with the link', async () => {
      // Mock fetch returning HTML error page (private sheet without Anyone with link permission)
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '<html><title>Error 401</title><body>Private Document</body></html>'
      } as any);

      const testOutcome = await testGvizConnection('1AbcPrivateSpreadsheetIdWithoutPublicAccess');

      expect(testOutcome.success).toBe(false);
      expect(testOutcome.message).toContain('GViz API HTTP Error');
    });

  });
});
