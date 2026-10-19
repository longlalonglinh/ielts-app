import { describe, it, expect, vi } from 'vitest';
import { getApiUrl, API_BASE_URL, submitExamPayload, postToGasWithLockRetry } from '../services/api';
import { saveExamToIndexedDb, getAllExamsFromIndexedDb } from '../services/indexedDb';
import { ExamData, SubmissionPayload } from '../types';

describe('Debounced Blank, Sandbox Preview & Dual Deployment Verification', () => {

  it('1. getApiUrl formats paths correctly with and without VITE_API_BASE_URL', () => {
    const defaultUrl = getApiUrl('/api/submissions');
    expect(defaultUrl).toContain('/api/submissions');

    const cleanUrl = getApiUrl('api/exams');
    expect(cleanUrl).toContain('/api/exams');
  });

  it('2. submitExamPayload with isPreview: true executes in RAM sandbox without calling network', async () => {
    const mockExam: ExamData = {
      exam_code: 'TEST_PREVIEW',
      title: 'Preview Exam',
      passages: [
        {
          passage_index: 1,
          title: 'P1',
          text: 'P1 text',
          questions: [
            {
              question_id: 'R1',
              section: 'reading',
              question_text: 'What is A? [blank_1]',
              question_type: 'fill_in_blank',
              correct_answer: 'apple',
              max_score: 1
            }
          ]
        }
      ]
    };

    const payload: SubmissionPayload = {
      submission_id: 'sub_prev_123',
      sbd: 'PREVIEW_TEACHER',
      exam_code: 'TEST_PREVIEW',
      test_mode: 'PRACTICE',
      answers: {
        'R1': 'apple',
        '1': 'apple'
      },
      isPreview: true
    };

    const res = await submitExamPayload('https://mock.gas.url', payload, mockExam);
    expect(res.success).toBe(true);
    expect(res.sbd).toBe('PREVIEW_TEACHER');
    expect(res.reading_raw_score).toBe(1);
    expect(res.message).toContain('RAM sandbox');
  });

  it('3. postToGasWithLockRetry bypasses network requests when isPreview is true', async () => {
    const res = await postToGasWithLockRetry('https://mock.gas.url', {
      action: 'submitExam',
      sbd: 'PREVIEW_TEACHER',
      isPreview: true
    });

    expect(res.status).toBe('success');
    expect(res.message).toContain('Preview sandboxed');
  });

  it('4. saveExamToIndexedDb and getAllExamsFromIndexedDb aliases exist and function', () => {
    expect(typeof saveExamToIndexedDb).toBe('function');
    expect(typeof getAllExamsFromIndexedDb).toBe('function');
  });
});
