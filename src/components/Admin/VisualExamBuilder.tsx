import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Trash2, 
  Save, 
  BookOpen, 
  Headphones, 
  PenTool, 
  CheckCircle2, 
  Clock, 
  HelpCircle,
  Sliders,
  RotateCcw,
  Sparkles,
  Undo2,
  Redo2,
  AlertTriangle,
  XCircle,
  Check,
  ArrowRight,
  ListCheck,
  Scissors,
  Columns,
  Eye
} from 'lucide-react';
import { ExamData, Question, ReadingPassageItem, QuestionType, IELTSQuestionType, canonicalizeQuestionType, SkillType, ExamType } from '../../types';
import { saveExamToIndexedDB } from '../../services/indexedDb';
import { saveExamToServerDb } from '../../services/api';
import { Task1ImageUploader } from './Task1ImageUploader';
import { QuestionEditorItem } from './QuestionEditorItem';
import { sanitizeExamForSkills } from '../../utils/examUtils';
import { IELTSQuestionCard } from '../Student/IELTSQuestionCard';

// 1. Zod Validation Schema - Highly flexible to allow single-skill exams & partial question sets
export const questionZodSchema = z.object({
  question_id: z.string().optional().default(''),
  section: z.enum(['listening', 'reading']).optional().default('reading'),
  passage_index: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  part: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  question_text: z.string().optional().default(''),
  question_type: z.string().optional().default('multiple_choice'),
  instruction: z.string().optional().default(''),
  word_limit: z.string().optional().default(''),
  options: z.array(z.string()).optional().default([]),
  correct_answer: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  max_score: z.number().optional().default(1),
  table_data: z.any().optional(),
  flowchart_steps: z.any().optional(),
  word_bank: z.any().optional(),
  matching_options: z.any().optional(),
  nb_condition: z.union([z.boolean(), z.string()]).optional(),
  multi_select_count: z.number().optional().default(2)
});

export const passageZodSchema = z.object({
  passage_index: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().optional().default('Reading Passage'),
  text: z.string().optional().default(''),
  questions: z.array(questionZodSchema).optional().default([])
});

export const examZodSchema = z.object({
  exam_code: z.string().min(1, 'Please enter exam code (e.g. READ01, TEST01)').max(30),
  title: z.string().min(2, 'Test title must have at least 2 characters'),
  test_type: z.enum(['TEST', 'PRACTICE']),
  exam_type: z.enum(['one_skill', 'two_skills', 'full_test']).optional().default('full_test'),
  skills: z.array(z.enum(['listening', 'reading', 'writing'])).optional().default(['listening', 'reading', 'writing']),
  duration_mins: z.number().min(1, 'Minimum duration is 1 minute').max(360),
  listening_duration_mins: z.number().min(0).max(120).optional().default(35),
  reading_duration_mins: z.number().min(0).max(120).optional().default(60),
  writing_duration_mins: z.number().min(0).max(120).optional().default(60),
  audio_url: z.string().optional().default(''),
  audio_title: z.string().optional().default(''),
  passages: z.array(passageZodSchema).optional().default([]),
  listening_questions: z.array(questionZodSchema).optional().default([]),
  writing_task1_prompt: z.string().optional().default(''),
  writing_task1_image: z.string().optional().default(''),
  writing_task2_prompt: z.string().optional().default('')
});

export type ExamFormValues = z.infer<typeof examZodSchema>;

interface VisualExamBuilderProps {
  initialExamData: ExamData;
  onSaveExam: (exam: ExamData) => void;
  isSaving?: boolean;
}

export const VisualExamBuilder: React.FC<VisualExamBuilderProps> = ({
  initialExamData,
  onSaveExam,
  isSaving = false
}) => {
  const [activeSection, setActiveSection] = useState<'reading' | 'listening' | 'writing' | 'settings'>('reading');
  const [selectedPassageIdx, setSelectedPassageIdx] = useState<0 | 1 | 2>(0);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [splitScreenPreview, setSplitScreenPreview] = useState(false);
  const [tokenizerToast, setTokenizerToast] = useState<string | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const passageTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Helper to format initial passages with embedded questions
  const formatInitialData = (data: ExamData): ExamFormValues => {
    const rawPassages = data.passages || [];
    const allReadingQs = data.reading_questions || (data.questions || []).filter(q => q.section === 'reading');
    const allListeningQs = data.listening_questions || (data.questions || []).filter(q => q.section === 'listening');

    const formattedPassages = [1, 2, 3].map((pNum, idx) => {
      const existingP = rawPassages.find(p => p.passage_index === pNum) || rawPassages[idx];
      const pQs = (existingP?.questions && existingP.questions.length > 0) 
        ? existingP.questions 
        : allReadingQs.filter(q => q.passage_index === pNum || (!q.passage_index && idx === 0));

      return {
        passage_index: pNum as 1 | 2 | 3,
        title: existingP?.title || `Reading Passage ${pNum}`,
        text: existingP?.text || (pNum === 1 ? (data.passage_text || '') : ''),
        questions: pQs.map(q => ({
          question_id: q.question_id,
          section: 'reading' as const,
          passage_index: pNum as 1 | 2 | 3,
          question_text: q.question_text || '',
          question_type: q.question_type || 'multiple_choice',
          options: q.options || [],
          correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer.join('|') : (q.correct_answer || ''),
          explanation: q.explanation || '',
          max_score: q.max_score || 1,
          instruction: q.instruction || '',
          word_limit: q.word_limit || '',
          table_data: q.table_data,
          flowchart_steps: q.flowchart_steps,
          word_bank: q.word_bank,
          matching_options: q.matching_options,
          nb_condition: q.nb_condition,
          multi_select_count: q.multi_select_count || 2
        }))
      };
    });

    const writingSection = data.sections?.find(s => s.skill === 'writing');
    const task1Obj = writingSection?.tasks?.find(t => t.task_number === 1) || writingSection?.tasks?.[0];
    const task2Obj = writingSection?.tasks?.find(t => t.task_number === 2) || writingSection?.tasks?.[1];

    const initialTask1Prompt = data.writing_task1_prompt || task1Obj?.prompt || '';
    const initialTask1Image = data.writing_task1_image || 
      data.writing_task1_image_url || 
      data.writing_task1_imageUrl || 
      task1Obj?.image_url || 
      task1Obj?.imageUrl || 
      (task1Obj as any)?.image || 
      data.image_url || 
      (data as any).imageUrl || 
      '';
    const initialTask2Prompt = data.writing_task2_prompt || task2Obj?.prompt || '';

    const hasL = allListeningQs.length > 0;
    const hasR = allReadingQs.length > 0;
    const hasW = Boolean(initialTask1Prompt || initialTask2Prompt || initialTask1Image);
    let detectedSkills: SkillType[] = data.skills || [];
    if (detectedSkills.length === 0) {
      if (hasL) detectedSkills.push('listening');
      if (hasR) detectedSkills.push('reading');
      if (hasW) detectedSkills.push('writing');
      if (detectedSkills.length === 0) detectedSkills = ['listening', 'reading', 'writing'];
    }
    const detectedExamType: ExamType = data.exam_type || (
      detectedSkills.length === 1 ? 'one_skill' : detectedSkills.length === 2 ? 'two_skills' : 'full_test'
    );

    const isOneSkill = detectedExamType === 'one_skill' || detectedSkills.length === 1;
    const allowListening = !isOneSkill || detectedSkills.includes('listening');
    const allowReading = !isOneSkill || detectedSkills.includes('reading');
    const allowWriting = !isOneSkill || detectedSkills.includes('writing');

    const filteredPassages = allowReading ? formattedPassages : [];
    const filteredListeningQs = allowListening ? allListeningQs : [];

    return {
      exam_code: data.exam_code || 'TEST01',
      title: data.title || 'IELTS Mock Test',
      test_type: data.test_type || 'TEST',
      exam_type: detectedExamType,
      skills: detectedSkills,
      duration_mins: data.duration_mins || 150,
      listening_duration_mins: data.listening_duration_mins || 35,
      reading_duration_mins: data.reading_duration_mins || 60,
      writing_duration_mins: data.writing_duration_mins || 60,
      audio_url: allowListening ? (data.audio_url || '') : '',
      audio_title: allowListening ? (data.audio_title || '') : '',
      passages: filteredPassages,
      listening_questions: filteredListeningQs.map(q => ({
        question_id: q.question_id,
        section: 'listening' as const,
        part: q.part || 1,
        question_text: q.question_text || '',
        question_type: q.question_type || 'fill_in_the_blank',
        options: q.options || [],
        correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer.join('|') : (q.correct_answer || ''),
        explanation: q.explanation || '',
        max_score: q.max_score || 1,
        instruction: q.instruction || '',
        word_limit: q.word_limit || '',
        table_data: q.table_data,
        flowchart_steps: q.flowchart_steps,
        word_bank: q.word_bank,
        matching_options: q.matching_options,
        nb_condition: q.nb_condition,
        multi_select_count: q.multi_select_count || 2
      })),
      writing_task1_prompt: allowWriting ? initialTask1Prompt : '',
      writing_task1_image: allowWriting ? initialTask1Image : '',
      writing_task2_prompt: allowWriting ? initialTask2Prompt : ''
    };
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examZodSchema) as any,
    defaultValues: formatInitialData(initialExamData),
    mode: 'onChange'
  });

  // Manage dynamic questions inside current selected passage
  const currentPassageQuestionsArray = useFieldArray({
    control,
    name: `passages.${selectedPassageIdx}.questions`
  });

  // Manage listening questions
  const listeningQuestionsArray = useFieldArray({
    control,
    name: 'listening_questions'
  });

  const watchedPassages = watch('passages');
  const watchedExamCode = watch('exam_code');
  const watchedTask1Image = watch('writing_task1_image');

  // History stack for Undo / Redo (Heuristic #3: User Control & Freedom)
  const [history, setHistory] = useState<ExamFormValues[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUndoRedo = useRef(false);

  // Take snapshot when important form states change
  useEffect(() => {
    if (isInternalUndoRedo.current) return;
    const currentValues = watch();
    const timer = setTimeout(() => {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        next.push(JSON.parse(JSON.stringify(currentValues)));
        if (next.length > 30) next.shift();
        return next;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 29));
    }, 400);

    return () => clearTimeout(timer);
  }, [
    watchedPassages,
    watchedExamCode,
    watchedTask1Image,
    watch('audio_url'),
    watch('skills'),
    watch('writing_task1_prompt'),
    watch('writing_task2_prompt'),
    watch('listening_questions')
  ]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isInternalUndoRedo.current = true;
      const target = history[historyIndex - 1];
      reset(target);
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => { isInternalUndoRedo.current = false; }, 150);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isInternalUndoRedo.current = true;
      const target = history[historyIndex + 1];
      reset(target);
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => { isInternalUndoRedo.current = false; }, 150);
    }
  };

  // Keyboard shortcut Ctrl+Z / Cmd+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Real-time Pre-Publish Readiness Checklist Audit
  const watchedValues = watch();
  const targetSkills = watchedValues.skills || ['listening', 'reading', 'writing'];
  const hasListeningSkill = targetSkills.includes('listening');
  const hasReadingSkill = targetSkills.includes('reading');
  const hasWritingSkill = targetSkills.includes('writing');

  const audioUrl = watchedValues.audio_url?.trim();
  const audioCheck = !hasListeningSkill ? 'na' : Boolean(audioUrl) ? 'pass' : 'fail';

  const allReadingQs = (watchedValues.passages || []).flatMap(p => p.questions || []);
  const allListeningQs = watchedValues.listening_questions || [];
  const allQs = [...(hasReadingSkill ? allReadingQs : []), ...(hasListeningSkill ? allListeningQs : [])];
  const totalQuestionsCount = allQs.length;
  const missingAnswerKeyQs = allQs.filter(q => !q.correct_answer || !q.correct_answer.trim());
  const answerKeyCheck = totalQuestionsCount === 0 
    ? 'warn' 
    : missingAnswerKeyQs.length === 0 
    ? 'pass' 
    : 'fail';

  const t1Prompt = watchedValues.writing_task1_prompt?.trim();
  const t1Img = watchedValues.writing_task1_image?.trim();
  const t2Prompt = watchedValues.writing_task2_prompt?.trim();
  const writingCheck = !hasWritingSkill 
    ? 'na' 
    : (Boolean(t1Prompt || t1Img) && Boolean(t2Prompt))
    ? 'pass'
    : (Boolean(t1Prompt || t1Img) || Boolean(t2Prompt))
    ? 'warn'
    : 'fail';

  const totalDuration = watchedValues.duration_mins || 0;
  const durationCheck = totalDuration > 0 ? 'pass' : 'fail';

  const auditItems = [
    {
      id: 'audio',
      title: 'Listening Audio File',
      status: audioCheck,
      desc: audioCheck === 'pass' ? 'Audio file URL configured' : audioCheck === 'fail' ? 'Audio URL is missing' : 'Not required (Listening omitted)',
      tab: 'listening' as const
    },
    {
      id: 'answers',
      title: 'Question Answer Keys',
      status: answerKeyCheck,
      desc: answerKeyCheck === 'pass' ? `All ${totalQuestionsCount} questions have valid answer keys` : answerKeyCheck === 'fail' ? `${missingAnswerKeyQs.length} question(s) missing correct answer key` : 'No questions created yet',
      tab: (allReadingQs.length > 0 ? 'reading' : 'listening') as any
    },
    {
      id: 'writing',
      title: 'Writing Prompts',
      status: writingCheck,
      desc: writingCheck === 'pass' ? 'Task 1 and Task 2 prompts provided' : writingCheck === 'warn' ? 'Only 1 of 2 writing tasks has a prompt' : writingCheck === 'fail' ? 'Writing prompts are empty' : 'Not required (Writing omitted)',
      tab: 'writing' as const
    },
    {
      id: 'timing',
      title: 'Exam Timer & Duration',
      status: durationCheck,
      desc: durationCheck === 'pass' ? `${totalDuration} mins set` : 'Duration must be > 0 mins',
      tab: 'settings' as const
    }
  ];

  const activeAudits = auditItems.filter(i => i.status !== 'na');
  const passingAudits = activeAudits.filter(i => i.status === 'pass').length;
  const readinessPercent = activeAudits.length > 0 ? Math.round((passingAudits / activeAudits.length) * 100) : 100;

  const onValidSubmit = async (formData: ExamFormValues) => {
    // Sanitize reading questions and passages (allow empty or partial passages)
    const flatReadingQuestions: Question[] = [];
    const rawPassages = formData.passages || [];

    const standardizedPassages: ReadingPassageItem[] = rawPassages.map((p, pIdx) => {
      const pNumber = ((p.passage_index || pIdx + 1) as 1 | 2 | 3);
      const validQs = (p.questions || [])
        .filter(q => q && (q.question_text?.trim() || q.correct_answer?.trim()))
        .map((q, qIdx) => ({
          ...q,
          question_id: q.question_id?.trim() || `R${pNumber}_Q${qIdx + 1}`,
          section: 'reading' as const,
          passage_index: pNumber,
          question_type: (q.question_type || 'multiple_choice') as QuestionType,
          correct_answer: q.correct_answer?.trim() || '',
          max_score: q.max_score || 1
        }));

      validQs.forEach(q => flatReadingQuestions.push(q));

      return {
        passage_index: pNumber,
        title: p.title?.trim() || `Reading Passage ${pNumber}`,
        text: p.text || '',
        questions: validQs
      };
    });

    // Sanitize listening questions
    const flatListeningQuestions: Question[] = (formData.listening_questions || [])
      .filter(q => q && (q.question_text?.trim() || q.correct_answer?.trim()))
      .map((q, qIdx) => ({
        ...q,
        question_id: q.question_id?.trim() || `L_Q${qIdx + 1}`,
        section: 'listening' as const,
        question_type: (q.question_type || 'multiple_choice') as QuestionType,
        correct_answer: q.correct_answer?.trim() || '',
        max_score: q.max_score || 1
      }));

    const hasReading = flatReadingQuestions.length > 0 || standardizedPassages.some(p => p.text?.trim().length > 0);
    const hasListening = flatListeningQuestions.length > 0 || Boolean(formData.audio_url?.trim());
    const hasWriting = Boolean(formData.writing_task1_prompt?.trim() || formData.writing_task2_prompt?.trim() || formData.writing_task1_image?.trim());

    if (!hasReading && !hasListening && !hasWriting) {
      alert('Please add content for at least one skill (Reading, Listening, or Writing) to save this exam!');
      return;
    }

    const detectedSkills: SkillType[] = [];
    if (hasListening) detectedSkills.push('listening');
    if (hasReading) detectedSkills.push('reading');
    if (hasWriting) detectedSkills.push('writing');

    // Determine target skills with strict adherence to form selection and one_skill discipline
    let targetSkills: SkillType[] = formData.skills && formData.skills.length > 0 ? [...formData.skills] : [];
    if (targetSkills.length === 0) {
      if (hasReading && !hasListening && !hasWriting) targetSkills = ['reading'];
      else if (hasListening && !hasReading && !hasWriting) targetSkills = ['listening'];
      else if (hasWriting && !hasReading && !hasListening) targetSkills = ['writing'];
      else targetSkills = detectedSkills;
    }

    const isOneSkillExam = formData.exam_type === 'one_skill' || targetSkills.length === 1;
    const finalExamType: ExamType = formData.exam_type || (targetSkills.length === 1 ? 'one_skill' : targetSkills.length === 2 ? 'two_skills' : 'full_test');

    const allowListening = !isOneSkillExam || targetSkills.includes('listening');
    const allowReading = !isOneSkillExam || targetSkills.includes('reading');
    const allowWriting = !isOneSkillExam || targetSkills.includes('writing');

    const rawTask1Img = formData.writing_task1_image?.trim() || '';
    const finalListeningQuestions = allowListening ? flatListeningQuestions : [];
    const finalReadingQuestions = allowReading ? flatReadingQuestions : [];
    const finalPassages = allowReading ? standardizedPassages : [];
    const finalAudioUrl = allowListening ? (formData.audio_url?.trim() || '') : '';
    const finalAudioTitle = allowListening ? (formData.audio_title?.trim() || '') : '';
    const finalTask1Prompt = allowWriting ? (formData.writing_task1_prompt?.trim() || '') : '';
    const finalTask1Img = allowWriting ? rawTask1Img : '';
    const finalTask2Prompt = allowWriting ? (formData.writing_task2_prompt?.trim() || '') : '';

    // Standardize sections array for dynamic modular multi-skill engine
    const sections: any[] = [];
    if (allowListening && (finalListeningQuestions.length > 0 || finalAudioUrl)) {
      sections.push({
        skill: 'listening',
        title: 'IELTS Listening Section',
        durationMinutes: formData.listening_duration_mins || 35,
        audioUrl: finalAudioUrl,
        questions: finalListeningQuestions
      });
    }
    if (allowReading && (finalReadingQuestions.length > 0 || finalPassages.some(p => p.text?.trim().length > 0))) {
      sections.push({
        skill: 'reading',
        title: 'IELTS Reading Section',
        durationMinutes: formData.reading_duration_mins || 60,
        passages: finalPassages,
        questions: finalReadingQuestions
      });
    }
    if (allowWriting && (finalTask1Prompt || finalTask2Prompt || finalTask1Img)) {
      sections.push({
        skill: 'writing',
        title: 'IELTS Writing Section',
        durationMinutes: formData.writing_duration_mins || 60,
        tasks: [
          {
            id: 'task-1',
            task_number: 1,
            title: 'Writing Task 1 (Report)',
            prompt: finalTask1Prompt,
            image_url: finalTask1Img,
            imageUrl: finalTask1Img,
            min_words: 150,
            suggested_time_minutes: 20
          },
          {
            id: 'task-2',
            task_number: 2,
            title: 'Writing Task 2 (Essay)',
            prompt: finalTask2Prompt,
            min_words: 250,
            suggested_time_minutes: 40
          }
        ]
      });
    }

    const unverifiedExam: ExamData = {
      exam_code: formData.exam_code.trim().toUpperCase(),
      title: formData.title,
      test_type: formData.test_type,
      exam_type: finalExamType,
      skills: targetSkills,
      sections,
      duration_mins: formData.duration_mins,
      listening_duration_mins: formData.listening_duration_mins,
      reading_duration_mins: formData.reading_duration_mins,
      writing_duration_mins: formData.writing_duration_mins,
      audio_url: finalAudioUrl,
      audio_title: finalAudioTitle,
      passages: finalPassages,
      reading_questions: finalReadingQuestions,
      listening_questions: finalListeningQuestions,
      questions: [...finalListeningQuestions, ...finalReadingQuestions],
      writing_task1_prompt: finalTask1Prompt,
      writing_task1_image: finalTask1Img,
      writing_task1_image_url: finalTask1Img,
      writing_task1_imageUrl: finalTask1Img,
      writing_task2_prompt: finalTask2Prompt,
      created_at: new Date().toISOString()
    };

    const completeExam = sanitizeExamForSkills(unverifiedExam);

    // 1. Dual save to IndexedDB
    await saveExamToIndexedDB(completeExam);

    // 2. Save directly to Central Server DB so all other devices can fetch it immediately
    try {
      await saveExamToServerDb(completeExam);
    } catch (serverErr) {
      console.warn('Could not auto-save to server DB:', serverErr);
    }

    // 3. Dual save to localStorage safely
    try {
      const existingRaw = localStorage.getItem('ielts_saved_exams');
      let existingList: ExamData[] = existingRaw ? JSON.parse(existingRaw) : [];
      if (!Array.isArray(existingList)) existingList = [];
      const idx = existingList.findIndex(e => e.exam_code === completeExam.exam_code);
      if (idx >= 0) {
        existingList[idx] = completeExam;
      } else {
        existingList.push(completeExam);
      }
      localStorage.setItem('ielts_saved_exams', JSON.stringify(existingList));
      localStorage.setItem('ielts_current_exam', JSON.stringify(completeExam));
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }

    // 3. Callback to parent
    onSaveExam(completeExam);

    const skillsLabel = completeExam.skills?.join(' + ') || 'IELTS Test';
    setSaveSuccessMessage(`Successfully saved exam ${completeExam.exam_code} [${skillsLabel}]!`);
    setTimeout(() => setSaveSuccessMessage(null), 4500);
  };

  // WYSIWYG Tokenizer ("Bôi đen tạo câu hỏi"): Highlight text -> click "Tạo ô trống" -> inserts [blank_X] and appends question
  const handleTokenizeSelection = () => {
    const textarea = passageTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end).trim();

    if (!selected) {
      setTokenizerToast('⚠️ Vui lòng bôi đen từ hoặc cụm từ trong khung văn bản bài đọc trước khi bấm "Tạo ô trống" (ví dụ: bôi đen từ "pesticides").');
      setTimeout(() => setTokenizerToast(null), 4000);
      return;
    }

    // Determine the next question number across all passages
    const allPassageQs = (watchedPassages || []).flatMap(p => p?.questions || []);
    const nextQNum = allPassageQs.length + 1;
    const token = `[blank_${nextQNum}]`;

    // Replace selected range in textarea
    const fullText = textarea.value;
    const newText = fullText.substring(0, start) + token + fullText.substring(end);
    setValue(`passages.${selectedPassageIdx}.text`, newText, { shouldDirty: true });

    // Auto-create matching fill_in_the_blank question item
    const pNumber = (selectedPassageIdx + 1) as 1 | 2 | 3;
    const wordCount = selected.split(/\s+/).length;
    const limitDesc = wordCount <= 1 ? 'NO MORE THAN ONE WORD' : wordCount <= 2 ? 'NO MORE THAN TWO WORDS' : 'NO MORE THAN THREE WORDS';

    currentPassageQuestionsArray.append({
      question_id: `R${nextQNum}`,
      section: 'reading',
      passage_index: pNumber,
      question_text: `Complete the sentence with ${limitDesc} from the passage: ${token}`,
      question_type: IELTSQuestionType.FILL_IN_THE_BLANK,
      options: [],
      correct_answer: selected,
      max_score: 1,
      instruction: `Write ${limitDesc} from the passage for each answer.`,
      word_limit: limitDesc,
      explanation: `Extracted verbatim from passage text: "${selected}"`,
      table_data: undefined,
      flowchart_steps: undefined,
      word_bank: undefined,
      matching_options: undefined,
      nb_condition: false,
      multi_select_count: 2
    });

    setTokenizerToast(`✅ Đã bôi đen "${selected}": Tự động thay bằng ${token} và tạo câu hỏi R${nextQNum} có đáp án "${selected}"!`);
    setTimeout(() => setTokenizerToast(null), 4500);
  };

  const handleAddQuestionToPassage = () => {
    const pNumber = (selectedPassageIdx + 1) as 1 | 2 | 3;
    const currentList = watchedPassages[selectedPassageIdx]?.questions || [];
    const nextQNum = currentList.length + 1;

    currentPassageQuestionsArray.append({
      question_id: `R${pNumber}_${nextQNum}_${Date.now().toString().slice(-4)}`,
      section: 'reading',
      passage_index: pNumber,
      question_text: `${nextQNum}. Enter question prompt or sentence`,
      question_type: IELTSQuestionType.MULTIPLE_CHOICE,
      options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
      correct_answer: 'A',
      max_score: 1,
      explanation: '',
      instruction: '',
      word_limit: '',
      table_data: undefined,
      flowchart_steps: undefined,
      word_bank: undefined,
      matching_options: undefined,
      nb_condition: false,
      multi_select_count: 2
    });
  };

  const handleAddListeningQuestion = () => {
    const nextQNum = (listeningQuestionsArray.fields.length || 0) + 1;
    listeningQuestionsArray.append({
      question_id: `L_${nextQNum}_${Date.now().toString().slice(-4)}`,
      section: 'listening',
      part: 1,
      question_text: `${nextQNum}. Enter listening question prompt`,
      question_type: IELTSQuestionType.FILL_IN_THE_BLANK,
      options: [],
      correct_answer: 'ANSWER',
      max_score: 1,
      explanation: '',
      instruction: '',
      word_limit: '',
      table_data: undefined,
      flowchart_steps: undefined,
      word_bank: undefined,
      matching_options: undefined,
      nb_condition: false,
      multi_select_count: 2
    });
  };

  const createBlankExamData = (examCode = 'NEW_EXAM'): ExamFormValues => ({
    exam_code: examCode,
    title: 'New IELTS Test',
    test_type: 'TEST',
    exam_type: 'full_test',
    skills: ['listening', 'reading', 'writing'],
    duration_mins: 150,
    listening_duration_mins: 35,
    reading_duration_mins: 60,
    writing_duration_mins: 60,
    audio_url: '',
    audio_title: '',
    passages: [
      {
        passage_index: 1,
        title: 'Reading Passage 1',
        text: '',
        questions: []
      },
      {
        passage_index: 2,
        title: 'Reading Passage 2',
        text: '',
        questions: []
      },
      {
        passage_index: 3,
        title: 'Reading Passage 3',
        text: '',
        questions: []
      }
    ],
    listening_questions: [],
    writing_task1_prompt: '',
    writing_task1_image: '',
    writing_task2_prompt: ''
  });

  const [showResetModal, setShowResetModal] = useState(false);

  const executeResetToBlankSheet = () => {
    const currentCode = watchedExamCode || 'NEW_EXAM';
    reset(createBlankExamData(currentCode));
    setSelectedPassageIdx(0);
    setShowResetModal(false);
    setSaveSuccessMessage('✅ Cleared all questions and content! Reset to Blank Sheet.');
    setTimeout(() => setSaveSuccessMessage(null), 5000);
  };

  return (
    <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-6 relative">
      
      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-purple-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-purple-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <RotateCcw className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#3C2A63]">Confirm Reset to Blank Sheet</h3>
                <p className="text-xs text-[#7C68A5]">This action will clear all questions</p>
              </div>
            </div>

            <p className="text-xs text-[#503A7A] leading-relaxed bg-[#F8F6FC] p-3.5 rounded-2xl border border-purple-100">
              All reading passages, Reading/Listening question lists, and Writing Task 1 &amp; 2 content will be completely cleared to start fresh from a blank sheet.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#3C2A63] text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetToBlankSheet}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All &amp; Reset to Blank Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER CONTROLS */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-purple-100 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#6B51A5] text-white">
              Visual Exam Builder
            </span>
            <span className="text-xs font-bold text-[#7C68A5]">
              Validated with Zod &amp; React Hook Form
            </span>
          </div>
          <h2 className="text-xl font-black text-[#3C2A63] mt-2">
            Exam Configuration: {watchedExamCode || 'NEW_EXAM'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Undo / Redo controls */}
          <div className="flex items-center bg-[#F5F2F9] border border-purple-200 rounded-2xl p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="px-3 py-1.5 text-xs font-bold text-[#503A7A] hover:bg-[#E2DDEC] disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="Undo last change (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5 text-[#6B51A5]" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <div className="w-px h-4 bg-purple-200" />
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="px-3 py-1.5 text-xs font-bold text-[#503A7A] hover:bg-[#E2DDEC] disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="Redo change (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5 text-[#6B51A5]" />
              <span className="hidden sm:inline">Redo</span>
            </button>
          </div>

          {/* Split-Screen Preview Toggle (User Request 2) */}
          <button
            type="button"
            onClick={() => setSplitScreenPreview(!splitScreenPreview)}
            title="Bật/Tắt chế độ chia đôi màn hình xem trước giao diện học sinh trong thời gian thực"
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
              splitScreenPreview
                ? 'bg-[#503A7A] text-white border-[#3C2A63] shadow-md'
                : 'bg-[#F8F6FC] hover:bg-[#E2DDEC] text-[#3C2A63] border-purple-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{splitScreenPreview ? 'Exit Split Screen' : 'Split-Screen Preview'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            title="Clear all questions, reset to blank sheet"
            className="px-3.5 py-2 bg-[#F5F2F9] hover:bg-[#E2DDEC] text-[#3C2A63] rounded-2xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border border-purple-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset (Blank)</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-950/10 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Validate & Save Exam'}</span>
          </button>
        </div>
      </div>

      {/* PRE-PUBLISH READINESS CHECKLIST (Thanh tiến độ kiểm tra hợp lệ) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-purple-100 shadow-md shadow-purple-950/5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-[#6B51A5] rounded-xl">
              <ListCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#3C2A63] uppercase tracking-wider">
                Pre-Publish Readiness Checklist
              </h3>
              <p className="text-[11px] text-[#7C68A5]">
                System verification before publishing exam to students
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#503A7A]">
              Readiness: {readinessPercent}%
            </span>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              readinessPercent === 100
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {readinessPercent === 100 ? 'Ready to Publish' : 'Needs Review'}
            </span>
          </div>
        </div>

        {/* Readiness Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${
              readinessPercent === 100 ? 'bg-emerald-500' : readinessPercent >= 75 ? 'bg-[#6B51A5]' : 'bg-amber-500'
            }`}
            style={{ width: `${readinessPercent}%` }}
          />
        </div>

        {/* 4 Interactive Audit Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {auditItems.map((item) => {
            const isPass = item.status === 'pass';
            const isWarn = item.status === 'warn';
            const isFail = item.status === 'fail';
            const isNa = item.status === 'na';

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.tab) setActiveSection(item.tab);
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                  isPass
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 hover:bg-emerald-100/70'
                    : isWarn
                    ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100/80'
                    : isFail
                    ? 'bg-rose-50/80 border-rose-300 text-rose-950 hover:bg-rose-100/80'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
                title="Click to jump directly to this section"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-black">{item.title}</span>
                  {isPass && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  {isWarn && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                  {isFail && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                  {isNa && <span className="text-[9px] font-bold text-slate-400">N/A</span>}
                </div>
                <p className="text-[10px] leading-tight opacity-90">
                  {item.desc}
                </p>
                <span className="text-[9px] font-extrabold text-[#6B51A5] flex items-center gap-0.5 pt-0.5">
                  <span>Go to section</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* QUICK SKILL PRESETS & FLEXIBILITY GUIDANCE */}
      <div className="bg-gradient-to-r from-purple-50/90 to-indigo-50/70 border border-purple-200/80 rounded-2xl p-3.5 space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#6B51A5] text-white rounded-xl">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-black text-[#3C2A63]">
              Flexible Exam Creation: Full test or individual skills
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black text-purple-700 uppercase mr-1">One Skill:</span>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'one_skill');
                setValue('skills', ['reading']);
                setValue('duration_mins', 60);
                setValue('reading_duration_mins', 60);
                setValue('listening_questions', []);
                setValue('audio_url', '');
                setValue('audio_title', '');
                setValue('writing_task1_prompt', '');
                setValue('writing_task1_image', '');
                setValue('writing_task2_prompt', '');
                setActiveSection('reading');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-white text-[#503A7A] hover:bg-purple-100 rounded-lg border border-purple-200 transition cursor-pointer shadow-2xs"
            >
              📖 Reading (60m)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'one_skill');
                setValue('skills', ['listening']);
                setValue('duration_mins', 35);
                setValue('listening_duration_mins', 35);
                setValue('passages', []);
                setValue('writing_task1_prompt', '');
                setValue('writing_task1_image', '');
                setValue('writing_task2_prompt', '');
                setActiveSection('listening');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-white text-[#503A7A] hover:bg-purple-100 rounded-lg border border-purple-200 transition cursor-pointer shadow-2xs"
            >
              🎧 Listening (35m)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'one_skill');
                setValue('skills', ['writing']);
                setValue('duration_mins', 60);
                setValue('writing_duration_mins', 60);
                setValue('passages', []);
                setValue('listening_questions', []);
                setValue('audio_url', '');
                setValue('audio_title', '');
                setActiveSection('writing');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-white text-[#503A7A] hover:bg-purple-100 rounded-lg border border-purple-200 transition cursor-pointer shadow-2xs"
            >
              ✍️ Writing (60m)
            </button>

            <span className="text-[10px] font-black text-indigo-700 uppercase ml-2 mr-1">Two Skills:</span>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'two_skills');
                setValue('skills', ['listening', 'reading']);
                setValue('duration_mins', 95);
                setValue('writing_task1_prompt', '');
                setValue('writing_task1_image', '');
                setValue('writing_task2_prompt', '');
                setActiveSection('listening');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-900 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs"
            >
              🎧+📖 Nghe &amp; Đọc (95m)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'two_skills');
                setValue('skills', ['reading', 'writing']);
                setValue('duration_mins', 120);
                setValue('listening_questions', []);
                setValue('audio_url', '');
                setValue('audio_title', '');
                setActiveSection('reading');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-900 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs"
            >
              📖+✍️ Đọc &amp; Viết (120m)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'two_skills');
                setValue('skills', ['listening', 'writing']);
                setValue('duration_mins', 95);
                setValue('passages', []);
                setActiveSection('listening');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-900 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs"
            >
              🎧+✍️ Nghe &amp; Viết (95m)
            </button>

            <span className="text-[10px] font-black text-purple-900 uppercase ml-2 mr-1">Full:</span>
            <button
              type="button"
              onClick={() => {
                setValue('exam_type', 'full_test');
                setValue('skills', ['listening', 'reading', 'writing']);
                setValue('duration_mins', 155);
                setActiveSection('reading');
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-purple-100 text-[#3C2A63] hover:bg-purple-200 rounded-lg border border-purple-300 transition cursor-pointer shadow-2xs"
            >
              ✨ Full 3 Kỹ Năng (155m)
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#6E5B8E] font-medium leading-relaxed">
          💡 Hệ thống hỗ trợ bài thi linh hoạt: <strong>One Skill</strong> (chỉ Nghe, Đọc hoặc Viết), <strong>Two Skills</strong> (combo 2 kỹ năng chuyển tiếp có 60s nghỉ), hoặc <strong>Full Test</strong> (cả 3 kỹ năng chuẩn).
        </p>
      </div>

      {/* TOP-LEVEL TABS */}
      <div className="flex items-center gap-2 border-b border-purple-100 pb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSection('reading')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeSection === 'reading'
              ? 'bg-[#6B51A5] text-white shadow-md'
              : 'bg-white text-[#503A7A] hover:bg-purple-50 border border-purple-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Reading Module (3 Passages &amp; Questions)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/10">
            {(watchedPassages || []).reduce((acc, p) => acc + (p?.questions?.length || 0), 0)} Qs
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('listening')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeSection === 'listening'
              ? 'bg-[#6B51A5] text-white shadow-md'
              : 'bg-white text-[#503A7A] hover:bg-purple-50 border border-purple-100'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>Listening Module</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/10">
            {listeningQuestionsArray.fields.length} Qs
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('writing')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeSection === 'writing'
              ? 'bg-[#6B51A5] text-white shadow-md'
              : 'bg-white text-[#503A7A] hover:bg-purple-50 border border-purple-100'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Writing Tasks 1 &amp; 2</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeSection === 'settings'
              ? 'bg-[#6B51A5] text-white shadow-md'
              : 'bg-white text-[#503A7A] hover:bg-purple-50 border border-purple-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Exam Timing &amp; Metadata</span>
        </button>
      </div>

      {/* SECTION 1: READING MODULE (Passages + Nested Questions) */}
      {activeSection === 'reading' && (
        <div className={splitScreenPreview ? "grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" : "space-y-6"}>
          
          {/* Left Column: Visual Builder */}
          <div className="space-y-6">
            {/* Passage 1, 2, 3 Selector */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((idx) => {
              const pNum = idx + 1;
              const pCount = watchedPassages[idx]?.questions?.length || 0;
              const isSel = selectedPassageIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedPassageIdx(idx as 0 | 1 | 2)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                    isSel
                      ? 'bg-[#3C2A63] text-white shadow-md'
                      : 'bg-[#F5F2F9] text-[#503A7A] hover:bg-[#E2DDEC] border border-purple-100'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Passage {pNum}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20">
                    {pCount} questions
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Passage Details */}
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#6B51A5]" />
                <span>Passage {selectedPassageIdx + 1} Content</span>
              </h3>
              <span className="text-xs text-[#7C68A5] font-semibold">
                Passage Index: {selectedPassageIdx + 1}
              </span>
            </div>

            {/* Passage Title */}
            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Passage Title:
              </label>
              <input
                type="text"
                {...register(`passages.${selectedPassageIdx}.title`)}
                placeholder="e.g. Passage 1: The History and Evolution of Renewable Energy Technologies"
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
              />
              {errors.passages?.[selectedPassageIdx]?.title && (
                <p className="text-xs text-rose-600 mt-1 font-bold">
                  {errors.passages[selectedPassageIdx]?.title?.message}
                </p>
              )}
            </div>

            {/* Passage Text with WYSIWYG Tokenizer */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-black text-[#3C2A63]">
                  Passage Text (Academic Reading Article):
                </label>

                {/* WYSIWYG TOKENIZER TOOLBAR */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTokenizeSelection}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                    title="Bôi đen một từ/cụm từ trong khung dưới đây rồi bấm nút này để tự động tạo ô trống [blank_X] và câu hỏi điền từ"
                  >
                    <Scissors className="w-3.5 h-3.5 text-purple-200" />
                    <span>Tạo ô trống [blank_X] từ từ bôi đen</span>
                  </button>
                </div>
              </div>

              {/* Tokenizer Toast Notification */}
              {tokenizerToast && (
                <div className="mb-2 p-2.5 bg-purple-100/90 border border-purple-300 rounded-xl text-xs font-bold text-[#3C2A63] flex items-center gap-2 animate-fadeIn">
                  <Sparkles className="w-4 h-4 text-[#6B51A5] shrink-0" />
                  <span>{tokenizerToast}</span>
                </div>
              )}

              {/* Textarea with ref for selection extraction */}
              {(() => {
                const { ref: formRef, ...rest } = register(`passages.${selectedPassageIdx}.text`);
                return (
                  <textarea
                    rows={10}
                    {...rest}
                    ref={(el) => {
                      formRef(el);
                      passageTextareaRef.current = el;
                    }}
                    placeholder="Dán hoặc nhập toàn bộ nội dung bài đọc tại đây. Để tạo câu hỏi điền từ nhanh, hãy bôi đen bất kỳ từ nào (ví dụ: 'pesticides') rồi bấm nút 'Tạo ô trống' phía trên..."
                    className="w-full p-4 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-serif leading-relaxed text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                  />
                );
              })()}
              {errors.passages?.[selectedPassageIdx]?.text && (
                <p className="text-xs text-rose-600 mt-1 font-bold">
                  {errors.passages[selectedPassageIdx]?.text?.message}
                </p>
              )}
            </div>
          </div>

          {/* Passage Nested Questions */}
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#6B51A5]" />
                  <span>Questions Inside Passage {selectedPassageIdx + 1}</span>
                </h3>
                <p className="text-xs text-[#7C68A5]">
                  Standardized directly within this passage structure for synchronous ReadingModule compatibility.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddQuestionToPassage}
                className="px-4 py-2 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-2xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            {/* Questions List */}
            <div className="space-y-4 pt-2">
              {currentPassageQuestionsArray.fields.length === 0 ? (
                <div className="p-8 text-center bg-purple-50/50 rounded-2xl border border-dashed border-purple-200 text-xs text-[#7C68A5]">
                  No questions currently added to Passage {selectedPassageIdx + 1}. Click &quot;Add Question&quot; above to create one.
                </div>
              ) : (
                currentPassageQuestionsArray.fields.map((field, qIdx) => (
                  <QuestionEditorItem
                    key={field.id}
                    prefix={`passages.${selectedPassageIdx}.questions.${qIdx}`}
                    index={qIdx}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    onRemove={() => currentPassageQuestionsArray.remove(qIdx)}
                    section="reading"
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Split-Screen Student CBT Simulation */}
        {splitScreenPreview && (
            <div className="sticky top-4 bg-white rounded-3xl p-6 border-2 border-purple-200/90 shadow-2xl space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#6B51A5] text-white rounded-xl shadow-xs">
                    <Eye className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-[#3C2A63] tracking-wider">
                      Student CBT Live Simulation
                    </h4>
                    <p className="text-[10px] text-[#7C68A5]">
                      Mô phỏng thời gian thực giao diện học sinh (Passage {selectedPassageIdx + 1})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewAnswers({})}
                  className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer"
                  title="Xóa câu trả lời đang test thử"
                >
                  Xóa đáp án thử
                </button>
              </div>

              {/* Passage Article Preview */}
              <div className="p-4 bg-[#FAF8FD] rounded-2xl border border-purple-100 space-y-2">
                <h5 className="text-xs font-black text-[#503A7A]">
                  {watchedPassages[selectedPassageIdx]?.title || `Reading Passage ${selectedPassageIdx + 1}`}
                </h5>
                <div className="text-xs font-serif leading-relaxed text-[#3C2A63] whitespace-pre-wrap max-h-56 overflow-y-auto p-2.5 bg-white rounded-xl border border-purple-50">
                  {watchedPassages[selectedPassageIdx]?.text || 'Chưa có nội dung đoạn văn bài đọc...'}
                </div>
              </div>

              {/* Interactive Student Questions Live Preview */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#3C2A63]">
                    Câu hỏi ({watchedPassages[selectedPassageIdx]?.questions?.length || 0})
                  </span>
                  <span className="text-[10px] text-[#7C68A5] font-semibold">
                    Interactive CBT Mode
                  </span>
                </div>

                {(!watchedPassages[selectedPassageIdx]?.questions || watchedPassages[selectedPassageIdx]?.questions?.length === 0) ? (
                  <div className="p-6 text-center text-xs text-[#7C68A5] bg-purple-50/50 rounded-2xl border border-dashed border-purple-200">
                    Chưa có câu hỏi nào. Dùng tính năng bôi đen để tạo ô trống hoặc bấm &quot;Add Question&quot;.
                  </div>
                ) : (
                  watchedPassages[selectedPassageIdx]?.questions?.map((q, qIdx) => {
                    const fallbackQId = q.question_id || `R${qIdx + 1}`;
                    return (
                      <IELTSQuestionCard
                        key={fallbackQId || qIdx}
                        question={q as any}
                        questionNumber={qIdx + 1}
                        userAnswer={previewAnswers[fallbackQId] || ''}
                        onAnswerChange={(qid, ans) => {
                          setPreviewAnswers(prev => ({ ...prev, [qid]: ans }));
                        }}
                        allUserAnswers={previewAnswers}
                        allQuestions={watchedPassages[selectedPassageIdx]?.questions as any}
                        isPreview={true}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SECTION 2: LISTENING MODULE */}
      {activeSection === 'listening' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-4">
            <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
              <Headphones className="w-4 h-4 text-[#6B51A5]" />
              <span>Listening Audio Stream Settings</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-[#3C2A63] mb-1">
                  Audio Stream URL:
                </label>
                <input
                  type="text"
                  {...register('audio_url')}
                  placeholder="https://.../listening.mp3"
                  className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-mono text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#3C2A63] mb-1">
                  Audio Title:
                </label>
                <input
                  type="text"
                  {...register('audio_title')}
                  placeholder="e.g. IELTS Listening Parts 1 - 4 Comprehensive Stream"
                  className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                />
              </div>
            </div>
          </div>

          {/* Listening Questions Array */}
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#6B51A5]" />
                <span>Listening Questions ({listeningQuestionsArray.fields.length})</span>
              </h3>

              <button
                type="button"
                onClick={handleAddListeningQuestion}
                className="px-4 py-2 bg-[#6B51A5] hover:bg-[#583F8F] text-white rounded-2xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Listening Question</span>
              </button>
            </div>

            <div className="space-y-4">
              {listeningQuestionsArray.fields.length === 0 ? (
                <div className="p-8 text-center bg-purple-50/50 rounded-2xl border border-dashed border-purple-200 text-xs text-[#7C68A5]">
                  No listening questions currently added. Click &quot;Add Listening Question&quot; above to create one.
                </div>
              ) : (
                listeningQuestionsArray.fields.map((field, qIdx) => (
                  <QuestionEditorItem
                    key={field.id}
                    prefix={`listening_questions.${qIdx}`}
                    index={qIdx}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    onRemove={() => listeningQuestionsArray.remove(qIdx)}
                    section="listening"
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: WRITING MODULE */}
      {activeSection === 'writing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-4">
            <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#6B51A5]" />
              <span>Academic Writing Task 1 (Report)</span>
            </h3>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Task 1 Prompt:
              </label>
              <textarea
                rows={4}
                {...register('writing_task1_prompt')}
                placeholder="The graph below shows the changes in..."
                className="w-full p-3.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-medium text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1.5">
                Task 1 Diagram / Chart Material:
              </label>
              <Task1ImageUploader
                value={watchedTask1Image}
                onChange={(imgStr) => setValue('writing_task1_image', imgStr, { shouldDirty: true, shouldValidate: true })}
                onClear={() => setValue('writing_task1_image', '', { shouldDirty: true, shouldValidate: true })}
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-4">
            <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#6B51A5]" />
              <span>Academic Writing Task 2 (Discursive Essay)</span>
            </h3>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Task 2 Essay Prompt:
              </label>
              <textarea
                rows={5}
                {...register('writing_task2_prompt')}
                placeholder="Some people think that universities should provide graduates with the knowledge and skills needed in the workplace..."
                className="w-full p-3.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-medium text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: EXAM TIMING & METADATA */}
      {activeSection === 'settings' && (
        <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xl shadow-purple-950/5 space-y-6">
          <h3 className="text-sm font-black text-[#3C2A63] uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6B51A5]" />
            <span>Examination Code, Title &amp; Timer Durations</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Exam Code:
              </label>
              <input
                type="text"
                {...register('exam_code')}
                placeholder="TEST01"
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-mono font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
              />
              {errors.exam_code && (
                <p className="text-xs text-rose-600 mt-1 font-bold">{errors.exam_code.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Exam Title:
              </label>
              <input
                type="text"
                {...register('title')}
                placeholder="IELTS Academic Official Mock Test 01"
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
              />
              {errors.title && (
                <p className="text-xs text-rose-600 mt-1 font-bold">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Default Test Mode:
              </label>
              <select
                {...register('test_type')}
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-bold text-[#3C2A63] focus:outline-none"
              >
                <option value="TEST">Official Test (Proctored with Fullscreen lock)</option>
                <option value="PRACTICE">Practice Mode (Self-paced)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Total Exam Duration (minutes):
              </label>
              <input
                type="number"
                {...register('duration_mins', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-mono font-bold text-[#3C2A63] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Reading Duration (minutes):
              </label>
              <input
                type="number"
                {...register('reading_duration_mins', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-mono font-bold text-[#3C2A63] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#3C2A63] mb-1">
                Listening Duration (minutes):
              </label>
              <input
                type="number"
                {...register('listening_duration_mins', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-[#F8F6FC] rounded-2xl border border-purple-100 text-xs font-mono font-bold text-[#3C2A63] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

    </form>
  );
};
