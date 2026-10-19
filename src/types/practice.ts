export interface PracticeCard {
  id: string;
  sentence_en: string; // The complete English sentence or cloze prompt e.g. "We need to analyze the comprehensive _____ of this environmental policy."
  sentence_vi: string; // Contextual meaning or paraphrase explanation
  cloze_target: string; // The missing word / phrase e.g. "impact"
  target_word?: string; // Root word or lemma e.g. "impact"
  part_of_speech?: string; // "noun", "verb", "adjective", "phrasal verb", etc.
  phonetic?: string; // e.g. "/ˈɪm.pækt/"
  hints?: string; // e.g. "impact, consequence, influence (noun)"
  accepted_answers: string[]; // e.g. ["impact", "impacts"]
  explanation: string; // Detailed grammar / collocation explanation
  grammar_points?: string[]; // Bullet points e.g. ["Collocation: comprehensive impact", "Preposition: impact on"]
  options?: string[]; // Optional 4 multiple choice options for beginners
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CustomPracticeDeck {
  deck_id: string; // e.g. "ON_TAP_01", "VOCAB_B2", "GRAMMAR_ESSENTIAL", "CUSTOM_DECK_1"
  title: string;
  category: 'Vocabulary' | 'Grammar' | 'Communication' | 'IELTS Academic' | 'IELTS Reading' | 'IELTS Listening' | 'IELTS Writing' | 'General English' | 'Custom';
  description: string;
  target_language: string;
  native_language: string;
  level: 'A1-A2' | 'B1-B2' | 'C1-C2';
  icon?: string;
  cover_gradient?: string;
  cards: PracticeCard[];
  created_at?: string;
  updated_at?: string;
  is_custom?: boolean;
}

export interface CardReviewState {
  card_id: string;
  correct_count: number;
  wrong_count: number;
  last_practiced: string;
  mastered: boolean;
  user_notes?: string;
}

export interface LearnerProfile {
  student_id: string; // e.g. "HV01", "HV02", "HV03"
  student_name: string; // e.g. "Learner 1 - John Doe"
  avatar_color: string; // Tailored color badge
  slot_index: 1 | 2 | 3; // 3 learners pool
  joined_at?: string;
  last_active?: string;
}

export interface StudentProgressRecord {
  student_id: string;
  student_name: string;
  deck_id: string;
  deck_title: string;
  cards_mastered: number;
  total_cards: number;
  mastery_pct: number;
  correct_count: number;
  wrong_count: number;
  daily_streak: number;
  last_studied_at: string;
  notes?: string;
}

export interface PracticeUserStats {
  daily_streak: number;
  last_streak_date: string;
  words_practiced_today: number;
  best_streak: number;
  correct_repeats_pct: number;
  total_cards_mastered: number;
  cards_state: Record<string, CardReviewState>;
  history_logs: Array<{
    timestamp: string;
    deck_id: string;
    deck_title: string;
    cards_practiced: number;
    score: number;
  }>;
}

export interface SentenceGrammarAnalysis {
  original_sentence: string;
  target_word: string;
  sentence_translation_vi: string;
  syntax_breakdown: {
    subject: string;
    main_verb: string;
    object_or_complement: string;
    modifiers_or_clauses: string;
  };
  word_analysis: {
    target_word: string;
    part_of_speech: string;
    phonetic: string;
    definition_vi: string;
    root_and_forms: string[];
    synonyms: string[];
    antonyms: string[];
  };
  key_grammar_rules: string[];
  collocations_and_phrases: string[];
  detailed_explanation_vi: string;
  common_pitfalls: string;
  example_sentences: Array<{
    en: string;
    vi: string;
  }>;
}

export type SentenceAnalysisResponse = SentenceGrammarAnalysis;
