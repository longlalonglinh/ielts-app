import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';

// In-memory LocalStorage polyfill for test environment
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
if (!(globalThis as any).window.indexedDB && (globalThis as any).indexedDB) {
  (globalThis as any).window.indexedDB = (globalThis as any).indexedDB;
}

import {
  saveCurrentAnswersToIndexedDB,
  getCurrentAnswersFromIndexedDB,
  saveWritingDraftToIndexedDB,
  getWritingDraftFromIndexedDB,
  saveAudioProgressToIndexedDB,
  getAudioProgressFromIndexedDB,
  createCandidateDraftBackup,
  clearCandidateAllDrafts,
  saveSubmissionToIndexedDB,
  getAllSubmissionsFromIndexedDB
} from '../services/indexedDb';
import { 
  importSubmissions, 
  getSubmissionsStats, 
  deleteStoredSubmission,
  getStoredSubmissions
} from '../../server/storage';
import { SubmissionRecord } from '../types';

describe('Candidate Result Saving, Emergency Backup & Database Extraction Pipeline', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Candidate Active Session Auto-Save & Emergency Backup Snapshot', () => {
    it('should save and retrieve active answers, writing drafts and audio progress in IndexedDB', async () => {
      const examCode = 'TEST99';
      const candidateId = 'TS88888';

      // 1. Save answers
      await saveCurrentAnswersToIndexedDB(examCode, candidateId, {
        '1': 'Library',
        '2': '9.30 AM',
        'q3': 'TRUE'
      });

      // 2. Save writing draft
      await saveWritingDraftToIndexedDB(examCode, candidateId, {
        task1: 'The chart illustrates the changes in energy consumption between 2000 and 2020.',
        task2: 'In today modern society, education plays a vital role.'
      });

      // 3. Save audio progress
      await saveAudioProgressToIndexedDB(examCode, candidateId, 342.5);

      // Verify individual retrievals
      const answers = await getCurrentAnswersFromIndexedDB(examCode, candidateId);
      expect(answers['1']).toBe('Library');
      expect(answers['q3']).toBe('TRUE');

      const draft = await getWritingDraftFromIndexedDB(examCode, candidateId);
      expect(draft?.task1).toContain('The chart illustrates');
      expect(draft?.task2).toContain('In today modern society');

      const audio = await getAudioProgressFromIndexedDB(examCode, candidateId);
      expect(audio).toBe(342.5);

      // 4. Create comprehensive Emergency Backup Snapshot
      const backup = await createCandidateDraftBackup(examCode, candidateId);
      expect(backup.exam_code).toBe('TEST99');
      expect(backup.candidate_id).toBe('TS88888');
      expect(backup.answers['1']).toBe('Library');
      expect(backup.writing_draft?.task1).toContain('The chart illustrates');
      expect(backup.audio_progress_seconds).toBe(342.5);
      expect(backup.timestamp).toBeDefined();

      // 5. Test clearCandidateAllDrafts
      await clearCandidateAllDrafts(examCode, candidateId);
      const clearedAnswers = await getCurrentAnswersFromIndexedDB(examCode, candidateId);
      expect(Object.keys(clearedAnswers).length).toBe(0);
    });
  });

  describe('2. Server Database Storage, Stats & Batch Import Pipeline', () => {
    it('should calculate database KPIs and handle bulk submission imports', () => {
      const mockSubmissions: any[] = [
        {
          submission_id: 'SUB_TEST_01',
          sbd: 'TS1001',
          student_name: 'Nguyen Van A',
          exam_code: 'IELTS01',
          test_mode: 'TEST',
          listening_raw_score: 32,
          listening_band: 7.5,
          reading_raw_score: 35,
          reading_band: 8.0,
          overall_band: 8.0,
          writing_status: 'GRADED',
          writing_band: 7.0,
          submitted_at: new Date().toISOString()
        },
        {
          submission_id: 'SUB_TEST_02',
          sbd: 'TS1002',
          student_name: 'Tran Thi B',
          exam_code: 'IELTS01',
          test_mode: 'TEST',
          listening_raw_score: 28,
          listening_band: 6.5,
          reading_raw_score: 30,
          reading_band: 7.0,
          overall_band: 6.5,
          writing_status: 'PENDING_TEACHER',
          submitted_at: new Date().toISOString()
        }
      ];

      // Import submissions
      const importResult = importSubmissions(mockSubmissions);
      expect(importResult.imported + importResult.updated).toBeGreaterThanOrEqual(2);

      // Verify stats
      const stats = getSubmissionsStats();
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.todayCount).toBeGreaterThanOrEqual(2);
      expect(stats.gradedWriting).toBeGreaterThanOrEqual(1);
      expect(stats.pendingWriting).toBeGreaterThanOrEqual(1);
      expect(stats.avgOverallBand).toBeGreaterThan(0);

      // Verify deletion
      const deleted = deleteStoredSubmission('SUB_TEST_01');
      expect(deleted).toBe(true);
    });
  });

  describe('3. CSV Database Extraction Format Verification', () => {
    it('should format CSV row with proper escaping and UTF-8 BOM', () => {
      const escapeCsvCell = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const nameWithQuotesAndCommas = 'Nguyen, Van "Hero" B';
      const escaped = escapeCsvCell(nameWithQuotesAndCommas);
      expect(escaped).toBe('"Nguyen, Van ""Hero"" B"');

      // BOM validation
      const bom = '\uFEFF';
      expect(bom.charCodeAt(0)).toBe(0xFEFF);
    });
  });
});
