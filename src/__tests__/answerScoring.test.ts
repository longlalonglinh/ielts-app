import { describe, it, expect } from 'vitest';
import {
  normalizeAnswer,
  parseAcceptableAnswers,
  isAnswerCorrect,
  calculateAcademicReadingBand,
  calculateListeningBand,
  gradeExamAnswers
} from '../services/answerScoring';
import { ExamData } from '../types';

describe('answerScoring.ts - Unit Tests', () => {
  describe('1. normalizeAnswer()', () => {
    it('should convert strings to lowercase', () => {
      expect(normalizeAnswer('AUSTRALIA')).toBe('australia');
      expect(normalizeAnswer('New Zealand')).toBe('new zealand');
    });

    it('should strip leading English indefinite and definite articles (a, an, the)', () => {
      expect(normalizeAnswer('a library')).toBe('library');
      expect(normalizeAnswer('an apple')).toBe('apple');
      expect(normalizeAnswer('the university campus')).toBe('university campus');
      expect(normalizeAnswer('THE PACIFIC OCEAN')).toBe('pacific ocean');
      // Words starting with 'the' inside words should not be stripped
      expect(normalizeAnswer('theater')).toBe('theater');
      expect(normalizeAnswer('theory')).toBe('theory');
    });

    it('should strip redundant punctuation (commas, periods, exclamation, brackets)', () => {
      expect(normalizeAnswer('1,400')).toBe('1400');
      expect(normalizeAnswer('Dr. Watson!')).toBe('dr watson');
      expect(normalizeAnswer('computer-aided design')).toBe('computeraided design');
      expect(normalizeAnswer('(approx.) 50%')).toBe('approx 50');
    });

    it('should collapse multiple spaces and trim leading/trailing whitespace', () => {
      expect(normalizeAnswer('   solar    panels   ')).toBe('solar panels');
      expect(normalizeAnswer('\t renewable \n energy \t')).toBe('renewable energy');
    });

    it('should safely handle empty, null, and undefined values', () => {
      expect(normalizeAnswer('')).toBe('');
      expect(normalizeAnswer(null)).toBe('');
      expect(normalizeAnswer(undefined)).toBe('');
    });
  });

  describe('2. parseAcceptableAnswers()', () => {
    it('should parse pipe-delimited string of answers', () => {
      const parsed = parseAcceptableAnswers('1,400 kilometres|1400 kilometres|1400 km|1,400km');
      expect(parsed).toEqual(['1,400 kilometres', '1400 kilometres', '1400 km', '1,400km']);
    });

    it('should handle string array of correct answers', () => {
      const parsed = parseAcceptableAnswers(['library', 'public library']);
      expect(parsed).toEqual(['library', 'public library']);
    });

    it('should merge and deduplicate with acceptableAnswers array', () => {
      const parsed = parseAcceptableAnswers('centre|center', ['town centre', 'center']);
      expect(parsed).toEqual(['centre', 'center', 'town centre']);
    });

    it('should handle undefined, null or empty inputs gracefully', () => {
      expect(parseAcceptableAnswers(undefined)).toEqual([]);
      expect(parseAcceptableAnswers(null)).toEqual([]);
      expect(parseAcceptableAnswers('')).toEqual([]);
    });
  });

  describe('3. isAnswerCorrect()', () => {
    it('should return false for empty or whitespace-only student answer', () => {
      expect(isAnswerCorrect('', 'library')).toBe(false);
      expect(isAnswerCorrect('   ', 'library')).toBe(false);
      expect(isAnswerCorrect(undefined, 'library')).toBe(false);
      expect(isAnswerCorrect(null, 'library')).toBe(false);
    });

    it('should match case-insensitively and ignore leading articles', () => {
      expect(isAnswerCorrect('A Library', 'library')).toBe(true);
      expect(isAnswerCorrect('the library', 'library')).toBe(true);
      expect(isAnswerCorrect('LIBRARY', 'the library')).toBe(true);
    });

    it('should match variant spellings via pipe delimiter', () => {
      const answerKey = 'theatre|theater|cinema';
      expect(isAnswerCorrect('theater', answerKey)).toBe(true);
      expect(isAnswerCorrect('theatre', answerKey)).toBe(true);
      expect(isAnswerCorrect('Cinema', answerKey)).toBe(true);
      expect(isAnswerCorrect('stadium', answerKey)).toBe(false);
    });

    it('should handle True/False/Not Given abbreviations (T, F, NG)', () => {
      expect(isAnswerCorrect('T', 'TRUE', [], 'true_false_not_given')).toBe(true);
      expect(isAnswerCorrect('t', 'true', [], 'true_false_not_given')).toBe(true);
      expect(isAnswerCorrect('False', 'f', [], 'true_false_not_given')).toBe(true);
      expect(isAnswerCorrect('NG', 'NOT GIVEN', [], 'true_false_not_given')).toBe(true);
      expect(isAnswerCorrect('Not Given', 'ng', [], 'true_false_not_given')).toBe(true);
    });

    it('should handle Yes/No/Not Given abbreviations (Y, N, NG)', () => {
      expect(isAnswerCorrect('Y', 'YES', [], 'yes_no_not_given')).toBe(true);
      expect(isAnswerCorrect('n', 'NO', [], 'yes_no_not_given')).toBe(true);
      expect(isAnswerCorrect('ng', 'NOT GIVEN', [], 'yes_no_not_given')).toBe(true);
    });

    it('should match numbers with units regardless of spacing (e.g. 1400km vs 1400 km)', () => {
      expect(isAnswerCorrect('1400km', '1400 km')).toBe(true);
      expect(isAnswerCorrect('1400 km', '1400km')).toBe(true);
      expect(isAnswerCorrect('25 kg', '25kg')).toBe(true);
    });

    it('should handle date permutations and ordinal suffixes (e.g. 14th May vs May 14)', () => {
      expect(isAnswerCorrect('14th May', '14 May')).toBe(true);
      expect(isAnswerCorrect('May 14th', '14 May')).toBe(true);
      expect(isAnswerCorrect('14 May', 'May 14')).toBe(true);
      expect(isAnswerCorrect('1st June', 'June 1')).toBe(true);
      expect(isAnswerCorrect('23rd August', '23 August')).toBe(true);
    });

    it('should match UK and US spelling equivalents (e.g. colour vs color, theatre vs theater)', () => {
      expect(isAnswerCorrect('colour', 'color')).toBe(true);
      expect(isAnswerCorrect('color', 'colour')).toBe(true);
      expect(isAnswerCorrect('theater', 'theatre')).toBe(true);
      expect(isAnswerCorrect('centre', 'center')).toBe(true);
      expect(isAnswerCorrect('kilometres', 'kilometers')).toBe(true);
    });
  });

  describe('4. Official IELTS Band Calculation', () => {
    it('should correctly calculate Academic Reading band thresholds', () => {
      expect(calculateAcademicReadingBand(40)).toBe(9.0);
      expect(calculateAcademicReadingBand(39)).toBe(9.0);
      expect(calculateAcademicReadingBand(37)).toBe(8.5);
      expect(calculateAcademicReadingBand(35)).toBe(8.0);
      expect(calculateAcademicReadingBand(30)).toBe(7.0);
      expect(calculateAcademicReadingBand(23)).toBe(6.0);
      expect(calculateAcademicReadingBand(15)).toBe(5.0);
      expect(calculateAcademicReadingBand(0)).toBe(0.0);
    });

    it('should clamp out-of-range raw scores in Reading', () => {
      expect(calculateAcademicReadingBand(-5)).toBe(0.0);
      expect(calculateAcademicReadingBand(50)).toBe(9.0);
    });

    it('should correctly calculate Listening band thresholds', () => {
      expect(calculateListeningBand(40)).toBe(9.0);
      expect(calculateListeningBand(39)).toBe(9.0);
      expect(calculateListeningBand(37)).toBe(8.5);
      expect(calculateListeningBand(35)).toBe(8.0);
      expect(calculateListeningBand(32)).toBe(7.5);
      expect(calculateListeningBand(30)).toBe(7.0);
      expect(calculateListeningBand(23)).toBe(6.0);
      expect(calculateListeningBand(16)).toBe(5.0);
      expect(calculateListeningBand(0)).toBe(0.0);
    });
  });

  describe('5. gradeExamAnswers() Full Candidate Evaluation', () => {
    const mockExam: ExamData = {
      exam_code: 'TEST01',
      title: 'IELTS Standard Diagnostic',
      passages: [],
      listening_questions: [
        {
          question_id: 'l1',
          section: 'listening',
          question_text: 'Complete the note: ________',
          question_type: 'fill_in_blank',
          correct_answer: 'central station|railway station',
          max_score: 1
        },
        {
          question_id: 'l2',
          section: 'listening',
          question_text: 'Select type of insurance',
          question_type: 'multiple_choice',
          correct_answer: 'B',
          max_score: 1
        }
      ],
      reading_questions: [
        {
          question_id: 'r1',
          section: 'reading',
          question_text: 'The experiment was conducted in 1994.',
          question_type: 'true_false_not_given',
          correct_answer: 'TRUE',
          max_score: 1
        }
      ]
    };

    it('should correctly score answers and return full grading summary', () => {
      const studentAnswers = {
        l1: '  the central station  ',
        l2: 'b',
        r1: 'T'
      };

      const summary = gradeExamAnswers(mockExam, studentAnswers);

      expect(summary.listening_raw).toBe(2);
      expect(summary.reading_raw).toBe(1);
      expect(summary.total_raw).toBe(3);
      expect(summary.results['l1'].is_correct).toBe(true);
      expect(summary.results['l2'].is_correct).toBe(true);
      expect(summary.results['r1'].is_correct).toBe(true);
    });

    it('should mark wrong answers and assign zero awarded points', () => {
      const studentAnswers = {
        l1: 'airport terminal',
        l2: 'C',
        r1: 'FALSE'
      };

      const summary = gradeExamAnswers(mockExam, studentAnswers);

      expect(summary.listening_raw).toBe(0);
      expect(summary.reading_raw).toBe(0);
      expect(summary.total_raw).toBe(0);
      expect(summary.results['l1'].is_correct).toBe(false);
      expect(summary.results['l1'].score_awarded).toBe(0);
    });

    it('should handle One Skill Retake for Writing when listening and reading data are completely empty', () => {
      const writingRetakeExam: ExamData = {
        exam_code: 'WT1004',
        title: 'IELTS Academic Writing One Skill Retake',
        exam_type: 'one_skill',
        skills: ['writing'],
        retakeMode: true,
        targetSkill: 'writing',
        writing_duration_mins: 60,
        writing_task1_prompt: 'Summarise the Japanese tourist market chart.',
        writing_task2_prompt: 'Discuss benefits of international tourism.',
        listening_questions: [],
        reading_questions: [],
        passages: [],
        questions: []
      };

      // Completely empty student answers for listening & reading
      const studentAnswers = {};

      const summary = gradeExamAnswers(writingRetakeExam, studentAnswers);

      expect(summary.listening_raw).toBe(0);
      expect(summary.listening_max).toBe(0);
      expect(summary.listening_band).toBe(0);
      expect(summary.reading_raw).toBe(0);
      expect(summary.reading_max).toBe(0);
      expect(summary.reading_band).toBe(0);
      expect(summary.total_raw).toBe(0);
      expect(Object.keys(summary.results).length).toBe(0);
    });

    it('should handle One Skill Retake for Reading when listening data is completely omitted', () => {
      const readingRetakeExam: ExamData = {
        exam_code: 'RT1001',
        title: 'IELTS Academic Reading One Skill Retake',
        exam_type: 'one_skill',
        skills: ['reading'],
        retakeMode: true,
        targetSkill: 'reading',
        reading_duration_mins: 60,
        reading_questions: [
          {
            question_id: 'r1',
            section: 'reading',
            question_text: 'Renewable energy accounted for 30%.',
            question_type: 'true_false_not_given',
            correct_answer: 'TRUE',
            max_score: 1
          }
        ],
        listening_questions: [],
        passages: [],
        questions: []
      };

      const summary = gradeExamAnswers(readingRetakeExam, { r1: 'True' });

      expect(summary.listening_raw).toBe(0);
      expect(summary.listening_max).toBe(0);
      expect(summary.listening_band).toBe(0);
      expect(summary.reading_raw).toBe(1);
      expect(summary.reading_max).toBe(1);
      expect(summary.reading_band).toBeGreaterThan(0);
      expect(summary.results['r1'].is_correct).toBe(true);
    });
  });
});
