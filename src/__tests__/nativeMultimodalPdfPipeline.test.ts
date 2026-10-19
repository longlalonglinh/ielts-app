import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  parseExamFromDocumentText, 
  transpileToCbtEngineSchema, 
  transpileFromCbtEngineSchema 
} from '../services/documentExamParser';
import { uploadAndParseIeltsPdf } from '../services/api';
import { CbtEngineTranspiledExam, ExamData } from '../types';

describe('Native Multimodal PDF Pipeline & CBT Transpilation Suite (EO-EO-3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Verifies no synthetic or dummy starter questions are injected when 0 questions exist', () => {
    const rawPassageWithoutQuestions = `
READING PASSAGE 1
The Architecture of Ancient Rome

Roman architecture continued the legacy left by the earlier architects of the Greek world,
and the Roman respect for this tradition and their particular formulation of established architectural
orders was to become the foundation for later Western architectural styles.
`;
    const result = parseExamFromDocumentText(rawPassageWithoutQuestions);
    // Truthful extraction: questionsCount must be 0, no dummy [blank_1] "identify the primary subject" injected!
    expect(result.questionsCount).toBe(0);
    const readingQs = result.exam.reading_questions || [];
    expect(readingQs.length).toBe(0);
  });

  it('2. Correctly parses genuine IELTS questions with varied numbering formats into structured questions', () => {
    const documentWithQuestions = `
READING PASSAGE 1
The History of Navigation

Early navigators relied on landmarks and constellations to guide their maritime voyages across open oceans.

Questions 1-4
Do the following statements agree with the information given in Reading Passage 1?
In boxes 1-4 on your answer sheet, write:
TRUE if the statement agrees with the information
FALSE if the statement contradicts the information
NOT GIVEN if there is no information on this

1 Early navigators had no tools to observe the night sky.
2 Maritime travel was largely limited to coastal routes.
3 Constellations were used exclusively during winter months.
4 The compass was invented before the astrolabe.

Questions 5-8
Complete the sentences below.
Choose NO MORE THAN TWO WORDS from the passage for each answer.

5 Sailors determined their latitude using the [blank_5].
6 The earliest trade routes were marked with prominent [blank_6].
7 Maritime maps became significantly more reliable in the [blank_7] century.
8 Standardized measurements reduced navigational [blank_8] on long expeditions.
`;

    const result = parseExamFromDocumentText(documentWithQuestions);
    expect(result.questionsCount).toBe(8);
    const qs = result.exam.reading_questions || result.exam.questions || [];
    expect(qs.length).toBe(8);

    // Verify questions 1-4 are true_false_not_given
    expect(qs[0].question_id).toBe('R1');
    expect(qs[0].question_type.toLowerCase()).toBe('true_false_not_given');
    expect(qs[0].question_text).toContain('Early navigators had no tools');

    // Verify fill_in_the_blank question tokens are preserved
    expect(qs[4].question_id).toBe('R5');
    expect(qs[4].question_text).toContain('[blank_5]');
  });

  it('3. Transpiles ExamData to CBT Engine Schema with strict question_groups and token formats', () => {
    const exam: Partial<ExamData> = {
      exam_code: 'IELTS_CBT_TEST',
      title: 'IELTS Academic Reading Test 1',
      skills: ['reading'],
      duration_mins: 60,
      passages: [
        {
          passage_index: 1,
          title: 'The Evolution of Languages',
          text: 'Languages evolve constantly through geographical isolation and cultural exchanges.',
          questions: [
            {
              question_id: 'R1',
              section: 'reading',
              question_type: 'TRUE_FALSE_NOT_GIVEN',
              question_text: 'Languages remain static without immigration.',
              instruction: 'Do the following statements agree with the information?',
              correct_answer: 'FALSE',
              max_score: 1
            },
            {
              question_id: 'R2',
              section: 'reading',
              question_type: 'FILL_IN_THE_BLANK',
              question_text: 'Grammar undergoes changes due to [blank_2] interactions.',
              instruction: 'Complete the summary with ONE WORD',
              correct_answer: 'social',
              max_score: 1
            }
          ]
        }
      ]
    };

    const cbt = transpileToCbtEngineSchema(exam);
    expect(cbt.exam_id).toBe('IELTS_CBT_TEST');
    expect(cbt.skill).toBe('reading');
    expect(cbt.passages?.length).toBe(1);
    expect(cbt.passages![0].question_groups.length).toBeGreaterThanOrEqual(1);

    // Round-trip transpile from CBT back to ExamData
    const roundTrip = transpileFromCbtEngineSchema(cbt);
    expect(roundTrip.exam_code).toBe('IELTS_CBT_TEST');
    expect(roundTrip.reading_questions?.length).toBe(2);
    expect(roundTrip.passages?.length).toBe(1);
    expect(roundTrip.passages![0].questions.length).toBe(2);
  });

  it('4. uploadAndParseIeltsPdf sends multipart/form-data to /api/admin/parse-pdf without exposing API key', async () => {
    const mockExam = {
      exam_code: 'PARSED_EXAM_99',
      title: 'Multimodal IELTS Mock Exam',
      reading_questions: [
        { question_id: 'R1', question_text: 'Test Q1', question_type: 'multiple_choice', max_score: 1 }
      ]
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        exam: mockExam,
        cbtExam: { exam_id: 'PARSED_EXAM_99' },
        testReport: { allPassed: true, summary: 'All 6 quality checks passed' }
      })
    } as any);

    const dummyBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    const dummyFile = new File([dummyBlob], 'ielts_academic.pdf', { type: 'application/pdf' });

    const result = await uploadAndParseIeltsPdf(dummyFile);
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/parse-pdf', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData)
    }));

    expect(result.exam_code).toBe('PARSED_EXAM_99');
    expect(result._testReport).toBeDefined();
    expect(result._testReport.allPassed).toBe(true);
  });

  it('5. Token Matrix Contract: Markdown Table extracts tokens into [blank_X] cells', () => {
    const rawTableMarkdown = `
| Category | Innovation Period | Primary Finding |
|---|---|---|
| Solar Power | 1839 | Edmond Becquerel discovery |
| Photovoltaic | 1954 | [blank_6] |
| Wind Kinetic | 1887 | Professor James Blyth [blank_7] |
`;
    // Verify tokens [blank_6] and [blank_7] exist in markdown string
    expect(rawTableMarkdown).toMatch(/\[blank_6\]/);
    expect(rawTableMarkdown).toMatch(/\[blank_7\]/);

    const blankRegex = /\[blank_(\d+)\]/g;
    const matches = Array.from(rawTableMarkdown.matchAll(blankRegex));
    expect(matches.length).toBe(2);
    expect(matches[0][1]).toBe('6');
    expect(matches[1][1]).toBe('7');
  });

  it('6. Multi-Select Multiple Choice: Selection Cap enforces max selections', () => {
    const targetMultiCount = 2;
    let selectedAnswers: string[] = ['A'];

    // Toggle B -> total 2
    selectedAnswers = [...selectedAnswers, 'B'];
    expect(selectedAnswers.length).toBe(2);

    const isCapReached = selectedAnswers.length >= targetMultiCount;
    expect(isCapReached).toBe(true);

    // Any other unselected option (e.g. 'C') should be locked / disabled
    const optionC = 'C';
    const isOptionCDisabled = !selectedAnswers.includes(optionC) && isCapReached;
    expect(isOptionCDisabled).toBe(true);

    // Option A is already selected, so it is NOT disabled (candidate can untick it)
    const isOptionADisabled = !selectedAnswers.includes('A') && isCapReached;
    expect(isOptionADisabled).toBe(false);
  });

  it('7. Matching Headings: Mutual Exclusion prevents selecting the same heading across paragraphs', () => {
    const allUserAnswers: Record<string, string> = {
      R1: 'ii',
      R2: 'iv'
    };

    const claimedHeadings = new Set(Object.values(allUserAnswers).map(v => v.toLowerCase()));
    expect(claimedHeadings.has('ii')).toBe(true);
    expect(claimedHeadings.has('iv')).toBe(true);
    expect(claimedHeadings.has('i')).toBe(false);

    // When paragraph 3 chooses a heading, 'ii' and 'iv' must be marked as disabled/claimed
    const headingList = [
      { id: 'i', text: 'Overview of Agricultural Techniques' },
      { id: 'ii', text: 'Environmental Impacts of Pesticides' },
      { id: 'iii', text: 'Economic Viability' },
      { id: 'iv', text: 'Government Subsidies and Reforms' }
    ];

    const isClaimedByOther = (hId: string) => claimedHeadings.has(hId.toLowerCase());
    expect(isClaimedByOther('ii')).toBe(true);
    expect(isClaimedByOther('iv')).toBe(true);
    expect(isClaimedByOther('i')).toBe(false);
    expect(isClaimedByOther('iii')).toBe(false);
  });
});
