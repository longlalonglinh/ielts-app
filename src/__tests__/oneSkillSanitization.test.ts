import { describe, it, expect } from 'vitest';
import { sanitizeExamForSkills } from '../utils/examUtils';
import { ExamData } from '../types';

describe('One Skill Exam Isolation Suite', () => {

  it('correctly isolates a One Skill Reading exam and strips listening questions and audio', () => {
    const rawExam: Partial<ExamData> = {
      exam_code: 'READ_ONLY_TEST',
      title: 'Reading Test Only',
      exam_type: 'one_skill',
      skills: ['reading'],
      duration_mins: 60,
      reading_duration_mins: 60,
      audio_url: 'https://example.com/audio.mp3',
      passages: [
        {
          passage_index: 1,
          title: 'Passage 1',
          text: 'Academic passage text',
          questions: [
            {
              question_id: 'R1_1',
              section: 'reading',
              question_text: 'What is the topic?',
              question_type: 'multiple_choice',
              options: ['A', 'B'],
              correct_answer: 'A',
              max_score: 1
            }
          ]
        }
      ],
      reading_questions: [
        {
          question_id: 'R1_1',
          section: 'reading',
          question_text: 'What is the topic?',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answer: 'A',
          max_score: 1
        }
      ],
      // Unwanted listening questions
      listening_questions: [
        {
          question_id: 'L1',
          section: 'listening',
          question_text: 'Unwanted listening question',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answer: 'A',
          max_score: 1
        }
      ],
      writing_task1_prompt: 'Unwanted writing prompt',
      writing_task2_prompt: 'Unwanted essay prompt'
    };

    const sanitized = sanitizeExamForSkills(rawExam);

    expect(sanitized.exam_type).toBe('one_skill');
    expect(sanitized.skills).toEqual(['reading']);
    // Listening stripped completely
    expect(sanitized.listening_questions).toHaveLength(0);
    expect(sanitized.audio_url).toBe('');
    // Writing prompts stripped
    expect(sanitized.writing_task1_prompt).toBe('');
    expect(sanitized.writing_task2_prompt).toBe('');
    // Reading preserved
    expect(sanitized.reading_questions).toHaveLength(1);
    expect(sanitized.questions).toHaveLength(1);
    expect(sanitized.questions![0].section).toBe('reading');
  });

  it('correctly isolates a One Skill Listening exam and strips reading passages and questions', () => {
    const rawExam: Partial<ExamData> = {
      exam_code: 'LISTEN_ONLY_TEST',
      title: 'Listening Test Only',
      exam_type: 'one_skill',
      skills: ['listening'],
      duration_mins: 35,
      audio_url: 'https://example.com/audio.mp3',
      passages: [
        {
          passage_index: 1,
          title: 'Unwanted Passage',
          text: 'Passage text',
          questions: [
            {
              question_id: 'R1',
              section: 'reading',
              question_text: 'Reading Q',
              question_type: 'multiple_choice',
              options: ['A', 'B'],
              correct_answer: 'A',
              max_score: 1
            }
          ]
        }
      ],
      reading_questions: [
        {
          question_id: 'R1',
          section: 'reading',
          question_text: 'Reading Q',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answer: 'A',
          max_score: 1
        }
      ],
      listening_questions: [
        {
          question_id: 'L1',
          section: 'listening',
          question_text: 'Listening Q',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answer: 'A',
          max_score: 1
        }
      ]
    };

    const sanitized = sanitizeExamForSkills(rawExam);

    expect(sanitized.exam_type).toBe('one_skill');
    expect(sanitized.skills).toEqual(['listening']);
    // Reading stripped completely
    expect(sanitized.reading_questions).toHaveLength(0);
    expect(sanitized.passages).toHaveLength(0);
    expect(sanitized.passage_text).toBe('');
    // Listening preserved
    expect(sanitized.listening_questions).toHaveLength(1);
    expect(sanitized.audio_url).toBe('https://example.com/audio.mp3');
    expect(sanitized.questions).toHaveLength(1);
    expect(sanitized.questions![0].section).toBe('listening');
  });

  it('correctly isolates a One Skill Writing exam and leaves 0 questions in QUESTIONS list', () => {
    const rawExam: Partial<ExamData> = {
      exam_code: 'WRITING_ONLY_TEST',
      title: 'Writing Drill',
      exam_type: 'one_skill',
      skills: ['writing'],
      duration_mins: 60,
      writing_task1_prompt: 'Summarise the chart below.',
      writing_task2_prompt: 'Discuss advantages and disadvantages.',
      reading_questions: [
        {
          question_id: 'R1',
          section: 'reading',
          question_type: 'multiple_choice',
          question_text: 'Reading Q',
          correct_answer: 'A',
          max_score: 1
        }
      ],
      listening_questions: [
        {
          question_id: 'L1',
          section: 'listening',
          question_type: 'multiple_choice',
          question_text: 'Listening Q',
          correct_answer: 'A',
          max_score: 1
        }
      ]
    };

    const sanitized = sanitizeExamForSkills(rawExam);

    expect(sanitized.exam_type).toBe('one_skill');
    expect(sanitized.skills).toEqual(['writing']);
    expect(sanitized.reading_questions).toHaveLength(0);
    expect(sanitized.listening_questions).toHaveLength(0);
    expect(sanitized.questions).toHaveLength(0);
    expect(sanitized.writing_task1_prompt).toBe('Summarise the chart below.');
    expect(sanitized.writing_task2_prompt).toBe('Discuss advantages and disadvantages.');
  });

});
