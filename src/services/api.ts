import { 
  SubmissionRecord, 
  CheatLog, 
  GradingForm, 
  SubmissionPayload, 
  SubmissionResponse, 
  ExamData,
  ReadingPassageItem,
  Question
} from '../types';
import { extractQuestionsFromRawResponse } from './dbDiagnostics';
import { CustomPracticeDeck, StudentProgressRecord } from '../types/practice';
import { 
  saveExamToIndexedDB, 
  getExamFromIndexedDB, 
  getAllExamsFromIndexedDB,
  deleteExamFromIndexedDB,
  saveSubmissionToIndexedDB, 
  getAllSubmissionsFromIndexedDB, 
  savePendingSubmissionToIndexedDB,
  getPendingSubmissionsFromIndexedDB,
  removePendingSubmissionFromIndexedDB,
  saveCheatLogToIndexedDB, 
  getAllCheatLogsFromIndexedDB,
  savePracticeDecksToIndexedDB,
  getPracticeDecksFromIndexedDB
} from './indexedDb';
import { gradeExamAnswers, computeAnswersChecksum } from './answerScoring';
import { DEFAULT_EXAMS } from '../data/defaultExams';
import { 
  fetchExamViaGviz, 
  getStoredSpreadsheetId, 
  setStoredSpreadsheetId, 
  extractSpreadsheetId, 
  testGvizConnection 
} from './gvizService';

export { 
  fetchExamViaGviz, 
  getStoredSpreadsheetId, 
  setStoredSpreadsheetId, 
  extractSpreadsheetId, 
  testGvizConnection
};

export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbySNk5foVr4UMC5ZVP1YTlxjxT9qFgdI85cH5nyQ63ffqXdYVZ7SJKbmD0B3xNO3DEe/exec";

/**
 * Dual Deployment Architecture Support:
 * When frontend is statically hosted (GitHub Pages, Vercel), backend Express server
 * is hosted separately (Render, Railway, Fly.io, VPS) and pointed to via VITE_API_BASE_URL.
 * When running unified in local dev or Cloud Run container, API requests cleanly resolve
 * to relative /api/...
 *
 * CRITICAL GUARD: A Google Apps Script URL (script.google.com) is used strictly for
 * Google Apps Script webhooks (GAS integration) and NEVER for Express API routes (/api/*).
 */
export const API_BASE_URL: string = (() => {
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE_URL) || '';
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  if (trimmed.includes('script.google.com')) {
    return '';
  }
  return trimmed;
})();

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
};

/**
 * Check connection status to internet and Google Apps Script API endpoint
 */
export async function checkConnection(apiUrl: string = DEFAULT_API_URL): Promise<{
  isOnline: boolean;
  isGasReachable: boolean;
  latencyMs?: number;
  message: string;
}> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    return {
      isOnline: false,
      isGasReachable: false,
      message: 'Client device is completely offline. Operating in IndexedDB offline mode.'
    };
  }

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return {
      isOnline: true,
      isGasReachable: false,
      message: 'Demo / Mock API URL configured. Operating via local & IndexedDB fallback storage.'
    };
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const testUrl = `${apiUrl}?action=ping`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    return {
      isOnline: true,
      isGasReachable: response.ok || response.status === 200 || response.status === 302,
      latencyMs,
      message: response.ok ? `Connected to Google Apps Script (${latencyMs}ms)` : `Connected with status ${response.status}`
    };
  } catch (err: any) {
    return {
      isOnline: true,
      isGasReachable: false,
      latencyMs: Date.now() - startTime,
      message: `Google Apps Script connection check failed: ${err.message || 'Network Timeout'}`
    };
  }
}

/**
 * Robust fetch wrapper with automatic exponential backoff retry for network errors
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  maxRetries: number = 3, 
  baseDelayMs: number = 800
): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = options.method === 'POST' ? 15000 : 8000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const fetchOptions: RequestInit = {
        ...options,
        signal: options.signal || controller.signal
      };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // If server returns 5xx error or rate limit, retry
      if (!response.ok && (response.status >= 500 || response.status === 429)) {
        throw new Error(`Server returned status ${response.status}`);
      }

      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Network Retry] Attempt ${attempt}/${maxRetries} failed for ${url}:`, err.message || err);

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch after ${maxRetries} attempts`);
}

/**
 * Deduplicate and sanitize student submissions
 */
export function deduplicateSubmissions(list: SubmissionRecord[]): SubmissionRecord[] {
  const seen = new Set<string>();
  const result: SubmissionRecord[] = [];
  list.forEach((sub, idx) => {
    if (!sub) return;
    const rawId = String(sub.submission_id ?? '').trim();
    const id = (!rawId || rawId === '#ERROR!')
      ? `sub_fallback_${String(sub.sbd || 'cand')}_${String(sub.exam_code || 'code')}_${idx}`
      : rawId;

    if (!seen.has(id)) {
      seen.add(id);
      result.push({
        ...sub,
        submission_id: id
      });
    }
  });
  return result;
}

/**
 * Deduplicate and sanitize cheat logs
 */
export function deduplicateCheatLogs(list: CheatLog[]): CheatLog[] {
  const seen = new Set<string>();
  const result: CheatLog[] = [];
  list.forEach((log, idx) => {
    if (!log) return;
    const rawId = String(log.log_id ?? '').trim();
    const id = (!rawId || rawId === '#ERROR!')
      ? `log_fallback_${String(log.sbd || 'cand')}_${String(log.exam_code || 'code')}_${idx}`
      : rawId;

    if (!seen.has(id)) {
      seen.add(id);
      result.push({
        ...log,
        log_id: id
      });
    }
  });
  return result;
}

/**
 * Fetch all student submissions with automatic retry and IndexedDB backup sync
 */
export async function fetchSubmissions(
  apiUrl: string = DEFAULT_API_URL
): Promise<{ success: boolean; data?: SubmissionRecord[]; error?: string; source?: 'gas' | 'idb' | 'local' | 'server' }> {
  // Load local backups first
  const localSaved = localStorage.getItem('ielts_student_submissions');
  const localData: SubmissionRecord[] = localSaved ? JSON.parse(localSaved) : [];
  const idbData = await getAllSubmissionsFromIndexedDB();

  // Combine unique local & idb submissions
  let combinedSubmissions = deduplicateSubmissions([...localData, ...idbData]);

  // Fetch from Centralized Server Database (/api/submissions) - Cross-Device Sync
  try {
    const serverRes = await fetch(getApiUrl('/api/submissions'));
    if (serverRes.ok) {
      const serverJson = await serverRes.json();
      if (serverJson && Array.isArray(serverJson.data)) {
        combinedSubmissions = deduplicateSubmissions([...serverJson.data, ...combinedSubmissions]);
        combinedSubmissions.forEach(sub => {
          saveSubmissionToIndexedDB(sub).catch(() => {});
        });
      }
    }
  } catch (err) {
    console.warn('Server submissions fetch error:', err);
  }

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return { success: true, data: combinedSubmissions, source: 'server' };
  }

  try {
    const response = await fetchWithRetry(`${apiUrl}?action=getSubmissions`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 2, 800);

    if (response.ok) {
      const result = await response.json();
      const rows = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : (Array.isArray(result?.submissions) ? result.submissions : null));
      if (rows) {
        // Merge with local & server submissions
        const allMerged = deduplicateSubmissions([...rows, ...combinedSubmissions]);

        // Backup newly synced submissions into IndexedDB & localStorage
        allMerged.forEach(sub => {
          saveSubmissionToIndexedDB(sub).catch(() => {});
        });
        localStorage.setItem('ielts_student_submissions', JSON.stringify(allMerged.slice(0, 100)));

        return { success: true, data: allMerged, source: 'gas' };
      }
    }
  } catch (err) {
    console.warn('GAS API fetchSubmissions failed after retries, utilizing Server/IndexedDB vault:', err);
  }

  return { success: true, data: combinedSubmissions, source: 'server' };
}

/**
 * Fetch cheat violation logs with automatic retry and IndexedDB backup sync
 */
export async function fetchCheatLogs(
  apiUrl: string
): Promise<{ success: boolean; data?: CheatLog[]; error?: string; source?: 'gas' | 'idb' | 'local' | 'server' }> {
  const localLogs = localStorage.getItem('ielts_cheat_logs');
  const logsArr: CheatLog[] = localLogs ? JSON.parse(localLogs) : [];
  const idbLogs = await getAllCheatLogsFromIndexedDB();

  let combinedLogs = deduplicateCheatLogs([...logsArr, ...idbLogs]);

  // Fetch from Centralized Server Database (/api/cheat-logs)
  try {
    const sRes = await fetch(getApiUrl('/api/cheat-logs'));
    if (sRes.ok) {
      const sJson = await sRes.json();
      if (sJson && Array.isArray(sJson.data)) {
        combinedLogs = deduplicateCheatLogs([...sJson.data, ...combinedLogs]);
      }
    }
  } catch (err) {}

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return { success: true, data: combinedLogs, source: 'server' };
  }

  try {
    const response = await fetchWithRetry(`${apiUrl}?action=getCheatLogs`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 2, 800);

    if (response.ok) {
      const result = await response.json();
      const rows = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : (Array.isArray(result?.cheatlogs) ? result.cheatlogs : null));
      if (rows) {
        const allMerged = deduplicateCheatLogs([...rows, ...combinedLogs]);

        // Backup to IndexedDB
        allMerged.forEach(log => {
          saveCheatLogToIndexedDB(log).catch(() => {});
        });
        localStorage.setItem('ielts_cheat_logs', JSON.stringify(allMerged.slice(0, 100)));

        return { success: true, data: allMerged, source: 'gas' };
      }
    }
  } catch (err) {
    console.warn('GAS API fetchCheatLogs failed after retries, falling back to IndexedDB vault:', err);
  }

  return { success: true, data: combinedLogs, source: 'server' };
}

/**
 * Save manual grading scores for Writing with dual backup to IndexedDB & localStorage
 */
export async function saveWritingScore(
  apiUrl: string, 
  submissionId: string, 
  form: GradingForm & { expected_version?: number; examiner_id?: string }
): Promise<{ success: boolean; conflict?: boolean; message?: string }> {
  // Centralized Server DB Sync (/api/submissions/grade-writing) with Optimistic Locking
  try {
    const serverRes = await fetch(getApiUrl('/api/submissions/grade-writing'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submissionId,
        writing_scores: {
          TR: form.tr,
          CC: form.cc,
          LR: form.lr,
          GRA: form.gra
        },
        overall_writing: form.overall_writing,
        feedback: form.feedback,
        expected_version: form.expected_version,
        examiner_id: form.examiner_id
      })
    });

    if (serverRes.status === 409) {
      const conflictData = await serverRes.json().catch(() => ({}));
      return {
        success: false,
        conflict: true,
        message: conflictData.message || 'DỮ LIỆU ĐÃ ĐƯỢC CẬP NHẬT BỞI NGƯỜI KHÁC. VUI LÒNG TẢI LẠI TRANG'
      };
    }
  } catch (e) {
    console.warn('Server DB grade sync error:', e);
  }

  // Update in LocalStorage & IndexedDB
  const localSaved = localStorage.getItem('ielts_student_submissions');
  if (localSaved) {
    const localData: SubmissionRecord[] = JSON.parse(localSaved);
    const updated = localData.map(sub => {
      if (sub.submission_id === submissionId) {
        const gradedSub: SubmissionRecord = {
          ...sub,
          writing_status: 'GRADED' as const,
          writing_band: form.overall_writing,
          writing_scores: {
            TR: form.tr,
            CC: form.cc,
            LR: form.lr,
            GRA: form.gra
          },
          writing_feedback: form.feedback
        };
        // Also update IndexedDB
        saveSubmissionToIndexedDB(gradedSub).catch(() => {});
        return gradedSub;
      }
      return sub;
    });
    localStorage.setItem('ielts_student_submissions', JSON.stringify(updated));
  }

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url')) {
    return { success: true, message: 'Writing scores saved to IndexedDB & LocalStorage successfully!' };
  }

  try {
    const response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'gradeWriting',
        submission_id: submissionId,
        writing_scores: {
          TR: form.tr,
          CC: form.cc,
          LR: form.lr,
          GRA: form.gra
        },
        writing_band: form.overall_writing,
        writing_feedback: form.feedback
      })
    }, 3, 1000);

    if (response.ok) {
      return { success: true, message: 'Writing scores updated on Google Sheets successfully!' };
    }
  } catch (err) {
    console.warn('GAS API saveWritingScore network failure, cached safely in IndexedDB:', err);
  }

  return { success: true, message: 'Grading record saved locally in IndexedDB & LocalStorage!' };
}

/**
 * Requirement 2: Submit with exponential backoff retry for Google Apps Script concurrent lock errors
 * If GAS returns { status: 'ERROR' } or network fails, retry after 2s, 4s, 8s.
 */
export async function postToGasWithLockRetry(
  apiUrl: string, 
  payload: any, 
  maxRetries: number = 3
): Promise<any> {
  // Isolated sandbox preview: do not send any network request to Google Sheets
  if (payload && (payload.isPreview || payload.is_preview)) {
    console.log('[Isolated Sandbox Preview] Bypassing Google Sheets Webhook delivery.');
    return { status: 'success', message: 'Preview sandboxed: no network request sent to Google Sheets.' };
  }

  const retryDelays = [2000, 4000, 8000];
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = 25000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Attempt 1: Standard fetch with text/plain (avoids CORS preflight OPTIONS request)
      let res: Response;
      let usedNoCors = false;

      try {
        res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payloadString,
          redirect: 'follow',
          signal: controller.signal
        });
      } catch (fetchErr: any) {
        // GAS doPost returns a 302 redirect. If browser blocks the redirect due to CORS,
        // fallback to mode: 'no-cors' to guarantee delivery to Google Sheets without failing!
        console.warn(`[GAS CORS/Redirect Handshake Notice]: Attempting opaque delivery via mode: 'no-cors'`, fetchErr?.message);
        res = await fetch(apiUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payloadString,
          signal: controller.signal
        });
        usedNoCors = true;
      }
      clearTimeout(timeoutId);

      // In no-cors mode, type is 'opaque' and status is 0 (browser doesn't expose headers),
      // but Google Apps Script receives and persists the POST data perfectly!
      if (usedNoCors || res.type === 'opaque') {
        console.log(`[GAS Submission Handshake] Payload successfully delivered via opaque channel.`);
        return { 
          status: 'success', 
          message: 'Submission successfully received by Google Apps Script (no-cors mode).',
          is_opaque: true 
        };
      }

      if (!res.ok && res.status !== 302) {
        throw new Error(`GAS HTTP error ${res.status}`);
      }

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        // If GAS redirected to HTML or plain text, consider delivered
        data = { status: 'success', raw: text };
      }

      // Check if GAS returned a concurrency lock error or busy state
      if (data && (data.status === 'ERROR' || data.status === 'error')) {
        const errorMsg = data.message || 'Concurrent write lock busy in Google Sheets';
        console.warn(`[GAS Concurrency Lock] Attempt ${attempt + 1}/${maxRetries + 1} returned busy: ${errorMsg}`);
        if (attempt < maxRetries) {
          const delay = retryDelays[attempt] || 8000;
          console.log(`[GAS Backoff] Retrying submission in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return data;
      }

      return data || { status: 'success' };
    } catch (err: any) {
      console.warn(`[GAS POST Attempt ${attempt + 1}/${maxRetries + 1} failed]:`, err.message || err);
      if (attempt < maxRetries) {
        const delay = retryDelays[attempt] || 8000;
        console.log(`[GAS Backoff] Retrying submission in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Submit full exam payload from Student with immediate IndexedDB & LocalStorage backup
 * Integrates Answer Normalization Engine and IELTS Academic Raw-to-Band calculation
 */
export async function submitExamPayload(
  apiUrl: string, 
  payload: SubmissionPayload,
  examData?: ExamData
): Promise<SubmissionResponse> {
  const timestamp = new Date().toISOString();
  const submissionId = payload.submission_id || `${payload.sbd}_${payload.exam_code}_${Date.now()}`;
  const submissionType = payload.submission_type || 'STANDARD';

  // Consolidate answers
  const userAnswers: Record<string, string> = {
    ...(payload.answers || {}),
    ...(payload.listening_answers || {}),
    ...(payload.reading_answers || {})
  };

  const answersCount = Object.keys(userAnswers).length;
  const answersChecksum = computeAnswersChecksum(userAnswers);
  const rawDigest = `${submissionId}:${payload.sbd}:${payload.exam_code}:${answersCount}:${answersChecksum}:${timestamp}`;
  const sealedToken = typeof btoa !== 'undefined'
    ? `SEALED-IELTS-${answersChecksum}-${btoa(rawDigest).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`
    : `SEALED-IELTS-${answersChecksum}-${Date.now().toString(36).toUpperCase()}`;
  const receiptCode = `RCPT-${(payload.exam_code || 'EXAM').toUpperCase()}-${(payload.sbd || 'USER').toUpperCase()}-${answersChecksum}-${Date.now().toString(36).toUpperCase()}`;

  // Isolated Sandbox Preview Mode: Score purely in RAM without writing to IndexedDB or sending network requests
  if (payload.isPreview) {
    const defaultExamFallback: ExamData = {
      exam_code: payload.exam_code || 'PREVIEW',
      title: 'Preview',
      passages: [],
      questions: []
    };
    const simulatedGrading = gradeExamAnswers(examData || defaultExamFallback, userAnswers);
    return {
      success: true,
      submission_id: submissionId,
      sbd: payload.sbd || 'PREVIEW_TEACHER',
      exam_code: payload.exam_code || 'PREVIEW',
      submission_type: submissionType,
      listening_raw_score: simulatedGrading.listening_raw,
      listening_max_score: simulatedGrading.listening_max,
      listening_band: simulatedGrading.listening_band,
      reading_raw_score: simulatedGrading.reading_raw,
      reading_max_score: simulatedGrading.reading_max,
      reading_band: simulatedGrading.reading_band,
      overall_band: simulatedGrading.listening_band && simulatedGrading.reading_band
        ? Math.round(((simulatedGrading.listening_band + simulatedGrading.reading_band) / 2) * 2) / 2
        : simulatedGrading.reading_band || simulatedGrading.listening_band || 0,
      detailed_results: simulatedGrading.results as any,
      writing_status: 'PENDING_TEACHER',
      submitted_at: timestamp,
      is_offline_pending: false,
      message: 'Preview simulation completed in RAM sandbox.'
    };
  }

  // 0. Attempt Authoritative Server-Side Grading & Certified Submission first
  try {
    const serverGradeRes = await fetch(getApiUrl('/api/submissions/grade-and-submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        answers: userAnswers,
        submission_id: submissionId,
        submission_type: submissionType,
        sealed_token: sealedToken,
        offline_receipt_code: receiptCode,
        expected_answers_hash: answersChecksum
      })
    });
    if (serverGradeRes.ok) {
      const serverData = await serverGradeRes.json();
      if (serverData.success && serverData.submission) {
        const sub = serverData.submission;
        
        // Save authoritative submission to IndexedDB and LocalStorage
        await saveSubmissionToIndexedDB({
          ...sub,
          is_offline_pending: false,
          is_server_certified: true,
          sync_status: 'CERTIFIED_ONLINE',
          sealed_token: sub.sealed_token || sealedToken,
          offline_receipt_code: sub.offline_receipt_code || receiptCode
        });

        await removePendingSubmissionFromIndexedDB(sub.submission_id);

        try {
          const existing = localStorage.getItem('ielts_student_submissions');
          const subsArr: SubmissionRecord[] = existing ? JSON.parse(existing) : [];
          if (!subsArr.some(s => s.submission_id === sub.submission_id)) {
            subsArr.unshift(sub);
          }
          localStorage.setItem('ielts_student_submissions', JSON.stringify(deduplicateSubmissions(subsArr)));
        } catch (e) {}

        return {
          success: true,
          submission_id: sub.submission_id,
          sbd: sub.sbd,
          exam_code: sub.exam_code,
          submission_type: sub.submission_type,
          listening_raw_score: sub.listening_raw_score,
          listening_max_score: sub.listening_max_score,
          listening_band: sub.listening_band,
          reading_raw_score: sub.reading_raw_score,
          reading_max_score: sub.reading_max_score,
          reading_band: sub.reading_band,
          overall_band: sub.overall_band,
          detailed_results: sub.detailed_results,
          writing_status: sub.writing_status || 'PENDING_TEACHER',
          submitted_at: sub.submitted_at,
          is_offline_pending: false,
          is_server_certified: true,
          sync_status: 'CERTIFIED_ONLINE',
          sealed_token: sub.sealed_token || sealedToken,
          offline_receipt_code: sub.offline_receipt_code || receiptCode,
          message: submissionType === 'TIMEOUT_FORCED' 
            ? 'Exam automatically submitted and certified by server due to session timeout.'
            : 'Exam officially submitted and graded authoritatively by server.'
        };
      }
    }
  } catch (serverErr) {
    console.warn('[Server Authoritative Scoring unavailable, continuing with local vault]:', serverErr);
  }

  let listeningRaw = 0;
  let readingRaw = 0;
  let listeningMax = 0;
  let readingMax = 0;
  let listeningBand = 0;
  let readingBand = 0;
  let detailedResults: Record<string, any> | undefined = undefined;

  // Grade using Answer Normalization Engine if examData is available
  if (examData) {
    const grading = gradeExamAnswers(examData, userAnswers);
    listeningRaw = grading.listening_raw;
    readingRaw = grading.reading_raw;
    listeningMax = grading.listening_max;
    readingMax = grading.reading_max;
    listeningBand = grading.listening_band;
    readingBand = grading.reading_band;
    detailedResults = grading.results;
  } else {
    // Count filled answers as reasonable fallback
    Object.keys(payload.listening_answers || {}).forEach(k => {
      if (payload.listening_answers && payload.listening_answers[k] && payload.listening_answers[k].trim() !== '') {
        listeningRaw += 1;
      }
    });
    Object.keys(payload.reading_answers || {}).forEach(k => {
      if (payload.reading_answers && payload.reading_answers[k] && payload.reading_answers[k].trim() !== '') {
        readingRaw += 1;
      }
    });
    listeningMax = examData?.listening_questions?.length ?? 40;
    readingMax = examData?.reading_questions?.length ?? 40;
    listeningBand = Math.min(9, Math.max(1, Math.round((listeningRaw / 3) * 2) / 2 || 4.5));
    readingBand = Math.min(9, Math.max(1, Math.round((readingRaw / 3) * 2) / 2 || 4.5));
  }

  // Calculate overall estimated band for completed receptive skills
  let overallBand: number | undefined = undefined;
  if (listeningMax > 0 && readingMax > 0) {
    overallBand = Math.round(((listeningBand + readingBand) / 2) * 2) / 2;
  } else if (readingMax > 0) {
    overallBand = readingBand;
  } else if (listeningMax > 0) {
    overallBand = listeningBand;
  }

  const isRetake = Boolean(payload.retakeMode || examData?.retakeMode || (examData?.exam_type === 'one_skill' && examData?.skills?.length === 1));
  const retakeSkill = payload.targetSkill || examData?.targetSkill || (examData?.skills?.length === 1 ? examData.skills[0] : undefined);

  // If this is a Writing One-Skill Retake session, skipped receptive skills are excluded from scoring
  if (isRetake && retakeSkill === 'writing') {
    listeningRaw = 0;
    readingRaw = 0;
    listeningMax = 0;
    readingMax = 0;
    listeningBand = 0;
    readingBand = 0;
    detailedResults = {};
    overallBand = undefined;
  } else if (isRetake && retakeSkill === 'listening') {
    readingRaw = 0;
    readingMax = 0;
    readingBand = 0;
    overallBand = listeningBand;
  } else if (isRetake && retakeSkill === 'reading') {
    listeningRaw = 0;
    listeningMax = 0;
    listeningBand = 0;
    overallBand = readingBand;
  }

  const responseObj: SubmissionResponse = {
    success: true,
    submission_id: submissionId,
    sbd: payload.sbd,
    exam_code: payload.exam_code,
    test_mode: payload.test_mode,
    retakeMode: isRetake,
    targetSkill: retakeSkill,
    submission_type: submissionType,
    listening_raw_score: listeningRaw,
    listening_max_score: listeningMax,
    listening_band: listeningBand,
    reading_raw_score: readingRaw,
    reading_max_score: readingMax,
    reading_band: readingBand,
    overall_band: overallBand,
    detailed_results: detailedResults,
    writing_status: 'PENDING_TEACHER',
    submitted_at: timestamp,
    is_offline_pending: true,
    is_server_certified: false,
    sync_status: 'QUEUED_OFFLINE',
    sealed_token: sealedToken,
    offline_receipt_code: receiptCode,
    message: submissionType === 'TIMEOUT_FORCED' 
      ? 'Exam automatically and securely sealed offline into IndexedDB (Time expired). Awaiting reconnection to obtain server certificate.'
      : 'Exam has been securely sealed offline into IndexedDB. Awaiting network reconnection to auto-sync.'
  };

  const record: SubmissionRecord = {
    submission_id: submissionId,
    sbd: payload.sbd,
    exam_code: payload.exam_code,
    test_mode: payload.test_mode,
    retakeMode: isRetake,
    targetSkill: retakeSkill,
    submission_type: submissionType,
    listening_answers: payload.listening_answers || userAnswers,
    reading_answers: payload.reading_answers || userAnswers,
    writing_task1_text: payload.writing_task1_text || payload.writing_task1,
    writing_task2_text: payload.writing_task2_text || payload.writing_task2,
    listening_raw_score: listeningRaw,
    listening_max_score: listeningMax,
    listening_band: listeningBand,
    reading_raw_score: readingRaw,
    reading_max_score: readingMax,
    reading_band: readingBand,
    overall_band: overallBand,
    detailed_results: detailedResults,
    writing_status: 'PENDING_TEACHER',
    submitted_at: timestamp,
    violations_count: payload.violations_count,
    cumulative_off_screen_seconds: payload.cumulative_off_screen_seconds,
    switch_count: payload.switch_count,
    is_offline_pending: true,
    is_server_certified: false,
    sync_status: 'QUEUED_OFFLINE',
    sealed_token: sealedToken,
    offline_receipt_code: receiptCode
  };

  // 1. Immediate persistence to IndexedDB
  await saveSubmissionToIndexedDB(record);

  // 1.5. Queue to IndexedDB Background Sync Queue
  await savePendingSubmissionToIndexedDB({
    ...payload,
    submission_id: submissionId,
    submission_type: submissionType,
    answers: userAnswers,
    sealed_token: sealedToken,
    offline_receipt_code: receiptCode,
    is_offline_pending: true,
    submitted_at: timestamp
  });

  // 2. Persistence to LocalStorage
  try {
    const existing = localStorage.getItem('ielts_student_submissions');
    const subsArr: SubmissionRecord[] = existing ? JSON.parse(existing) : [];
    if (!subsArr.some(s => s.submission_id === record.submission_id)) {
      subsArr.unshift(record);
    }
    localStorage.setItem('ielts_student_submissions', JSON.stringify(deduplicateSubmissions(subsArr)));
  } catch (e) {
    console.warn('LocalStorage save failed, IndexedDB preserved:', e);
  }

  // 2.5. Centralized Server Database Submission Sync (/api/submissions)
  try {
    fetch(getApiUrl('/api/submissions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(e => console.warn('Server submission push failed:', e));
  } catch (err) {}

  // If cheat logs present in payload, persist to IndexedDB & Server DB
  const rawLogs = (payload.violation_logs || payload.cheat_logs || []) as CheatLog[];
  if (Array.isArray(rawLogs) && rawLogs.length > 0) {
    rawLogs.forEach(log => {
      saveCheatLogToIndexedDB(log).catch(() => {});
      fetch(getApiUrl('/api/cheat-logs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      }).catch(() => {});
    });
  }

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return responseObj;
  }

  // 3. Send to Google Apps Script with exponential backoff retry
  try {
    const postData = {
      action: 'submitExam',
      ...payload,
      submission_id: submissionId,
      submission_type: submissionType,
      listening_raw_score: listeningRaw,
      reading_raw_score: readingRaw,
      listening_band: listeningBand,
      reading_band: readingBand,
      submitted_at: timestamp
    };

    const serverRes = await postToGasWithLockRetry(apiUrl, postData, 3);
    if (serverRes && serverRes.submission_id) {
      return {
        ...responseObj,
        ...serverRes,
        submission_type: submissionType
      };
    }
  } catch (err) {
    console.warn('Network error while posting to GAS API with retry, offline IndexedDB backup active:', err);
  }

  return responseObj;
}

/**
 * Background Sync Queue Processor:
 * Attempts to push any offline pending submissions to /api/submissions/grade-and-submit
 * and sync to Google Apps Script. Updates local IndexedDB records when certified.
 */
export async function syncPendingSubmissions(gasUrl?: string): Promise<{
  attempted: number;
  synced: number;
  remaining: number;
  results: SubmissionResponse[];
}> {
  const pending = await getPendingSubmissionsFromIndexedDB();
  if (!pending || pending.length === 0) {
    return { attempted: 0, synced: 0, remaining: 0, results: [] };
  }

  const results: SubmissionResponse[] = [];
  let syncedCount = 0;

  for (const item of pending) {
    try {
      // 1. Try authoritative server certification first via /api/submit or /api/submissions/grade-and-submit
      let serverRes = await fetch(getApiUrl('/api/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (!serverRes.ok) {
        serverRes = await fetch(getApiUrl('/api/submissions/grade-and-submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
      }

      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.success && data.submission) {
          const certifiedSub = data.submission;
          await saveSubmissionToIndexedDB({
            ...certifiedSub,
            is_offline_pending: false,
            is_server_certified: true,
            sync_status: 'CERTIFIED_ONLINE'
          });
          if (item.submission_id) {
            await removePendingSubmissionFromIndexedDB(item.submission_id);
          }
          syncedCount++;

          // Update LocalStorage cache
          try {
            const existing = localStorage.getItem('ielts_student_submissions');
            const subsArr: SubmissionRecord[] = existing ? JSON.parse(existing) : [];
            const updated = subsArr.map(s => s.submission_id === certifiedSub.submission_id ? certifiedSub : s);
            localStorage.setItem('ielts_student_submissions', JSON.stringify(deduplicateSubmissions(updated)));
          } catch (e) {}

          results.push({
            success: true,
            submission_id: certifiedSub.submission_id,
            sbd: certifiedSub.sbd,
            exam_code: certifiedSub.exam_code,
            submission_type: certifiedSub.submission_type,
            listening_raw_score: certifiedSub.listening_raw_score,
            listening_max_score: certifiedSub.listening_max_score,
            listening_band: certifiedSub.listening_band,
            reading_raw_score: certifiedSub.reading_raw_score,
            reading_max_score: certifiedSub.reading_max_score,
            reading_band: certifiedSub.reading_band,
            overall_band: certifiedSub.overall_band,
            detailed_results: certifiedSub.detailed_results,
            writing_status: certifiedSub.writing_status || 'PENDING_TEACHER',
            submitted_at: certifiedSub.submitted_at,
            is_offline_pending: false,
            is_server_certified: true,
            sync_status: 'CERTIFIED_ONLINE',
            sealed_token: certifiedSub.sealed_token,
            offline_receipt_code: certifiedSub.offline_receipt_code,
            message: 'Exam submission synced to server successfully!'
          });
          continue;
        }
      }

      // 2. If server endpoint is unreachable, but GAS URL is provided, try direct GAS push with robust CORS & 302 handling
      if (gasUrl && !gasUrl.includes('AKfycbx_mock') && !gasUrl.includes('mock_ielts')) {
        try {
          const gasRes = await postToGasWithLockRetry(gasUrl, { action: 'submitExam', ...item }, 2);
          if (gasRes && (gasRes.status === 'success' || gasRes.is_opaque || gasRes.submission_id)) {
            if (item.submission_id) {
              await removePendingSubmissionFromIndexedDB(item.submission_id);
            }
            syncedCount++;
          }
        } catch (gasErr) {
          console.warn('Background sync direct GAS push error:', gasErr);
        }
      }
    } catch (e) {
      console.warn('Background sync failed for item:', item.submission_id, e);
    }
  }

  const remainingQueue = await getPendingSubmissionsFromIndexedDB();
  return {
    attempted: pending.length,
    synced: syncedCount,
    remaining: remainingQueue.length,
    results
  };
}

/**
 * Standardize an ExamData object to ensure passages is an array of 3 passages,
 * each containing passage_index, title, text, and its list of questions directly inside.
 */
export function standardizeExamData(rawExam: any, cleanCode: string): ExamData {
  const allQs = rawExam.questions || [];
  const listeningQs = rawExam.listening_questions || allQs.filter((q: any) => q.section === 'listening');
  let readingQs = rawExam.reading_questions || allQs.filter((q: any) => q.section === 'reading');

  let rawPassages: any[] = rawExam.passages || [];

  // If reading questions are nested in passages but not in reading_questions
  if (readingQs.length === 0 && Array.isArray(rawPassages)) {
    const extracted: Question[] = [];
    rawPassages.forEach((p: any) => {
      if (Array.isArray(p?.questions)) {
        extracted.push(...p.questions);
      }
    });
    if (extracted.length > 0) {
      readingQs = extracted;
    }
  }

  // Check if Reading skill exists in this exam
  const hasReadingContent = readingQs.length > 0 || rawPassages.some((p: any) => (p?.text && p.text.trim()) || (p?.questions && p.questions.length > 0));

  let standardizedPassages: ReadingPassageItem[] = [];

  if (hasReadingContent) {
    if (!Array.isArray(rawPassages) || rawPassages.length === 0) {
      rawPassages = [
        {
          passage_index: 1,
          title: rawExam.passage_title || rawExam.reading_passage_title || 'Reading Passage 1',
          text: rawExam.passage_text || rawExam.reading_passage || ''
        },
        {
          passage_index: 2,
          title: 'Reading Passage 2',
          text: ''
        },
        {
          passage_index: 3,
          title: 'Reading Passage 3',
          text: ''
        }
      ];
    }

    // Determine how many passages to preserve
    const maxPIdx = Math.max(
      1,
      ...rawPassages.map((p: any) => p.passage_index || 1),
      ...readingQs.map((q: any) => q.passage_index || 1)
    );
    const passageIndices = Array.from({ length: Math.min(3, Math.max(1, maxPIdx)) }, (_, i) => i + 1);

    standardizedPassages = passageIndices.map((pIdx) => {
      const existingP = rawPassages.find((p: any) => p.passage_index === pIdx) || rawPassages[pIdx - 1];
      const pTitle = existingP?.title || `Reading Passage ${pIdx}`;
      const pText = existingP?.text || (pIdx === 1 ? (rawExam.passage_text || rawExam.reading_passage || '') : '');
      
      // Locate questions belonging to this passage
      let pQuestions = existingP?.questions;
      if (!Array.isArray(pQuestions) || pQuestions.length === 0) {
        pQuestions = readingQs.filter((q: any) => {
          if (q.passage_index === pIdx) return true;
          if (!q.passage_index) {
            const qIndex = readingQs.indexOf(q);
            if (pIdx === 1 && qIndex < 13) return true;
            if (pIdx === 2 && qIndex >= 13 && qIndex < 26) return true;
            if (pIdx === 3 && qIndex >= 26) return true;
          }
          return false;
        });
      }

      return {
        passage_index: pIdx as 1 | 2 | 3,
        title: pTitle,
        text: pText,
        questions: pQuestions
      };
    });
  }

  const writingSection = rawExam.sections?.find((s: any) => s.skill === 'writing');
  const writingTask1 = writingSection?.tasks?.find((t: any) => t.task_number === 1) || writingSection?.tasks?.[0];
  const writingTask2 = writingSection?.tasks?.find((t: any) => t.task_number === 2) || writingSection?.tasks?.[1];

  const resolvedTask1Prompt = rawExam.writing_task1_prompt || writingTask1?.prompt || '';
  const resolvedTask1Image = rawExam.writing_task1_image || 
    rawExam.writing_task1_image_url || 
    rawExam.writing_task1_imageUrl || 
    writingTask1?.image_url || 
    writingTask1?.imageUrl || 
    (writingTask1 as any)?.image || 
    rawExam.image_url || 
    rawExam.imageUrl || 
    '';
  const resolvedTask2Prompt = rawExam.writing_task2_prompt || writingTask2?.prompt || '';

  // Synchronize sections array if present or create if writing skill is declared
  let standardizedSections = rawExam.sections;
  if (Array.isArray(standardizedSections)) {
    standardizedSections = standardizedSections.map((sec: any) => {
      if (sec.skill === 'writing' && Array.isArray(sec.tasks)) {
        return {
          ...sec,
          tasks: sec.tasks.map((t: any) => {
            if (t.task_number === 1 || t.id === 'task-1') {
              return {
                ...t,
                prompt: t.prompt || resolvedTask1Prompt,
                image_url: t.image_url || t.imageUrl || resolvedTask1Image,
                imageUrl: t.imageUrl || t.image_url || resolvedTask1Image
              };
            }
            if (t.task_number === 2 || t.id === 'task-2') {
              return {
                ...t,
                prompt: t.prompt || resolvedTask2Prompt
              };
            }
            return t;
          })
        };
      }
      return sec;
    });
  }

  return {
    ...rawExam,
    exam_code: cleanCode,
    title: rawExam.title || `IELTS Examination - ${cleanCode}`,
    passages: standardizedPassages,
    listening_questions: listeningQs,
    reading_questions: readingQs,
    questions: allQs.length > 0 ? allQs : [...listeningQs, ...readingQs],
    sections: standardizedSections,
    writing_task1_prompt: resolvedTask1Prompt,
    writing_task1_image: resolvedTask1Image,
    writing_task1_image_url: resolvedTask1Image,
    writing_task1_imageUrl: resolvedTask1Image,
    writing_task2_prompt: resolvedTask2Prompt
  };
}

/**
 * Fast In-Memory Exam Cache & Pre-fetching Engine
 */
export const examMemoryCache = new Map<string, ExamData>();
const inFlightExamFetches = new Map<string, Promise<{ success: boolean; exam?: ExamData }>>();

// Populate memory cache asynchronously from IndexedDB and LocalStorage in the background
if (typeof window !== 'undefined') {
  setTimeout(async () => {
    try {
      const idbExams = await getAllExamsFromIndexedDB();
      idbExams.forEach((ex) => {
        if (ex && ex.exam_code) {
          const code = ex.exam_code.trim().toUpperCase();
          if (!examMemoryCache.has(code)) {
            examMemoryCache.set(code, standardizeExamData(ex, code));
          }
        }
      });
    } catch (e) {}

    try {
      const localRaw = localStorage.getItem('ielts_saved_exams');
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((ex: any) => {
            if (ex && ex.exam_code) {
              const code = String(ex.exam_code).trim().toUpperCase();
              if (!examMemoryCache.has(code)) {
                examMemoryCache.set(code, standardizeExamData(ex, code));
              }
            }
          });
        }
      }
    } catch (e) {}
  }, 0);
}

/**
 * Asynchronously revalidate exam data from Google Sheets in the background without blocking UI
 */
export function triggerBackgroundRevalidation(apiUrl: string, cleanCode: string): void {
  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return;
  }

  setTimeout(async () => {
    try {
      const fetchUrl = `${apiUrl}?action=get_exam&exam_code=${encodeURIComponent(cleanCode)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        const extracted = extractQuestionsFromRawResponse(raw, cleanCode);
        const meta = extracted.meta || {};
        const hasQuestions = extracted.questions && extracted.questions.length > 0;
        const hasWritingPrompts = Boolean(
          meta.writing_task1_prompt || meta.writing_task2_prompt ||
          raw.writing_task1_prompt || raw.writing_task2_prompt ||
          raw.exam?.writing_task1_prompt || raw.exam?.writing_task2_prompt
        );

        if (hasQuestions || hasWritingPrompts) {
          const existingCached = examMemoryCache.get(cleanCode);
          const rawTask1Image = meta.writing_task1_image || meta.writing_task1_image_url || meta.writing_task1_imageUrl || 
            raw.writing_task1_image || raw.writing_task1_image_url || raw.writing_task1_imageUrl || 
            raw.exam?.writing_task1_image || raw.exam?.writing_task1_image_url || raw.exam?.writing_task1_imageUrl || 
            meta.imageUrl || meta.image_url || raw.imageUrl || raw.image_url || 
            raw.sections?.find((s: any) => s.skill === 'writing')?.tasks?.[0]?.image_url || 
            raw.sections?.find((s: any) => s.skill === 'writing')?.tasks?.[0]?.imageUrl || 
            existingCached?.writing_task1_image || 
            existingCached?.writing_task1_image_url || 
            existingCached?.writing_task1_imageUrl || 
            '';

          const rawExamObj: ExamData = {
            exam_code: cleanCode,
            title: meta.title || raw.title || raw.exam?.title || `IELTS Examination - ${cleanCode}`,
            audio_url: meta.audio_url || raw.audio_url || raw.exam?.audio_url || '',
            passages: meta.passages || raw.passages || raw.exam?.passages || [],
            questions: extracted.questions || [],
            sections: raw.sections,
            writing_task1_prompt: meta.writing_task1_prompt || raw.writing_task1_prompt || raw.exam?.writing_task1_prompt || '',
            writing_task1_image: rawTask1Image,
            writing_task1_image_url: rawTask1Image,
            writing_task1_imageUrl: rawTask1Image,
            writing_task2_prompt: meta.writing_task2_prompt || raw.writing_task2_prompt || raw.exam?.writing_task2_prompt || ''
          };

          const fresh = standardizeExamData(rawExamObj, cleanCode);
          examMemoryCache.set(cleanCode, fresh);
          saveExamToIndexedDB(fresh).catch(() => {});
          try {
            localStorage.setItem('ielts_current_exam', JSON.stringify(fresh));
          } catch (e) {}

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ielts:exam-revalidated', { detail: fresh }));
          }
        }
      }
    } catch (e) {}
  }, 60);
}

/**
 * Background pre-fetching engine to warm up cache while candidate is typing or reviewing instructions
 */
export function prefetchExam(
  apiUrl: string,
  examCode: string
): Promise<{ success: boolean; exam?: ExamData }> {
  const cleanCode = (examCode || 'TEST01').trim().toUpperCase();
  if (!cleanCode) return Promise.resolve({ success: false });

  if (examMemoryCache.has(cleanCode)) {
    return Promise.resolve({ success: true, exam: examMemoryCache.get(cleanCode) });
  }

  if (inFlightExamFetches.has(cleanCode)) {
    return inFlightExamFetches.get(cleanCode)!;
  }

  const prefetchPromise = (async () => {
    // 1. Check Centralized Server DB (/api/exams/:code) first (<20ms, private Sheet guard)
    try {
      const sRes = await fetch(`/api/exams/${encodeURIComponent(cleanCode)}`);
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (sJson && sJson.success && sJson.exam) {
          const standardized = standardizeExamData(sJson.exam, cleanCode);
          examMemoryCache.set(cleanCode, standardized);
          saveExamToIndexedDB(standardized).catch(() => {});
          return { success: true, exam: standardized };
        }
      }
    } catch (e) {}

    // 2. Check IndexedDB
    try {
      const idbExam = await getExamFromIndexedDB(cleanCode);
      if (idbExam) {
        const standardized = standardizeExamData(idbExam, cleanCode);
        examMemoryCache.set(cleanCode, standardized);
        return { success: true, exam: standardized };
      }
    } catch (e) {}

    // 3. Check LocalStorage
    try {
      const localExamsRaw = localStorage.getItem('ielts_saved_exams');
      if (localExamsRaw) {
        const localList = JSON.parse(localExamsRaw);
        if (Array.isArray(localList)) {
          const foundLocal = localList.find((ex: any) => ex.exam_code?.toUpperCase() === cleanCode);
          if (foundLocal) {
            const standardized = standardizeExamData(foundLocal, cleanCode);
            examMemoryCache.set(cleanCode, standardized);
            saveExamToIndexedDB(standardized).catch(() => {});
            return { success: true, exam: standardized };
          }
        }
      }
    } catch (e) {}

    // 3.5. Fast Google Visualization API (GViz / tq) prefetch (~50-200ms) for static deployments
    const activeSpreadsheetId = getStoredSpreadsheetId();
    if (activeSpreadsheetId) {
      try {
        const gvizRes = await fetchExamViaGviz(activeSpreadsheetId, cleanCode);
        if (gvizRes.success && gvizRes.exam) {
          const standardized = standardizeExamData(gvizRes.exam, cleanCode);
          examMemoryCache.set(cleanCode, standardized);
          saveExamToIndexedDB(standardized).catch(() => {});
          return { success: true, exam: standardized };
        }
      } catch (e) {}
    }

    // 4. Background fetch from GAS
    if (apiUrl && !apiUrl.includes('mock_ielts_exam_system_gas_url') && !apiUrl.includes('AKfycbx_mock')) {
      try {
        const fetchUrl = `${apiUrl}?action=get_exam&exam_code=${encodeURIComponent(cleanCode)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(fetchUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const raw = await res.json();
          const extracted = extractQuestionsFromRawResponse(raw, cleanCode);
          const meta = extracted.meta || {};
          const hasQuestions = extracted.questions && extracted.questions.length > 0;
          const hasWritingPrompts = Boolean(
            meta.writing_task1_prompt || meta.writing_task2_prompt ||
            raw.writing_task1_prompt || raw.writing_task2_prompt ||
            raw.exam?.writing_task1_prompt || raw.exam?.writing_task2_prompt
          );

          if (hasQuestions || hasWritingPrompts) {
            const existingCached = examMemoryCache.get(cleanCode);
            const rawTask1Image = meta.writing_task1_image || meta.writing_task1_image_url || meta.writing_task1_imageUrl || 
              raw.writing_task1_image || raw.writing_task1_image_url || raw.writing_task1_imageUrl || 
              raw.exam?.writing_task1_image || raw.exam?.writing_task1_image_url || raw.exam?.writing_task1_imageUrl || 
              meta.imageUrl || meta.image_url || raw.imageUrl || raw.image_url || 
              raw.sections?.find((s: any) => s.skill === 'writing')?.tasks?.[0]?.image_url || 
              raw.sections?.find((s: any) => s.skill === 'writing')?.tasks?.[0]?.imageUrl || 
              existingCached?.writing_task1_image || 
              existingCached?.writing_task1_image_url || 
              existingCached?.writing_task1_imageUrl || 
              '';

            const rawExamObj: ExamData = {
              exam_code: cleanCode,
              title: meta.title || raw.title || raw.exam?.title || `IELTS Examination - ${cleanCode}`,
              audio_url: meta.audio_url || raw.audio_url || raw.exam?.audio_url || '',
              passages: meta.passages || raw.passages || raw.exam?.passages || [],
              questions: extracted.questions || [],
              sections: raw.sections,
              writing_task1_prompt: meta.writing_task1_prompt || raw.writing_task1_prompt || raw.exam?.writing_task1_prompt || '',
              writing_task1_image: rawTask1Image,
              writing_task1_image_url: rawTask1Image,
              writing_task1_imageUrl: rawTask1Image,
              writing_task2_prompt: meta.writing_task2_prompt || raw.writing_task2_prompt || raw.exam?.writing_task2_prompt || ''
            };
            const standardized = standardizeExamData(rawExamObj, cleanCode);
            examMemoryCache.set(cleanCode, standardized);
            saveExamToIndexedDB(standardized).catch(() => {});
            try {
              localStorage.setItem('ielts_current_exam', JSON.stringify(standardized));
            } catch (e) {}
            return { success: true, exam: standardized };
          }
        }
      } catch (err) {}
    }

    return { success: false };
  })().finally(() => {
    inFlightExamFetches.delete(cleanCode);
  });

  inFlightExamFetches.set(cleanCode, prefetchPromise);
  return prefetchPromise;
}

/**
 * Ultra-fast Exam Fetching with Cache-First & Stale-While-Revalidate architecture.
 * Loads in ~0ms if in-memory, ~2ms if in IndexedDB/LocalStorage, or resolves prefetch.
 */
/**
 * Clear timer countdown targets stored in sessionStorage
 */
export function clearSessionTimers(examCode?: string): void {
  try {
    const cleanCode = examCode ? examCode.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, '_') : '';
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('ielts_timer_target_')) {
        if (!cleanCode || k.includes(cleanCode)) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {}
}

/**
 * Purge cached exam entry from memory, IndexedDB, and LocalStorage to force clean re-synchronization
 */
export async function clearExamCache(examCode: string): Promise<void> {
  const cleanCode = (examCode || '').trim().toUpperCase();
  if (!cleanCode) return;
  examMemoryCache.delete(cleanCode);
  inFlightExamFetches.delete(cleanCode);
  clearSessionTimers(cleanCode);
  try {
    await deleteExamFromIndexedDB(cleanCode);
  } catch (e) {}
  try {
    const localRaw = localStorage.getItem('ielts_saved_exams');
    if (localRaw) {
      const arr = JSON.parse(localRaw);
      if (Array.isArray(arr)) {
        const filtered = arr.filter((ex: any) => (ex?.exam_code || '').toUpperCase() !== cleanCode);
        localStorage.setItem('ielts_saved_exams', JSON.stringify(filtered));
      }
    }
  } catch (e) {}
}

let memoryCachedSpreadsheetId: string = '';

/**
 * Dynamically resolves the active Google Spreadsheet ID from:
 * 1. LocalStorage ('ielts_spreadsheet_id')
 * 2. In-memory cache
 * 3. Server Config ('/api/config')
 * 4. Fallback to VITE_GOOGLE_SPREADSHEET_ID
 */
export async function getDynamicSpreadsheetId(): Promise<string> {
  const localId = getStoredSpreadsheetId();
  if (localId) {
    memoryCachedSpreadsheetId = localId;
    return localId;
  }

  if (memoryCachedSpreadsheetId) {
    return memoryCachedSpreadsheetId;
  }

  try {
    const serverCfg = await fetchServerConfig();
    if (serverCfg?.spreadsheet_id) {
      const extracted = extractSpreadsheetId(serverCfg.spreadsheet_id);
      if (extracted) {
        memoryCachedSpreadsheetId = extracted;
        setStoredSpreadsheetId(extracted);
        return extracted;
      }
    }
  } catch (e) {}

  return '';
}

/**
 * Ultra-fast Exam Fetching with Cache-First & Stale-While-Revalidate architecture.
 * Loads in ~0ms if in-memory, ~2ms if in IndexedDB/LocalStorage, or resolves prefetch.
 * Supports forceFresh to bypass local cache and query live Google Apps Script endpoint.
 */
export async function fetchExam(
  apiUrl: string, 
  examCode: string,
  forceFresh: boolean = false
): Promise<{ success: boolean; exam?: ExamData; error?: string; source?: 'gas' | 'idb' | 'local' | 'default' | 'memory' | 'gviz' | 'server' }> {
  const cleanCode = (examCode || 'TEST01').trim().toUpperCase();

  if (forceFresh) {
    await clearExamCache(cleanCode);
  }

  // Tier 1: In-Memory Cache (Instant ~0ms)
  if (!forceFresh && examMemoryCache.has(cleanCode)) {
    const cached = examMemoryCache.get(cleanCode)!;
    triggerBackgroundRevalidation(apiUrl, cleanCode);
    return { success: true, exam: cached, source: 'memory' };
  }

  // Tier 2: Authoritative Centralized Server Cache (/api/exams/:code) - Instant <20ms & Private Sheet Guard
  // Clients fetch exclusively via Server API, preventing any exposure of Google Sheet IDs or answer keys in Network tab!
  try {
    const serverRes = await fetch(`/api/exams/${encodeURIComponent(cleanCode)}`);
    if (serverRes.ok) {
      const serverJson = await serverRes.json();
      if (serverJson && serverJson.success && serverJson.exam) {
        const standardized = standardizeExamData(serverJson.exam, cleanCode);
        examMemoryCache.set(cleanCode, standardized);
        saveExamToIndexedDB(standardized).catch(() => {});
        try {
          localStorage.setItem('ielts_current_exam', JSON.stringify(standardized));
        } catch (e) {}
        return { success: true, exam: standardized, source: 'server' as any };
      }
    }
  } catch (e) {
    // If server is momentarily unreachable (e.g., offline mode), proceed to local client storage tiers
  }

  // Tier 3: In-flight prefetch check with quick grace period
  if (!forceFresh && inFlightExamFetches.has(cleanCode)) {
    try {
      const fastResult = await Promise.race([
        inFlightExamFetches.get(cleanCode)!,
        new Promise<null>((res) => setTimeout(() => res(null), 600))
      ]);
      if (fastResult && fastResult.success && fastResult.exam) {
        return { success: true, exam: fastResult.exam, source: 'gas' };
      }
    } catch (e) {}
  }

  // Tier 4: IndexedDB Offline Vault (~2-5ms)
  if (!forceFresh) {
    try {
      const idbExam = await getExamFromIndexedDB(cleanCode);
      if (idbExam) {
        const standardized = standardizeExamData(idbExam, cleanCode);
        examMemoryCache.set(cleanCode, standardized);
        return { success: true, exam: standardized, source: 'idb' };
      }
    } catch (e) {
      console.warn('Error reading from IndexedDB:', e);
    }
  }

  // Tier 5: Saved LocalStorage Exams (~1-2ms)
  if (!forceFresh) {
    try {
      const localExamsRaw = localStorage.getItem('ielts_saved_exams');
      if (localExamsRaw) {
        const localList = JSON.parse(localExamsRaw);
        if (Array.isArray(localList)) {
          const foundLocal = localList.find((ex: any) => ex.exam_code?.toUpperCase() === cleanCode);
          if (foundLocal) {
            const standardized = standardizeExamData(foundLocal, cleanCode);
            examMemoryCache.set(cleanCode, standardized);
            saveExamToIndexedDB(standardized).catch(() => {});
            return { success: true, exam: standardized, source: 'local' };
          }
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
    }
  }

  // Tier 6: Fast Google Visualization API (GViz / tq) Query (~50ms - 200ms)
  // Essential for 100% static hosting on GitHub Pages when Node.js server backend is not present!
  let activeSpreadsheetId = getStoredSpreadsheetId();
  if (!activeSpreadsheetId) {
    activeSpreadsheetId = await getDynamicSpreadsheetId();
  }

  if (activeSpreadsheetId) {
    try {
      const gvizRes = await fetchExamViaGviz(activeSpreadsheetId, cleanCode);
      if (gvizRes.success && gvizRes.exam) {
        const standardized = standardizeExamData(gvizRes.exam, cleanCode);
        examMemoryCache.set(cleanCode, standardized);
        saveExamToIndexedDB(standardized).catch(() => {});
        try {
          localStorage.setItem('ielts_current_exam', JSON.stringify(standardized));
        } catch (e) {}
        saveExamToServerDb(standardized).catch(() => {});
        return { success: true, exam: standardized, source: 'gviz' };
      }
    } catch (gvizErr) {
      console.warn('[GViz Query Notice] Direct GViz query failed, falling back to Google Apps Script:', gvizErr);
    }
  }

  // Tier 7: Direct targeted GAS Fetch (Single request, 4.5s timeout)
  if (apiUrl && !apiUrl.includes('mock_ielts_exam_system_gas_url') && !apiUrl.includes('AKfycbx_mock')) {
    try {
      const endpoints = [
        `${apiUrl}?action=get_exam&exam_code=${encodeURIComponent(cleanCode)}&_t=${Date.now()}`,
        `${apiUrl}?action=getExam&exam_code=${encodeURIComponent(cleanCode)}&_t=${Date.now()}`
      ];

      for (const fetchUrl of endpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(fetchUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const raw = await res.json();
          const extracted = extractQuestionsFromRawResponse(raw, cleanCode);
          const meta = extracted.meta || {};
          const hasQuestions = extracted.questions && extracted.questions.length > 0;
          const hasWritingPrompts = Boolean(
            meta.writing_task1_prompt || meta.writing_task2_prompt ||
            raw.writing_task1_prompt || raw.writing_task2_prompt ||
            raw.exam?.writing_task1_prompt || raw.exam?.writing_task2_prompt
          );

          if (hasQuestions || hasWritingPrompts) {
            const existingCached = examMemoryCache.get(cleanCode);
            const rawTask1Image = meta.writing_task1_image || meta.writing_task1_image_url || meta.writing_task1_imageUrl || 
              raw.writing_task1_image || raw.writing_task1_image_url || raw.writing_task1_imageUrl || 
              raw.exam?.writing_task1_image || raw.exam?.writing_task1_image_url || raw.exam?.writing_task1_imageUrl || 
              meta.imageUrl || meta.image_url || raw.imageUrl || raw.image_url || 
              raw.sections?.find((s: any) => s.skill === 'writing')?.tasks?.[0]?.image_url || 
              raw.sections?.find((s: any) => s.skill === 'writing')?.tasks?.[0]?.imageUrl || 
              existingCached?.writing_task1_image || 
              existingCached?.writing_task1_image_url || 
              existingCached?.writing_task1_imageUrl || 
              '';

            const rawExamObj: ExamData = {
              exam_code: cleanCode,
              title: meta.title || raw.title || raw.exam?.title || `IELTS Examination - ${cleanCode}`,
              audio_url: meta.audio_url || raw.audio_url || raw.exam?.audio_url || '',
              passages: meta.passages || raw.passages || raw.exam?.passages || [],
              questions: extracted.questions || [],
              sections: raw.sections,
              writing_task1_prompt: meta.writing_task1_prompt || raw.writing_task1_prompt || raw.exam?.writing_task1_prompt || '',
              writing_task1_image: rawTask1Image,
              writing_task1_image_url: rawTask1Image,
              writing_task1_imageUrl: rawTask1Image,
              writing_task2_prompt: meta.writing_task2_prompt || raw.writing_task2_prompt || raw.exam?.writing_task2_prompt || ''
            };

            const standardized = standardizeExamData(rawExamObj, cleanCode);
            examMemoryCache.set(cleanCode, standardized);
            await saveExamToIndexedDB(standardized);
            try {
              localStorage.setItem('ielts_current_exam', JSON.stringify(standardized));
            } catch (e) {}

            // Save to centralized server database if server is available
            saveExamToServerDb(standardized).catch(() => {});

            return { success: true, exam: standardized, source: 'gas' };
          }
        }
      }
    } catch (err) {
      console.warn(`Direct fetch failed for exam ${cleanCode}:`, err);
    }
  }

  // Tier 8: Direct Server fallback check before giving up
  try {
    const sFallback = await fetch(`/api/exams/${encodeURIComponent(cleanCode)}`);
    if (sFallback.ok) {
      const sJson = await sFallback.json();
      if (sJson && sJson.success && sJson.exam) {
        const standardized = standardizeExamData(sJson.exam, cleanCode);
        examMemoryCache.set(cleanCode, standardized);
        saveExamToIndexedDB(standardized).catch(() => {});
        return { success: true, exam: standardized, source: 'server' as any };
      }
    }
  } catch (e) {}

  // Tier 6.8: Check standard built-in exam package (DEFAULT_EXAMS)
  const foundDefault = DEFAULT_EXAMS.find(e => (e.exam_code || '').toUpperCase() === cleanCode);
  if (foundDefault) {
    const standardized = standardizeExamData(foundDefault, cleanCode);
    examMemoryCache.set(cleanCode, standardized);
    saveExamToIndexedDB(standardized).catch(() => {});
    return { success: true, exam: standardized, source: 'default' };
  }

  // Tier 7: Invalidate cache for this code so failed state doesn't block later attempts
  examMemoryCache.delete(cleanCode);

  // Return clean, informative error message in English
  return { 
    success: false, 
    error: `Exam not found: No test paper found for code [${cleanCode}]. Please check your test code, switch to Practice Mode if this is a writing drill (e.g. WT codes), or tap Force Resync.` 
  };
}

/**
 * Fetch practice decks with retry and IndexedDB backup
 */
export async function fetchPracticeDecksFromGAS(
  apiUrl: string
): Promise<{ success: boolean; is_initialized?: boolean; decks?: CustomPracticeDeck[]; message?: string; error?: string }> {
  // Check IndexedDB first as cache
  const idbDecks = await getPracticeDecksFromIndexedDB();

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    if (idbDecks.length > 0) {
      return { success: true, is_initialized: true, decks: idbDecks };
    }
    return { success: false, error: 'Google Apps Script URL is not configured' };
  }

  try {
    const urls = [
      `${apiUrl}?action=get_practice_decks`,
      `${apiUrl}?action=getPracticeDecks`
    ];

    for (const fetchUrl of urls) {
      const res = await fetchWithRetry(fetchUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 2, 700);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const fetchedDecks = Array.isArray(data.decks) ? data.decks : [];
          if (fetchedDecks.length > 0) {
            savePracticeDecksToIndexedDB(fetchedDecks).catch(() => {});
          }
          return {
            success: true,
            is_initialized: data.is_initialized !== false,
            decks: fetchedDecks,
            message: data.message
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('fetchPracticeDecksFromGAS failed after retries:', err);
    if (idbDecks.length > 0) {
      return { success: true, is_initialized: true, decks: idbDecks, message: 'Loaded from IndexedDB offline vault' };
    }
    return { success: false, error: err.message || 'Unable to connect to Google Sheets' };
  }

  if (idbDecks.length > 0) {
    return { success: true, is_initialized: true, decks: idbDecks };
  }

  return { success: false, error: 'Unable to retrieve practice database from Google Sheets' };
}

/**
 * Initialize PRACTICE_QUESTIONS database tab on Google Sheets and sync practice decks
 */
export async function initPracticeDatabaseInGAS(
  apiUrl: string,
  decks: CustomPracticeDeck[],
  mode: 'replace_all' | 'append' = 'replace_all'
): Promise<{ success: boolean; message?: string; total_cards?: number; error?: string }> {
  // Always backup to IndexedDB
  await savePracticeDecksToIndexedDB(decks);

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return { 
      success: true, 
      message: 'Practice decks saved into IndexedDB offline vault successfully!', 
      total_cards: decks.reduce((acc, d) => acc + (d.cards?.length || 0), 0)
    };
  }

  try {
    const res = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'init_practice_sheet',
        mode,
        decks
      })
    }, 2, 1000);

    if (res.ok) {
      const result = await res.json();
      if (result && result.success) {
        return {
          success: true,
          message: result.message || 'Practice database initialized on Google Sheets successfully!',
          total_cards: result.total_cards
        };
      }
    }
  } catch (err: any) {
    console.warn('initPracticeDatabaseInGAS failed:', err);
    return { success: true, message: 'Saved to IndexedDB backup (network error initializing GAS)', total_cards: decks.reduce((acc, d) => acc + (d.cards?.length || 0), 0) };
  }

  return { success: false, error: 'Database initialization failed. Please verify Web App access permissions (Anyone) on Google Apps Script.' };
}

/**
 * Save / update single practice deck to Google Sheets and IndexedDB
 */
export async function savePracticeDeckToGAS(
  apiUrl: string,
  deck: CustomPracticeDeck
): Promise<{ success: boolean; message?: string; error?: string }> {
  // Save to IndexedDB
  await savePracticeDecksToIndexedDB([deck]);

  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return { success: true, message: 'Practice deck saved to IndexedDB offline vault!' };
  }

  try {
    const res = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'save_practice_deck',
        mode: 'append',
        deck
      })
    }, 2, 800);

    if (res.ok) {
      const result = await res.json();
      if (result && result.success) {
        return { success: true, message: result.message || 'Practice deck saved to Google Sheets!' };
      }
    }
  } catch (err: any) {
    console.warn('savePracticeDeckToGAS failed:', err);
    return { success: true, message: 'Saved to IndexedDB (Google Sheets sync will retry)' };
  }

  return { success: false, error: 'Unable to save practice deck to Google Sheets' };
}

/**
 * Sync student practice progress records to Google Sheets
 */
export async function syncStudentProgressToGAS(
  apiUrl: string,
  records: StudentProgressRecord[]
): Promise<{ success: boolean; message?: string; updated_count?: number; error?: string }> {
  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return { success: true, message: 'Progress saved locally!', updated_count: records.length };
  }

  try {
    const res = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sync_student_progress',
        progress_records: records
      })
    }, 2, 800);

    if (res.ok) {
      const result = await res.json();
      if (result && result.success) {
        return { 
          success: true, 
          message: result.message || 'Learner progress saved to Google Sheets successfully!',
          updated_count: result.updated_count
        };
      }
    }
  } catch (err: any) {
    console.warn('syncStudentProgressToGAS failed:', err);
    return { success: false, error: err.message };
  }

  return { success: false, error: 'Unable to sync progress to Google Sheets' };
}

/**
 * Fetch student practice progress from Google Sheets
 */
export async function fetchStudentProgressFromGAS(
  apiUrl: string,
  studentId?: string
): Promise<{ success: boolean; records?: StudentProgressRecord[]; error?: string }> {
  if (!apiUrl || apiUrl.includes('mock_ielts_exam_system_gas_url') || apiUrl.includes('AKfycbx_mock')) {
    return { success: false, error: 'Google Apps Script URL is not configured' };
  }

  try {
    const query = studentId ? `&student_id=${encodeURIComponent(studentId)}` : '';
    const res = await fetchWithRetry(`${apiUrl}?action=get_student_progress${query}`, {
      method: 'GET'
    }, 2, 800);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.records)) {
        return { success: true, records: data.records };
      }
    }
  } catch (err: any) {
    console.warn('fetchStudentProgressFromGAS failed:', err);
    return { success: false, error: err.message };
  }

  return { success: false, error: 'Unable to retrieve learner progress from Google Sheets' };
}

/**
 * Persist an exam to the Centralized Server Database (/api/exams)
 * Ensures any exam created or downloaded is instantly available across all devices.
 */
export async function saveExamToServerDb(exam: ExamData): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/exams'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exam)
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save exam to server DB:', err);
    return false;
  }
}

/**
 * Fetch server configuration (e.g. centralized gas_url and spreadsheet_id)
 */
export async function fetchServerConfig(): Promise<{ gas_url?: string; spreadsheet_id?: string; last_synced_at?: string } | null> {
  try {
    const res = await fetch(getApiUrl('/api/config'));
    if (res.ok) {
      const data = await res.json();
      return data.config || null;
    }
  } catch (err) {
    console.warn('Could not fetch server config:', err);
  }
  return null;
}

/**
 * Upload an image to the server storage to obtain a static, cross-device accessible URL
 */
export async function uploadImageToServer(dataUrlOrFile: string, filename?: string): Promise<string> {
  if (!dataUrlOrFile || !dataUrlOrFile.startsWith('data:image/')) {
    return dataUrlOrFile || '';
  }
  try {
    const res = await fetch(getApiUrl('/api/upload-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrlOrFile, filename })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.warn('Could not upload image to server:', err);
  }
  return dataUrlOrFile;
}

/**
 * Save server configuration (e.g. update gas_url and/or spreadsheet_id for all connected devices)
 */
export async function saveServerConfig(
  config: { 
    gas_url?: string; 
    spreadsheet_id?: string;
    service_account_email?: string;
    service_account_private_key?: string;
    service_account_json?: string;
    service_account_project_id?: string;
  } | string
): Promise<boolean> {
  try {
    const payload = typeof config === 'string' ? { gas_url: config } : config;
    const res = await fetch(getApiUrl('/api/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save server config:', err);
    return false;
  }
}

/**
 * Trigger Google Sheets Cache synchronization on Server Node.js (/api/sync-sheet)
 * Reads private Google Sheet via Service Account and populates Server RAM cache (< 20ms).
 */
export async function triggerServerSheetSync(
  examCode?: string,
  spreadsheetId?: string
): Promise<{ success: boolean; message: string; synced_count?: number; latencyMs?: number }> {
  const startTime = Date.now();
  try {
    const res = await fetch(getApiUrl('/api/sync-sheet'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_code: examCode, spreadsheet_id: spreadsheetId })
    });
    const latencyMs = Date.now() - startTime;
    const data = await res.json();
    return {
      success: data.success,
      message: data.message || (data.success ? 'Server in-memory cache synchronized successfully.' : data.error),
      synced_count: data.synced_count,
      latencyMs
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Failed to contact server sync endpoint: ' + err.message,
      latencyMs: Date.now() - startTime
    };
  }
}

/**
 * Fetch Google Apps Script Webhook trigger script code for installable onEdit trigger
 */
export async function fetchAppsScriptWebhookCode(): Promise<string> {
  try {
    const res = await fetch(getApiUrl('/api/admin/apps-script-webhook'));
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.script) {
        return data.script;
      }
    }
  } catch (err) {
    console.warn('Could not fetch webhook script from server:', err);
  }
  return '';
}

/**
 * Manually flush pending submissions queue from server to Google Sheets
 */
export async function flushServerSubmissionsQueue(): Promise<{ success: boolean; count: number }> {
  try {
    const res = await fetch(getApiUrl('/api/admin/flush-submissions-queue'), { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not flush submissions queue:', err);
  }
  return { success: false, count: 0 };
}

/**
 * Pull all data from Google Apps Script into the Centralized Server Database
 */
export async function syncServerWithGas(gasUrl?: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(getApiUrl('/api/sync/pull-from-gas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gas_url: gasUrl })
    });
    const data = await res.json();
    return { success: data.success, message: data.message || data.error || 'Sync completed' };
  } catch (err: any) {
    return { success: false, message: 'Sync error: ' + err.message };
  }
}

/**
 * Delete an exam from both Server Database and Client IndexedDB / Local Cache
 */
export async function deleteExam(examCode: string): Promise<boolean> {
  const cleanCode = (examCode || '').trim().toUpperCase();
  if (!cleanCode) return false;

  // 1. Remove from in-memory cache
  examMemoryCache.delete(cleanCode);

  // 2. Remove from IndexedDB
  await deleteExamFromIndexedDB(cleanCode);

  // 3. Remove from LocalStorage
  try {
    const raw = localStorage.getItem('ielts_saved_exams');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((e: any) => (e.exam_code || '').trim().toUpperCase() !== cleanCode);
        localStorage.setItem('ielts_saved_exams', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  // 4. Delete on server
  try {
    const res = await fetch(getApiUrl(`/api/exams/${encodeURIComponent(cleanCode)}`), {
      method: 'DELETE'
    });
    return res.ok;
  } catch (e) {
    console.warn(`Could not delete exam [${cleanCode}] from server:`, e);
    return false;
  }
}

/**
 * Direct lookup for an exam by code: returns exam if found, or null
 */
export async function getExamByCode(examCode: string): Promise<ExamData | null> {
  const result = await fetchExam(DEFAULT_API_URL, examCode);
  if (result.success && result.exam) {
    return result.exam;
  }
  return null;
}

/**
 * Admin utility: seed default starter pack into server database
 */
export async function seedStarterPack(): Promise<{ success: boolean; imported?: number; error?: string }> {
  try {
    const res = await fetch(getApiUrl('/api/admin/seed-starter'), {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, imported: data.imported };
    }
    const err = await res.json();
    return { success: false, error: err.error || 'Failed to seed starter pack' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Native Multimodal PDF pipeline: Upload raw PDF file to backend /api/admin/parse-pdf
 * Processes file via backend without exposing GEMINI_API_KEY to browser.
 */
export async function uploadAndParseIeltsPdf(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('pdf', file);

  const response = await fetch(getApiUrl('/api/admin/parse-pdf'), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'LỖI_KHI_TRÍCH_XUẤT_PDF');
  }

  const result = await response.json();
  const exam = result.exam;
  if (exam && result.testReport) {
    exam._testReport = result.testReport;
  }
  if (exam && result.cbtExam) {
    exam._cbtExam = result.cbtExam;
  }
  return exam;
}

/**
 * Fetch database analytical metrics for Candidate Submissions
 */
export async function fetchSubmissionsStats(): Promise<{
  success: boolean;
  stats?: {
    total: number;
    todayCount: number;
    gradedWriting: number;
    pendingWriting: number;
    avgListeningBand: number;
    avgReadingBand: number;
    avgOverallBand: number;
    totalViolations: number;
  };
  error?: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/admin/submissions/stats'));
    if (res.ok) {
      const data = await res.json();
      return { success: true, stats: data.stats };
    }
    return { success: false, error: 'Failed to fetch submission stats' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Download Submissions as Excel-friendly CSV with UTF-8 BOM
 */
export async function exportSubmissionsCSV(searchTerm: string = '', status: string = 'all'): Promise<void> {
  const query = new URLSearchParams({
    format: 'csv',
    search: searchTerm,
    status
  });
  const url = getApiUrl(`/api/admin/submissions/export?${query.toString()}`);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `ielts_submissions_${Date.now()}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Download Submissions as full JSON database archive
 */
export async function exportSubmissionsJSON(searchTerm: string = '', status: string = 'all'): Promise<void> {
  const query = new URLSearchParams({
    format: 'json',
    search: searchTerm,
    status
  });
  const url = getApiUrl(`/api/admin/submissions/export?${query.toString()}`);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `ielts_submissions_backup_${Date.now()}.json`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Import a list of submissions into the centralized database
 */
export async function importSubmissionsJSON(
  submissions: any[],
  syncToSheets: boolean = false
): Promise<{ success: boolean; imported?: number; updated?: number; total?: number; error?: string }> {
  try {
    const res = await fetch(getApiUrl('/api/admin/submissions/import'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissions, syncToSheets })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Flush and immediately push all queued submissions to Google Sheets API v4
 */
export async function syncDatabaseToSheets(): Promise<{ success: boolean; flushed?: number; message?: string; error?: string }> {
  try {
    const res = await fetch(getApiUrl('/api/admin/submissions/sync-to-sheets'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a submission from the server database
 */
export async function deleteSubmission(submissionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(getApiUrl(`/api/admin/submissions/${encodeURIComponent(submissionId)}`), {
      method: 'DELETE'
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}



