export * from './types/practice';

export enum IELTSQuestionType {
  // Nhóm Trắc nghiệm
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  MULTIPLE_CHOICE_MULTIPLE_ANSWERS = "MULTIPLE_CHOICE_MULTIPLE_ANSWERS", // Chọn 2 hoặc 3 đáp án (A, C, E)

  // Nhóm Đúng / Sai / Không đề cập
  TRUE_FALSE_NOT_GIVEN = "TRUE_FALSE_NOT_GIVEN",
  YES_NO_NOT_GIVEN = "YES_NO_NOT_GIVEN",

  // Nhóm Nối (Matching)
  MATCHING_HEADINGS = "MATCHING_HEADINGS",
  MATCHING_INFORMATION = "MATCHING_INFORMATION",
  MATCHING_FEATURES = "MATCHING_FEATURES",
  MATCHING_SENTENCE_ENDINGS = "MATCHING_SENTENCE_ENDINGS",

  // Nhóm Điền từ (Completion)
  FILL_IN_THE_BLANK = "FILL_IN_THE_BLANK", // Sentence/Note Completion
  SUMMARY_COMPLETION_TEXT = "SUMMARY_COMPLETION_TEXT", // Lấy từ bài đọc
  SUMMARY_COMPLETION_BOX = "SUMMARY_COMPLETION_BOX", // Chọn từ trong bảng từ vựng
  TABLE_COMPLETION = "TABLE_COMPLETION",
  FLOW_CHART_COMPLETION = "FLOW_CHART_COMPLETION",
  DIAGRAM_LABEL_COMPLETION = "DIAGRAM_LABEL_COMPLETION",

  // Nhóm Câu trả lời ngắn
  SHORT_ANSWER = "SHORT_ANSWER"
}

export type QuestionType =
  | IELTSQuestionType
  | keyof typeof IELTSQuestionType
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_CHOICE_MULTIPLE_ANSWERS'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING_HEADINGS'
  | 'MATCHING_INFORMATION'
  | 'MATCHING_FEATURES'
  | 'MATCHING_SENTENCE_ENDINGS'
  | 'FILL_IN_THE_BLANK'
  | 'SUMMARY_COMPLETION_TEXT'
  | 'SUMMARY_COMPLETION_BOX'
  | 'TABLE_COMPLETION'
  | 'FLOW_CHART_COMPLETION'
  | 'DIAGRAM_LABEL_COMPLETION'
  | 'SHORT_ANSWER'
  // Listening & Reading shared (legacy strings)
  | 'multiple_choice'
  | 'multiple_choice_multi'
  | 'matching'
  | 'plan_map_diagram_labelling'
  | 'form_note_table_flowchart_completion'
  | 'sentence_completion'
  | 'short_answer_questions'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  // Reading specialized
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'matching_sentence_endings'
  | 'diagram_label_completion'
  | 'summary_completion'
  | 'summary_completion_text'
  | 'summary_completion_box'
  | 'table_completion'
  | 'flow_chart_completion'
  // Fallbacks & aliases
  | 'fill_in_blank';

export function canonicalizeQuestionType(rawType: string | undefined | null): IELTSQuestionType {
  if (!rawType) return IELTSQuestionType.MULTIPLE_CHOICE;
  const upper = rawType.toUpperCase().replace(/[-\s]+/g, '_');

  if (upper in IELTSQuestionType) {
    return IELTSQuestionType[upper as keyof typeof IELTSQuestionType];
  }

  // Common aliases & partial matches
  if (
    upper.includes('MULTI') || 
    upper.includes('CHOOSE_TWO') || 
    upper.includes('CHOOSE_THREE') || 
    upper.includes('MULTIPLE_ANSWERS')
  ) {
    return IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS;
  }
  if (upper.includes('TRUE_FALSE') || upper === 'TFNG' || upper.includes('TRUE')) {
    return IELTSQuestionType.TRUE_FALSE_NOT_GIVEN;
  }
  if (upper.includes('YES_NO') || upper === 'YNNG') {
    return IELTSQuestionType.YES_NO_NOT_GIVEN;
  }
  if (upper.includes('MATCHING_HEADING') || upper.includes('HEADING')) {
    return IELTSQuestionType.MATCHING_HEADINGS;
  }
  if (upper.includes('MATCHING_INFO') || upper.includes('WHICH_PARAGRAPH')) {
    return IELTSQuestionType.MATCHING_INFORMATION;
  }
  if (upper.includes('MATCHING_FEATURE') || upper.includes('FEATURE') || upper.includes('PERSON') || upper.includes('PEOPLE')) {
    return IELTSQuestionType.MATCHING_FEATURES;
  }
  if (upper.includes('MATCHING_SENTENCE') || upper.includes('SENTENCE_ENDING') || upper.includes('ENDING')) {
    return IELTSQuestionType.MATCHING_SENTENCE_ENDINGS;
  }
  if (upper.includes('SUMMARY_COMPLETION_BOX') || upper.includes('WORD_LIST') || upper.includes('WORDLIST') || upper.includes('WORD_BANK')) {
    return IELTSQuestionType.SUMMARY_COMPLETION_BOX;
  }
  if (upper.includes('SUMMARY_COMPLETION_TEXT') || upper.includes('SUMMARY')) {
    return IELTSQuestionType.SUMMARY_COMPLETION_TEXT;
  }
  if (upper.includes('TABLE')) {
    return IELTSQuestionType.TABLE_COMPLETION;
  }
  if (upper.includes('FLOW_CHART') || upper.includes('FLOWCHART')) {
    return IELTSQuestionType.FLOW_CHART_COMPLETION;
  }
  if (upper.includes('DIAGRAM') || upper.includes('LABEL') || upper.includes('MAP')) {
    return IELTSQuestionType.DIAGRAM_LABEL_COMPLETION;
  }
  if (upper.includes('SHORT_ANSWER')) {
    return IELTSQuestionType.SHORT_ANSWER;
  }
  if (upper.includes('FILL') || upper.includes('BLANK') || upper.includes('SENTENCE_COMPLETION')) {
    return IELTSQuestionType.FILL_IN_THE_BLANK;
  }

  return IELTSQuestionType.MULTIPLE_CHOICE;
}

export interface MatchingOption {
  id: string; // e.g. "A", "i", "1"
  text: string;
}

export interface TableCell {
  text?: string;
  is_blank?: boolean;
  question_id?: string; // e.g. "R14" or "14"
  placeholder?: string;
}

export interface TableRow {
  cells: TableCell[];
}

export type SkillType = 'listening' | 'reading' | 'writing';
export type ExamType = 'one_skill' | 'two_skills' | 'full_test';

export interface WritingTask {
  id?: string;
  task_number: 1 | 2;
  title?: string;
  prompt: string;
  image_url?: string;
  imageUrl?: string;
  min_words?: number;
  suggested_time_minutes?: number;
}

export interface ExamSkillSection {
  skill: SkillType;
  title: string;
  durationMinutes: number;
  audioUrl?: string; // Required for listening
  instruction?: string;
  passages?: ReadingPassageItem[]; // For reading
  tasks?: WritingTask[]; // For writing
  questions?: Question[];
}

export interface TableData {
  title?: string;
  headers: string[]; // Column headers
  rows: TableRow[];
}

export interface FlowChartStep {
  step_number: number;
  title?: string;
  description: string;
  is_blank?: boolean;
  question_id?: string;
}

export interface WordBankItem {
  id: string; // e.g. "A", "B", ...
  word: string; // e.g. "fossil fuels", "emissions"
}

export interface Question {
  question_id: string;
  question_number?: number;
  section: 'listening' | 'reading';
  part?: 1 | 2 | 3 | 4; // Listening Part 1, 2, 3, 4 (10 questions each)
  passage_index?: 1 | 2 | 3; // Reading Passage 1, 2, 3
  question_text: string;
  question_type: QuestionType;
  instruction?: string; // e.g. "Write NO MORE THAN TWO WORDS AND/OR A NUMBER"
  word_limit?: string; // e.g. "NO MORE THAN TWO WORDS"
  options?: string[]; // Multiple choice options ["A. Option 1", "B. Option 2", ...]
  headings_list?: MatchingOption[]; // For Matching Headings: [{ id: "i", text: "..." }, ...]
  matching_options?: MatchingOption[]; // For Matching Features/Endings: [{ id: "A", text: "..." }, ...]
  diagram_image_url?: string; // For Diagram/Map/Plan Labelling
  diagram_labels?: string[]; // Labels available on diagram (e.g. ["A", "B", "C", "D", "E"])
  correct_answer?: string | string[]; // e.g. "A", "library", or pipe-separated "1,400 kilometres|1400 kilometres|1400 km|1,400km"
  acceptable_answers?: string[]; // Multiple accepted alternatives
  correct_answers_multi?: string[]; // e.g. ["B", "D"] for choose 2 out of 5
  explanation?: string;
  evidence_quote?: string;
  max_score: number;
  image_url?: string;

  // Rich IELTS Question Attributes:
  table_data?: TableData;
  table_markdown?: string;
  flowchart_steps?: FlowChartStep[];
  word_bank?: WordBankItem[];
  nb_condition?: boolean | string; // e.g. "NB You may use any letter more than once"
  multi_select_count?: number; // e.g. 2 for "Choose TWO letters"
  context_content?: string; // Container context or table/flowchart markdown embedding [blank_X]
  is_example?: boolean; // Demonstrative example question (e.g. Paragraph A: viii) - excluded from score
  multi_group_id?: string; // Group ID for multi-select questions (e.g. Questions 8-9) for set-intersection scoring
  max_words?: number; // Maximum words limit for gap fill / completion questions
}

export interface ReadingPassageItem {
  passage_index: 1 | 2 | 3;
  title: string;
  text: string;
  questions: Question[];
}

export interface ExamData {
  id?: string;
  exam_code: string;
  title: string;
  exam_type?: ExamType; // 'one_skill' | 'two_skills' | 'full_test'
  skills?: SkillType[]; // ['reading'] hoặc ['listening', 'reading'] hoặc ['listening', 'reading', 'writing']
  retakeMode?: boolean;
  targetSkill?: SkillType;
  sections?: ExamSkillSection[];
  test_type?: 'TEST' | 'PRACTICE';
  duration_mins?: number; // Total exam duration in minutes (default 120 or 150)
  listening_duration_mins?: number; // Default 30-40 mins
  reading_duration_mins?: number; // Default 60 mins
  writing_duration_mins?: number; // Default 60 mins
  audio_url?: string;
  audio_title?: string;
  image_url?: string;
  imageUrl?: string;
  listening_questions?: Question[];
  passage_title?: string;
  reading_passage_title?: string;
  passage_text?: string;
  reading_passage?: string;
  passages: ReadingPassageItem[]; // Multi-passage support (Passage 1, 2, 3) - each contains passage_index, title, text, and questions
  reading_questions?: Question[];
  questions?: Question[];
  writing_task1_prompt?: string;
  writing_task1_image?: string;
  writing_task1_image_url?: string;
  writing_task1_imageUrl?: string;
  writing_task2_prompt?: string;
  created_at?: string;
}

// Alias for backwards compatibility
export type Exam = ExamData;

export interface WritingScores {
  TR: number;  // Task Response
  CC: number;  // Coherence & Cohesion
  LR: number;  // Lexical Resource
  GRA: number; // Grammatical Range & Accuracy
}

export interface GradingForm {
  tr: number;
  cc: number;
  lr: number;
  gra: number;
  overall_writing: number;
  feedback: string;
}

export interface SubmissionRecord {
  submission_id: string;
  sbd: string;
  exam_code: string;
  test_mode?: 'TEST' | 'PRACTICE';
  retakeMode?: boolean;
  targetSkill?: SkillType;
  submission_type?: 'STANDARD' | 'TIMEOUT_FORCED';
  listening_answers?: Record<string, string>;
  reading_answers?: Record<string, string>;
  writing_task1_text?: string;
  writing_task2_text?: string;
  listening_raw_score?: number;
  listening_max_score?: number;
  listening_band?: number;
  listening_score?: number;
  reading_raw_score?: number;
  reading_max_score?: number;
  reading_band?: number;
  reading_score?: number;
  writing_scores?: WritingScores;
  writing_band?: number;
  writing_status: 'PENDING_TEACHER' | 'GRADED';
  writing_feedback?: string;
  overall_band?: number;
  detailed_results?: Record<string, {
    question_id: string;
    section: 'listening' | 'reading';
    user_answer: string;
    is_correct: boolean;
    score_awarded: number;
    acceptable_answers: string[];
  }>;
  submitted_at?: string;
  timestamp?: string;
  created_at?: string;
  submission_time?: string;
  violations_count?: number;
  cumulative_off_screen_seconds?: number;
  switch_count?: number;
  sealed_token?: string;
  offline_receipt_code?: string;
  is_offline_pending?: boolean;
  is_server_certified?: boolean;
  sync_status?: 'CERTIFIED_ONLINE' | 'QUEUED_OFFLINE' | 'SYNCING';
}

// Alias
export type Submission = SubmissionRecord;

export interface SubmissionPayload {
  submission_id?: string;
  sbd: string;
  exam_code: string;
  test_mode?: 'TEST' | 'PRACTICE';
  retakeMode?: boolean;
  targetSkill?: SkillType;
  submission_type?: 'STANDARD' | 'TIMEOUT_FORCED';
  listening_answers?: Record<string, string>;
  reading_answers?: Record<string, string>;
  writing_task1_text?: string;
  writing_task2_text?: string;
  answers?: Record<string, string>;
  writing_task1?: string;
  writing_task2?: string;
  violations_count?: number;
  cumulative_off_screen_seconds?: number;
  switch_count?: number;
  sealed_token?: string;
  offline_receipt_code?: string;
  is_offline_pending?: boolean;
  violation_logs?: CheatLog[];
  cheat_logs?: CheatLog[];
  submitted_at?: string;
  isPreview?: boolean;
}

export interface SubmissionResponse {
  success?: boolean;
  submission_id: string;
  sbd: string;
  exam_code: string;
  test_mode?: 'TEST' | 'PRACTICE';
  retakeMode?: boolean;
  targetSkill?: SkillType;
  submission_type?: 'STANDARD' | 'TIMEOUT_FORCED';
  listening_raw_score?: number;
  listening_max_score?: number;
  listening_band?: number;
  listening_score?: number;
  reading_raw_score?: number;
  reading_max_score?: number;
  reading_band?: number;
  reading_score?: number;
  overall_raw_score?: number;
  overall_band?: number;
  detailed_results?: Record<string, {
    question_id: string;
    section: 'listening' | 'reading';
    user_answer: string;
    is_correct: boolean;
    score_awarded: number;
    acceptable_answers: string[];
  }>;
  writing_status: 'PENDING_TEACHER' | 'GRADED';
  submitted_at?: string;
  created_at?: string;
  message?: string;
  is_offline_pending?: boolean;
  is_server_certified?: boolean;
  sealed_token?: string;
  offline_receipt_code?: string;
  sync_status?: 'CERTIFIED_ONLINE' | 'QUEUED_OFFLINE' | 'SYNCING';
}

export interface CheatLog {
  log_id: string;
  submission_id: string;
  sbd: string;
  exam_code: string;
  violation_type: 'ONBLUR' | 'FULLSCREEN_EXIT' | 'RIGHT_CLICK' | 'KEY_DEVTOOLS' | string;
  violation_count?: number;
  timestamp: string;
}

export interface StudentSession {
  sbd: string;
  exam_code: string;
  test_mode: 'TEST' | 'PRACTICE';
  retakeMode?: boolean;
  targetSkill?: SkillType;
  is_review: boolean;
  review_submission_id?: string;
}

export interface HighlightingTool {
  id: string;
  color: 'yellow' | 'green' | 'blue';
  color_hex?: string;
  text: string;
  startIndex?: number;
  endIndex?: number;
  paragraphIndex?: number;
}

export interface ParseExamResponse {
  success: boolean;
  exam?: ExamData;
  error?: string;
}

export type CanonicalCbtQuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'fill_blank'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'flow_chart_completion'
  | 'writing_task';

export interface CbtQuestionItem {
  question_number: number;
  question_text: string;
  options?: string[];
  correct_answer: string | null;
  acceptable_answers?: string[];
  explanation: string | null;
  is_example?: boolean;
  multi_group_id?: string;
  max_words?: number;
}

export interface CbtQuestionGroup {
  group_id: string;
  instructions: string;
  question_type: CanonicalCbtQuestionType;
  context_content?: string;
  options?: string[];
  questions: CbtQuestionItem[];
}

export interface CbtPassageItem {
  passage_number: number;
  title: string;
  content: string;
  question_groups: CbtQuestionGroup[];
}

export interface CbtWritingTaskItem {
  task_number: 1 | 2;
  title?: string;
  prompt: string;
  image_url?: string;
  min_words: number;
}

export interface CbtEngineTranspiledExam {
  exam_id: string;
  title: string;
  skill: 'reading' | 'listening' | 'writing';
  duration_minutes: number;
  passages?: CbtPassageItem[];
  writing_tasks?: CbtWritingTaskItem[];
}

