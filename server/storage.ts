import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'server_data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure data and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Persists base64 data URLs to disk as permanent image files so that
 * all devices (phones, tablets, PCs) can load them cleanly via static URL
 * without hitting Google Sheets 50,000 character cell limits.
 */
export function persistBase64Image(dataUrlOrUrl: string, examCode: string): string {
  if (!dataUrlOrUrl || typeof dataUrlOrUrl !== 'string') return '';
  const trimmed = dataUrlOrUrl.trim();
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const matches = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) return trimmed;

    const rawExt = matches[1].toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'svg+xml' ? 'svg' : rawExt.replace(/[^a-z0-9]/g, '');
    const safeCode = (examCode || 'EXAM').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `task1_${safeCode}_${Date.now()}.${ext || 'jpg'}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    const buffer = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn('[Server Storage] Error persisting base64 image:', err);
    return trimmed;
  }
}

const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');
const STARTER_PACK_FILE = path.join(DATA_DIR, 'starter_pack.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const CHEAT_LOGS_FILE = path.join(DATA_DIR, 'cheat_logs.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PRACTICE_DECKS_FILE = path.join(DATA_DIR, 'practice_decks.json');

const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbySNk5foVr4UMC5ZVP1YTlxjxT9qFgdI85cH5nyQ63ffqXdYVZ7SJKbmD0B3xNO3DEe/exec";

// In-memory cache for ultra-low latency (<1ms)
let cachedExams: any[] | null = null;
let cachedSubmissions: any[] | null = null;
let cachedCheatLogs: any[] | null = null;
let cachedConfig: any | null = null;
let cachedPracticeDecks: any[] | null = null;

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[Server Storage] Error reading ${filePath}, using fallback:`, err);
  }
  return fallback;
}

function safeWriteJson(filePath: string, data: any): void {
  try {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`[Server Storage] Error writing ${filePath}:`, err);
  }
}

// ---------------- EXAMS ----------------
export function getStoredExams(): any[] {
  if (cachedExams) return cachedExams;

  const examsFromFile = safeReadJson<any[]>(EXAMS_FILE, []);
  cachedExams = Array.isArray(examsFromFile) ? examsFromFile : [];
  return cachedExams;
}

export function importStarterPack(): { imported: number; exams: any[] } {
  const starter = safeReadJson<any[]>(STARTER_PACK_FILE, []);
  if (!starter || starter.length === 0) return { imported: 0, exams: [] };

  const current = getStoredExams();
  const existingCodes = new Set(current.map((e: any) => (e.exam_code || '').toUpperCase()));
  let count = 0;
  for (const ex of starter) {
    const code = (ex.exam_code || '').toUpperCase();
    if (code && !existingCodes.has(code)) {
      current.push(ex);
      existingCodes.add(code);
      count++;
    }
  }
  cachedExams = current;
  safeWriteJson(EXAMS_FILE, current);
  return { imported: count, exams: current };
}

export function getStoredExam(examCode: string): any | null {
  const cleanCode = (examCode || '').trim().toUpperCase();
  if (!cleanCode) return null;

  const exams = getStoredExams();
  const found = exams.find((e: any) => (e.exam_code || '').toUpperCase() === cleanCode) || null;
  if (!found) return null;

  const writingSection = found.sections?.find((s: any) => s.skill === 'writing');
  const task1Obj = writingSection?.tasks?.find((t: any) => t.task_number === 1) || writingSection?.tasks?.[0];

  const resolvedT1Img = found.writing_task1_image || 
    found.writing_task1_image_url || 
    found.writing_task1_imageUrl || 
    task1Obj?.image_url || 
    task1Obj?.imageUrl || 
    found.image_url || 
    found.imageUrl || 
    '';

  if (resolvedT1Img) {
    found.writing_task1_image = resolvedT1Img;
    found.writing_task1_image_url = resolvedT1Img;
    found.writing_task1_imageUrl = resolvedT1Img;
  }

  return found;
}

export function saveStoredExam(examData: any): any {
  if (!examData || !examData.exam_code) {
    throw new Error('Exam data must have exam_code');
  }

  const cleanCode = String(examData.exam_code).trim().toUpperCase();

  const writingSection = examData.sections?.find((s: any) => s.skill === 'writing');
  const task1Obj = writingSection?.tasks?.find((t: any) => t.task_number === 1) || writingSection?.tasks?.[0];

  const rawT1Img = examData.writing_task1_image || 
    examData.writing_task1_image_url || 
    examData.writing_task1_imageUrl || 
    task1Obj?.image_url || 
    task1Obj?.imageUrl || 
    examData.image_url || 
    examData.imageUrl || 
    '';

  const resolvedT1Img = rawT1Img ? persistBase64Image(rawT1Img, cleanCode) : '';

  const rawSkills = Array.isArray(examData.skills) ? examData.skills : [];
  const isOneSkill = examData.exam_type === 'one_skill' || rawSkills.length === 1;
  const allowListening = !isOneSkill || rawSkills.includes('listening');
  const allowReading = !isOneSkill || rawSkills.includes('reading');
  const allowWriting = !isOneSkill || rawSkills.includes('writing');

  const listening_questions = allowListening ? (examData.listening_questions || []) : [];
  const reading_questions = allowReading ? (examData.reading_questions || []) : [];
  const audio_url = allowListening ? (examData.audio_url || '') : '';
  const passages = allowReading ? (examData.passages || []) : [];
  const passage_text = allowReading ? (examData.passage_text || examData.reading_passage || '') : '';
  const passage_title = allowReading ? (examData.passage_title || examData.reading_passage_title || '') : '';

  const cleanW1 = allowWriting ? (examData.writing_task1_prompt || '') : '';
  const cleanW1Img = allowWriting ? resolvedT1Img : '';
  const cleanW2 = allowWriting ? (examData.writing_task2_prompt || '') : '';

  let questions = examData.questions;
  if (Array.isArray(questions)) {
    questions = questions.filter((q: any) => {
      const sec = (q.section || 'reading').toLowerCase();
      if (sec === 'listening') return allowListening;
      if (sec === 'reading') return allowReading;
      return true;
    });
  } else {
    questions = [...listening_questions, ...reading_questions];
  }

  let sections = examData.sections;
  if (Array.isArray(sections)) {
    sections = sections
      .filter((sec: any) => {
        if (sec.skill === 'listening') return allowListening;
        if (sec.skill === 'reading') return allowReading;
        if (sec.skill === 'writing') return allowWriting;
        return true;
      })
      .map((sec: any) => {
        if (sec.skill === 'writing' && Array.isArray(sec.tasks)) {
          return {
            ...sec,
            tasks: sec.tasks.map((t: any) => {
              if (t.task_number === 1 || t.id === 'task-1') {
                return {
                  ...t,
                  image_url: t.image_url || t.imageUrl || cleanW1Img,
                  imageUrl: t.imageUrl || t.image_url || cleanW1Img
                };
              }
              return t;
            })
          };
        }
        return sec;
      });
  }

  const standardizedExam = {
    ...examData,
    exam_code: cleanCode,
    skills: rawSkills,
    exam_type: examData.exam_type || (rawSkills.length === 1 ? 'one_skill' : rawSkills.length === 2 ? 'two_skills' : 'full_test'),
    sections,
    audio_url,
    audio_title: allowListening ? (examData.audio_title || '') : '',
    passage_title,
    reading_passage_title: passage_title,
    passage_text,
    reading_passage: passage_text,
    passages,
    listening_questions,
    reading_questions,
    questions,
    writing_task1_prompt: cleanW1,
    writing_task1_image: cleanW1Img,
    writing_task1_image_url: cleanW1Img,
    writing_task1_imageUrl: cleanW1Img,
    writing_task2_prompt: cleanW2,
    updated_at: new Date().toISOString()
  };

  const exams = getStoredExams();
  const idx = exams.findIndex((e: any) => (e.exam_code || '').toUpperCase() === cleanCode);

  if (idx >= 0) {
    exams[idx] = standardizedExam;
  } else {
    exams.push(standardizedExam);
  }

  cachedExams = exams;
  safeWriteJson(EXAMS_FILE, exams);
  return standardizedExam;
}

export function deleteStoredExam(examCode: string): boolean {
  const cleanCode = (examCode || '').trim().toUpperCase();
  const exams = getStoredExams();
  const filtered = exams.filter((e: any) => (e.exam_code || '').toUpperCase() !== cleanCode);
  
  if (filtered.length !== exams.length) {
    cachedExams = filtered;
    safeWriteJson(EXAMS_FILE, filtered);
    return true;
  }
  return false;
}

// ---------------- SUBMISSIONS ----------------
export function getStoredSubmissions(): any[] {
  if (cachedSubmissions) return cachedSubmissions;
  cachedSubmissions = safeReadJson<any[]>(SUBMISSIONS_FILE, []);
  return cachedSubmissions;
}

export function saveStoredSubmission(submission: any): any {
  const submissions = getStoredSubmissions();
  const subId = submission.submission_id || `SUB_${Date.now()}`;
  const record = {
    ...submission,
    submission_id: subId,
    received_at: new Date().toISOString()
  };

  const idx = submissions.findIndex((s: any) => s.submission_id === subId);
  if (idx >= 0) {
    submissions[idx] = record;
  } else {
    submissions.unshift(record);
  }

  // Keep latest 2000 submissions
  if (submissions.length > 2000) {
    submissions.length = 2000;
  }

  cachedSubmissions = submissions;
  safeWriteJson(SUBMISSIONS_FILE, submissions);
  return record;
}

export function updateStoredWritingScore(
  submissionId: string, 
  scores: any, 
  overallWriting: number, 
  feedback?: string,
  expectedVersion?: number,
  examinerId?: string
): { success: boolean; submission?: any; conflict?: boolean; message?: string } {
  const submissions = getStoredSubmissions();
  const sub = submissions.find((s: any) => s.submission_id === submissionId);
  if (!sub) return { success: false, message: 'Submission not found' };

  // TC-EXAM-02: Optimistic Locking for concurrent examiners
  const currentVersion = sub.grading_version || 1;
  if (expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
    return {
      success: false,
      conflict: true,
      message: 'DATA HAS BEEN MODIFIED BY ANOTHER EXAMINER. PLEASE REFRESH THE PAGE (DỮ LIỆU ĐÃ ĐƯỢC CẬP NHẬT BỞI NGƯỜI KHÁC)'
    };
  }

  sub.writing_status = 'GRADED';
  sub.writing_band = overallWriting;
  sub.writing_scores = scores;
  if (feedback !== undefined) sub.writing_feedback = feedback;
  sub.grading_version = currentVersion + 1;
  sub.graded_by = examinerId || 'examiner';
  sub.graded_at = new Date().toISOString();

  // Re-calculate overall band if listening and reading bands exist
  const lBand = Number(sub.listening_band) || 0;
  const rBand = Number(sub.reading_band) || 0;
  const isOneSkillRetake = Boolean(sub.retakeMode || sub.retake_mode || (sub.targetSkill === 'writing' || sub.target_skill === 'writing'));
  
  if (isOneSkillRetake && lBand === 0 && rBand === 0) {
    sub.overall_band = overallWriting;
  } else if (lBand > 0 || rBand > 0) {
    const activeBands = [lBand, rBand, overallWriting].filter(b => b > 0);
    const avg = activeBands.reduce((a, b) => a + b, 0) / activeBands.length;
    sub.overall_band = Math.round(avg * 2) / 2;
  } else {
    sub.overall_band = overallWriting;
  }

  cachedSubmissions = submissions;
  safeWriteJson(SUBMISSIONS_FILE, submissions);
  return { success: true, submission: sub };
}

export function deleteStoredSubmission(submissionId: string): boolean {
  const submissions = getStoredSubmissions();
  const filtered = submissions.filter((s: any) => s.submission_id !== submissionId);
  if (filtered.length !== submissions.length) {
    cachedSubmissions = filtered;
    safeWriteJson(SUBMISSIONS_FILE, filtered);
    return true;
  }
  return false;
}

export function importSubmissions(importedList: any[]): { imported: number; updated: number; total: number } {
  if (!Array.isArray(importedList) || importedList.length === 0) {
    return { imported: 0, updated: 0, total: getStoredSubmissions().length };
  }

  const current = getStoredSubmissions();
  let importedCount = 0;
  let updatedCount = 0;

  for (const item of importedList) {
    if (!item) continue;
    const subId = item.submission_id || `${item.sbd || 'IMPORT'}_${item.exam_code || 'EXAM'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      ...item,
      submission_id: subId,
      received_at: item.received_at || item.submitted_at || new Date().toISOString()
    };

    const existingIdx = current.findIndex((s: any) => s.submission_id === subId);
    if (existingIdx >= 0) {
      current[existingIdx] = { ...current[existingIdx], ...record };
      updatedCount++;
    } else {
      current.unshift(record);
      importedCount++;
    }
  }

  if (current.length > 3000) {
    current.length = 3000;
  }

  cachedSubmissions = current;
  safeWriteJson(SUBMISSIONS_FILE, current);
  return { imported: importedCount, updated: updatedCount, total: current.length };
}

export function getSubmissionsStats(): {
  total: number;
  todayCount: number;
  gradedWriting: number;
  pendingWriting: number;
  avgListeningBand: number;
  avgReadingBand: number;
  avgOverallBand: number;
  totalViolations: number;
} {
  const submissions = getStoredSubmissions();
  const todayStr = new Date().toISOString().split('T')[0];

  let todayCount = 0;
  let gradedWriting = 0;
  let pendingWriting = 0;
  let totalViolations = 0;

  const listeningBands: number[] = [];
  const readingBands: number[] = [];
  const overallBands: number[] = [];

  for (const s of submissions) {
    const subDate = (s.submitted_at || s.received_at || '').split('T')[0];
    if (subDate === todayStr) {
      todayCount++;
    }

    if (s.writing_status === 'GRADED') {
      gradedWriting++;
    } else {
      pendingWriting++;
    }

    totalViolations += Number(s.violations_count || s.cheat_count || 0);

    const lBand = Number(s.listening_band);
    if (!isNaN(lBand) && lBand > 0) listeningBands.push(lBand);

    const rBand = Number(s.reading_band);
    if (!isNaN(rBand) && rBand > 0) readingBands.push(rBand);

    const oBand = Number(s.overall_band);
    if (!isNaN(oBand) && oBand > 0) overallBands.push(oBand);
  }

  const calcAvg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  return {
    total: submissions.length,
    todayCount,
    gradedWriting,
    pendingWriting,
    avgListeningBand: calcAvg(listeningBands),
    avgReadingBand: calcAvg(readingBands),
    avgOverallBand: calcAvg(overallBands),
    totalViolations
  };
}

// ---------------- CHEAT LOGS ----------------
export function getStoredCheatLogs(): any[] {
  if (cachedCheatLogs) return cachedCheatLogs;
  cachedCheatLogs = safeReadJson<any[]>(CHEAT_LOGS_FILE, []);
  return cachedCheatLogs;
}

export function saveStoredCheatLog(log: any): any {
  const logs = getStoredCheatLogs();
  const logId = log.log_id || `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record = {
    ...log,
    log_id: logId,
    timestamp: log.timestamp || new Date().toISOString()
  };

  logs.unshift(record);
  if (logs.length > 3000) {
    logs.length = 3000;
  }

  cachedCheatLogs = logs;
  safeWriteJson(CHEAT_LOGS_FILE, logs);
  return record;
}

// ---------------- SERVER CONFIG ----------------
export interface ServerConfig {
  gas_url: string;
  spreadsheet_id?: string;
  service_account_email?: string;
  service_account_private_key?: string;
  service_account_json?: string;
  service_account_project_id?: string;
  last_synced_at?: string;
}

export function getStoredConfig(): ServerConfig {
  if (cachedConfig) return cachedConfig;
  const def: ServerConfig = { gas_url: DEFAULT_GAS_URL, spreadsheet_id: '' };
  cachedConfig = safeReadJson<ServerConfig>(CONFIG_FILE, def);
  if (!cachedConfig.gas_url) {
    cachedConfig.gas_url = DEFAULT_GAS_URL;
  }
  return cachedConfig;
}

export function saveStoredConfig(newConfig: Partial<ServerConfig>): ServerConfig {
  const current = getStoredConfig();
  cachedConfig = {
    ...current,
    ...newConfig
  };
  safeWriteJson(CONFIG_FILE, cachedConfig);
  return cachedConfig;
}

// ---------------- PRACTICE DECKS ----------------
export function getStoredPracticeDecks(): any[] {
  if (cachedPracticeDecks) return cachedPracticeDecks;
  cachedPracticeDecks = safeReadJson<any[]>(PRACTICE_DECKS_FILE, []);
  return cachedPracticeDecks;
}

export function saveStoredPracticeDeck(deck: any): any {
  const decks = getStoredPracticeDecks();
  const deckId = deck.deck_id || `DECK_${Date.now()}`;
  const record = { ...deck, deck_id: deckId, updated_at: new Date().toISOString() };

  const idx = decks.findIndex((d: any) => d.deck_id === deckId);
  if (idx >= 0) {
    decks[idx] = record;
  } else {
    decks.push(record);
  }

  cachedPracticeDecks = decks;
  safeWriteJson(PRACTICE_DECKS_FILE, decks);
  return record;
}
