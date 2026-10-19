import { ExamData, Question, QuestionType, ReadingPassageItem } from '../types';

/**
 * Extracts a valid Google Spreadsheet ID from either a raw ID string
 * or a full Google Sheets URL (e.g., https://docs.google.com/spreadsheets/d/1AbCdEfG.../edit)
 */
export function extractSpreadsheetId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Check if it's a URL matching /spreadsheets/d/([a-zA-Z0-9-_]+)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Check if it's an exported pubhtml or alternative pattern
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch && pubMatch[1]) {
    return pubMatch[1];
  }
  
  // If it's already a raw ID (typically 20-70 alphanumeric characters with dashes/underscores)
  if (/^[a-zA-Z0-9-_]{20,70}$/.test(trimmed)) {
    return trimmed;
  }

  // Fallback: if no slashes or spaces and reasonable length
  if (!trimmed.includes('/') && !trimmed.includes(' ') && trimmed.length >= 15) {
    return trimmed;
  }
  
  return null;
}

/**
 * Retrieve currently configured Google Spreadsheet ID
 */
export function getStoredSpreadsheetId(): string {
  if (typeof window === 'undefined') return '';
  const fromStorage = localStorage.getItem('ielts_spreadsheet_id') || '';
  const fromStorageClean = extractSpreadsheetId(fromStorage);
  if (fromStorageClean) return fromStorageClean;
  
  // Environment variable fallback if configured
  try {
    const fromEnv = (import.meta as any).env?.VITE_GOOGLE_SPREADSHEET_ID;
    if (fromEnv && typeof fromEnv === 'string') {
      const fromEnvClean = extractSpreadsheetId(fromEnv);
      if (fromEnvClean) return fromEnvClean;
    }
  } catch (e) {
    // Ignore environment lookup in environments without import.meta.env
  }

  return '';
}

/**
 * Store Google Spreadsheet ID for future queries
 */
export function setStoredSpreadsheetId(idOrUrl: string): void {
  if (typeof window === 'undefined') return;
  const cleanId = extractSpreadsheetId(idOrUrl);
  if (cleanId) {
    localStorage.setItem('ielts_spreadsheet_id', cleanId);
  } else {
    localStorage.removeItem('ielts_spreadsheet_id');
  }
}

/**
 * Queries a specific sheet within a Google Spreadsheet using the Google Visualization API (gviz/tq).
 * Bypasses Apps Script runtime completely, leveraging Google's C++ edge query engine (~50ms - 200ms).
 */
export async function querySheetGviz(
  spreadsheetId: string,
  sheetName: string,
  query: string,
  timeoutMs: number = 6000
): Promise<any> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('Invalid or missing Google Spreadsheet ID.');
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=${encodedQuery}&_t=${Date.now()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/plain' },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`GViz API HTTP Error: ${response.status} ${response.statusText}`);
    }

    const rawText = await response.text();
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      throw new Error('Response returned by Google Sheet is not a valid GViz JSONP wrapper.');
    }

    const jsonString = rawText.substring(startIdx, endIdx + 1);
    const data = JSON.parse(jsonString);

    if (data.status === 'error') {
      const errorDetails = data.errors?.[0]?.detailed_message || data.errors?.[0]?.message || 'GViz Query Syntax or Permission Error';
      throw new Error(errorDetails);
    }

    return data.table;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`GViz query timed out after ${timeoutMs}ms.`);
    }
    throw err;
  }
}

/**
 * Tests connectivity and latency of the Google Visualization API for a given Spreadsheet ID.
 */
export async function testGvizConnection(
  spreadsheetId: string
): Promise<{ success: boolean; latencyMs: number; message: string; examsFound: number }> {
  const startTime = Date.now();
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    if (!cleanId) {
      return {
        success: false,
        latencyMs: 0,
        message: 'No valid Spreadsheet ID provided.',
        examsFound: 0
      };
    }

    const table = await querySheetGviz(cleanId, 'EXAMS', 'SELECT A, B LIMIT 10', 5000);
    const latencyMs = Date.now() - startTime;
    const examsCount = table?.rows?.length || 0;

    return {
      success: true,
      latencyMs,
      message: `GViz connection successful (${latencyMs}ms). Sheet contains ${examsCount} exam(s).`,
      examsFound: examsCount
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      message: `GViz connection failed: ${err.message}`,
      examsFound: 0
    };
  }
}

/**
 * Fetches and reconstructs full IELTS exam data via Google Visualization API (GViz / tq).
 * 
 * Security Guard:
 * When querying QUESTIONS table, column G (CORRECT_ANSWER) is deliberately OMITTED 
 * directly at Google's query engine level:
 *   SELECT A, B, C, D, E, F, H WHERE UPPER(A) = '${cleanCode}'
 * 
 * This guarantees answer keys are never transferred over the wire to candidate client devices!
 */
export async function fetchExamViaGviz(
  spreadsheetId: string,
  examCode: string
): Promise<{ success: boolean; exam?: ExamData; error?: string; latencyMs?: number }> {
  const cleanCode = (examCode || 'TEST01').trim().toUpperCase();
  const cleanId = extractSpreadsheetId(spreadsheetId);

  if (!cleanId) {
    return {
      success: false,
      error: 'Google Spreadsheet ID is not configured.'
    };
  }

  const startTime = Date.now();

  try {
    // Parallel fetch: EXAMS and QUESTIONS tabs simultaneously for minimum round-trip time
    const [examTable, questionsTable] = await Promise.all([
      querySheetGviz(
        cleanId,
        'EXAMS',
        `SELECT A, B, C, D, E, F, G, H, I, J, K WHERE UPPER(A) = '${cleanCode}' LIMIT 1`
      ),
      querySheetGviz(
        cleanId,
        'QUESTIONS',
        // Column A: EXAM_CODE, B: QUESTION_ID, C: SECTION, D: QUESTION_TEXT, 
        // E: QUESTION_TYPE, F: OPTIONS, H: MAX_SCORE (SKIPS G: CORRECT_ANSWER for test integrity)
        `SELECT A, B, C, D, E, F, H WHERE UPPER(A) = '${cleanCode}'`
      )
    ]);

    const latencyMs = Date.now() - startTime;

    // Validate EXAMS result
    if (!examTable.rows || examTable.rows.length === 0) {
      return {
        success: false,
        error: `Exam code [${cleanCode}] was not found in the EXAMS tab of Google Sheet.`,
        latencyMs
      };
    }

    const examRow = examTable.rows[0].c;
    const title = examRow[1]?.v ? String(examRow[1].v) : `IELTS Exam - ${cleanCode}`;
    const testType = (examRow[2]?.v === 'PRACTICE' ? 'PRACTICE' : 'TEST') as 'TEST' | 'PRACTICE';
    const rawDuration = examRow[3]?.v;
    const parsedDuration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration);
    const durationMins = (!isNaN(parsedDuration) && parsedDuration > 0) ? parsedDuration : 120;
    const audioUrl = examRow[4]?.v ? String(examRow[4].v).trim() : '';
    const readingPassage = examRow[5]?.v ? String(examRow[5].v).trim() : '';
    const writingTask1Prompt = examRow[6]?.v ? String(examRow[6].v).trim() : '';
    const writingTask2Prompt = examRow[7]?.v ? String(examRow[7].v).trim() : '';
    const writingTask1Image = examRow[8]?.v ? String(examRow[8].v).trim() : '';
    const audioTitle = examRow[9]?.v ? String(examRow[9].v).trim() : '';

    // Parse QUESTIONS result
    const listeningQuestions: Question[] = [];
    const readingQuestions: Question[] = [];
    const allQuestions: Question[] = [];

    if (questionsTable.rows && questionsTable.rows.length > 0) {
      questionsTable.rows.forEach((rowObj: any, index: number) => {
        const c = rowObj.c;
        if (!c) return;

        const qId = String(c[1]?.v || `Q${index + 1}`).trim();
        const section = String(c[2]?.v || 'reading').toLowerCase().trim() as 'listening' | 'reading';
        let questionText = String(c[3]?.v || '').trim();
        let questionType = String(c[4]?.v || 'multiple_choice').toLowerCase().trim() as QuestionType;

        // Parse options array safely from JSON, pipe-delimited (|), or newline-separated (\n)
        let options: string[] = [];
        const rawOptions = c[5]?.v;
        if (rawOptions !== undefined && rawOptions !== null) {
          const strOptions = String(rawOptions).trim();
          if (strOptions) {
            try {
              const parsedJson = JSON.parse(strOptions);
              // Backward Compatibility: If Col F contains legacy JSON object with question_text
              // and Col D was stored as a short token ("A", "B", "C", "D", "TRUE", "FALSE")
              if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
                if (parsedJson.question_text) {
                  const upperText = questionText.toUpperCase();
                  const shortFlags = ['A', 'B', 'C', 'D', 'TRUE', 'FALSE', 'NOT GIVEN', 'YES', 'NO'];
                  if (shortFlags.includes(upperText) || questionText.length <= 4) {
                    questionText = String(parsedJson.question_text).trim();
                  }
                }
                if (parsedJson.question_type) {
                  questionType = String(parsedJson.question_type).toLowerCase().trim() as QuestionType;
                }
                if (Array.isArray(parsedJson.options)) {
                  options = parsedJson.options.map((opt: any) => String(opt).trim()).filter(Boolean);
                }
              } else if (Array.isArray(parsedJson)) {
                options = parsedJson.map((opt: any) => String(opt).trim()).filter(Boolean);
              } else if (typeof parsedJson === 'string') {
                options = [parsedJson.trim()];
              }
            } catch {
              if (strOptions.includes('|')) {
                options = strOptions.split('|').map((opt: string) => opt.trim()).filter(Boolean);
              } else if (strOptions.includes('\n')) {
                options = strOptions.split('\n').map((opt: string) => opt.trim()).filter(Boolean);
              } else {
                options = [strOptions];
              }
            }
          }
        }

        const maxScore = Number(c[6]?.v) || 1;

        const questionItem: Question = {
          question_id: qId,
          section,
          question_text: questionText,
          question_type: questionType,
          options,
          max_score: maxScore,
          question_number: index + 1
        };

        allQuestions.push(questionItem);
        if (section === 'listening') {
          listeningQuestions.push(questionItem);
        } else {
          readingQuestions.push(questionItem);
        }
      });
    }

    // Build standard reading passages structure (Supports Multi-Passage split with '--- Passage Divider ---')
    let passages: ReadingPassageItem[] = [];
    if (readingPassage) {
      if (readingPassage.includes('--- Passage Divider ---')) {
        const passageChunks = readingPassage
          .split(/\r?\n\s*---\s*Passage Divider\s*---\s*\r?\n|--- Passage Divider ---/i)
          .map(chunk => chunk.trim())
          .filter(Boolean);

        const totalReadingCount = readingQuestions.length;
        const chunkCount = Math.max(passageChunks.length, 1);

        passages = passageChunks.map((chunkText, pIdx) => {
          const pIndex = Math.min(Math.max(pIdx + 1, 1), 3) as 1 | 2 | 3;
          const startIdx = Math.floor((pIdx * totalReadingCount) / chunkCount);
          const endIdx = Math.floor(((pIdx + 1) * totalReadingCount) / chunkCount);
          const assignedQuestions = readingQuestions.slice(startIdx, endIdx).map(q => ({
            ...q,
            passage_index: pIndex
          }));

          return {
            passage_index: pIndex,
            title: `Reading Passage ${pIndex}`,
            text: chunkText,
            questions: assignedQuestions
          };
        });
      } else {
        passages = [
          {
            passage_index: 1,
            title: 'Reading Passage 1',
            text: readingPassage,
            questions: readingQuestions.map(q => ({ ...q, passage_index: 1 }))
          }
        ];
      }
    }

    // Detect skills
    const detectedSkills: ('listening' | 'reading' | 'writing')[] = [];
    if (listeningQuestions.length > 0 || audioUrl) detectedSkills.push('listening');
    if (readingQuestions.length > 0 || readingPassage) detectedSkills.push('reading');
    if (writingTask1Prompt || writingTask2Prompt || writingTask1Image) detectedSkills.push('writing');
    if (detectedSkills.length === 0) detectedSkills.push('reading');

    const examType = detectedSkills.length === 1 ? 'one_skill' : detectedSkills.length === 2 ? 'two_skills' : 'full_test';

    const parsedExam: ExamData = {
      exam_code: cleanCode,
      title,
      test_type: testType,
      exam_type: examType,
      skills: detectedSkills,
      duration_mins: durationMins,
      audio_url: audioUrl,
      audio_title: audioTitle,
      passage_title: 'Reading Passage 1',
      passage_text: readingPassage,
      reading_passage: readingPassage,
      passages,
      listening_questions: listeningQuestions,
      reading_questions: readingQuestions,
      questions: allQuestions,
      writing_task1_prompt: writingTask1Prompt,
      writing_task1_image: writingTask1Image,
      writing_task1_image_url: writingTask1Image,
      writing_task1_imageUrl: writingTask1Image,
      writing_task2_prompt: writingTask2Prompt
    };

    return {
      success: true,
      exam: parsedExam,
      latencyMs
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      error: `GViz Extraction Error (${latencyMs}ms): ${err.message}`,
      latencyMs
    };
  }
}
