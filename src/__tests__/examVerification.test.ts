import { describe, it, expect } from 'vitest';
import { verifyAndOptimizeExam } from '../services/examVerification';
import { isAnswerCorrect } from '../services/answerScoring';
import { normalizeGoogleDriveImageUrl } from '../utils/imageUrl';

describe('AI Exam Generator - Pre-Flight Verification & Optimization Suite', () => {

  it('successfully verifies, tests, and validates a complete IELTS Academic exam', () => {
    const rawExam = {
      exam_code: 'IELTS_ACAD_01',
      title: 'IELTS Academic Mock Test - Renewable Energy Dynamics',
      test_type: 'TEST' as const,
      duration_mins: 120,
      audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
      reading_passage_title: 'Global Energy Transition and Wind Power Grid Integration',
      reading_passage: `The transition toward sustainable energy sources represents one of the most critical infrastructural undertakings of the twenty-first century. As conventional fossil fuel reserves deplete and climate agreements demand stringent carbon caps, national grid operators are pivoting toward decentralized renewable power. Wind energy, harvested both onshore and offshore, has emerged as a frontline candidate for baseload supplementation.

Modern multi-megawatt turbines incorporate aerodynamically optimized composite blades and variable-speed synchronous generators. These engineering advancements allow electricity production across a broad spectrum of atmospheric wind velocities. When integrated with high-voltage direct current (HVDC) transmission lines, energy harvested in remote offshore locations can be delivered to dense municipal centers with transmission losses below three percent.

Nevertheless, the intermittency of wind velocity poses substantial challenges to power grid equilibrium. Grid operators must balance instantaneous generation with continuous consumer demand. Pumped-storage hydroelectricity and advanced lithium iron phosphate battery complexes are increasingly deployed to buffer unexpected supply fluctuations, ensuring continuous grid resilience without recourse to peaking thermal generators.`,
      listening_questions: [
        {
          question_id: 'L1',
          section: 'listening' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'What is the primary benefit of offshore wind installations described in the audio?',
          options: ['A. Lower upfront equipment fabrication expense', 'B. Higher and more consistent atmospheric wind velocities', 'C. Complete elimination of grid transmission lines', 'D. Ability to operate without electrical generators'],
          correct_answer: 'B',
          acceptable_answers: ['B', 'Higher and more consistent atmospheric wind velocities'],
          explanation: 'Offshore installations access higher and more consistent atmospheric wind velocities.',
          max_score: 1
        },
        {
          question_id: 'L2',
          section: 'listening' as const,
          question_type: 'fill_in_blank' as const,
          question_text: 'Complete the sentence: Transmission loss is kept below ________ percent.',
          correct_answer: 'three',
          acceptable_answers: ['three', '3', '3%'],
          explanation: 'The audio cites transmission losses below three percent.',
          max_score: 1
        }
      ],
      reading_questions: [
        {
          question_id: 'R1',
          section: 'reading' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'According to paragraph 2, what technological component allows power delivery to municipal centers with minimal loss?',
          options: [
            'A. High-voltage direct current transmission lines',
            'B. Conventional open-cycle gas turbines',
            'C. Low-frequency underground cables',
            'D. Decentralized coal-fired stations'
          ],
          correct_answer: 'A',
          acceptable_answers: ['A', 'High-voltage direct current transmission lines'],
          explanation: 'Paragraph 2 highlights high-voltage direct current (HVDC) transmission lines.',
          max_score: 1
        },
        {
          question_id: 'R2',
          section: 'reading' as const,
          question_type: 'true_false_not_given' as const,
          question_text: 'Modern wind turbines only operate during periods of extreme gale-force winds.',
          options: ['TRUE', 'FALSE', 'NOT GIVEN'],
          correct_answer: 'FALSE',
          acceptable_answers: ['FALSE', 'F'],
          explanation: 'Paragraph 2 explains turbines allow electricity production across a broad spectrum of atmospheric wind velocities.',
          max_score: 1
        },
        {
          question_id: 'R3',
          section: 'reading' as const,
          question_type: 'fill_in_blank' as const,
          question_text: 'Complete the sentence: Grid intermittency is buffered using advanced lithium iron ________ battery complexes.',
          correct_answer: 'phosphate',
          acceptable_answers: ['phosphate'],
          explanation: 'Paragraph 3 refers to lithium iron phosphate battery complexes.',
          max_score: 1
        }
      ],
      writing_task1_prompt: 'The chart shows offshore wind capacity in gigawatts between 2010 and 2025. Summarise the features and make comparisons. Write at least 150 words.',
      writing_task2_prompt: 'Some people argue that governments should fund renewable energy transitions entirely through taxation. Do you agree or disagree? Write at least 250 words.'
    };

    const result = verifyAndOptimizeExam(rawExam);

    expect(result.report.passed).toBe(true);
    expect(result.report.score).toBe(100);
    expect(result.report.totalChecks).toBe(6);
    expect(result.report.passedChecks).toBe(6);
    expect(result.report.failedChecks).toBe(0);

    // Verify metrics
    expect(result.report.metrics.totalQuestions).toBe(5);
    expect(result.report.metrics.listeningCount).toBe(2);
    expect(result.report.metrics.readingCount).toBe(3);
    expect(result.report.metrics.scoringSimulationSuccessRate).toBe(100);
    expect(result.report.metrics.readingWordCount).toBeGreaterThan(150);

    // Verify structure
    expect(result.exam.passages).toHaveLength(1);
    expect(result.exam.passages[0].questions).toHaveLength(3);
  });

  it('auto-repairs unformatted options, lowercase true/false, and missing fields', () => {
    const imperfectRaw = {
      title: '', // Missing title
      exam_code: 'exam with spaces 101', // Invalid code with spaces
      duration_mins: 0, // Invalid duration
      reading_passage_title: 'Urban Ecology',
      reading_passage: 'Urban ecology explores the interaction of organisms within metropolitan built environments. Trees provide shade and air filtration.',
      listening_questions: [
        {
          question_id: '',
          section: 'listening' as any,
          question_type: 'mcq' as any, // non-standard type
          question_text: 'Where was the specimen collected?',
          options: ['Botanical garden', 'National park', 'Suburban backyard', 'River delta'], // Missing 'A. ', 'B. ' prefixes
          correct_answer: 'Botanical garden', // Text instead of letter
          max_score: 1
        }
      ],
      reading_questions: [
        {
          question_id: '',
          section: 'reading' as any,
          question_type: 'tfng' as any, // alias type
          question_text: 'Urban vegetation mitigates particulate air pollution.',
          options: [],
          correct_answer: 't', // lowercase shortcut
          max_score: 1
        }
      ]
    };

    const result = verifyAndOptimizeExam(imperfectRaw);

    expect(result.report.passed).toBe(true);
    expect(result.exam.exam_code).toBe('EXAM_WITH_SPACES_101');
    expect(result.exam.duration_mins).toBe(120);

    // Multiple choice question auto-repair
    const l1 = result.exam.listening_questions![0];
    expect(l1.question_type).toBe('multiple_choice');
    expect(l1.options![0]).toBe('A. Botanical garden');
    expect(l1.options![1]).toBe('B. National park');
    expect(l1.correct_answer).toBe('A');

    // True/False question auto-repair
    const r1 = result.exam.reading_questions![0];
    expect(r1.question_type).toBe('true_false_not_given');
    expect(r1.correct_answer).toBe('TRUE');
    expect(r1.options).toEqual(['TRUE', 'FALSE', 'NOT GIVEN']);

    // Auto-repairs array should report applied fixes
    expect(result.report.repairsApplied.length).toBeGreaterThan(0);
  });

  it('guarantees 100% solvability in dry-run scoring simulation', () => {
    const rawExam = {
      exam_code: 'SIM_TEST_99',
      title: 'Simulation Check Exam',
      reading_passage: 'Empirical research in biochemistry has established the structure of cellular membranes.',
      reading_questions: [
        {
          question_id: 'R1',
          section: 'reading' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'Select the optimal option:',
          options: ['A. Option Alpha', 'B. Option Beta', 'C. Option Gamma'],
          correct_answer: 'B',
          max_score: 1
        },
        {
          question_id: 'R2',
          section: 'reading' as const,
          question_type: 'true_false_not_given' as const,
          question_text: 'Membranes are entirely rigid barriers.',
          options: ['TRUE', 'FALSE', 'NOT GIVEN'],
          correct_answer: 'FALSE',
          max_score: 1
        },
        {
          question_id: 'R3',
          section: 'reading' as const,
          question_type: 'fill_in_blank' as const,
          question_text: 'Membrane fluidity is regulated by ________',
          correct_answer: 'cholesterol',
          max_score: 1
        }
      ]
    };

    const { exam, report } = verifyAndOptimizeExam(rawExam);

    expect(report.metrics.scoringSimulationSuccessRate).toBe(100);

    // Independent test using the application answerScoring engine
    const q1 = exam.questions!.find(q => q.question_id === 'R1')!;
    expect(isAnswerCorrect('B', q1.correct_answer, q1.acceptable_answers, q1.question_type)).toBe(true);
    expect(isAnswerCorrect('b ', q1.correct_answer, q1.acceptable_answers, q1.question_type)).toBe(true);
    expect(isAnswerCorrect('C', q1.correct_answer, q1.acceptable_answers, q1.question_type)).toBe(false);

    const q2 = exam.questions!.find(q => q.question_id === 'R2')!;
    expect(isAnswerCorrect('FALSE', q2.correct_answer, q2.acceptable_answers, q2.question_type)).toBe(true);
    expect(isAnswerCorrect('f', q2.correct_answer, q2.acceptable_answers, q2.question_type)).toBe(true);
    expect(isAnswerCorrect('TRUE', q2.correct_answer, q2.acceptable_answers, q2.question_type)).toBe(false);

    const q3 = exam.questions!.find(q => q.question_id === 'R3')!;
    expect(isAnswerCorrect('cholesterol', q3.correct_answer, q3.acceptable_answers, q3.question_type)).toBe(true);
    expect(isAnswerCorrect(' Cholesterol  ', q3.correct_answer, q3.acceptable_answers, q3.question_type)).toBe(true);
  });

  it('strictly preserves Task 1 image across all naming variants (image_url, imageUrl, writing_task1_image) in one-skill and multi-skill modes', () => {
    const oneSkillWritingExam = {
      exam_code: 'WT1004',
      title: 'IELTS Academic Writing One-Skill Drill',
      test_type: 'TEST' as const,
      exam_type: 'one_skill' as const,
      skills: ['writing' as const],
      duration_mins: 60,
      writing_duration_mins: 60,
      sections: [
        {
          skill: 'writing' as const,
          title: 'IELTS Writing Section',
          durationMinutes: 60,
          tasks: [
            {
              id: 'task-1',
              task_number: 1 as const,
              title: 'Academic Writing Task 1',
              prompt: 'The charts below show the number of Japanese tourists travelling abroad between 1985 and 1995.',
              imageUrl: 'data:image/jpeg;base64,mockJapaneseTouristsChartData1234567890==',
              min_words: 150,
              suggested_time_minutes: 20
            },
            {
              id: 'task-2',
              task_number: 2 as const,
              title: 'Academic Writing Task 2',
              prompt: 'Discuss advantages and disadvantages of international tourism.',
              min_words: 250,
              suggested_time_minutes: 40
            }
          ]
        }
      ]
    };

    const { exam, report } = verifyAndOptimizeExam(oneSkillWritingExam);

    expect(report.passed).toBe(true);
    expect(exam.writing_task1_image).toBe('data:image/jpeg;base64,mockJapaneseTouristsChartData1234567890==');
    expect(exam.writing_task1_image_url).toBe('data:image/jpeg;base64,mockJapaneseTouristsChartData1234567890==');
    expect(exam.writing_task1_imageUrl).toBe('data:image/jpeg;base64,mockJapaneseTouristsChartData1234567890==');
    expect(exam.exam_type).toBe('one_skill');
    expect(exam.skills).toContain('writing');
  });

  it('normalizes Google Drive sharing URLs to direct high-resolution thumbnail URLs', () => {
    const driveFileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    
    // File view link
    const viewUrl = `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
    expect(normalizeGoogleDriveImageUrl(viewUrl)).toBe(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`);

    // Open link
    const openUrl = `https://drive.google.com/open?id=${driveFileId}`;
    expect(normalizeGoogleDriveImageUrl(openUrl)).toBe(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`);

    // Direct uc link
    const ucUrl = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
    expect(normalizeGoogleDriveImageUrl(ucUrl)).toBe(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`);

    // lh3 usercontent link
    const lh3Url = `https://lh3.googleusercontent.com/d/${driveFileId}`;
    expect(normalizeGoogleDriveImageUrl(lh3Url)).toBe(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`);

    // Non-Drive URLs should remain unchanged
    const directCdnUrl = 'https://images.unsplash.com/photo-1543269865-cbf427effbad';
    expect(normalizeGoogleDriveImageUrl(directCdnUrl)).toBe(directCdnUrl);

    // Data URLs should remain untouched
    const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(normalizeGoogleDriveImageUrl(base64Data)).toBe(base64Data);

    // Empty input returns empty string
    expect(normalizeGoogleDriveImageUrl('')).toBe('');
  });

  it('guarantees that creating a One Skill Reading exam strips all listening questions and audio', () => {
    const mixedInput = {
      exam_code: 'READ_ONLY_01',
      title: 'IELTS Academic Reading Special Drill',
      test_type: 'TEST' as const,
      exam_type: 'one_skill' as const,
      skills: ['reading' as const],
      duration_mins: 60,
      audio_url: 'https://cdn.pixabay.com/audio/sample.mp3',
      reading_passage_title: 'Artificial Intelligence in Medical Diagnostics',
      reading_passage: 'Artificial intelligence is revolutionizing the healthcare sector with computer vision systems and neural network diagnostic algorithms.',
      reading_questions: [
        {
          question_id: 'R1',
          section: 'reading' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'What field is being revolutionized according to the text?',
          options: ['A. Healthcare', 'B. Transportation', 'C. Agriculture', 'D. Construction'],
          correct_answer: 'A',
          acceptable_answers: ['A', 'Healthcare'],
          explanation: 'Text directly highlights the healthcare sector.',
          max_score: 1
        }
      ],
      // Extraneous listening questions present in raw input (e.g. from default template)
      listening_questions: [
        {
          question_id: 'L1',
          section: 'listening' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'Who called the office?',
          options: ['A. John', 'B. Mary'],
          correct_answer: 'A',
          max_score: 1
        }
      ]
    };

    const { exam } = verifyAndOptimizeExam(mixedInput);

    expect(exam.exam_type).toBe('one_skill');
    expect(exam.skills).toEqual(['reading']);
    // Listening questions must be completely stripped out
    expect(exam.listening_questions).toHaveLength(0);
    expect(exam.audio_url).toBeUndefined();
    // Reading questions preserved
    expect(exam.reading_questions).toHaveLength(1);
    expect(exam.reading_questions![0].question_id).toBe('R1');
    // Unified questions list must ONLY contain the 1 reading question
    expect(exam.questions).toHaveLength(1);
    expect(exam.questions![0].section).toBe('reading');
  });

  it('guarantees that creating a One Skill Listening exam strips all reading passages and questions', () => {
    const mixedInput = {
      exam_code: 'LISTEN_ONLY_01',
      title: 'IELTS Academic Listening Drill',
      test_type: 'TEST' as const,
      exam_type: 'one_skill' as const,
      skills: ['listening' as const],
      duration_mins: 35,
      audio_url: 'https://cdn.pixabay.com/audio/sample.mp3',
      listening_questions: [
        {
          question_id: 'L1',
          section: 'listening' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'Where does the tour group meet?',
          options: ['A. Reception desk', 'B. Main entrance', 'C. Bus stop', 'D. Cafeteria'],
          correct_answer: 'A',
          acceptable_answers: ['A', 'Reception desk'],
          explanation: 'The guide asks the group to convene at the reception desk.',
          max_score: 1
        }
      ],
      // Extraneous reading questions from default template
      reading_passage_title: 'Unwanted Reading Passage',
      reading_passage: 'This passage should not be present in a listening-only exam.',
      reading_questions: [
        {
          question_id: 'R1',
          section: 'reading' as const,
          question_type: 'multiple_choice' as const,
          question_text: 'Unwanted reading question',
          options: ['A. 1', 'B. 2'],
          correct_answer: 'A',
          max_score: 1
        }
      ]
    };

    const { exam } = verifyAndOptimizeExam(mixedInput);

    expect(exam.exam_type).toBe('one_skill');
    expect(exam.skills).toEqual(['listening']);
    // Reading questions and passages must be completely stripped out
    expect(exam.reading_questions).toHaveLength(0);
    expect(exam.passages).toHaveLength(0);
    expect(exam.passage_text).toBeUndefined();
    // Listening questions preserved
    expect(exam.listening_questions).toHaveLength(1);
    expect(exam.listening_questions![0].question_id).toBe('L1');
    expect(exam.audio_url).toBe('https://cdn.pixabay.com/audio/sample.mp3');
    // Unified questions list must ONLY contain the 1 listening question
    expect(exam.questions).toHaveLength(1);
    expect(exam.questions![0].section).toBe('listening');
  });

});
