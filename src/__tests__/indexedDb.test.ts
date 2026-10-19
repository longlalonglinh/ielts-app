import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

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
  openIndexedDB,
  saveExamToIndexedDB,
  getExamFromIndexedDB,
  getAllExamsFromIndexedDB,
  saveSubmissionToIndexedDB,
  getAllSubmissionsFromIndexedDB,
  saveCheatLogToIndexedDB,
  getAllCheatLogsFromIndexedDB,
  saveWritingDraftToIndexedDB,
  getWritingDraftFromIndexedDB,
  saveAudioProgressToIndexedDB,
  getAudioProgressFromIndexedDB,
  saveCurrentAnswersToIndexedDB,
  getCurrentAnswersFromIndexedDB,
  savePendingSubmissionToIndexedDB,
  getPendingSubmissionsFromIndexedDB,
  removePendingSubmissionFromIndexedDB,
  saveCumulativeProctoringData,
  getCumulativeProctoringData,
  saveKeyValue,
  getKeyValue
} from '../services/indexedDb';
import { ExamData, SubmissionRecord, CheatLog, SubmissionPayload } from '../types';

describe('indexedDb.ts - Unit & Integration Tests', () => {
  beforeEach(async () => {
    // Clear localStorage for isolated test runs
    localStorage.clear();
  });

  describe('1. Database Initialization & Schema Verification', () => {
    it('should open IndexedDB and initialize all 5 required object stores', async () => {
      const db = await openIndexedDB();
      expect(db.name).toBe('ielts_offline_vault_db');
      expect(db.version).toBe(2);

      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain('exams');
      expect(storeNames).toContain('submissions');
      expect(storeNames).toContain('cheat_logs');
      expect(storeNames).toContain('practice_decks');
      expect(storeNames).toContain('key_values');
    });
  });

  describe('2. Exam Data CRUD Operations', () => {
    const mockExam: ExamData = {
      exam_code: 'TEST_IDB_01',
      title: 'IELTS Offline Vault Test',
      passages: [],
      listening_questions: [
        {
          question_id: 'q1',
          section: 'listening',
          question_text: 'Where is the meeting?',
          question_type: 'fill_in_blank',
          correct_answer: 'Room 302',
          max_score: 1
        }
      ],
      reading_questions: []
    };

    it('should successfully save and retrieve an exam by exam_code', async () => {
      await saveExamToIndexedDB(mockExam);
      const retrieved = await getExamFromIndexedDB('TEST_IDB_01');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.exam_code).toBe('TEST_IDB_01');
      expect(retrieved?.title).toBe('IELTS Offline Vault Test');
      expect(retrieved?.listening_questions?.length).toBe(1);
    });

    it('should return null when querying a non-existent exam', async () => {
      const result = await getExamFromIndexedDB('NON_EXISTENT_CODE');
      expect(result).toBeNull();
    });

    it('should retrieve all stored exams from IndexedDB', async () => {
      const secondExam: ExamData = {
        ...mockExam,
        exam_code: 'TEST_IDB_02',
        title: 'IELTS Second Test'
      };
      await saveExamToIndexedDB(secondExam);

      const all = await getAllExamsFromIndexedDB();
      expect(all.length).toBeGreaterThanOrEqual(2);
      const codes = all.map(e => e.exam_code);
      expect(codes).toContain('TEST_IDB_01');
      expect(codes).toContain('TEST_IDB_02');
    });
  });

  describe('3. Student Writing Draft & Auto-Save Recovery', () => {
    it('should persist and retrieve writing draft for a candidate across reloads', async () => {
      const examCode = 'IELTS_AC_01';
      const candidateId = 'SBD_8899';
      const draft = {
        task1: 'The chart illustrates the consumption of renewable energy...',
        task2: 'In modern society, technological advancement has significantly...'
      };

      await saveWritingDraftToIndexedDB(examCode, candidateId, draft);

      const retrieved = await getWritingDraftFromIndexedDB(examCode, candidateId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.task1).toBe(draft.task1);
      expect(retrieved?.task2).toBe(draft.task2);
      expect(retrieved?.updated_at).toBeDefined();
    });

    it('should fallback to localStorage if IndexedDB returns null or error', async () => {
      const examCode = 'IELTS_FALLBACK';
      const candidateId = 'SBD_FALLBACK';
      const cleanCode = 'IELTS_FALLBACK';
      const cleanId = 'SBD_FALLBACK';
      const draftKey = `DRAFT_WRITING_${cleanCode}_${cleanId}`;

      const fallbackPayload = {
        task1: 'LocalStorage task 1 backup',
        task2: 'LocalStorage task 2 backup',
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(fallbackPayload));

      const retrieved = await getWritingDraftFromIndexedDB(examCode, candidateId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.task1).toBe('LocalStorage task 1 backup');
    });
  });

  describe('4. Audio Playback Progress Persistence', () => {
    it('should record audio progress timestamp and restore accurately', async () => {
      const examCode = 'IELTS_AUDIO_01';
      const candidateId = 'SBD_AUDIO_101';

      await saveAudioProgressToIndexedDB(examCode, candidateId, 185.5);
      const restoredTime = await getAudioProgressFromIndexedDB(examCode, candidateId);

      expect(restoredTime).toBeCloseTo(185.5, 1);
    });

    it('should return 0 for unrecorded audio sessions', async () => {
      const restoredTime = await getAudioProgressFromIndexedDB('NEW_EXAM', 'NEW_SBD');
      expect(restoredTime).toBe(0);
    });
  });

  describe('5. Real-Time Active Answers & Submission Records', () => {
    it('should save candidate answers snapshot in real-time', async () => {
      const answers = {
        q1: 'library',
        q2: '1400',
        q3: 'FALSE'
      };

      await saveCurrentAnswersToIndexedDB('EXAM_ANS', 'CAND_01', answers);
      const retrieved = await getCurrentAnswersFromIndexedDB('EXAM_ANS', 'CAND_01');

      expect(retrieved).toEqual(answers);
    });

    it('should store candidate submission record with anti-tamper structure', async () => {
      const submission: SubmissionRecord = {
        submission_id: 'sub_test_999',
        sbd: 'CAND_VIETNAM_01',
        exam_code: 'TEST01',
        test_mode: 'TEST',
        submission_type: 'STANDARD',
        timestamp: new Date().toISOString(),
        listening_answers: { l1: 'A' },
        reading_answers: { r1: 'TRUE' },
        listening_raw_score: 35,
        listening_band: 8.0,
        reading_raw_score: 36,
        reading_band: 8.0,
        writing_task1_text: 'Sample task 1 essay',
        writing_task2_text: 'Sample task 2 essay',
        writing_status: 'PENDING_TEACHER',
        violations_count: 0
      };

      await saveSubmissionToIndexedDB(submission);
      const allSubmissions = await getAllSubmissionsFromIndexedDB();

      const found = allSubmissions.find(s => s.submission_id === 'sub_test_999');
      expect(found).toBeDefined();
      expect(found?.sbd).toBe('CAND_VIETNAM_01');
      expect(found?.listening_band).toBe(8.0);
      expect(found?.reading_band).toBe(8.0);
    });
  });

  describe('6. Proctoring Cheat Logs Persistence', () => {
    it('should record violation incident logs securely', async () => {
      const log: CheatLog = {
        log_id: 'cheat_log_1',
        submission_id: 'sub_test_999',
        sbd: 'CAND_01',
        exam_code: 'TEST01',
        violation_type: 'Tab switched / Left exam window',
        timestamp: new Date().toISOString()
      };

      await saveCheatLogToIndexedDB(log);
      const logs = await getAllCheatLogsFromIndexedDB();

      expect(logs.length).toBeGreaterThanOrEqual(1);
      const matched = logs.find(l => l.log_id === 'cheat_log_1');
      expect(matched?.violation_type).toBe('Tab switched / Left exam window');
    });
  });

  describe('7. Quota Limits & Error Resilience', () => {
    it('should handle generic key-value storage without unhandled rejections', async () => {
      await saveKeyValue('test_key', { data: 'test_value' });
      const value = await getKeyValue<{ data: string }>('test_key');
      expect(value?.data).toBe('test_value');
    });
  });

  describe('8. Offline Submission Sync Queue (Deadline Auto-Submit Resilience)', () => {
    it('should queue pending offline submissions and support removal after certification', async () => {
      const mockPayload: SubmissionPayload = {
        submission_id: 'pending_sub_001',
        sbd: 'CAND_OFFLINE_01',
        exam_code: 'IELTS01',
        test_mode: 'TEST',
        submission_type: 'TIMEOUT_FORCED',
        answers: { L1: 'APPLE', R1: 'TRUE' },
        sealed_token: 'SEALED-IELTS-TOKEN-12345',
        offline_receipt_code: 'RCPT-IELTS01-CAND_OFFLINE_01-ABCDE',
        is_offline_pending: true,
        submitted_at: new Date().toISOString()
      };

      await savePendingSubmissionToIndexedDB(mockPayload);
      const pendingList = await getPendingSubmissionsFromIndexedDB();

      expect(pendingList.length).toBeGreaterThanOrEqual(1);
      const matched = pendingList.find(p => p.submission_id === 'pending_sub_001');
      expect(matched).toBeDefined();
      expect(matched?.offline_receipt_code).toBe('RCPT-IELTS01-CAND_OFFLINE_01-ABCDE');
      expect(matched?.is_offline_pending).toBe(true);

      // Now remove after server certification
      await removePendingSubmissionFromIndexedDB('pending_sub_001');
      const updatedList = await getPendingSubmissionsFromIndexedDB();
      const afterRemoval = updatedList.find(p => p.submission_id === 'pending_sub_001');
      expect(afterRemoval).toBeUndefined();
    });
  });

  describe('9. Cumulative Proctoring Data Persistence (Grace Period Exploitation Resilience)', () => {
    it('should persist and retrieve cumulative off-screen metrics across session restarts', async () => {
      await saveCumulativeProctoringData('IELTS01', 'CAND_01', {
        totalOffScreenMs: 4500,
        rapidSwitchCount: 3,
        lastUpdated: new Date().toISOString()
      });

      const metrics = await getCumulativeProctoringData('IELTS01', 'CAND_01');
      expect(metrics).not.toBeNull();
      expect(metrics?.totalOffScreenMs).toBe(4500);
      expect(metrics?.rapidSwitchCount).toBe(3);
    });
  });
});
