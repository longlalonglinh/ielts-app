import { ExamData, SkillType, ExamType, Question, ReadingPassageItem } from '../types';

/**
 * Sanitize and enforce skill isolation for ExamData.
 * When creating or saving a one_skill (or custom skill set) exam,
 * only questions, audio, passages, and prompts of the selected skills
 * are preserved. Omitted skills have their questions and assets stripped completely
 * so that Google Sheets, server databases, and IndexedDB never store extraneous questions.
 */
export function sanitizeExamForSkills<T extends Partial<ExamData>>(exam: T): T {
  if (!exam) return exam;

  // Determine effective skills
  let skills: SkillType[] = Array.isArray(exam.skills) ? [...exam.skills] : [];
  
  if (skills.length === 0) {
    if (exam.exam_type === 'one_skill') {
      if (exam.targetSkill) {
        skills = [exam.targetSkill];
      } else if (exam.listening_questions && exam.listening_questions.length > 0 && (!exam.reading_questions || exam.reading_questions.length === 0)) {
        skills = ['listening'];
      } else if (((exam.reading_questions && exam.reading_questions.length > 0) || (exam.passages && exam.passages.length > 0)) && (!exam.listening_questions || exam.listening_questions.length === 0)) {
        skills = ['reading'];
      } else if (exam.writing_task1_prompt || exam.writing_task2_prompt) {
        skills = ['writing'];
      }
    }
  }

  // If no skills are constrained, return unchanged
  if (skills.length === 0) return exam;

  const isOneSkill = exam.exam_type === 'one_skill' || skills.length === 1;
  const examType: ExamType = exam.exam_type || (skills.length === 1 ? 'one_skill' : skills.length === 2 ? 'two_skills' : 'full_test');

  const hasListening = skills.includes('listening');
  const hasReading = skills.includes('reading');
  const hasWriting = skills.includes('writing');

  // Filter listening questions & audio
  const cleanListeningQs = hasListening ? (exam.listening_questions || []) : [];
  const cleanAudioUrl = hasListening ? (exam.audio_url || '') : '';
  const cleanAudioTitle = hasListening ? (exam.audio_title || '') : '';

  // Filter reading questions & passages
  const cleanReadingQs = hasReading ? (exam.reading_questions || []) : [];
  const cleanPassages: ReadingPassageItem[] = hasReading ? (exam.passages || []) : [];
  const cleanPassageTitle = hasReading ? (exam.passage_title || exam.reading_passage_title || '') : '';
  const cleanPassageText = hasReading ? (exam.passage_text || exam.reading_passage || '') : '';

  // Filter writing tasks
  const cleanW1 = hasWriting ? (exam.writing_task1_prompt || '') : '';
  const cleanW1Img = hasWriting ? (exam.writing_task1_image || exam.writing_task1_image_url || exam.writing_task1_imageUrl || '') : '';
  const cleanW2 = hasWriting ? (exam.writing_task2_prompt || '') : '';

  // If exam has unified questions list, ensure it only includes allowed sections
  let cleanQuestions: Question[] = [];
  if (Array.isArray(exam.questions) && exam.questions.length > 0) {
    cleanQuestions = exam.questions.filter(q => {
      const sec = (q.section || 'reading').toLowerCase();
      return skills.includes(sec as SkillType);
    });
  } else {
    cleanQuestions = [...cleanListeningQs, ...cleanReadingQs];
  }

  // Filter sections if present
  let cleanSections = exam.sections;
  if (Array.isArray(cleanSections)) {
    cleanSections = cleanSections.filter(s => skills.includes(s.skill as SkillType));
  }

  return {
    ...exam,
    exam_type: examType,
    skills,
    sections: cleanSections,
    audio_url: cleanAudioUrl,
    audio_title: cleanAudioTitle,
    passage_title: cleanPassageTitle,
    reading_passage_title: cleanPassageTitle,
    passage_text: cleanPassageText,
    reading_passage: cleanPassageText,
    passages: cleanPassages,
    listening_questions: cleanListeningQs,
    reading_questions: cleanReadingQs,
    questions: cleanQuestions,
    writing_task1_prompt: cleanW1,
    writing_task1_image: cleanW1Img,
    writing_task1_image_url: cleanW1Img,
    writing_task1_imageUrl: cleanW1Img,
    writing_task2_prompt: cleanW2
  };
}
