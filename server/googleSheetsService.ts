import { google, sheets_v4 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getStoredConfig, saveStoredConfig, saveStoredExam, getStoredExams } from './storage';

// In-Memory Fast Cache for Exams (Serves requests in < 5ms)
const serverExamMemoryCache = new Map<string, any>();

// In-Memory Submission Batch Queue to prevent hitting Google Sheets rate limits
interface QueuedSubmission {
  submission: any;
  queuedAt: number;
  retryCount: number;
}
let submissionQueue: QueuedSubmission[] = [];
let batchTimeoutHandle: NodeJS.Timeout | null = null;
const BATCH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 15;

/**
 * Resolves Google Service Account credentials from environment variables,
 * stored JSON config, or credential file paths.
 */
export function getServiceAccountCredentials(): {
  client_email?: string;
  private_key?: string;
  projectId?: string;
} | null {
  // Option 1: Direct JSON in process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim();
      if (!raw.startsWith('{')) {
        // Handle possible base64 encoded string
        raw = Buffer.from(raw, 'base64').toString('utf-8');
      }
      const parsed = JSON.parse(raw);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
          projectId: parsed.project_id
        };
      }
    } catch (e) {
      console.warn('[Google Sheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY env var:', e);
    }
  }

  // Option 2: Email and Private Key in distinct env vars
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
      private_key: process.env.GOOGLE_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
      projectId: process.env.GOOGLE_PROJECT_ID
    };
  }

  // Option 3: Stored configuration from Admin panel
  const config = getStoredConfig() as any;
  if (config.service_account_json) {
    try {
      let raw = config.service_account_json.trim();
      if (!raw.startsWith('{')) {
        raw = Buffer.from(raw, 'base64').toString('utf-8');
      }
      const parsed = JSON.parse(raw);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
          projectId: parsed.project_id
        };
      }
    } catch (e) {
      console.warn('[Google Sheets] Failed to parse stored service_account_json:', e);
    }
  }

  if (config.service_account_email && config.service_account_private_key) {
    return {
      client_email: config.service_account_email.trim(),
      private_key: config.service_account_private_key.trim().replace(/\\n/g, '\n'),
      projectId: config.service_account_project_id
    };
  }

  // Option 4: Local file service-account.json in root or server_data
  const possiblePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), 'service-account.json'),
    path.join(process.cwd(), 'server_data', 'service-account.json')
  ].filter(Boolean) as string[];

  for (const credPath of possiblePaths) {
    if (fs.existsSync(credPath)) {
      try {
        const raw = fs.readFileSync(credPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.client_email && parsed.private_key) {
          return {
            client_email: parsed.client_email,
            private_key: parsed.private_key.replace(/\\n/g, '\n'),
            projectId: parsed.project_id
          };
        }
      } catch (e) {
        console.warn(`[Google Sheets] Failed to read credential file at ${credPath}:`, e);
      }
    }
  }

  return null;
}

/**
 * Checks whether a Google Service Account is configured.
 */
export function isServiceAccountConfigured(): boolean {
  return getServiceAccountCredentials() !== null;
}

/**
 * Initializes and returns an authenticated Google Sheets v4 API client.
 */
export function getGoogleSheetsClient(): sheets_v4.Sheets | null {
  const credentials = getServiceAccountCredentials();
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Retrieves the effective Google Spreadsheet ID from config or environment.
 */
export function getEffectiveSpreadsheetId(explicitId?: string): string {
  if (explicitId && explicitId.trim()) {
    const clean = explicitId.trim();
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : clean;
  }

  const config = getStoredConfig() as any;
  if (config.spreadsheet_id && config.spreadsheet_id.trim()) {
    const clean = config.spreadsheet_id.trim();
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : clean;
  }

  const envId = process.env.GOOGLE_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '';
  if (envId.trim()) {
    const clean = envId.trim();
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : clean;
  }

  return '';
}

/**
 * Fetches all exam rows from the private Google Sheet 'EXAMS' tab via Google Sheets API v4.
 */
export async function fetchExamsFromSheet(spreadsheetId?: string): Promise<any[]> {
  const sheets = getGoogleSheetsClient();
  const sheetId = getEffectiveSpreadsheetId(spreadsheetId);

  if (!sheets || !sheetId) {
    throw new Error('Google Service Account or Spreadsheet ID is not configured.');
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'EXAMS!A2:K',
    valueRenderOption: 'UNFORMATTED_VALUE'
  });

  const rows = res.data.values || [];
  return rows.map((row) => {
    const examCode = String(row[0] || '').trim().toUpperCase();
    const title = String(row[1] || `IELTS Examination - ${examCode}`).trim();
    const testType = String(row[2] || 'TEST').trim().toUpperCase() === 'PRACTICE' ? 'PRACTICE' : 'TEST';
    
    // Duration parse safe fallback to 120
    const rawDur = row[3];
    const parsedDur = typeof rawDur === 'number' ? rawDur : Number(rawDur);
    const durationMins = !isNaN(parsedDur) && parsedDur > 0 ? parsedDur : 120;

    const audioUrl = String(row[4] || '').trim();
    const readingPassage = String(row[5] || '').trim();
    const writingTask1Prompt = String(row[6] || '').trim();
    const writingTask2Prompt = String(row[7] || '').trim();
    const writingTask1Image = String(row[8] || '').trim();
    const audioTitle = String(row[9] || '').trim();
    const createdAt = String(row[10] || '').trim();

    return {
      exam_code: examCode,
      title,
      test_type: testType,
      duration_mins: durationMins,
      audio_url: audioUrl,
      audio_title: audioTitle,
      reading_passage: readingPassage,
      writing_task1_prompt: writingTask1Prompt,
      writing_task2_prompt: writingTask2Prompt,
      writing_task1_image: writingTask1Image,
      created_at: createdAt
    };
  }).filter(e => Boolean(e.exam_code));
}

/**
 * Fetches all questions from the private Google Sheet 'QUESTIONS' tab via Google Sheets API v4.
 * Note: Col G contains CORRECT_ANSWER, which is preserved ONLY in Server Memory for authoritative grading.
 */
export async function fetchQuestionsFromSheet(spreadsheetId?: string, examCode?: string): Promise<any[]> {
  const sheets = getGoogleSheetsClient();
  const sheetId = getEffectiveSpreadsheetId(spreadsheetId);

  if (!sheets || !sheetId) {
    throw new Error('Google Service Account or Spreadsheet ID is not configured.');
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'QUESTIONS!A2:H',
    valueRenderOption: 'UNFORMATTED_VALUE'
  });

  const rows = res.data.values || [];
  const targetCode = examCode ? examCode.trim().toUpperCase() : null;

  const parsedQuestions = rows.map((row, idx) => {
    const rowExamCode = String(row[0] || '').trim().toUpperCase();
    const qId = String(row[1] || `Q${idx + 1}`).trim();
    const section = String(row[2] || 'reading').toLowerCase().trim() as 'listening' | 'reading';
    const questionText = String(row[3] || '').trim();
    const questionType = String(row[4] || 'multiple_choice').toLowerCase().trim();

    // Parse options: supports JSON array, pipe-delimited (|), or newline-separated (\n)
    let options: string[] = [];
    const rawOptions = row[5];
    if (rawOptions !== undefined && rawOptions !== null) {
      const strOptions = String(rawOptions).trim();
      if (strOptions) {
        try {
          const parsedJson = JSON.parse(strOptions);
          if (Array.isArray(parsedJson)) {
            options = parsedJson.map((o: any) => String(o).trim()).filter(Boolean);
          } else if (typeof parsedJson === 'string') {
            options = [parsedJson.trim()];
          }
        } catch {
          if (strOptions.includes('|')) {
            options = strOptions.split('|').map((o: string) => o.trim()).filter(Boolean);
          } else if (strOptions.includes('\n')) {
            options = strOptions.split('\n').map((o: string) => o.trim()).filter(Boolean);
          } else {
            options = [strOptions];
          }
        }
      }
    }

    // Col G (index 6): CORRECT_ANSWER - Authoritative answer key
    const correctAnswer = row[6] !== undefined && row[6] !== null ? String(row[6]).trim() : '';

    // Col H (index 7): MAX_SCORE
    const rawScore = Number(row[7]);
    const maxScore = !isNaN(rawScore) && rawScore > 0 ? rawScore : 1;

    return {
      exam_code: rowExamCode,
      question_id: qId,
      section,
      question_text: questionText,
      question_type: questionType,
      options,
      correct_answer: correctAnswer,
      max_score: maxScore,
      question_number: idx + 1
    };
  }).filter(q => Boolean(q.exam_code));

  if (targetCode) {
    return parsedQuestions.filter(q => q.exam_code === targetCode);
  }
  return parsedQuestions;
}

/**
 * Builds and synchronizes a complete IELTS exam from Google Sheets into the Server In-Memory Cache.
 */
export async function syncExamFromGoogleSheets(
  examCode: string,
  spreadsheetId?: string
): Promise<{ success: boolean; exam?: any; error?: string }> {
  const cleanCode = (examCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'Exam code is required.' };
  }

  try {
    const [allExams, questions] = await Promise.all([
      fetchExamsFromSheet(spreadsheetId),
      fetchQuestionsFromSheet(spreadsheetId, cleanCode)
    ]);

    const examMeta = allExams.find(e => e.exam_code === cleanCode);
    if (!examMeta) {
      return {
        success: false,
        error: `Exam code [${cleanCode}] was not found in the EXAMS tab on Google Sheet.`
      };
    }

    const listeningQuestions = questions.filter(q => q.section === 'listening');
    const readingQuestions = questions.filter(q => q.section === 'reading');

    // Build Passages (Supports Multi-Passage delimiter '--- Passage Divider ---')
    let passages: any[] = [];
    const rawPassage = examMeta.reading_passage || '';
    if (rawPassage) {
      if (rawPassage.includes('--- Passage Divider ---')) {
        const chunks = rawPassage
          .split(/\r?\n\s*---\s*Passage Divider\s*---\s*\r?\n|--- Passage Divider ---/i)
          .map((c: string) => c.trim())
          .filter(Boolean);

        const totalReading = readingQuestions.length;
        const chunkCount = Math.max(chunks.length, 1);

        passages = chunks.map((chunkText: string, idx: number) => {
          const pIndex = idx + 1;
          const startIdx = Math.floor((idx * totalReading) / chunkCount);
          const endIdx = Math.floor(((idx + 1) * totalReading) / chunkCount);
          const assigned = readingQuestions.slice(startIdx, endIdx).map(q => ({
            ...q,
            passage_index: pIndex
          }));

          return {
            passage_index: pIndex,
            title: `Reading Passage ${pIndex}`,
            text: chunkText,
            questions: assigned
          };
        });
      } else {
        passages = [
          {
            passage_index: 1,
            title: 'Reading Passage 1',
            text: rawPassage,
            questions: readingQuestions.map(q => ({ ...q, passage_index: 1 }))
          }
        ];
      }
    }

    const skills: ('listening' | 'reading' | 'writing')[] = [];
    if (listeningQuestions.length > 0 || examMeta.audio_url) skills.push('listening');
    if (readingQuestions.length > 0 || rawPassage) skills.push('reading');
    if (examMeta.writing_task1_prompt || examMeta.writing_task2_prompt || examMeta.writing_task1_image) skills.push('writing');
    if (skills.length === 0) skills.push('reading');

    const examType = skills.length === 1 ? 'one_skill' : skills.length === 2 ? 'two_skills' : 'full_test';

    const fullExam = {
      exam_code: cleanCode,
      title: examMeta.title,
      test_type: examMeta.test_type,
      exam_type: examType,
      skills,
      duration_mins: examMeta.duration_mins,
      audio_url: examMeta.audio_url,
      audio_title: examMeta.audio_title,
      passage_title: 'Reading Passage 1',
      passage_text: rawPassage,
      reading_passage: rawPassage,
      passages,
      listening_questions: listeningQuestions,
      reading_questions: readingQuestions,
      questions,
      writing_task1_prompt: examMeta.writing_task1_prompt,
      writing_task1_image: examMeta.writing_task1_image,
      writing_task1_image_url: examMeta.writing_task1_image,
      writing_task1_imageUrl: examMeta.writing_task1_image,
      writing_task2_prompt: examMeta.writing_task2_prompt,
      last_synced_at: new Date().toISOString()
    };

    // Store in RAM Cache (Sub-millisecond access) & persistent JSON file
    serverExamMemoryCache.set(cleanCode, fullExam);
    saveStoredExam(fullExam);

    return { success: true, exam: fullExam };
  } catch (err: any) {
    console.error(`[Google Sheets Sync Error for ${cleanCode}]:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes all exams from Google Sheets into the Server In-Memory Cache.
 */
export async function syncAllExamsFromGoogleSheets(
  spreadsheetId?: string
): Promise<{ success: boolean; count: number; exams: any[]; error?: string }> {
  try {
    const allExamMetas = await fetchExamsFromSheet(spreadsheetId);
    const allQuestions = await fetchQuestionsFromSheet(spreadsheetId);

    const syncedList: any[] = [];

    for (const examMeta of allExamMetas) {
      const code = examMeta.exam_code;
      const questions = allQuestions.filter(q => q.exam_code === code);
      const listeningQuestions = questions.filter(q => q.section === 'listening');
      const readingQuestions = questions.filter(q => q.section === 'reading');

      let passages: any[] = [];
      const rawPassage = examMeta.reading_passage || '';
      if (rawPassage) {
        if (rawPassage.includes('--- Passage Divider ---')) {
          const chunks = rawPassage
            .split(/\r?\n\s*---\s*Passage Divider\s*---\s*\r?\n|--- Passage Divider ---/i)
            .map((c: string) => c.trim())
            .filter(Boolean);

          const totalReading = readingQuestions.length;
          const chunkCount = Math.max(chunks.length, 1);

          passages = chunks.map((chunkText: string, idx: number) => {
            const pIndex = idx + 1;
            const startIdx = Math.floor((idx * totalReading) / chunkCount);
            const endIdx = Math.floor(((idx + 1) * totalReading) / chunkCount);
            const assigned = readingQuestions.slice(startIdx, endIdx).map(q => ({
              ...q,
              passage_index: pIndex
            }));

            return {
              passage_index: pIndex,
              title: `Reading Passage ${pIndex}`,
              text: chunkText,
              questions: assigned
            };
          });
        } else {
          passages = [
            {
              passage_index: 1,
              title: 'Reading Passage 1',
              text: rawPassage,
              questions: readingQuestions.map(q => ({ ...q, passage_index: 1 }))
            }
          ];
        }
      }

      const skills: ('listening' | 'reading' | 'writing')[] = [];
      if (listeningQuestions.length > 0 || examMeta.audio_url) skills.push('listening');
      if (readingQuestions.length > 0 || rawPassage) skills.push('reading');
      if (examMeta.writing_task1_prompt || examMeta.writing_task2_prompt || examMeta.writing_task1_image) skills.push('writing');
      if (skills.length === 0) skills.push('reading');

      const examType = skills.length === 1 ? 'one_skill' : skills.length === 2 ? 'two_skills' : 'full_test';

      const fullExam = {
        exam_code: code,
        title: examMeta.title,
        test_type: examMeta.test_type,
        exam_type: examType,
        skills,
        duration_mins: examMeta.duration_mins,
        audio_url: examMeta.audio_url,
        audio_title: examMeta.audio_title,
        passage_title: 'Reading Passage 1',
        passage_text: rawPassage,
        reading_passage: rawPassage,
        passages,
        listening_questions: listeningQuestions,
        reading_questions: readingQuestions,
        questions,
        writing_task1_prompt: examMeta.writing_task1_prompt,
        writing_task1_image: examMeta.writing_task1_image,
        writing_task1_image_url: examMeta.writing_task1_image,
        writing_task1_imageUrl: examMeta.writing_task1_image,
        writing_task2_prompt: examMeta.writing_task2_prompt,
        last_synced_at: new Date().toISOString()
      };

      serverExamMemoryCache.set(code, fullExam);
      saveStoredExam(fullExam);
      syncedList.push(fullExam);
    }

    saveStoredConfig({ last_synced_at: new Date().toISOString() });

    return {
      success: true,
      count: syncedList.length,
      exams: syncedList
    };
  } catch (err: any) {
    console.error('[Google Sheets Sync All Error]:', err.message);
    return {
      success: false,
      count: 0,
      exams: [],
      error: err.message
    };
  }
}

/**
 * Returns exam directly from Server RAM Cache for ultra-fast latency (< 5ms).
 */
export function getCachedExam(examCode: string): any | null {
  const cleanCode = (examCode || '').trim().toUpperCase();
  if (serverExamMemoryCache.has(cleanCode)) {
    return serverExamMemoryCache.get(cleanCode);
  }
  return null;
}

/**
 * Stores exam into Server RAM Cache.
 */
export function setCachedExam(examCode: string, exam: any): void {
  const cleanCode = (examCode || '').trim().toUpperCase();
  serverExamMemoryCache.set(cleanCode, exam);
}

// ---------------- SUBMISSION QUEUE & BATCH APPEND ----------------

/**
 * Enqueues a candidate submission for asynchronous batch writing to Google Sheets.
 * Prevents hitting Google Sheets write quotas when many candidates submit simultaneously.
 */
export function enqueueSubmission(submission: any): void {
  submissionQueue.push({
    submission,
    queuedAt: Date.now(),
    retryCount: 0
  });

  // If queue has reached MAX_BATCH_SIZE, flush immediately
  if (submissionQueue.length >= MAX_BATCH_SIZE) {
    flushSubmissionQueue().catch(err => {
      console.warn('[Submission Queue Immediate Flush Error]:', err.message);
    });
    return;
  }

  // Otherwise, debounce flush by BATCH_INTERVAL_MS
  if (!batchTimeoutHandle) {
    batchTimeoutHandle = setTimeout(() => {
      batchTimeoutHandle = null;
      flushSubmissionQueue().catch(err => {
        console.warn('[Submission Queue Debounce Flush Error]:', err.message);
      });
    }, BATCH_INTERVAL_MS);
  }
}

/**
 * Flushes all pending submissions currently in the queue using Google Sheets values.append.
 */
export async function flushSubmissionQueue(): Promise<{ success: boolean; count: number }> {
  if (batchTimeoutHandle) {
    clearTimeout(batchTimeoutHandle);
    batchTimeoutHandle = null;
  }

  if (submissionQueue.length === 0) {
    return { success: true, count: 0 };
  }

  // Atomic swap: take current batch and reset queue
  const currentBatch = [...submissionQueue];
  submissionQueue = [];

  const sheets = getGoogleSheetsClient();
  const sheetId = getEffectiveSpreadsheetId();

  if (!sheets || !sheetId) {
    // If Google Sheets Service Account is not configured, items remain in local storage
    return { success: true, count: currentBatch.length };
  }

  try {
    const rowsToAppend = currentBatch.map(item => {
      const sub = item.submission;
      const userAnswersStr = JSON.stringify({
        answers: sub.answers || {},
        listening: sub.listening_answers || {},
        reading: sub.reading_answers || {}
      });

      const writingScoresStr = typeof sub.writing_scores === 'object' && sub.writing_scores !== null
        ? JSON.stringify(sub.writing_scores)
        : (typeof sub.detailed_results?.writing === 'object' ? JSON.stringify(sub.detailed_results.writing) : JSON.stringify({ TR: 0, CC: 0, LR: 0, GRA: 0 }));

      return [
        sub.submission_id || `SUB_${Date.now()}`,               // Col 1 (A): SUBMISSION_ID
        sub.sbd || '',                                          // Col 2 (B): SBD
        sub.student_name || sub.candidate_name || '',           // Col 3 (C): STUDENT_NAME
        sub.exam_code || '',                                    // Col 4 (D): EXAM_CODE
        sub.test_mode || 'TEST',                                // Col 5 (E): TEST_MODE
        sub.listening_raw_score ?? sub.listening_raw ?? '',     // Col 6 (F): LISTENING_RAW
        sub.listening_band ?? sub.listening_score ?? '',        // Col 7 (G): LISTENING_BAND
        sub.reading_raw_score ?? sub.reading_raw ?? '',         // Col 8 (H): READING_RAW
        sub.reading_band ?? sub.reading_score ?? '',            // Col 9 (I): READING_BAND
        sub.writing_task1_text || sub.writing_task1_response || sub.writing_responses?.task1 || '', // Col 10 (J): WRITING_TASK1_TEXT
        sub.writing_task2_text || sub.writing_task2_response || sub.writing_responses?.task2 || '', // Col 11 (K): WRITING_TASK2_TEXT
        userAnswersStr,                                         // Col 12 (L): ANSWERS_JSON
        writingScoresStr,                                       // Col 13 (M): WRITING_SCORES_JSON
        sub.writing_band ?? '',                                 // Col 14 (N): WRITING_BAND
        sub.overall_band ?? sub.band_score ?? '',               // Col 15 (O): OVERALL_BAND
        sub.status || sub.writing_status || 'PENDING_TEACHER',  // Col 16 (P): STATUS
        sub.submitted_at || new Date().toISOString(),           // Col 17 (Q): SUBMITTED_AT
        sub.violations_count ?? sub.cheat_count ?? 0            // Col 18 (R): VIOLATIONS_COUNT
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'SUBMISSIONS!A:R',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rowsToAppend
      }
    });

    console.log(`[Google Sheets Batch Append] Successfully appended ${rowsToAppend.length} submission(s) to SUBMISSIONS sheet.`);
    return { success: true, count: rowsToAppend.length };
  } catch (err: any) {
    console.error('[Google Sheets Batch Append Error]:', err.message);
    
    // Put failed items back into queue with backoff up to 3 retries
    const retriable = currentBatch
      .filter(item => item.retryCount < 3)
      .map(item => ({ ...item, retryCount: item.retryCount + 1 }));

    if (retriable.length > 0) {
      submissionQueue = [...retriable, ...submissionQueue];
      // Schedule retry in 10s
      if (!batchTimeoutHandle) {
        batchTimeoutHandle = setTimeout(() => {
          batchTimeoutHandle = null;
          flushSubmissionQueue().catch(() => {});
        }, 10000);
      }
    }

    return { success: false, count: 0 };
  }
}

/**
 * Appends a specific batch of submissions directly to Google Sheets (18 standard columns A-R).
 */
export async function batchAppendSubmissions(submissions: any[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return { success: true, count: 0 };
  }

  const sheets = getGoogleSheetsClient();
  const sheetId = getEffectiveSpreadsheetId();

  if (!sheets || !sheetId) {
    return { success: false, count: 0, error: 'Google Sheets Service Account or Spreadsheet ID not configured.' };
  }

  try {
    const rows = submissions.map(sub => {
      const userAnswersStr = JSON.stringify({
        answers: sub.answers || {},
        listening: sub.listening_answers || {},
        reading: sub.reading_answers || {}
      });

      const writingScoresStr = typeof sub.writing_scores === 'object' && sub.writing_scores !== null
        ? JSON.stringify(sub.writing_scores)
        : (typeof sub.detailed_results?.writing === 'object' ? JSON.stringify(sub.detailed_results.writing) : JSON.stringify({ TR: 0, CC: 0, LR: 0, GRA: 0 }));

      return [
        sub.submission_id || `SUB_${Date.now()}`,               // Col 1 (A): SUBMISSION_ID
        sub.sbd || '',                                          // Col 2 (B): SBD
        sub.student_name || sub.candidate_name || '',           // Col 3 (C): STUDENT_NAME
        sub.exam_code || '',                                    // Col 4 (D): EXAM_CODE
        sub.test_mode || 'TEST',                                // Col 5 (E): TEST_MODE
        sub.listening_raw_score ?? sub.listening_raw ?? '',     // Col 6 (F): LISTENING_RAW
        sub.listening_band ?? sub.listening_score ?? '',        // Col 7 (G): LISTENING_BAND
        sub.reading_raw_score ?? sub.reading_raw ?? '',         // Col 8 (H): READING_RAW
        sub.reading_band ?? sub.reading_score ?? '',            // Col 9 (I): READING_BAND
        sub.writing_task1_text || sub.writing_task1_response || sub.writing_responses?.task1 || '', // Col 10 (J): WRITING_TASK1_TEXT
        sub.writing_task2_text || sub.writing_task2_response || sub.writing_responses?.task2 || '', // Col 11 (K): WRITING_TASK2_TEXT
        userAnswersStr,                                         // Col 12 (L): ANSWERS_JSON
        writingScoresStr,                                       // Col 13 (M): WRITING_SCORES_JSON
        sub.writing_band ?? '',                                 // Col 14 (N): WRITING_BAND
        sub.overall_band ?? sub.band_score ?? '',               // Col 15 (O): OVERALL_BAND
        sub.status || sub.writing_status || 'PENDING_TEACHER',  // Col 16 (P): STATUS
        sub.submitted_at || new Date().toISOString(),           // Col 17 (Q): SUBMITTED_AT
        sub.violations_count ?? sub.cheat_count ?? 0            // Col 18 (R): VIOLATIONS_COUNT
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'SUBMISSIONS!A:R',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}
