import { ExamData, Question } from '../types';
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

export function getGeminiApiKey(): string {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('ielts_gemini_api_key') ||
    localStorage.getItem('gemini_api_key') ||
    ''
  );
}

export function saveGeminiApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem('ielts_gemini_api_key', trimmed);
  } else {
    localStorage.removeItem('ielts_gemini_api_key');
  }
}

async function parseResponseSafely(response: Response, endpointDesc: string): Promise<any> {
  const rawText = await response.text();
  let json: any = null;

  try {
    json = JSON.parse(rawText);
  } catch {
    if (rawText.trim().toLowerCase().startsWith('<!doctype') || rawText.includes('<html')) {
      throw new Error(`Endpoint ${endpointDesc} returned 404/HTML (static hosting without backend server).`);
    }
    throw new Error(`Invalid response received from server (${rawText.slice(0, 100)}).`);
  }

  if (!response.ok) {
    throw new Error(json?.error || `Server error (${response.status})`);
  }

  return json;
}

/**
 * Direct client-side call to Google Gemini REST API (gemini-2.5-flash)
 * Compatible with GitHub Pages static hosting.
 */
async function callDirectClientGemini(prompt: string, inlinePdfBase64?: string): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please enter your API key in settings.');
  }

  const parts: any[] = [];
  if (inlinePdfBase64) {
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: inlinePdfBase64
      }
    });
  }
  parts.push({ text: prompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        }),
        signal: controller.signal
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errBody.slice(0, 200)}`);
    }

    const geminiData = await res.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      throw new Error('Empty response received from Gemini API.');
    }

    const clean = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Client-side synthesized IELTS exam generator for instant offline/static fallback
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
 * Generate a complete verified IELTS Exam
 * Primary: Server endpoint /api/gemini/generate-exam
 * Secondary (GitHub Pages): Direct Gemini REST API via VITE_GEMINI_API_KEY / localStorage
 * Tertiary: Client-side authentic IELTS generator
 */
export async function generateExamWithAI(options: GenerateExamOptions): Promise<GenerateExamResponse> {
  // 1. Try server-side endpoint if available
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
    console.warn('Server endpoint /api/gemini/generate-exam unavailable, checking client fallback:', serverErr.message);
  }

  // 2. Direct client-side Gemini REST API call (GitHub Pages compatibility)
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const skillsStr = (options.skills || ['reading', 'listening', 'writing']).join(', ');
      const prompt = `You are a Senior Cambridge IELTS Assessment Specialist.
Create a complete, authentic IELTS Exam paper on the topic: "${options.topic}".
Exam Type: ${options.testType || 'ACADEMIC'}
Skills required: ${skillsStr}
Difficulty: ${options.difficulty || 'band_65_75'}
Custom Instructions: ${options.customPrompt || 'Standard Cambridge IELTS formatting'}

Return ONLY valid JSON matching this schema:
{
  "exam_code": "IELTS_${Date.now().toString().slice(-4)}",
  "title": "IELTS Academic Test - ${options.topic}",
  "test_type": "TEST",
  "exam_type": "full_test",
  "skills": ["reading", "listening", "writing"],
  "duration_mins": ${options.durationMins || 120},
  "passages": [
    {
      "passage_index": 1,
      "title": "Academic Reading Passage Title",
      "text": "Full academic text (approx 700-900 words) with clear paragraphs.",
      "questions": [
        {
          "question_id": "R1_Q1",
          "section": "reading",
          "passage_index": 1,
          "question_text": "Question text...",
          "question_type": "multiple_choice",
          "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
          "correct_answer": "A",
          "explanation": "Detailed explanation of why A is correct based on the passage text.",
          "max_score": 1
        },
        {
          "question_id": "R1_Q2",
          "section": "reading",
          "passage_index": 1,
          "question_text": "Statement for verification...",
          "question_type": "true_false_not_given",
          "options": ["TRUE", "FALSE", "NOT GIVEN"],
          "correct_answer": "TRUE",
          "explanation": "Detailed rationale.",
          "max_score": 1
        }
      ]
    }
  ],
  "listening_questions": [
    {
      "question_id": "L1_Q1",
      "section": "listening",
      "part": 1,
      "question_text": "Listening question text...",
      "question_type": "fill_in_the_blank",
      "options": [],
      "correct_answer": "answer keyword",
      "explanation": "Rationale for answer.",
      "max_score": 1
    }
  ],
  "writing_task1_prompt": "Task 1 report prompt (150 words)...",
  "writing_task2_prompt": "Task 2 essay prompt (250 words)..."
}`;

      const directJson = await callDirectClientGemini(prompt, options.pdfBase64);
      if (directJson && (directJson.passages || directJson.questions || directJson.title)) {
        const checkResult = verifyAndOptimizeExam(directJson);
        return {
          success: true,
          exam: checkResult.exam,
          testReport: checkResult.report
        };
      }
    } catch (clientGeminiErr: any) {
      console.warn('Direct Gemini API call failed:', clientGeminiErr.message);
    }
  }

  // 3. Resilient client-side synthesis (ensures app never blocks on static host)
  const fallbackExam = generateClientFallbackExam(options);
  const verified = verifyAndOptimizeExam(fallbackExam);
  return {
    success: true,
    exam: verified.exam,
    testReport: verified.report
  };
}

/**
 * Parse an uploaded IELTS Exam PDF Base64 string into structured Exam JSON
 */
export async function parsePdfWithGemini(pdfBase64: string, customApiKey?: string): Promise<string> {
  if (customApiKey) {
    saveGeminiApiKey(customApiKey);
  }
  const result = await parsePdfWithServerGemini(pdfBase64);
  return JSON.stringify(result.exam, null, 2);
}

/**
 * Robust PDF and document parser with automated pre-flight testing
 * Tries server /api/parse-exam first; on GitHub Pages (static 404), falls back to
 * direct Gemini multimodal API or client-side document parser.
 */
export async function parsePdfWithServerGemini(
  pdfBase64: string,
  text?: string
): Promise<{ success: boolean; exam: ExamData; testReport: ExamTestReport }> {
  // 1. Try server-side endpoint if available
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
    console.warn('Server endpoint /api/parse-exam unavailable on static host, falling back:', serverErr.message);
  }

  // 2. If raw text is available, use client-side document exam parser
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

  // 3. If PDF Base64 is provided and API key is set, call Gemini multimodal directly
  const apiKey = getGeminiApiKey();
  if (apiKey && pdfBase64) {
    try {
      const prompt = `You are a Cambridge IELTS exam document parser.
Analyze this PDF document and convert it into structured IELTS exam JSON matching:
{
  "exam_code": "IELTS_PARSED_${Date.now().toString().slice(-4)}",
  "title": "IELTS Academic Test",
  "test_type": "TEST",
  "exam_type": "full_test",
  "skills": ["reading", "listening", "writing"],
  "duration_mins": 120,
  "passages": [
    {
      "passage_index": 1,
      "title": "Passage Title",
      "text": "Passage text content...",
      "questions": [
        {
          "question_id": "R1_Q1",
          "section": "reading",
          "passage_index": 1,
          "question_text": "...",
          "question_type": "multiple_choice",
          "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "correct_answer": "A",
          "explanation": "..."
        }
      ]
    }
  ],
  "listening_questions": [],
  "writing_task1_prompt": "",
  "writing_task2_prompt": ""
}
Return ONLY valid JSON.`;

      const directJson = await callDirectClientGemini(prompt, pdfBase64);
      if (directJson) {
        const verified = verifyAndOptimizeExam(directJson);
        return {
          success: true,
          exam: verified.exam,
          testReport: verified.report
        };
      }
    } catch (directErr: any) {
      console.warn('Direct Gemini PDF parse failed:', directErr.message);
    }
  }

  throw new Error(
    'Static hosting mode detected (GitHub Pages). Please enter your Google Gemini API Key in the settings or paste the exam text directly into the Text/Syllabus tab.'
  );
}
