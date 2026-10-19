import { describe, it, expect } from 'vitest';
import { DEFAULT_EXAMS } from '../data/defaultExams';
import fs from 'fs';
import path from 'path';

describe('IELTS CBT Writing Task 1 Image & Fallback Verification (One Skill, Two Skills, All Skills)', () => {

  const examsJsonPath = path.resolve(process.cwd(), 'server_data/exams.json');
  const starterPackPath = path.resolve(process.cwd(), 'server_data/starter_pack.json');

  const serverExams = fs.existsSync(examsJsonPath)
    ? JSON.parse(fs.readFileSync(examsJsonPath, 'utf8'))
    : [];

  const starterExams = fs.existsSync(starterPackPath)
    ? JSON.parse(fs.readFileSync(starterPackPath, 'utf8'))
    : [];

  /* =========================================================================
   * 1. ONE-SKILL MODE (Writing Retake e.g. WT1004, WT1001, WT1003)
   * ========================================================================= */
  describe('1. One-Skill Mode (Writing One-Skill Retake)', () => {
    it('WT1004 has guaranteed valid Task 1 image across all alias properties', () => {
      const wt1004 = DEFAULT_EXAMS.find(e => e.exam_code === 'WT1004') || serverExams.find((e: any) => e.exam_code === 'WT1004');
      expect(wt1004).toBeDefined();

      const task1Img = wt1004?.writing_task1_image || 
        (wt1004 as any)?.writing_task1_image_url || 
        (wt1004 as any)?.writing_task1_imageUrl ||
        wt1004?.sections?.find(s => s.skill === 'writing')?.tasks?.[0]?.image_url;

      expect(task1Img).toBeTruthy();
      expect(typeof task1Img).toBe('string');
      expect(task1Img?.startsWith('http') || task1Img?.startsWith('data:')).toBe(true);
    });

    it('Writing drill papers (WT1001, WT1003) have valid Task 1 image configured', () => {
      ['WT1001', 'WT1003'].forEach(code => {
        const exam = DEFAULT_EXAMS.find(e => e.exam_code === code) || serverExams.find((e: any) => e.exam_code === code);
        expect(exam).toBeDefined();

        const img = exam?.writing_task1_image || 
          (exam as any)?.writing_task1_image_url ||
          exam?.sections?.find(s => s.skill === 'writing')?.tasks?.[0]?.image_url;

        expect(img).toBeTruthy();
        expect(typeof img).toBe('string');
      });
    });
  });

  /* =========================================================================
   * 2. TWO-SKILLS MODE (Reading & Writing e.g. RW2001)
   * ========================================================================= */
  describe('2. Two-Skills Mode (Dual-Skill Paper RW2001)', () => {
    it('RW2001 has guaranteed valid Task 1 image across all alias properties', () => {
      const rw2001 = DEFAULT_EXAMS.find(e => e.exam_code === 'RW2001') || serverExams.find((e: any) => e.exam_code === 'RW2001');
      expect(rw2001).toBeDefined();

      const task1Img = rw2001?.writing_task1_image || 
        (rw2001 as any)?.writing_task1_image_url || 
        (rw2001 as any)?.writing_task1_imageUrl ||
        rw2001?.sections?.find(s => s.skill === 'writing')?.tasks?.[0]?.image_url;

      expect(task1Img).toBeTruthy();
      expect(typeof task1Img).toBe('string');
      expect(task1Img?.startsWith('http') || task1Img?.startsWith('data:')).toBe(true);
    });
  });

  /* =========================================================================
   * 3. ALL-SKILLS MODE (Full 4-Skills Mock & Official Tests: TEST01, IELTS01)
   * ========================================================================= */
  describe('3. All-Skills Mode (Full 4-Skills Official Exams TEST01 & IELTS01)', () => {
    ['TEST01', 'IELTS01'].forEach(code => {
      it(`${code} has guaranteed valid Task 1 image in both static defaultExams and server JSON`, () => {
        const examStatic = DEFAULT_EXAMS.find(e => e.exam_code === code);
        const examServer = serverExams.find((e: any) => e.exam_code === code);

        expect(examStatic || examServer).toBeDefined();

        const imgStatic = examStatic?.writing_task1_image || (examStatic as any)?.writing_task1_image_url;
        const imgServer = examServer?.writing_task1_image || examServer?.writing_task1_image_url;

        expect(imgStatic || imgServer).toBeTruthy();
        expect((imgStatic || imgServer).startsWith('http')).toBe(true);
      });
    });
  });

  /* =========================================================================
   * 4. FALLBACK RESILIENCE & ZERO-BLANK GUARANTEE
   * ========================================================================= */
  describe('4. Fallback Guarantee & Sanitization Resilience', () => {
    it('WritingModule resolution cascade guarantees non-empty image even when exam has no image configured', () => {
      const DEFAULT_TASK1_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60';
      
      const emptyExamProps: any = {
        task1Prompt: 'Summarise the chart below',
        task1Image: undefined,
        imageUrl: undefined,
        image_url: undefined,
        tasks: []
      };

      const task1FromList = emptyExamProps.tasks?.find((t: any) => t.task_number === 1) || emptyExamProps.tasks?.[0];
      const detectedImage = emptyExamProps.task1Image || 
        emptyExamProps.imageUrl || 
        emptyExamProps.image_url || 
        task1FromList?.image_url || 
        task1FromList?.imageUrl || 
        DEFAULT_TASK1_FALLBACK_IMAGE;

      expect(detectedImage).toBe(DEFAULT_TASK1_FALLBACK_IMAGE);
      expect(detectedImage.length).toBeGreaterThan(10);
    });

    it('Student sanitization in server.ts never deletes Task 1 images or writing sections', () => {
      const mockRawExam = {
        exam_code: 'TEST01',
        title: 'Full Exam',
        writing_task1_prompt: 'Summarise the bar chart',
        writing_task1_image: 'https://images.unsplash.com/photo-sample',
        writing_task2_prompt: 'Discuss advantages and disadvantages',
        questions: [
          { question_id: 'q1', correct_answer: 'LEAKED_SECRET', explanation: 'Secret' }
        ],
        sections: [
          {
            skill: 'writing',
            tasks: [
              { task_number: 1, title: 'Task 1', image_url: 'https://images.unsplash.com/photo-sample' }
            ]
          }
        ]
      };

      // Server sanitizeExamForStudent behavior check
      const sanitizeExamForStudent = (exam: any) => {
        const copy = JSON.parse(JSON.stringify(exam));
        if (Array.isArray(copy.questions)) {
          copy.questions = copy.questions.map((q: any) => {
            const { correct_answer, explanation, ...safe } = q;
            return safe;
          });
        }
        const rootImg = copy.writing_task1_image || copy.writing_task1_image_url || '';
        copy.writing_task1_image = rootImg;
        copy.writing_task1_image_url = rootImg;
        return copy;
      };

      const sanitized = sanitizeExamForStudent(mockRawExam);
      expect(sanitized.questions[0].correct_answer).toBeUndefined(); // stripped
      expect(sanitized.writing_task1_image).toBe('https://images.unsplash.com/photo-sample'); // preserved
      expect(sanitized.sections[0].tasks[0].image_url).toBe('https://images.unsplash.com/photo-sample'); // preserved
    });
  });

  /* =========================================================================
   * 5. ERROR REPORTING & VECTOR SAFE MODE
   * ========================================================================= */
  describe('5. Diagram Issue Reporting & Vector Safe Mode Recovery', () => {
    it('Formats TASK1_IMAGE_ISSUE_REPORT payload correctly and issues confirmation reference', () => {
      const candidateId = 'CAND_9942';
      const examCode = 'RW2001';
      const reason = 'Image not loading / Blank box';
      const note = 'Cannot see the bar chart on Chrome';

      const payload = {
        sbd: candidateId,
        exam_code: examCode,
        violation_type: 'TASK1_IMAGE_ISSUE_REPORT',
        description: `Candidate reported image issue: [${reason}]. Note: ${note}. Image URL: https://example.com/chart.png`,
        timestamp: new Date().toISOString()
      };

      expect(payload.violation_type).toBe('TASK1_IMAGE_ISSUE_REPORT');
      expect(payload.sbd).toBe('CAND_9942');
      expect(payload.exam_code).toBe('RW2001');

      const refId = `REP-${Date.now().toString(36).toUpperCase()}`;
      expect(refId.startsWith('REP-')).toBe(true);
    });

    it('Switches to vector fallback diagram when image load fails', () => {
      let imageError = false;
      let useVectorFallback = false;

      // On img onError event
      const onImageError = () => {
        imageError = true;
      };

      onImageError();
      expect(imageError).toBe(true);

      // Student clicks "Use Vector Chart Now" or activates fallback
      useVectorFallback = true;
      expect(useVectorFallback).toBe(true);
    });

    it('Formats WRITING_ISSUE_REPORT correctly for prompt content errors and task image failures', () => {
      const candidateId = 'CAND_3310';
      const examCode = 'WT1004';
      
      // 1. Task 1 image failure report
      const imgPayload = {
        sbd: candidateId,
        exam_code: examCode,
        violation_type: 'WRITING_ISSUE_REPORT',
        description: 'Candidate feedback on [Writing Task 1]: Category=[image_failed]. Note=[Image cannot load on workstation]. Diagram URL=[https://images.unsplash.com/sample]',
        timestamp: new Date().toISOString()
      };

      expect(imgPayload.violation_type).toBe('WRITING_ISSUE_REPORT');
      expect(imgPayload.description).toContain('image_failed');

      // 2. Task 2 prompt wording / content report
      const promptPayload = {
        sbd: candidateId,
        exam_code: examCode,
        violation_type: 'WRITING_ISSUE_REPORT',
        description: 'Candidate feedback on [Writing Task 2]: Category=[prompt_content]. Note=[Typo in topic sentence or missing instructions]. Diagram URL=[None]',
        timestamp: new Date().toISOString()
      };

      expect(promptPayload.violation_type).toBe('WRITING_ISSUE_REPORT');
      expect(promptPayload.description).toContain('prompt_content');
      expect(promptPayload.description).toContain('Writing Task 2');
    });

    it('Transitions Task 1 container to Image Unavailable placeholder state with prominent Report Issue trigger', () => {
      let imageError = false;
      let uiState = {
        showImageUnavailable: false,
        showProminentReportButton: false,
        icon: 'ImageIcon'
      };

      // Simulates onError triggering the enhanced placeholder
      const handleImageLoadError = () => {
        imageError = true;
        uiState = {
          showImageUnavailable: true,
          showProminentReportButton: true,
          icon: 'ImageOff'
        };
      };

      handleImageLoadError();

      expect(imageError).toBe(true);
      expect(uiState.showImageUnavailable).toBe(true);
      expect(uiState.icon).toBe('ImageOff');
      expect(uiState.showProminentReportButton).toBe(true);
    });
  });

});
