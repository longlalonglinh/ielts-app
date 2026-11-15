import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { applyCandidateExamShuffle } from '../utils/examShuffle';
import { gradeExamAnswers } from '../services/answerScoring';
import { computeExamItemAnalysis } from '../components/Admin/MonitoringDashboard';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/gasScriptCode';
import { ExamData, IELTSQuestionType, SubmissionRecord } from '../types';

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('Security Hardening & Cleanup Verification', () => {
  it('1. Removes ?admin=true query bypass and enforces header-based Admin authentication in server.ts', () => {
    const serverSrc = readProjectFile('server.ts');
    expect(serverSrc).not.toContain("req.query.admin === 'true'");
    expect(serverSrc).not.toContain('req.query.admin');
    expect(serverSrc).toContain('requireAdminMiddleware');
    expect(serverSrc).toContain("app.post('/api/admin/login'");
    expect(serverSrc).toContain("app.get('/api/admin/verify'");
    expect(serverSrc).toContain("pushPayloadToGas(undefined, { action: 'log_cheat', ...saved }, 'CHEATLOGS')");
  });

  it('2. Deletes fix-keys.patch, declares ADMIN_TOKEN in .env.example, and removes Unsplash fallbacks', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'fix-keys.patch'))).toBe(false);
    const envExample = readProjectFile('.env.example');
    expect(envExample).toContain('ADMIN_TOKEN=');

    const appSrc = readProjectFile('src/App.tsx');
    const writingSrc = readProjectFile('src/components/Student/WritingModule.tsx');
    expect(appSrc).not.toContain('images.unsplash.com');
    expect(writingSrc).not.toContain('images.unsplash.com');
  });

  it('3. Blocks Ctrl+Alt+A Admin toggle during active student TEST sessions in App.tsx', () => {
    const appSrc = readProjectFile('src/App.tsx');
    expect(appSrc).toContain("if (activeView === 'student' && isLoggedIn && testMode === 'TEST' && currentModule !== 'results') {");
    expect(appSrc).toContain('ADMIN PASSWORD GATE');
    expect(appSrc).toContain('autoSubmitLimit={proctoringPolicy.auto_submit_on_violation ? proctoringPolicy.max_violations_limit : null}');
  });

  it('4. GAS Script includes repairSheetsHeaders_, EXAMS dedup, and CHEATLOGS batchAppendRows_ handling', () => {
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('function repairSheetsHeaders_(ss)');
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain("action === 'logcheat' || action === 'savecheatlog'");
    expect(GOOGLE_APPS_SCRIPT_CODE).toContain('var seenExamMap = {};');
  });
});

describe('Deterministic Seeded CBT Shuffling (examShuffle.ts)', () => {
  const sampleExam: ExamData = {
    exam_code: 'TEST99',
    title: 'Sample Audit CBT Paper',
    passages: [
      {
        passage_index: 1,
        title: 'Passage 1',
        text: 'Sample reading passage content.',
        questions: [
          {
            question_id: 'R1',
            section: 'reading',
            question_type: IELTSQuestionType.MULTIPLE_CHOICE,
            question_text: 'Standalone MCQ 1?',
            options: ['A. Alpha', 'B. Beta', 'C. Gamma', 'D. Delta'],
            correct_answer: 'B',
            max_score: 1
          },
          {
            question_id: 'R2',
            section: 'reading',
            question_type: IELTSQuestionType.MULTIPLE_CHOICE,
            question_text: 'Standalone MCQ 2?',
            options: ['A. One', 'B. Two', 'C. Three', 'D. Four'],
            correct_answer: 'C',
            max_score: 1
          },
          {
            question_id: 'R3',
            section: 'reading',
            question_type: IELTSQuestionType.MULTIPLE_CHOICE,
            question_text: 'Standalone MCQ 3?',
            options: ['A. Red', 'B. Blue', 'C. Green', 'D. Yellow'],
            correct_answer: 'A',
            max_score: 1
          },
          {
            question_id: 'R4',
            section: 'reading',
            question_type: IELTSQuestionType.MULTIPLE_CHOICE,
            question_text: 'Standalone MCQ 4?',
            options: ['A. North', 'B. South', 'C. East', 'D. West'],
            correct_answer: 'D',
            max_score: 1
          },
          {
            question_id: 'R5',
            section: 'reading',
            question_type: IELTSQuestionType.FILL_IN_THE_BLANK,
            question_text: 'The experiment lasted [blank_1] days.',
            correct_answer: '14',
            max_score: 1
          }
        ]
      }
    ],
    listening_questions: [
      {
        question_id: 'L1',
        section: 'listening',
        question_type: IELTSQuestionType.MULTIPLE_CHOICE,
        question_text: 'Where is the museum located?',
        options: ['A. Oak Street', 'B. Pine Road', 'C. Elm Avenue', 'D. Maple Lane'],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L2',
        section: 'listening',
        question_type: IELTSQuestionType.FILL_IN_THE_BLANK,
        question_text: 'Opening hour: [blank_1]',
        correct_answer: '9:30',
        max_score: 1
      }
    ],
    reading_questions: []
  };

  it('1. Preserves canonical exam untouched in PRACTICE mode', () => {
    const res = applyCandidateExamShuffle(sampleExam, 'SBD01', 'PRACTICE');
    expect(res).toBe(sampleExam);
    expect(res.passages[0].questions[0].display_options).toBeUndefined();
  });

  it('2. Produces deterministic shuffle for identical SBD and distinct orderings across SBDs in TEST mode', () => {
    const s1Run1 = applyCandidateExamShuffle(sampleExam, 'CAND_ALPHA_101', 'TEST');
    const s1Run2 = applyCandidateExamShuffle(sampleExam, 'CAND_ALPHA_101', 'TEST');
    const s2Run1 = applyCandidateExamShuffle(sampleExam, 'CAND_OMEGA_999', 'TEST');

    // Identical candidate produces identical order
    expect(s1Run1.passages[0].questions.map(q => q.question_id)).toEqual(
      s1Run2.passages[0].questions.map(q => q.question_id)
    );
    expect(s1Run1.listening_questions?.[0].display_options).toEqual(
      s1Run2.listening_questions?.[0].display_options
    );

    // Listening chronological question order NEVER changes
    expect(s1Run1.listening_questions?.map(q => q.question_id)).toEqual(['L1', 'L2']);

    // Reading fill-in-the-blank stays anchored at index 4
    expect(s1Run1.passages[0].questions[4].question_id).toBe('R5');

    // Candidate 2 differs in option or question order
    const sig1 = JSON.stringify(s1Run1.passages[0].questions.map(q => ({ id: q.question_id, opts: q.display_options })));
    const sig2 = JSON.stringify(s2Run1.passages[0].questions.map(q => ({ id: q.question_id, opts: q.display_options })));
    expect(sig1).not.toEqual(sig2);
  });

  it('3. Preserves canonical value keys so scoring produces 100% identical marks after shuffle', () => {
    const shuffled = applyCandidateExamShuffle(sampleExam, 'CAND_SCORE_42', 'TEST');
    // Pick the correct display option by looking up canonical `value`
    const answers: Record<string, string> = {};
    const rQuestions = shuffled.passages[0].questions;
    rQuestions.forEach(q => {
      if (q.display_options) {
        const match = q.display_options.find(d => d.value === q.correct_answer);
        expect(match).toBeDefined();
        answers[q.question_id] = match!.value;
      } else {
        answers[q.question_id] = String(q.correct_answer);
      }
    });
    shuffled.listening_questions?.forEach(q => {
      if (q.display_options) {
        const match = q.display_options.find(d => d.value === q.correct_answer);
        expect(match).toBeDefined();
        answers[q.question_id] = match!.value;
      } else {
        answers[q.question_id] = String(q.correct_answer);
      }
    });

    const canonicalGraded = gradeExamAnswers(sampleExam, answers);
    const shuffledGraded = gradeExamAnswers(shuffled, answers);

    expect(canonicalGraded.listening_raw).toBe(2);
    expect(canonicalGraded.reading_raw).toBe(5);
    expect(shuffledGraded.listening_raw).toBe(canonicalGraded.listening_raw);
    expect(shuffledGraded.reading_raw).toBe(canonicalGraded.reading_raw);
  });
});

describe('Admin Item Analysis & Practice Review Logic', () => {
  it('1. Computes accuracy %, difficulty classification, and distractor counts accurately', () => {
    const questions = [
      {
        question_id: 'R1',
        section: 'reading' as const,
        question_type: IELTSQuestionType.MULTIPLE_CHOICE,
        question_text: 'Hard item?',
        correct_answer: 'B',
        max_score: 1
      },
      {
        question_id: 'R2',
        section: 'reading' as const,
        question_type: IELTSQuestionType.MULTIPLE_CHOICE,
        question_text: 'Easy item?',
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R3',
        section: 'reading' as const,
        question_type: IELTSQuestionType.FILL_IN_THE_BLANK,
        question_text: 'Balanced item?',
        correct_answer: 'solar',
        max_score: 1
      }
    ];

    const submissions: SubmissionRecord[] = [
      {
        submission_id: 's1',
        sbd: '01',
        exam_code: 'TEST01',
        writing_status: 'PENDING_TEACHER',
        reading_answers: { R1: 'A', R2: 'A', R3: 'solar' }
      },
      {
        submission_id: 's2',
        sbd: '02',
        exam_code: 'TEST01',
        writing_status: 'PENDING_TEACHER',
        reading_answers: { R1: 'C', R2: 'A', R3: 'wind' }
      },
      {
        submission_id: 's3',
        sbd: '03',
        exam_code: 'TEST01',
        writing_status: 'PENDING_TEACHER',
        reading_answers: { R1: 'A', R2: 'A', R3: 'solar' }
      },
      {
        submission_id: 's4',
        sbd: '04',
        exam_code: 'TEST01',
        writing_status: 'PENDING_TEACHER',
        reading_answers: { R1: 'D', R2: 'A', R3: '' }
      },
      {
        submission_id: 'other',
        sbd: '99',
        exam_code: 'OTHER99',
        writing_status: 'PENDING_TEACHER',
        reading_answers: { R1: 'B', R2: 'B', R3: 'solar' }
      }
    ];

    const rows = computeExamItemAnalysis('TEST01', questions, submissions);
    expect(rows).toHaveLength(3);

    // R1: 0/4 = 0% -> Too Hard (<30%), distractors include A: 2, C: 1, D: 1
    expect(rows[0].attempts).toBe(4);
    expect(rows[0].correctRate).toBe(0);
    expect(rows[0].difficultyLabel).toBe('Too Hard (<30%)');
    expect(rows[0].answerBreakdown[0]).toEqual({ answer: 'A', count: 2, isCorrect: false });

    // R2: 4/4 = 100% -> Too Easy (>85%)
    expect(rows[1].correctRate).toBe(100);
    expect(rows[1].difficultyLabel).toBe('Too Easy (>85%)');

    // R3: 2/4 = 50% -> Balanced (30-85%)
    expect(rows[2].correctRate).toBe(50);
    expect(rows[2].difficultyLabel).toBe('Balanced (30-85%)');
  });

  it('2. PracticeDashboard includes focused wrong-cards review action without mutating deck', () => {
    const practiceDashSrc = readProjectFile('src/components/Student/Practice/PracticeDashboard.tsx');
    expect(practiceDashSrc).toContain('sessionCardsOverride');
    expect(practiceDashSrc).toContain('handleRetryMissedCards');
    expect(practiceDashSrc).toContain('Ôn lại các câu làm sai');
  });
});
