import { describe, it, expect } from 'vitest';
import { 
  IELTSQuestionType, 
  canonicalizeQuestionType, 
  Question, 
  TableData 
} from '../types';
import { isAnswerCorrect, parseAcceptableAnswers } from '../services/answerScoring';
import { determineQuestionType } from '../services/documentExamParser';

describe('IELTS Question Types & Answer Scoring Suite', () => {

  describe('IELTSQuestionType Enum & Canonicalization', () => {
    it('defines all required IELTS question types in enum', () => {
      expect(IELTSQuestionType.MULTIPLE_CHOICE).toBe('MULTIPLE_CHOICE');
      expect(IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS).toBe('MULTIPLE_CHOICE_MULTIPLE_ANSWERS');
      expect(IELTSQuestionType.TRUE_FALSE_NOT_GIVEN).toBe('TRUE_FALSE_NOT_GIVEN');
      expect(IELTSQuestionType.YES_NO_NOT_GIVEN).toBe('YES_NO_NOT_GIVEN');
      expect(IELTSQuestionType.MATCHING_HEADINGS).toBe('MATCHING_HEADINGS');
      expect(IELTSQuestionType.MATCHING_INFORMATION).toBe('MATCHING_INFORMATION');
      expect(IELTSQuestionType.MATCHING_FEATURES).toBe('MATCHING_FEATURES');
      expect(IELTSQuestionType.MATCHING_SENTENCE_ENDINGS).toBe('MATCHING_SENTENCE_ENDINGS');
      expect(IELTSQuestionType.FILL_IN_THE_BLANK).toBe('FILL_IN_THE_BLANK');
      expect(IELTSQuestionType.SUMMARY_COMPLETION_TEXT).toBe('SUMMARY_COMPLETION_TEXT');
      expect(IELTSQuestionType.SUMMARY_COMPLETION_BOX).toBe('SUMMARY_COMPLETION_BOX');
      expect(IELTSQuestionType.TABLE_COMPLETION).toBe('TABLE_COMPLETION');
      expect(IELTSQuestionType.FLOW_CHART_COMPLETION).toBe('FLOW_CHART_COMPLETION');
      expect(IELTSQuestionType.DIAGRAM_LABEL_COMPLETION).toBe('DIAGRAM_LABEL_COMPLETION');
      expect(IELTSQuestionType.SHORT_ANSWER).toBe('SHORT_ANSWER');
    });

    it('correctly maps various strings and aliases to IELTSQuestionType', () => {
      expect(canonicalizeQuestionType('multiple_choice')).toBe(IELTSQuestionType.MULTIPLE_CHOICE);
      expect(canonicalizeQuestionType('multiple_choice_multi')).toBe(IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS);
      expect(canonicalizeQuestionType('CHOOSE_TWO_LETTERS')).toBe(IELTSQuestionType.MULTIPLE_CHOICE_MULTIPLE_ANSWERS);
      expect(canonicalizeQuestionType('true_false_not_given')).toBe(IELTSQuestionType.TRUE_FALSE_NOT_GIVEN);
      expect(canonicalizeQuestionType('TFNG')).toBe(IELTSQuestionType.TRUE_FALSE_NOT_GIVEN);
      expect(canonicalizeQuestionType('yes_no_not_given')).toBe(IELTSQuestionType.YES_NO_NOT_GIVEN);
      expect(canonicalizeQuestionType('matching_headings')).toBe(IELTSQuestionType.MATCHING_HEADINGS);
      expect(canonicalizeQuestionType('matching_information')).toBe(IELTSQuestionType.MATCHING_INFORMATION);
      expect(canonicalizeQuestionType('which_paragraph_contains')).toBe(IELTSQuestionType.MATCHING_INFORMATION);
      expect(canonicalizeQuestionType('matching_features')).toBe(IELTSQuestionType.MATCHING_FEATURES);
      expect(canonicalizeQuestionType('matching_sentence_endings')).toBe(IELTSQuestionType.MATCHING_SENTENCE_ENDINGS);
      expect(canonicalizeQuestionType('summary_completion_box')).toBe(IELTSQuestionType.SUMMARY_COMPLETION_BOX);
      expect(canonicalizeQuestionType('table_completion')).toBe(IELTSQuestionType.TABLE_COMPLETION);
      expect(canonicalizeQuestionType('flow_chart_completion')).toBe(IELTSQuestionType.FLOW_CHART_COMPLETION);
      expect(canonicalizeQuestionType('diagram_label_completion')).toBe(IELTSQuestionType.DIAGRAM_LABEL_COMPLETION);
    });
  });

  describe('Document Parser Question Type Detection', () => {
    it('detects MATCHING_INFORMATION with NB condition', () => {
      const instruction = 'Which paragraph contains the following information? NB You may use any letter more than once.';
      const qText = 'a description of early solar collectors in agricultural applications';
      const detected = determineQuestionType(instruction, qText, 0);
      expect(detected).toBe('matching_information');
    });

    it('detects MATCHING_FEATURES with researcher/scientist list', () => {
      const instruction = 'Look at the following statements and the list of researchers below. Match each statement with the correct researcher, A-D.';
      const qText = 'Identified the theoretical limits of photovoltaic efficiency';
      const detected = determineQuestionType(instruction, qText, 0);
      expect(detected).toBe('matching_features');
    });

    it('detects MATCHING_SENTENCE_ENDINGS', () => {
      const instruction = 'Complete each sentence with the correct ending, A-G, below.';
      const qText = 'Passive solar architecture was widely adopted because';
      const detected = determineQuestionType(instruction, qText, 0);
      expect(detected).toBe('matching_sentence_endings');
    });

    it('detects SUMMARY_COMPLETION_BOX (with wordlist)', () => {
      const instruction = 'Complete the summary using the list of words, A-I, below.';
      const qText = 'The introduction of silicon cells revolutionized solar research by providing increased _____ .';
      const detected = determineQuestionType(instruction, qText, 0);
      expect(detected).toBe('summary_completion_box');
    });

    it('detects TABLE_COMPLETION', () => {
      const instruction = 'Complete the table below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.';
      const qText = 'Timeline of Early Photovoltaic Advancements';
      const detected = determineQuestionType(instruction, qText, 0);
      expect(detected).toBe('table_completion');
    });

    it('detects MULTIPLE_CHOICE_MULTIPLE_ANSWERS (Choose TWO letters)', () => {
      const instruction = 'Questions 14 and 15: Choose TWO letters, A-E.';
      const qText = 'Which TWO of the following factors contributed to the commercial failure of early solar boilers?';
      const detected = determineQuestionType(instruction, qText, 5);
      expect(detected).toBe('multiple_choice_multi');
    });
  });

  describe('Scoring of Multi-Select & Rich IELTS Questions', () => {
    it('evaluates MULTIPLE_CHOICE_MULTIPLE_ANSWERS regardless of letter order', () => {
      expect(isAnswerCorrect('B, D', 'B, D', undefined, 'multiple_choice_multi')).toBe(true);
      expect(isAnswerCorrect('D, B', 'B, D', undefined, 'multiple_choice_multi')).toBe(true);
      expect(isAnswerCorrect('B,D', 'B, D', undefined, 'multiple_choice_multi')).toBe(true);
      expect(isAnswerCorrect('B D', 'B, D', undefined, 'multiple_choice_multi')).toBe(true);
      expect(isAnswerCorrect('A, C', 'B, D', undefined, 'multiple_choice_multi')).toBe(false);
    });

    it('evaluates array of correct answers in parseAcceptableAnswers', () => {
      const answers = parseAcceptableAnswers(['A', 'C']);
      expect(answers).toContain('A, C');
      expect(isAnswerCorrect('C, A', ['A', 'C'], undefined, 'multiple_choice_multi')).toBe(true);
    });

    it('evaluates Table and Gap Filling with normalization', () => {
      expect(isAnswerCorrect('solar energy', 'solar energy', undefined, 'table_completion')).toBe(true);
      expect(isAnswerCorrect('the solar energy', 'solar energy', undefined, 'table_completion')).toBe(true);
      expect(isAnswerCorrect('1400 km', '1,400 kilometres|1400 kilometres|1400 km', undefined, 'table_completion')).toBe(true);
    });
  });

  describe('Table Data Model Integrity', () => {
    it('supports structured table rows and cells with blanks', () => {
      const tableData: TableData = {
        title: 'Industrial Applications',
        headers: ['Process', 'Year', 'Output'],
        rows: [
          {
            cells: [
              { text: 'Smelting', is_blank: false },
              { text: '1890', is_blank: false },
              { text: '', is_blank: true, question_id: 'R14', placeholder: 'Enter product' }
            ]
          }
        ]
      };

      expect(tableData.headers).toHaveLength(3);
      expect(tableData.rows[0].cells[2].is_blank).toBe(true);
      expect(tableData.rows[0].cells[2].question_id).toBe('R14');
    });
  });
});
