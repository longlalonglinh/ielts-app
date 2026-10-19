import { describe, it, expect } from 'vitest';
import { 
  parseExamFromDocumentText,
  normalizeInlineTokens,
  canonicalizeToCbtQuestionType,
  transpileToCbtEngineSchema,
  transpileFromCbtEngineSchema
} from '../services/documentExamParser';

describe('IELTS Document & Copied Text Parser', () => {

  it('correctly extracts full reading passage, all 13 questions, and answer key from text', () => {
    const rawIeltsText = `READING PASSAGE 1
You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.

The Life and Discoveries of Marie Curie
Marie Curie is recognized as one of the most distinguished scientists in human history. Born Maria Sklodowska in Warsaw in 1867, she overcame financial hardship and gender prejudice to pursue scientific research in Paris. Together with her husband Pierre Curie, she conducted groundbreaking investigations into radioactivity, eventually isolating the elements polonium and radium.

Her discoveries transformed modern physics and medical therapy. In 1903, she was awarded the Nobel Prize in Physics alongside Pierre Curie and Henri Becquerel, becoming the first woman to receive the accolade. Following Pierre's tragic death in 1906, she succeeded him as Professor of General Physics at the Sorbonne, a milestone for female academia in Europe.

During the First World War, Curie devoted herself to the development of mobile radiological units—informally termed 'petites Curies'—which provided essential diagnostic imaging for wounded soldiers on the frontline. Despite experiencing chronic illness caused by prolonged exposure to ionizing radiation, she continued directing the Radium Institute until her death in 1934.

Questions 1-6
Do the following statements agree with the information given in Reading Passage 1?
In boxes 1-6 on your answer sheet, write:
TRUE if the statement agrees with the information
FALSE if the statement contradicts the information
NOT GIVEN if there is no information on this

1. Marie Curie was born in Poland.
2. Pierre Curie died before Marie Curie received her first Nobel Prize.
3. Marie Curie was the first woman to win a Nobel Prize.
4. Her parents were both prominent physicians in Warsaw.
5. She assumed her late husband's academic chair at the Sorbonne.
6. The mobile radiological vehicles were funded entirely by private philanthropists.

Questions 7-10
Choose the correct letter, A, B, C or D.

7. Which two chemical elements were isolated through Marie and Pierre Curie's research?
A. Uranium and thorium
B. Polonium and radium
C. Helium and plutonium
D. Cesium and cobalt

8. In what year did Marie Curie receive the Nobel Prize in Physics?
A. 1867
B. 1903
C. 1906
D. 1934

9. What was the colloquial name given to the mobile X-ray units used in World War I?
A. Sorbonne Ambulances
B. Warsaw Radiology Vans
C. Petites Curies
D. Radium Diagnostics

10. What was the primary cause of Marie Curie's long-term health decline?
A. Battlefield shrapnel wounds
B. Prolonged exposure to ionizing radiation
C. Severe chemical burns from acid
D. Malnutrition during her youth

Questions 11-13
Complete the sentences below.
Write NO MORE THAN TWO WORDS from the passage for each answer.

11. Marie Curie pursued her scientific education in the city of ________.
12. She shared her 1903 Nobel Prize with Pierre Curie and ________.
13. The mobile radiological ambulances provided essential ________ for wounded soldiers.

Answers:
1. TRUE
2. FALSE
3. TRUE
4. NOT GIVEN
5. TRUE
6. NOT GIVEN
7. B
8. B
9. C
10. B
11. Paris
12. Henri Becquerel
13. diagnostic imaging`;

    const result = parseExamFromDocumentText(rawIeltsText);

    expect(result.questionsCount).toBe(13);
    expect(result.hasPassage).toBe(true);
    expect(result.detectedTitle).toContain('Marie Curie');

    const readingQs = result.exam.reading_questions!;
    expect(readingQs).toHaveLength(13);

    // Questions 1-6: True/False/Not Given
    expect(readingQs[0].question_id).toBe('R1');
    expect(readingQs[0].question_type).toBe('true_false_not_given');
    expect(readingQs[0].question_text).toBe('Marie Curie was born in Poland.');
    expect(readingQs[0].correct_answer).toBe('TRUE');

    expect(readingQs[1].question_id).toBe('R2');
    expect(readingQs[1].correct_answer).toBe('FALSE');

    expect(readingQs[3].question_id).toBe('R4');
    expect(readingQs[3].correct_answer).toBe('NOT GIVEN');

    // Questions 7-10: Multiple Choice
    expect(readingQs[6].question_id).toBe('R7');
    expect(readingQs[6].question_type).toBe('multiple_choice');
    expect(readingQs[6].options).toHaveLength(4);
    expect(readingQs[6].options![0]).toBe('A. Uranium and thorium');
    expect(readingQs[6].options![1]).toBe('B. Polonium and radium');
    expect(readingQs[6].correct_answer).toBe('B');

    expect(readingQs[8].question_id).toBe('R9');
    expect(readingQs[8].correct_answer).toBe('C');

    // Questions 11-13: Fill in the blank
    expect(readingQs[10].question_id).toBe('R11');
    expect(readingQs[10].question_type).toBe('sentence_completion');
    expect(readingQs[10].correct_answer).toBe('Paris');

    expect(readingQs[11].question_id).toBe('R12');
    expect(readingQs[11].correct_answer).toBe('Henri Becquerel');

    expect(readingQs[12].question_id).toBe('R13');
    expect(readingQs[12].correct_answer).toBe('diagnostic imaging');

    // Verify passage text does NOT contain the Answer Key block
    expect(result.exam.reading_passage).not.toContain('Answers:');
    expect(result.exam.reading_passage).toContain('radioactivity, eventually isolating');
  });

  it('extracts writing tasks and listening questions if present in text', () => {
    const mixedExamText = `SECTION 1: Questions 1-3
Complete the form below.
Write NO MORE THAN TWO WORDS for each answer.

1. Candidate Surname: ________
2. Desired Course: ________
3. Preferred Start Date: ________

WRITING TASK 1
You should spend about 20 minutes on this task.
The table below gives information about railway passenger numbers in five European countries.
Write at least 150 words.

WRITING TASK 2
You should spend about 40 minutes on this task.
Some people believe that universities should focus exclusively on vocational skills. To what extent do you agree?
Write at least 250 words.

Answers:
1. Jenkins
2. Computer Science
3. September`;

    const result = parseExamFromDocumentText(mixedExamText);

    expect(result.hasListening).toBe(true);
    expect(result.hasWriting).toBe(true);
    expect(result.exam.listening_questions).toHaveLength(3);
    expect(result.exam.listening_questions![0].correct_answer).toBe('Jenkins');
    expect(result.exam.writing_task1_prompt).toContain('railway passenger numbers');
    expect(result.exam.writing_task2_prompt).toContain('vocational skills');
  });

  it('correctly handles matching headings, diverse numbering formats, and multi-passage tests without hardcoding questions', () => {
    const multiPassageIeltsText = `READING PASSAGE 1
You should spend about 20 minutes on Questions 1-5.

The Evolution of Wind Turbines
Wind energy has emerged as a cornerstone of modern renewable infrastructure. Paragraph A describes the earliest windmills engineered in ancient Persia. Paragraph B explains the transition to industrial steel turbines in 20th century Europe. Paragraph C highlights cutting-edge offshore aerodynamic blades.

Questions 1-3
Choose the correct heading for each paragraph from the list of headings below.
List of Headings
i. Ancient origins and primitive mechanics
ii. The industrial revolution and steel developments
iii. Offshore installations and advanced aerodynamics
iv. Environmental controversies of avian impact

1. Paragraph A
2. Paragraph B
3. Paragraph C

Questions 4-5
Choose the correct letter, A, B, C or D.

Question 4: Where were the earliest known vertical windmills developed?
A. Ancient Greece
B. Ancient Persia
C. Roman Empire
D. Medieval Britain

(5) What material defined the 20th-century transition?
A Wood
B Bronze
C Industrial steel
D Carbon fiber

READING PASSAGE 2
You should spend about 20 minutes on Questions 6-10.

Marine Ecosystem Dynamics
Coral reefs represent some of the most biodiverse aquatic habitats on earth. Ocean acidification and rising sea surface temperatures threaten reef calcification processes globally.

Questions 6-8
Do the following statements agree with the information given in Reading Passage 2?
In boxes 6-8 on your answer sheet, write:
TRUE if the statement agrees with the information
FALSE if the statement contradicts the information
NOT GIVEN if there is no information on this

6. Coral reefs possess high levels of biological diversity.
7. Ocean acidification accelerates coral reef calcification.
8. Deep water marine trenches have completely stopped warming.

Questions 9-10
Complete the sentences below.
Write NO MORE THAN TWO WORDS.

9. Marine calcification is primarily threatened by ocean ________.
10. Coral reef habitats are among the most ________ in the world.

Answers:
1. i
2. ii
3. iii
4. B
5. C
6. TRUE
7. FALSE
8. NOT GIVEN
9. acidification
10. biodiverse`;

    const result = parseExamFromDocumentText(multiPassageIeltsText);

    // Assert multi-passage recognized
    expect(result.passageCount).toBe(2);
    expect(result.questionsCount).toBe(10);
    expect(result.exam.passages).toHaveLength(2);

    const questions = result.exam.reading_questions!;
    expect(questions).toHaveLength(10);

    // Questions 1-3: Matching Headings
    expect(questions[0].question_id).toBe('R1');
    expect(questions[0].question_type).toBe('matching_headings');
    expect(questions[0].correct_answer).toBe('i');

    expect(questions[1].question_id).toBe('R2');
    expect(questions[1].question_type).toBe('matching_headings');
    expect(questions[1].correct_answer).toBe('ii');

    expect(questions[2].question_id).toBe('R3');
    expect(questions[2].correct_answer).toBe('iii');

    // Questions 4-5: Multiple choice with diverse numbering (Question 4: and (5))
    expect(questions[3].question_id).toBe('R4');
    expect(questions[3].question_type).toBe('multiple_choice');
    expect(questions[3].correct_answer).toBe('B');

    expect(questions[4].question_id).toBe('R5');
    expect(questions[4].question_type).toBe('multiple_choice');
    expect(questions[4].options).toHaveLength(4);
    expect(questions[4].correct_answer).toBe('C');

    // Questions 6-8 in Passage 2: True/False/Not Given
    expect(questions[5].question_id).toBe('R6');
    expect(questions[5].question_type).toBe('true_false_not_given');
    expect(questions[5].correct_answer).toBe('TRUE');

    expect(questions[6].question_id).toBe('R7');
    expect(questions[6].correct_answer).toBe('FALSE');

    expect(questions[7].question_id).toBe('R8');
    expect(questions[7].correct_answer).toBe('NOT GIVEN');

    // Questions 9-10 in Passage 2: Completion
    expect(questions[8].question_id).toBe('R9');
    expect(questions[8].question_type).toBe('sentence_completion');
    expect(questions[8].correct_answer).toBe('acidification');

    expect(questions[9].question_id).toBe('R10');
    expect(questions[9].correct_answer).toBe('biodiverse');
  });

  it('correctly parses IELTS Cambridge PDF format where question numbers are on their own lines', () => {
    const rawCambridge = `READING PASSAGE 1
Crop-growing skyscrapers
By the year 2050, nearly 80% of the Earth's population will live in urban centres.

Questions 1-3
Complete the sentences below.
Choose NO MORE THAN TWO WORDS from the passage for each answer.

1
Indoor farming would reduce the risk of infectious diseases transmitted through agricultural runoff.

2
Desalination plants could supply water directly through recycled domestic sources.

3
Pests would be eliminated without using any chemical pesticides.`;

    const result = parseExamFromDocumentText(rawCambridge);
    expect(result.questionsCount).toBe(3);
    expect(result.hasPassage).toBe(true);

    const qs = result.exam.reading_questions!;
    expect(qs).toHaveLength(3);
    expect(qs[0].question_id).toBe('R1');
    expect(qs[0].question_text).toContain('Indoor farming');
    expect(qs[1].question_id).toBe('R2');
    expect(qs[1].question_text).toContain('Desalination');
    expect(qs[2].question_id).toBe('R3');
    expect(qs[2].question_text).toContain('Pests');
  });

  it('correctly parses Vietnamese formatted questions and brackets', () => {
    const rawVn = `ĐỀ THI IELTS READING
Bài đọc: Lịch sử năng lượng mặt trời
Năng lượng mặt trời đã được sử dụng từ thời cổ đại để sưởi ấm và nấu nướng.

Câu 1: Năng lượng mặt trời được phát hiện vào năm nào?
A. 1839
B. 1883
C. 1954
D. 2000

Câu 2: Ai là người phát minh ra pin selenium đầu tiên?
A. Becquerel
B. Charles Fritts
C. Einstein
D. Newton`;

    const result = parseExamFromDocumentText(rawVn);
    expect(result.questionsCount).toBe(2);
    expect(result.hasPassage).toBe(true);

    const qs = result.exam.reading_questions!;
    expect(qs[0].question_id).toBe('R1');
    expect(qs[0].question_type).toBe('multiple_choice');
    expect(qs[0].options).toHaveLength(4);
    expect(qs[1].question_id).toBe('R2');
    expect(qs[1].options).toHaveLength(4);
  });

  it('correctly extracts inline blank summary completion questions', () => {
    const rawSummary = `READING PASSAGE 1
The Discovery of Solar Power
The solar industry started in 1839 when Edmond Becquerel observed the photovoltaic effect.

Questions 1-3
Complete the summary below.
Edmond Becquerel discovered the photovoltaic effect in (1) ............
Charles Fritts produced the first functioning selenium solar cell in (2) ............
Bell Laboratories created the first modern silicon solar cell in (3) ............`;

    const result = parseExamFromDocumentText(rawSummary);
    expect(result.questionsCount).toBe(3);

    const qs = result.exam.reading_questions!;
    expect(qs[0].question_id).toBe('R1');
    expect(qs[0].question_text).toContain('Becquerel');
    expect(qs[1].question_id).toBe('R2');
    expect(qs[1].question_text).toContain('Charles Fritts');
    expect(qs[2].question_id).toBe('R3');
    expect(qs[2].question_text).toContain('Bell Laboratories');
  });

  describe('CBT Engine Transpiler & Token Normalization Rules', () => {
    it('normalizes inline blank notations into standardized [blank_X] token', () => {
      expect(normalizeInlineTokens('Water boils at (5) under standard pressure.', 5))
        .toBe('Water boils at [blank_5] under standard pressure.');

      expect(normalizeInlineTokens('The compound dissolves in ______ at room temperature.', 6))
        .toBe('The compound dissolves in [blank_6] at room temperature.');

      expect(normalizeInlineTokens('Photosynthesis produces glucose and ............ as a byproduct.', 7))
        .toBe('Photosynthesis produces glucose and [blank_7] as a byproduct.');
    });

    it('strictly maps question categories to the 9 canonical CBT schema types', () => {
      expect(canonicalizeToCbtQuestionType('multiple_choice')).toBe('multiple_choice');
      expect(canonicalizeToCbtQuestionType('true_false_not_given')).toBe('true_false_not_given');
      expect(canonicalizeToCbtQuestionType('yes_no_not_given')).toBe('yes_no_not_given');
      expect(canonicalizeToCbtQuestionType('fill_in_blank')).toBe('fill_blank');
      expect(canonicalizeToCbtQuestionType('sentence_completion')).toBe('fill_blank');
      expect(canonicalizeToCbtQuestionType('summary_completion_box')).toBe('fill_blank');
      expect(canonicalizeToCbtQuestionType('table_completion')).toBe('fill_blank');
      expect(canonicalizeToCbtQuestionType('matching_headings')).toBe('matching_headings');
      expect(canonicalizeToCbtQuestionType('matching_information')).toBe('matching_information');
      expect(canonicalizeToCbtQuestionType('matching_features')).toBe('matching_features');
      expect(canonicalizeToCbtQuestionType('flow_chart_completion')).toBe('flow_chart_completion');
      expect(canonicalizeToCbtQuestionType('writing_task')).toBe('writing_task');
    });

    it('round-trip transpiles ExamData into the target deterministic CBT Engine Schema', () => {
      const mockExam = {
        exam_code: 'IELTS_ACAD_01',
        title: 'Academic Reading Test 1',
        skills: ['reading' as const],
        duration_mins: 60,
        passages: [
          {
            passage_index: 1 as const,
            title: 'The Roman Amphitheatre',
            text: 'Paragraph 1 text\n\nParagraph 2 text',
            questions: [
              {
                question_id: 'R1',
                section: 'reading' as const,
                question_type: 'multiple_choice' as const,
                question_text: 'Where was the structure constructed?',
                options: ['A. Rome', 'B. Athens', 'C. Alexandria'],
                correct_answer: 'A',
                acceptable_answers: ['A', 'Rome'],
                explanation: 'Built in Rome in 70 AD',
                max_score: 1
              },
              {
                question_id: 'R2',
                section: 'reading' as const,
                question_type: 'fill_in_blank' as const,
                question_text: 'The arena had an overall capacity of ______ spectators.',
                correct_answer: '50000',
                acceptable_answers: ['50,000', '50000'],
                explanation: 'Capacity reached 50,000',
                max_score: 1
              }
            ]
          }
        ]
      };

      const cbtSchema = transpileToCbtEngineSchema(mockExam);

      expect(cbtSchema.exam_id).toBe('IELTS_ACAD_01');
      expect(cbtSchema.skill).toBe('reading');
      expect(cbtSchema.passages).toHaveLength(1);
      expect(cbtSchema.passages![0].content).toBe('Paragraph 1 text\n\nParagraph 2 text');

      const groups = cbtSchema.passages![0].question_groups;
      expect(groups.length).toBeGreaterThanOrEqual(1);

      // Verify question 2 was normalized with [blank_2]
      const fillQ = groups.flatMap(g => g.questions).find(q => q.question_number === 2);
      expect(fillQ).toBeDefined();
      expect(fillQ?.question_text).toBe('The arena had an overall capacity of [blank_2] spectators.');

      // Round-trip transpile back to internal schema
      const restored = transpileFromCbtEngineSchema(cbtSchema);
      expect(restored.exam_code).toBe('IELTS_ACAD_01');
      expect(restored.reading_questions).toHaveLength(2);
      expect(restored.reading_questions![0].question_id).toBe('R1');
      expect(restored.reading_questions![1].question_id).toBe('R2');
    });
  });

  it('successfully extracts multi-blank summary questions even when dates or numbers precede the blanks', () => {
    const rawSummaryWithYears = `READING PASSAGE 1
The Evolution of Mobile Technology
Mobile phones have transformed worldwide communication.

Questions 1-2
Complete the summary below.
Choose NO MORE THAN TWO WORDS from the passage for each answer.

In 1973, Martin Cooper placed the world's first cellular phone call utilizing a prototype handset that weighed over [1] ____________ kilograms.
By 1992, engineers developed commercial network towers across [2] ____________ major European capitals.`;

    const result = parseExamFromDocumentText(rawSummaryWithYears);
    expect(result.questionsCount).toBe(2);
    expect(result.exam.reading_questions).toHaveLength(2);
    expect(result.exam.reading_questions![0].question_id).toBe('R1');
    expect(result.exam.reading_questions![1].question_id).toBe('R2');
  });

  it('correctly handles Writing-only documents without rejecting or throwing missing question errors', () => {
    const rawWritingPaper = `IELTS ACADEMIC WRITING TEST

WRITING TASK 1
You should spend about 20 minutes on this task.
The chart below shows the expenditure on consumer goods in four European countries.
Summarise the information by selecting and reporting the main features.

WRITING TASK 2
You should spend about 40 minutes on this task.
Some people believe that unpaid community service should be a compulsory part of high school programmes.
To what extent do you agree or disagree?`;

    const result = parseExamFromDocumentText(rawWritingPaper);
    expect(result.hasWriting).toBe(true);
    expect(result.questionsCount).toBeGreaterThanOrEqual(1);
    expect(result.exam.writing_task1_prompt).toContain('The chart below shows');
    expect(result.exam.writing_task2_prompt).toContain('unpaid community service');
  });

});
