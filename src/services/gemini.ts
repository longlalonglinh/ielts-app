import { ExamData } from '../types';
import { ExamTestReport, verifyAndOptimizeExam } from './examVerification';
import { getApiUrl } from './api';
import { parseExamFromDocumentText } from './documentExamParser';

export interface GenerateExamOptions {
  mode?: 'topic' | 'document' | 'preset';
  topic: string;
  skills?: ('listening' | 'reading' | 'writing')[];
  difficulty?: 'band_5_6' | 'band_65_75' | 'band_8_9';
  questionCount?: number;
  durationMins?: number;
  customPrompt?: string;
  text?: string;
  pdfBase64?: string;
  testType?: 'ACADEMIC' | 'GENERAL_TRAINING';
  archetypeMix?: 'full_cambridge' | 'headings_and_blanks' | 'objective_only';
}

export interface GenerateExamResponse {
  success: boolean;
  exam: ExamData;
  testReport: ExamTestReport;
  error?: string;
}

async function parseResponseSafely(response: Response, endpointDesc: string): Promise<any> {
  const rawText = await response.text();
  let json: any = null;

  try {
    json = JSON.parse(rawText);
  } catch {
    if (rawText.trim().toLowerCase().startsWith('<!doctype') || rawText.includes('<html')) {
      throw new Error(`Endpoint ${endpointDesc} returned an HTML response instead of JSON.`);
    }
    throw new Error(`Invalid response received from server (${rawText.slice(0, 100)}).`);
  }

  if (!response.ok) {
    throw new Error(json?.error || `Server error (${response.status})`);
  }

  return json;
}

/**
 * Client-side synthesized IELTS exam generator for offline resilience
 */
function generateClientFallbackExam(options: GenerateExamOptions): ExamData {
  const codeNum = Date.now().toString().slice(-4);
  const examCode = `IELTS_${options.testType === 'GENERAL_TRAINING' ? 'GT' : 'ACAD'}_${codeNum}`;
  const skills = options.skills || ['reading', 'listening', 'writing'];
  const topic = options.topic || 'Environmental Sustainability and Technological Innovation';

  return {
    exam_code: examCode,
    title: `IELTS Academic Test - ${topic}`,
    test_type: 'TEST',
    exam_type: skills.length === 1 ? 'one_skill' : skills.length === 2 ? 'two_skills' : 'full_test',
    skills: skills,
    duration_mins: options.durationMins || 120,
    listening_duration_mins: 35,
    reading_duration_mins: 60,
    writing_duration_mins: 60,
    status: 'draft',
    is_draft: true,
    passages: [
      {
        passage_index: 1,
        title: `Academic Research: ${topic}`,
        text: `In recent decades, global attention has increasingly focused on ${topic}. Scientists and policy analysts have highlighted that sustainable adaptation requires transformative structural shifts rather than incremental mitigation. Early empirical investigations revealed substantial variances in ecosystem resilience, predominantly driven by anthropogenic factors and technological integration.\n\nAccording to prominent environmental economists, the deployment of decentralized renewable grids coupled with regenerative resource modeling has yielded measurable reductions in environmental degradation. However, skeptics caution that the lifecycle footprint of emerging clean technologies must be systematically scrutinized. Life cycle assessment (LCA) methodologies demonstrate that raw mineral extraction and subsequent recycling efficiency remain critical determinants of overall ecological neutrality.\n\nFurthermore, institutional governance plays an indispensable role. Municipal programs that incorporate community-led stewardship consistently demonstrate higher compliance rates and long-term viability than centralized top-down mandates. As international accords continue to evolve, multidisciplinary consensus underscores the necessity of harmonizing technological innovation with equitable regulatory frameworks.`,
        questions: [
          {
            question_id: 'R1_Q1',
            section: 'reading',
            passage_index: 1,
            question_text: 'What is identified as a primary requirement for sustainable adaptation?',
            question_type: 'multiple_choice',
            options: [
              'A. Incremental mitigation steps',
              'B. Transformative structural shifts',
              'C. Complete cessation of mineral extraction',
              'D. Sole reliance on centralized governance'
            ],
            correct_answer: 'B',
            explanation: 'The passage explicitly states that sustainable adaptation requires transformative structural shifts rather than incremental mitigation.',
            max_score: 1
          },
          {
            question_id: 'R1_Q2',
            section: 'reading',
            passage_index: 1,
            question_text: 'Municipal initiatives with community-led stewardship demonstrate lower compliance than top-down mandates.',
            question_type: 'true_false_not_given',
            options: ['TRUE', 'FALSE', 'NOT GIVEN'],
            correct_answer: 'FALSE',
            explanation: 'The passage contradicts this statement, noting that community-led stewardship consistently demonstrates higher compliance rates.',
            max_score: 1
          },
          {
            question_id: 'R1_Q3',
            section: 'reading',
            passage_index: 1,
            question_text: 'Life cycle assessment evaluates raw mineral extraction and recycling efficiency.',
            question_type: 'true_false_not_given',
            options: ['TRUE', 'FALSE', 'NOT GIVEN'],
            correct_answer: 'TRUE',
            explanation: 'The passage confirms that LCA methodologies demonstrate raw mineral extraction and recycling efficiency remain critical determinants.',
            max_score: 1
          },
          {
            question_id: 'R1_Q4',
            section: 'reading',
            passage_index: 1,
            question_text: 'Decentralized renewable grids have resulted in measurable reductions in [BLANK].',
            question_type: 'FILL_IN_THE_BLANK',
            options: [],
            correct_answer: 'environmental degradation',
            explanation: 'The text states that decentralized renewable grids have yielded measurable reductions in environmental degradation.',
            max_score: 1,
            word_limit: 'NO MORE THAN TWO WORDS'
          }
        ]
      }
    ],
    listening_questions: skills.includes('listening') ? [
      {
        question_id: 'L1_Q1',
        section: 'listening',
        part: 1,
        question_text: 'The student orientation lecture will commence at [BLANK] in Hall B.',
        question_type: 'FILL_IN_THE_BLANK',
        options: [],
        correct_answer: '9:30 AM',
        explanation: 'Hall B orientation session begins promptly at 9:30 AM.',
        max_score: 1,
        word_limit: 'ONE TIME ONLY'
      },
      {
        question_id: 'L1_Q2',
        section: 'listening',
        part: 1,
        question_text: 'Which document must all attendees present upon registration?',
        question_type: 'multiple_choice',
        options: [
          'A. Student ID card with barcode',
          'B. Academic transcript',
          'C. Passport copy only',
          'D. Recommendation letter'
        ],
        correct_answer: 'A',
        explanation: 'Attendees are required to present their student ID card with barcode.',
        max_score: 1
      }
    ] : [],
    writing_task1_prompt: skills.includes('writing')
      ? 'The chart below shows global renewable energy adoption rates from 2010 to 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'
      : '',
    writing_task2_prompt: skills.includes('writing')
      ? `Some people believe that addressing ${topic.toLowerCase()} is solely the responsibility of national governments, while others argue that individuals and private corporations must play the primary role. Discuss both views and give your own opinion. Write at least 250 words.`
      : '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Generate a complete verified IELTS Exam via server-side Gemini endpoint (/api/gemini/generate-exam)
 * with resilient offline synthesis fallback.
 */
export async function generateExamWithAI(options: GenerateExamOptions): Promise<GenerateExamResponse> {
  try {
    const response = await fetch(getApiUrl('/api/gemini/generate-exam'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: options.mode || 'topic',
        topic: options.topic,
        skills: options.skills || ['listening', 'reading', 'writing'],
        difficulty: options.difficulty || 'band_65_75',
        questionCount: options.questionCount || 10,
        durationMins: options.durationMins || 120,
        customPrompt: options.customPrompt,
        text: options.text,
        pdf_base64: options.pdfBase64,
        testType: options.testType || 'ACADEMIC',
        archetypeMix: options.archetypeMix || 'full_cambridge'
      })
    });

    const data = await parseResponseSafely(response, 'AI Exam Generator');
    if (data.success && data.exam) {
      let verifiedExam = data.exam;
      let testReport = data.testReport;
      if (!testReport) {
        const checkResult = verifyAndOptimizeExam(verifiedExam);
        verifiedExam = checkResult.exam;
        testReport = checkResult.report;
      }
      return { success: true, exam: verifiedExam, testReport };
    }
  } catch (serverErr: any) {
    console.warn('Server endpoint /api/gemini/generate-exam unavailable, using local synthesizer fallback:', serverErr.message);
  }

  // Offline / unreachable server fallback
  const fallbackExam = generateClientFallbackExam(options);
  const verified = verifyAndOptimizeExam(fallbackExam);
  return {
    success: true,
    exam: verified.exam,
    testReport: verified.report
  };
}

/**
 * Parse an uploaded IELTS Exam PDF Base64 string into structured Exam JSON via server Gemini pipeline.
 */
export async function parsePdfWithGemini(pdfBase64: string): Promise<string> {
  const result = await parsePdfWithServerGemini(pdfBase64);
  return JSON.stringify(result.exam, null, 2);
}

/**
 * Robust PDF and document parser routed through server-side Gemini (/api/parse-exam)
 * with local deterministic text parsing fallback when server is unreachable.
 */
export async function parsePdfWithServerGemini(
  pdfBase64: string,
  text?: string
): Promise<{ success: boolean; exam: ExamData; testReport: ExamTestReport }> {
  let serverErrorMessage = '';

  // 1. Call server-side Gemini parser endpoint
  try {
    const response = await fetch(getApiUrl('/api/parse-exam'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_base64: pdfBase64, text: text })
    });

    const data = await parseResponseSafely(response, 'Document Exam Parser');
    if (data.success && data.exam) {
      let verifiedExam = data.exam;
      let testReport = data.testReport;
      if (!testReport) {
        const verified = verifyAndOptimizeExam(verifiedExam);
        verifiedExam = verified.exam;
        testReport = verified.report;
      }
      return { success: true, exam: verifiedExam, testReport };
    }
  } catch (serverErr: any) {
    serverErrorMessage = serverErr?.message || '';
    console.warn('Server endpoint /api/parse-exam failed or unavailable:', serverErrorMessage);
  }

  // 2. If raw text is available, fall back to deterministic client-side document exam parser
  if (text && text.trim().length > 20) {
    const parsed = parseExamFromDocumentText(text);
    const candidateExam: ExamData = {
      exam_code: parsed.exam.exam_code || `DOC_${Date.now().toString().slice(-4)}`,
      title: parsed.detectedTitle || parsed.exam.title || 'IELTS Extracted Exam Paper',
      test_type: parsed.exam.test_type || 'TEST',
      exam_type: (parsed.exam.exam_type as any) || 'full_test',
      skills: (parsed.exam.skills as any) || ['reading'],
      duration_mins: parsed.exam.duration_mins || 60,
      passages: (parsed.exam.passages as any) || [],
      listening_questions: (parsed.exam.listening_questions as any) || [],
      writing_task1_prompt: parsed.exam.writing_task1_prompt || '',
      writing_task2_prompt: parsed.exam.writing_task2_prompt || '',
      questions: parsed.exam.questions || [],
      status: 'draft',
      is_draft: true
    };

    const verified = verifyAndOptimizeExam(candidateExam);
    return {
      success: true,
      exam: verified.exam,
      testReport: verified.report
    };
  }

  throw new Error(
    serverErrorMessage ||
      'Unable to parse the uploaded PDF document on the server. Please paste the exam text into the Text/Syllabus tab and try again.'
  );
}
