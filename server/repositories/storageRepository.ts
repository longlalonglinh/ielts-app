import {
  getStoredExams,
  getStoredExam,
  saveStoredExam,
  deleteStoredExam,
  importStarterPack,
  getStoredSubmissions,
  saveStoredSubmission,
  updateStoredWritingScore,
  deleteStoredSubmission,
  importSubmissions,
  getSubmissionsStats,
  getStoredCheatLogs,
  saveStoredCheatLog,
  getStoredConfig,
  saveStoredConfig,
  getStoredPracticeDecks,
  saveStoredPracticeDeck,
  deleteStoredPracticeDeck,
  replaceStoredPracticeDecks,
  ServerConfig
} from '../storage';

export interface IExamRepository {
  findAll(): any[];
  findByCode(examCode: string): any | null;
  save(exam: any): any;
  deleteByCode(examCode: string): boolean;
  importStarterPack(): { imported: number; exams: any[] };
}

export interface ISubmissionRepository {
  findAll(): any[];
  findById(submissionId: string): any | null;
  save(submission: any): any;
  updateWritingScore(submissionId: string, writingScores: any, writingBand: number, writingFeedback?: string): any | null;
  deleteById(submissionId: string): boolean;
  importBatch(submissions: any[]): { imported: number; total: number };
  getStats(): ReturnType<typeof getSubmissionsStats>;
}

export interface ICheatLogRepository {
  findAll(): any[];
  append(log: any): any;
}

export interface IPracticeDeckRepository {
  findAll(): any[];
  save(deck: any): any;
  deleteById(deckId: string): boolean;
  replaceAll(decks: any[]): any[];
}

export interface IConfigRepository {
  get(): ServerConfig;
  update(patch: Partial<ServerConfig>): ServerConfig;
}

export interface IStorageRepository {
  readonly exams: IExamRepository;
  readonly submissions: ISubmissionRepository;
  readonly cheatLogs: ICheatLogRepository;
  readonly practiceDecks: IPracticeDeckRepository;
  readonly config: IConfigRepository;
}

/**
 * File-backed Repository implementation encapsulating local JSON persistence + RAM caching.
 * Implements domain repository interfaces so the persistence layer can be swapped cleanly
 * (e.g., PostgreSQL / Firestore) without altering HTTP route handlers.
 */
export class FileStorageRepository implements IStorageRepository {
  public readonly exams: IExamRepository = {
    findAll: () => getStoredExams(),
    findByCode: (examCode: string) => getStoredExam(examCode),
    save: (exam: any) => saveStoredExam(exam),
    deleteByCode: (examCode: string) => deleteStoredExam(examCode),
    importStarterPack: () => importStarterPack()
  };

  public readonly submissions: ISubmissionRepository = {
    findAll: () => getStoredSubmissions(),
    findById: (submissionId: string) => {
      const target = String(submissionId || '').trim();
      if (!target) return null;
      return getStoredSubmissions().find((s: any) => s.submission_id === target) || null;
    },
    save: (submission: any) => saveStoredSubmission(submission),
    updateWritingScore: (submissionId: string, writingScores: any, writingBand: number, writingFeedback?: string) =>
      updateStoredWritingScore(submissionId, writingScores, writingBand, writingFeedback),
    deleteById: (submissionId: string) => deleteStoredSubmission(submissionId),
    importBatch: (submissions: any[]) => importSubmissions(submissions),
    getStats: () => getSubmissionsStats()
  };

  public readonly cheatLogs: ICheatLogRepository = {
    findAll: () => getStoredCheatLogs(),
    append: (log: any) => saveStoredCheatLog(log)
  };

  public readonly practiceDecks: IPracticeDeckRepository = {
    findAll: () => getStoredPracticeDecks(),
    save: (deck: any) => saveStoredPracticeDeck(deck),
    deleteById: (deckId: string) => deleteStoredPracticeDeck(deckId),
    replaceAll: (decks: any[]) => replaceStoredPracticeDecks(decks)
  };

  public readonly config: IConfigRepository = {
    get: () => getStoredConfig(),
    update: (patch: Partial<ServerConfig>) => saveStoredConfig(patch)
  };
}

export const storageRepository: IStorageRepository = new FileStorageRepository();
