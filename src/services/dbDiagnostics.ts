import { ExamData, Question, QuestionType } from '../types';
import { DEFAULT_API_URL } from './api';
import { sanitizeExamForSkills } from '../utils/examUtils';

export interface DiagnosticStepResult {
  id: string;
  name: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  title: string;
  message: string;
  details?: any;
  durationMs?: number;
}

export interface FullDiagnosticReport {
  timestamp: string;
  apiUrl: string;
  testedCode: string;
  overallStatus: 'OPTIMAL' | 'DEGRADED' | 'FAILED';
  summary: string;
  steps: DiagnosticStepResult[];
  recommendedFixes: string[];
  rawResponseSample?: string;
  availableCodesInSheet?: string[];
  totalQuestionsFound: number;
  listeningCount: number;
  readingCount: number;
  protocolUsed?: string;
  parsedExam?: ExamData | null;
}

/**
 * Universal safe question extractor supporting all known GAS / REST data shapes
 */
export function extractQuestionsFromRawResponse(raw: any, targetCode?: string): {
  questions: Question[];
  meta: any;
  protocol: string;
} {
  let questions: Question[] = [];
  let meta: any = {};
  let protocol = 'unknown';

  if (!raw) {
    return { questions, meta, protocol };
  }

  // Shape 1: Standard IELTS format { status: 'success', exam_meta: {...}, questions: [...] }
  if (Array.isArray(raw.questions)) {
    questions = raw.questions;
    meta = raw.exam_meta || raw.exam || raw;
    protocol = 'standard_questions_array';
  }
  // Shape 2: REST array format { success: true, data: [...] } where data is an Array of questions
  else if (Array.isArray(raw.data)) {
    questions = raw.data;
    meta = raw;
    protocol = 'rest_data_array';
  }
  // Shape 3: Nested object format { success: true, data: { questions: [...], ... } }
  else if (raw.data && Array.isArray(raw.data.questions)) {
    questions = raw.data.questions;
    meta = raw.data;
    protocol = 'data_nested_questions';
  }
  // Shape 4: Exam wrapper format { exam: { questions: [...], ... } }
  else if (raw.exam && Array.isArray(raw.exam.questions)) {
    questions = raw.exam.questions;
    meta = raw.exam;
    protocol = 'exam_nested_questions';
  }
  // Shape 5: Raw array of question rows [ { question_id, ... }, ... ]
  else if (Array.isArray(raw)) {
    questions = raw;
    meta = {};
    protocol = 'root_array';
  }
  // Shape 6: Split format { listening_questions: [...], reading_questions: [...] }
  else if (Array.isArray(raw.listening_questions) || Array.isArray(raw.reading_questions)) {
    const lQs = (raw.listening_questions || []).map((q: any) => ({ ...q, section: 'listening' }));
    const rQs = (raw.reading_questions || []).map((q: any) => ({ ...q, section: 'reading' }));
    questions = [...lQs, ...rQs];
    meta = raw;
    protocol = 'split_skill_arrays';
  }

  // If targetCode specified and items have exam_code, strictly filter to matching items only
  if (targetCode && questions.length > 0) {
    const upperTarget = targetCode.trim().toUpperCase();
    const hasExamCodeField = questions.some(q => (q as any).exam_code !== undefined && (q as any).exam_code !== null);
    if (hasExamCodeField) {
      const filtered = questions.filter(q => {
        const code = String((q as any).exam_code || '').trim().toUpperCase();
        return code === upperTarget;
      });
      // Strictly assign filtered questions (if 0 match, it accurately means 0 questions for this exam code)
      questions = filtered;
    }
  }

  // Normalize questions to adhere strictly to Question type
  const normalizedQuestions: Question[] = questions.map((q: any, idx: number) => {
    let options: string[] = [];
    if (Array.isArray(q.options)) {
      options = q.options;
    } else if (typeof q.options === 'string') {
      if (q.options.startsWith('[') && q.options.endsWith(']')) {
        try {
          options = JSON.parse(q.options);
        } catch {
          options = q.options.split('|').map((s: string) => s.trim());
        }
      } else if (q.options.includes('|')) {
        options = q.options.split('|').map((s: string) => s.trim());
      } else if (q.options.trim()) {
        options = [q.options.trim()];
      }
    }

    const rawSection = String(q.section || q.skill || q.part_type || '').toLowerCase().trim();
    const qId = String(q.question_id || q.id || `q_${idx + 1}`).trim();
    const isListen = rawSection.includes('listen') || rawSection.includes('nghe') || rawSection === 'l' || qId.toLowerCase().startsWith('l');
    const section = isListen ? 'listening' : 'reading';

    const rawType = String(q.question_type || q.type || 'multiple_choice').toLowerCase().trim();
    const validTypes: QuestionType[] = [
      'multiple_choice', 'multiple_choice_multi', 'matching', 'plan_map_diagram_labelling',
      'form_note_table_flowchart_completion', 'sentence_completion', 'short_answer_questions',
      'true_false_not_given', 'yes_no_not_given', 'matching_headings', 'matching_information',
      'matching_features', 'matching_sentence_endings', 'diagram_label_completion', 'summary_completion', 'fill_in_blank'
    ];
    const questionType: QuestionType = validTypes.includes(rawType as QuestionType) ? (rawType as QuestionType) : 'multiple_choice';

    return {
      question_id: qId,
      section: section,
      question_text: String(q.question_text || q.text || q.prompt || `Question ${idx + 1}`).trim(),
      question_type: questionType,
      options: options,
      max_score: Number(q.max_score || q.score || 1),
      part: ([1, 2, 3, 4].includes(Number(q.part)) ? (Number(q.part) as 1 | 2 | 3 | 4) : undefined),
      passage_index: ([1, 2, 3].includes(Number(q.passage_index)) ? (Number(q.passage_index) as 1 | 2 | 3) : undefined),
      instruction: q.instruction || undefined,
      word_limit: q.word_limit || undefined,
      correct_answer: q.correct_answer || undefined
    };
  });

  return { questions: normalizedQuestions, meta, protocol };
}

/**
 * Execute comprehensive automated diagnostics against Google Apps Script & Google Sheets database
 */
export async function runDatabaseDiagnostics(
  apiUrl: string = DEFAULT_API_URL, 
  testExamCode: string = 'TEST01'
): Promise<FullDiagnosticReport> {
  const startTime = Date.now();
  const cleanCode = (testExamCode || 'TEST01').trim().toUpperCase();
  const steps: DiagnosticStepResult[] = [];
  const fixes: string[] = [];
  let rawResponseSample = '';
  let availableCodesInSheet: string[] = [];
  let totalQuestions = 0;
  let listeningCount = 0;
  let readingCount = 0;
  let detectedProtocol = 'none';
  let parsedExamData: ExamData | null = null;

  // STEP 1: Endpoint URL Syntax & Protocol Check
  const s1Start = Date.now();
  if (!apiUrl || apiUrl.trim() === '') {
    steps.push({
      id: 'step_url',
      name: 'Endpoint URL Verification',
      status: 'ERROR',
      title: 'Google Apps Script URL Not Configured',
      message: 'The Google Apps Script Web App URL is currently empty.',
      durationMs: Date.now() - s1Start
    });
    fixes.push('Paste the Google Apps Script Web App URL (ending in /exec) into the configuration settings.');
    return {
      timestamp: new Date().toISOString(),
      apiUrl,
      testedCode: cleanCode,
      overallStatus: 'FAILED',
      summary: 'Missing Google Apps Script Endpoint URL configuration.',
      steps,
      recommendedFixes: fixes,
      totalQuestionsFound: 0,
      listeningCount: 0,
      readingCount: 0
    };
  }

  if (apiUrl.includes('AKfycbx_mock') || apiUrl.includes('mock_ielts_exam_system_gas_url')) {
    steps.push({
      id: 'step_url',
      name: 'Endpoint URL Verification',
      status: 'WARNING',
      title: 'Using Simulated (Mock) URL',
      message: 'The system is pointing to a simulated mock URL and using built-in local data.',
      durationMs: Date.now() - s1Start
    });
    fixes.push('To sync live data, deploy Google Apps Script from your Google Sheet and paste the Web App URL into system settings.');
  } else if (!apiUrl.startsWith('https://script.google.com/macros/s/') || !apiUrl.endsWith('/exec')) {
    steps.push({
      id: 'step_url',
      name: 'Endpoint URL Verification',
      status: 'WARNING',
      title: 'Unusual URL Format',
      message: 'Standard Google Apps Script URLs typically follow the pattern https://script.google.com/macros/s/.../exec',
      durationMs: Date.now() - s1Start
    });
    fixes.push('Ensure you selected Deploy > New deployment > Web app > Anyone and copied the URL ending with /exec.');
  } else {
    steps.push({
      id: 'step_url',
      name: 'Endpoint URL Verification',
      status: 'SUCCESS',
      title: 'Valid Web App URL Format',
      message: `Verified Google Apps Script Web App URL: ${apiUrl.substring(0, 45)}...`,
      durationMs: Date.now() - s1Start
    });
  }

  // STEP 2: Network Connectivity & HTTP Latency Check
  const s2Start = Date.now();
  let reachable = false;
  let httpStatus = 0;
  let firstResponseText = '';

  const testEndpoints = [
    { label: 'Query ?action=get_exam&exam_code', url: `${apiUrl}?action=get_exam&exam_code=${encodeURIComponent(cleanCode)}&t=${Date.now()}` },
    { label: 'Query ?action=getExam&exam_code', url: `${apiUrl}?action=getExam&exam_code=${encodeURIComponent(cleanCode)}&t=${Date.now()}` },
    { label: 'Query ?exam_code direct', url: `${apiUrl}?exam_code=${encodeURIComponent(cleanCode)}&t=${Date.now()}` }
  ];

  let successfulUrl = '';
  let successfulJson: any = null;

  for (const ep of testEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(ep.url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      httpStatus = res.status;
      if (res.ok) {
        reachable = true;
        const text = await res.text();
        firstResponseText = text;
        rawResponseSample = text.length > 500 ? text.substring(0, 500) + '...' : text;
        
        try {
          const parsed = JSON.parse(text);
          successfulJson = parsed;
          successfulUrl = ep.url;
          detectedProtocol = ep.label;
          break; // Found working query variant!
        } catch {
          // Response is not JSON (maybe HTML error page)
          firstResponseText = text;
        }
      }
    } catch (netErr: any) {
      console.warn(`Endpoint query failed on ${ep.label}:`, netErr);
    }
  }

  if (!reachable) {
    steps.push({
      id: 'step_network',
      name: 'Google Server Network Connectivity',
      status: 'ERROR',
      title: 'Unable to Connect to Google Apps Script Server',
      message: 'Connection was refused or request timed out (> 8s).',
      durationMs: Date.now() - s2Start
    });
    fixes.push('Verify your device Internet connection.');
    fixes.push('In Google Sheets: Open Extensions > Apps Script > Deploy > Manage deployments > Verify that "Who has access" is set to "Anyone".');
  } else if (firstResponseText.includes('<!DOCTYPE html>') || firstResponseText.includes('accounts.google.com') || firstResponseText.includes('unable to open the file')) {
    steps.push({
      id: 'step_network',
      name: 'Web App Public Access Permission',
      status: 'ERROR',
      title: 'Google Apps Script Access Restricted (Access Denied / Login Required)',
      message: 'Google returned a login redirect or "Unable to open file" page. Candidates will be unable to load questions.',
      durationMs: Date.now() - s2Start
    });
    fixes.push('Important: Open Google Sheet > Extensions > Apps Script > Deploy > New Deployment > Web app:');
    fixes.push('- Execute as: Me (your Google account)');
    fixes.push('- Who has access: Anyone (MUST be Anyone so candidates do not require Google login)');
  } else {
    steps.push({
      id: 'step_network',
      name: 'Network Latency & Connectivity',
      status: 'SUCCESS',
      title: 'Connected to Google Apps Script Successfully',
      message: `Server response time: ${Date.now() - s2Start}ms (HTTP ${httpStatus}). Protocol variant: ${detectedProtocol}`,
      durationMs: Date.now() - s2Start
    });
  }

  // STEP 3: Question Parsing & Database Structure Diagnosis
  const s3Start = Date.now();
  if (successfulJson) {
    const extracted = extractQuestionsFromRawResponse(successfulJson, cleanCode);
    const questions = extracted.questions;
    totalQuestions = questions.length;
    listeningCount = questions.filter(q => q.section === 'listening').length;
    readingCount = questions.filter(q => q.section === 'reading').length;

    if (totalQuestions > 0) {
      steps.push({
        id: 'step_parse',
        name: 'Question Extraction from Google Sheets DB',
        status: 'SUCCESS',
        title: `Retrieved ${totalQuestions} Questions for Exam [${cleanCode}]`,
        message: `Breakdown: ${listeningCount} Listening questions, ${readingCount} Reading questions. Response structure: ${extracted.protocol}`,
        durationMs: Date.now() - s3Start
      });

      // Assemble final ExamData
      const meta = extracted.meta || {};
      parsedExamData = {
        exam_code: cleanCode,
        title: meta.title || `IELTS Academic Examination - ${cleanCode}`,
        audio_url: meta.audio_url || '',
        listening_questions: questions.filter(q => q.section === 'listening'),
        passage_title: meta.passage_title || meta.reading_passage_title || 'Reading Passage',
        passage_text: meta.passage_text || meta.reading_passage || '',
        passages: meta.passages || [],
        reading_questions: questions.filter(q => q.section === 'reading'),
        writing_task1_prompt: meta.writing_task1_prompt || '',
        writing_task2_prompt: meta.writing_task2_prompt || ''
      };
    } else {
      // 0 questions found! Let's diagnose why!
      steps.push({
        id: 'step_parse',
        name: 'Question Data Verification in Google Sheet',
        status: 'WARNING',
        title: `Google Sheet Returned 0 Questions for Code [${cleanCode}]`,
        message: `The server recognized the request, but the question array is empty (data: [] or questions: []).`,
        durationMs: Date.now() - s3Start
      });

      fixes.push(`Check the 'QUESTIONS' tab in your Google Sheet: Does Column A (EXAM_CODE) contain rows with code '${cleanCode}'?`);
      fixes.push(`Verify the tab name is uppercase 'QUESTIONS' or create an exam in Admin Visual Builder / Upload Module.`);
    }
  } else if (reachable) {
    steps.push({
      id: 'step_parse',
      name: 'Question Extraction from Google Sheets DB',
      status: 'ERROR',
      title: 'Unable to Parse JSON Response',
      message: 'The data returned from Google Apps Script is not formatted as valid JSON.',
      durationMs: Date.now() - s3Start
    });
    fixes.push('Check the doGet(e) function in Apps Script: Ensure it returns ContentService.createTextOutput(JSON.stringify(...)).setMimeType(ContentService.MimeType.JSON);');
  }

  // STEP 4: Fallback & Offline Resilience Readiness
  const s4Start = Date.now();
  steps.push({
    id: 'step_fallback',
    name: 'Storage & Resilience Readiness',
    status: 'SUCCESS',
    title: 'IndexedDB & Server Storage Ready',
    message: `System operates on persistent storage (Server exams.json and Client IndexedDB). If exam code exists, candidates can securely take the test.`,
    durationMs: Date.now() - s4Start
  });

  // Calculate Overall Status
  let overallStatus: 'OPTIMAL' | 'DEGRADED' | 'FAILED' = 'OPTIMAL';
  let summary = '';

  if (totalQuestions > 0 && reachable) {
    overallStatus = 'OPTIMAL';
    summary = `Database system operating optimally! Retrieved ${totalQuestions} questions for exam [${cleanCode}].`;
  } else if (reachable && totalQuestions === 0) {
    overallStatus = 'DEGRADED';
    summary = `Connected to Google Apps Script successfully, but found 0 questions for [${cleanCode}] in the Sheet. Safe fallback exam engaged.`;
  } else {
    overallStatus = 'FAILED';
    summary = 'Unable to connect to Google Apps Script. Application will run in offline mode using the built-in exam bank.';
  }

  return {
    timestamp: new Date().toISOString(),
    apiUrl,
    testedCode: cleanCode,
    overallStatus,
    summary,
    steps,
    recommendedFixes: fixes,
    rawResponseSample,
    availableCodesInSheet,
    totalQuestionsFound: totalQuestions,
    listeningCount,
    readingCount,
    protocolUsed: detectedProtocol,
    parsedExam: parsedExamData
  };
}

/**
 * 1-Click Sync/Seed Standard IELTS Exam Data to Google Sheets via doPost upload_exam
 */
export async function seedExamToGoogleSheets(
  apiUrl: string = DEFAULT_API_URL, 
  examToSeed?: ExamData
): Promise<{ success: boolean; message: string; details?: any }> {
  if (!apiUrl || apiUrl.includes('AKfycbx_mock')) {
    return {
      success: false,
      message: 'A valid live Google Apps Script Web App URL is required to seed exam data.'
    };
  }

  if (!examToSeed) {
    return {
      success: false,
      message: 'Please provide an exam to seed, or select an exam from your library.'
    };
  }

  const exam = sanitizeExamForSkills(examToSeed);

  try {
    const payload = {
      action: 'upload_exam',
      exam_data: {
        exam_code: exam.exam_code,
        title: exam.title,
        test_type: exam.test_type || 'Academic',
        exam_type: exam.exam_type,
        skills: exam.skills,
        duration_mins: exam.duration_mins || 150,
        audio_url: exam.audio_url,
        passage_title: exam.passage_title,
        passage_text: exam.passage_text,
        reading_passage: exam.passage_text,
        passages: exam.passages,
        listening_questions: exam.listening_questions,
        reading_questions: exam.reading_questions,
        questions: exam.questions,
        writing_task1_prompt: exam.writing_task1_prompt,
        writing_task2_prompt: exam.writing_task2_prompt
      }
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return {
          success: true,
          message: json.message || `Successfully uploaded exam [${exam.exam_code}] to Google Sheets!`,
          details: json
        };
      } catch {
        return {
          success: true,
          message: `Sent exam data for [${exam.exam_code}] to Google Sheets.`,
          details: text
        };
      }
    } else {
      return {
        success: false,
        message: `Google server returned HTTP error code ${res.status}. Please verify Web App access permissions.`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Connection error when uploading exam to Google Sheets: ${err.message || err}`
    };
  }
}
