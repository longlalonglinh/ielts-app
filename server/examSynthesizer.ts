import { ExamData, Question } from '../src/types';

export interface SynthesizerOptions {
  topic: string;
  skills: ('listening' | 'reading' | 'writing')[];
  difficulty: string; // 'band_5_6' | 'band_65_75' | 'band_8_9'
  questionCount: number;
  durationMins: number;
  customPrompt?: string;
  testType?: 'ACADEMIC' | 'GENERAL_TRAINING';
  archetypeMix?: 'full_cambridge' | 'headings_and_blanks' | 'objective_only';
}

export function synthesizeTopicExam(options: SynthesizerOptions): ExamData {
  const { 
    topic, 
    skills, 
    difficulty, 
    questionCount, 
    durationMins, 
    customPrompt,
    testType = 'ACADEMIC',
    archetypeMix = 'full_cambridge'
  } = options;

  const timestamp = Date.now().toString().slice(-6);
  const examCode = `IELTS_AI_${timestamp}`;
  const totalQ = Math.max(6, Math.min(questionCount || 10, 40));

  const cleanTopic = (topic || 'Global Environmental Sustainability and Green Innovation').trim();
  const reqListening = skills.includes('listening');
  const reqReading = skills.includes('reading');
  const reqWriting = skills.includes('writing');

  // Academic Reading Passage Paragraphs
  const passageTitle = `The Evolutionary Dynamics and Paradigm Shifts in ${cleanTopic}`;
  
  const paragraphA = `Paragraph A
In recent decades, the trajectory of ${cleanTopic.toLowerCase()} has fundamentally altered the paradigm through which researchers and policymakers evaluate global development. Historically, initial methodologies were constrained by rudimentary empirical frameworks, often neglecting systemic ecological and technological interdependencies. As interdisciplinary collaboration expanded across international institutions, the necessity for sophisticated paradigms became irrefutable. Modern frameworks synthesize quantitative longitudinal analytics with granular stakeholder qualitative assessments, establishing an authoritative foundation for subsequent developmental interventions.`;

  const paragraphB = `Paragraph B
A pivotal breakthrough emerged with the integration of decentralized predictive modelling. Early pioneers in the field observed that decentralized systems exhibited an inherent resilience against stochastic volatility, outperforming centralized conventional architectures by significant margins. In controlled comparative field studies across multiple continents, adaptive networks demonstrated an average efficiency increment of 34%, while simultaneously curbing operational redundancies. Consequently, leading governmental bodies and transnational conglomerates have accelerated strategic capital allocation toward this burgeoning methodology.`;

  const paragraphC = `Paragraph C
Notwithstanding widespread optimism, significant socio-economic and structural impediments continue to hinder frictionless global implementation. Prominent among these is the disparity in technological infrastructure between high-income industrial economies and developing global regions. Critics emphasize that absent substantial philanthropic subsidies and equitable intellectual property transfer frameworks, the disproportionate distribution of benefits risks exacerbating preexisting socio-economic stratification. Furthermore, regulatory divergence across jurisdictions complicates the standardization of safety, ethics, and performance benchmarks.`;

  const paragraphD = `Paragraph D
To mitigate these emerging challenges, consortiums of independent scientists and academic specialists have formulated a comprehensive protocol known as the Sustainable Optimization Metric (SOM). By subjecting continuous operational workflows to rigorous independent third-party audits, SOM ensures that ethical standards remain uncompromised amidst aggressive commercialization. Initial diagnostic assessments suggest that organizations adopting SOM achieve higher long-term regulatory compliance alongside robust societal approval, signaling a promising trajectory for sustainable expansion.`;

  const paragraphE = `Paragraph E
Looking toward the subsequent phase of technological maturation, artificial intelligence and automated feedback loops are projected to assume an indispensable role in refining ${cleanTopic.toLowerCase()}. By autonomously calibrating parameters in real time based on continuous sensory telemetry, next-generation infrastructures will preemptively resolve structural bottlenecks before catastrophic operational failure occurs. The realization of this holistic vision, however, demands sustained international collaboration, proactive public engagement, and an unwavering commitment to equitable ethical governance.`;

  const readingPassageText = `${paragraphA}\n\n${paragraphB}\n\n${paragraphC}\n\n${paragraphD}\n\n${paragraphE}`;

  // Distribute questions across active skills
  const questions: Question[] = [];
  let qNum = 1;

  // 1. Listening Questions (if requested)
  if (reqListening) {
    const listeningLimit = reqReading ? Math.max(3, Math.floor(totalQ * 0.4)) : totalQ;

    // L1: Conversation Purpose (Multiple Choice)
    const l1: Question = {
      question_id: `L${qNum}`,
      section: 'listening',
      part: 1,
      question_number: qNum,
      question_text: `${qNum}. What is the primary focus of the research briefing discussed between the candidate and the director?`,
      question_type: 'multiple_choice',
      options: [
        `A. Accelerating sustainable implementation of ${cleanTopic.toLowerCase()}`,
        'B. Reallocating traditional industrial budgets exclusively to administrative oversight',
        'C. Terminating academic oversight to expedite commercialization timelines',
        'D. Restricting diagnostic data access strictly to regional regulatory bodies'
      ],
      correct_answer: 'A',
      explanation: `The audio dialogue specifically highlights sustainable implementation frameworks and collaborative research within ${cleanTopic.toLowerCase()}.`,
      max_score: 1
    };
    questions.push(l1);
    qNum++;

    // L2: Note Completion / Number
    if (qNum <= listeningLimit) {
      const l2: Question = {
        question_id: `L${qNum}`,
        section: 'listening',
        part: 1,
        question_number: qNum,
        question_text: `${qNum}. Note Completion: The measured efficiency increment across comparative trials was ________ percent.`,
        question_type: 'fill_in_blank',
        instruction: 'Write ONE NUMBER ONLY.',
        word_limit: 'A NUMBER',
        correct_answer: '34',
        acceptable_answers: ['34', 'thirty-four', '34%'],
        explanation: 'The research briefing explicitly records an average efficiency increment of 34 percent across decentralized field architectures.',
        max_score: 1
      };
      questions.push(l2);
      qNum++;
    }

    // L3: Form Completion
    if (qNum <= listeningLimit) {
      const l3: Question = {
        question_id: `L${qNum}`,
        section: 'listening',
        part: 2,
        question_number: qNum,
        question_text: `${qNum}. Form Completion: Field evaluation inspections take place semi-annually in the month of ________.`,
        question_type: 'fill_in_blank',
        instruction: 'Write ONE WORD ONLY.',
        word_limit: 'ONE WORD',
        correct_answer: 'October',
        acceptable_answers: ['October', 'october'],
        explanation: 'The briefing calendar specifies October as the scheduled month for comprehensive semi-annual on-site evaluations.',
        max_score: 1
      };
      questions.push(l3);
      qNum++;
    }

    // L4: Academic Discussion (Multiple Choice)
    if (qNum <= listeningLimit) {
      const l4: Question = {
        question_id: `L${qNum}`,
        section: 'listening',
        part: 3,
        question_number: qNum,
        question_text: `${qNum}. Which committee holds ultimate authority for enforcing ethical standard compliance under SOM?`,
        question_type: 'multiple_choice',
        options: [
          'A. The Independent Academic Consortium',
          'B. The International Commerce Bureau',
          'C. The Municipal Infrastructure Department',
          'D. The Regional Financial Inspection Panel'
        ],
        correct_answer: 'A',
        explanation: 'Section 3 explains that audit compliance is independently governed by the Independent Academic Consortium.',
        max_score: 1
      };
      questions.push(l4);
      qNum++;
    }
  }

  // 2. Reading Questions (if requested)
  if (reqReading) {
    // Archetype A: Matching Headings (Official Cambridge Question Style)
    if (archetypeMix === 'full_cambridge' || archetypeMix === 'headings_and_blanks') {
      const headingList = [
        'i. Overcoming technological infrastructure disparities and socio-economic gaps',
        'ii. Quantitative performance increments verified in comparative field trials',
        'iii. The historic paradigm transition toward interdisciplinary research models',
        'iv. Autonomous feedback mechanisms and preemptive failure diagnostics',
        'v. Safeguarding standard ethical integrity through certified independent audits',
        'vi. Outdated models of centralized municipal industrial production',
        'vii. Reassessing the commercial profitability of public investments'
      ];

      // Question for Paragraph A
      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. Paragraph A: Choose the correct heading from the List of Headings below.`,
        question_type: 'matching_headings',
        instruction: 'Choose the correct heading for Paragraph A from the list of headings below.',
        options: headingList,
        correct_answer: 'iii',
        acceptable_answers: ['iii', 'III', 'iii. The historic paradigm transition toward interdisciplinary research models'],
        explanation: 'Paragraph A focuses on how historical rudimentary frameworks were replaced by interdisciplinary collaboration and sophisticated paradigms.',
        max_score: 1
      });
      qNum++;

      // Question for Paragraph B
      if (qNum <= totalQ) {
        questions.push({
          question_id: `R${qNum}`,
          section: 'reading',
          passage_index: 1,
          question_number: qNum,
          question_text: `${qNum}. Paragraph B: Choose the correct heading from the List of Headings below.`,
          question_type: 'matching_headings',
          instruction: 'Choose the correct heading for Paragraph B.',
          options: headingList,
          correct_answer: 'ii',
          acceptable_answers: ['ii', 'II', 'ii. Quantitative performance increments verified in comparative field trials'],
          explanation: 'Paragraph B details controlled comparative field studies demonstrating an average efficiency increment of 34%.',
          max_score: 1
        });
        qNum++;
      }

      // Question for Paragraph C
      if (qNum <= totalQ) {
        questions.push({
          question_id: `R${qNum}`,
          section: 'reading',
          passage_index: 1,
          question_number: qNum,
          question_text: `${qNum}. Paragraph C: Choose the correct heading from the List of Headings below.`,
          question_type: 'matching_headings',
          instruction: 'Choose the correct heading for Paragraph C.',
          options: headingList,
          correct_answer: 'i',
          acceptable_answers: ['i', 'I', 'i. Overcoming technological infrastructure disparities and socio-economic gaps'],
          explanation: 'Paragraph C addresses technological infrastructure disparities between high-income industrial economies and developing regions.',
          max_score: 1
        });
        qNum++;
      }
    }

    // Archetype B: Multiple Choice (Single Answer)
    if (qNum <= totalQ) {
      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. According to Paragraph B, what was an immediate consequence of the efficiency gains in adaptive networks?`,
        question_type: 'multiple_choice',
        options: [
          'A. Governments and transnational conglomerates accelerated strategic capital investment',
          'B. Academic researchers recommended reverting completely to centralized architectures',
          'C. Commercial entities were prohibited from deploying predictive modelling tools',
          'D. Cross-continental field studies were suspended pending regulatory updates'
        ],
        correct_answer: 'A',
        explanation: 'Paragraph B concludes: "Consequently, leading governmental bodies and transnational conglomerates have accelerated strategic capital allocation toward this burgeoning methodology."',
        max_score: 1
      });
      qNum++;
    }

    // Archetype C: True / False / Not Given
    if (qNum <= totalQ) {
      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. Disparities in technical infrastructure between countries present an obstacle to frictionless implementation.`,
        question_type: 'true_false_not_given',
        instruction: 'Do the following statements agree with the information in the Reading Passage? Write TRUE, FALSE, or NOT GIVEN.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        correct_answer: 'TRUE',
        explanation: 'Paragraph C states: "Prominent among these is the disparity in technological infrastructure between high-income industrial economies and developing global regions."',
        max_score: 1
      });
      qNum++;
    }

    // Archetype D: True / False / Not Given (False)
    if (qNum <= totalQ) {
      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. The Sustainable Optimization Metric (SOM) requires organizations to cease commercialization entirely.`,
        question_type: 'true_false_not_given',
        instruction: 'Write TRUE, FALSE, or NOT GIVEN.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        correct_answer: 'FALSE',
        explanation: 'Paragraph D notes that SOM ensures ethical standards remain uncompromised amidst aggressive commercialization, rather than eliminating it.',
        max_score: 1
      });
      qNum++;
    }

    // Archetype E: True / False / Not Given (Not Given)
    if (qNum <= totalQ) {
      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. More than seventy percent of developing nations currently enforce mandatory SOM certification.`,
        question_type: 'true_false_not_given',
        instruction: 'Write TRUE, FALSE, or NOT GIVEN.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        correct_answer: 'NOT GIVEN',
        explanation: 'The passage mentions regulatory divergence across jurisdictions but gives no percentage regarding adoption in developing nations.',
        max_score: 1
      });
      qNum++;
    }

    // Archetype F: Table Completion (Structured Markdown Table with [blank_X] Tokens)
    if (qNum <= totalQ) {
      const tableQNum = qNum;
      const tableContent = `
### Summary of Strategic Dimensions & Key Performance Benchmarks

| Strategic Dimension | Associated Mechanism | Key Outcome / Benchmark |
|---|---|---|
| **Predictive Modelling** | Decentralized architecture | Average [blank_${tableQNum}] % efficiency improvement |
| **Integrity Assurance** | Sustainable Optimization Metric | Independent third-party [blank_${tableQNum + 1}] |
| **System Maturation** | Autonomous sensory feedback | Preempts structural [blank_${tableQNum + 2}] |
`.trim();

      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. Complete the table below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from the passage.`,
        question_type: 'table_completion',
        instruction: 'Complete the table below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER from the passage for each answer.',
        table_markdown: tableContent,
        word_limit: 'A NUMBER',
        correct_answer: '34',
        acceptable_answers: ['34', 'thirty-four', '34%'],
        explanation: 'Paragraph B explicitly specifies an average efficiency increment of 34 percent.',
        max_score: 1
      });
      qNum++;

      if (qNum <= totalQ) {
        questions.push({
          question_id: `R${qNum}`,
          section: 'reading',
          passage_index: 1,
          question_number: qNum,
          question_text: `${qNum}. Complete the table cell for Integrity Assurance: Independent third-party ________.`,
          question_type: 'table_completion',
          instruction: 'Write NO MORE THAN TWO WORDS from the passage.',
          word_limit: 'TWO WORDS',
          correct_answer: 'audits',
          acceptable_answers: ['audits', 'independent third-party audits'],
          explanation: 'Paragraph D notes that SOM operates by subjecting continuous workflows to rigorous independent third-party audits.',
          max_score: 1
        });
        qNum++;
      }

      if (qNum <= totalQ) {
        questions.push({
          question_id: `R${qNum}`,
          section: 'reading',
          passage_index: 1,
          question_number: qNum,
          question_text: `${qNum}. Complete the table cell for System Maturation: Preempts structural ________.`,
          question_type: 'table_completion',
          instruction: 'Write ONE WORD ONLY from the passage.',
          word_limit: 'ONE WORD',
          correct_answer: 'bottlenecks',
          acceptable_answers: ['bottlenecks', 'structural bottlenecks'],
          explanation: 'Paragraph E states next-generation infrastructures will preemptively resolve structural bottlenecks.',
          max_score: 1
        });
        qNum++;
      }
    }

    // Archetype G: Summary Completion with Word Bank
    if (qNum <= totalQ) {
      const summaryWordBank = [
        { id: 'A', word: 'telemetry', text: 'telemetry' },
        { id: 'B', word: 'stratification', text: 'stratification' },
        { id: 'C', word: 'volatility', text: 'volatility' },
        { id: 'D', word: 'interdependence', text: 'interdependence' },
        { id: 'E', word: 'commercialization', text: 'commercialization' },
        { id: 'F', word: 'redundancy', text: 'redundancy' }
      ];

      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. Summary Completion: Without targeted subsidies, an unequal distribution of new advances threatens to deepen existing social and economic [blank_${qNum}].`,
        question_type: 'summary_completion_box',
        instruction: 'Complete the summary using the list of words, A-F, below.',
        options: summaryWordBank.map(w => `${w.id}. ${w.text}`),
        word_bank: summaryWordBank,
        correct_answer: 'B',
        acceptable_answers: ['B', 'stratification', 'B. stratification'],
        explanation: 'Paragraph C states that the uneven distribution of benefits risks exacerbating preexisting socio-economic stratification (Option B).',
        max_score: 1
      });
      qNum++;
    }

    // Fill remaining up to requested totalQ
    while (qNum <= totalQ) {
      questions.push({
        question_id: `R${qNum}`,
        section: 'reading',
        passage_index: 1,
        question_number: qNum,
        question_text: `${qNum}. What overarching prerequisite is cited in Paragraph E for the successful maturation of ${cleanTopic.toLowerCase()}?`,
        question_type: 'multiple_choice',
        options: [
          'A. Sustained international collaboration and equitable ethical governance',
          'B. Total deregulation of sensory data transmission networks',
          'C. The immediate cessation of artificial intelligence algorithms in infrastructure',
          'D. Complete monopolization of intellectual property rights by private corporations'
        ],
        correct_answer: 'A',
        explanation: 'Paragraph E states that the realization of this vision demands sustained international collaboration, proactive public engagement, and an unwavering commitment to equitable ethical governance.',
        max_score: 1
      });
      qNum++;
    }
  }

  // 3. Writing Tasks
  const isGeneralTraining = testType === 'GENERAL_TRAINING';
  
  const writingTask1Prompt = isGeneralTraining
    ? `You recently participated in an international conference regarding ${cleanTopic.toLowerCase()} and experienced several organizational deficiencies. Write a formal letter to the conference committee. In your letter:
- Explain why you attended the event
- Describe the specific logistical or presentation issues encountered
- Suggest practical improvements for future conferences
(Write at least 150 words. You do NOT need to write any addresses.)`
    : `The diagrams and data charts below illustrate the strategic lifecycle, global capital allocation, and implementation progression of ${cleanTopic.toLowerCase()} across major economic sectors between 2015 and 2025. 
Summarise the information by selecting and reporting the main features, and make comparisons where relevant.
(Write at least 150 words.)`;

  const writingTask2Prompt = `Some experts argue that massive financial investment and regulatory standards in ${cleanTopic.toLowerCase()} should be mandated and directed exclusively by national governments, while others contend that market-driven private enterprise produces superior and more rapid innovations.
Discuss both views and give your own opinion. Include relevant examples from your knowledge or experience.
(Write at least 250 words.)`;

  // Select authentic academic chart / infographic image for Task 1
  const academicImages = [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80'
  ];
  const selectedImage = academicImages[Math.floor(Math.random() * academicImages.length)];

  const examData: ExamData = {
    exam_code: examCode,
    title: `IELTS ${testType === 'GENERAL_TRAINING' ? 'General Training' : 'Academic'} Practice Exam - ${cleanTopic}`,
    test_type: 'TEST',
    duration_mins: durationMins || 120,
    skills: skills,
    exam_type: skills.length === 1 ? 'one_skill' : skills.length === 2 ? 'two_skills' : 'full_test',
    
    // Audio stream for listening
    audio_url: reqListening ? 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=english-conversation-11823.mp3' : '',
    audio_title: reqListening ? `IELTS Listening Section - Dialogue on ${cleanTopic}` : '',
    
    // Reading Passages with structured questions
    reading_passage_title: reqReading ? passageTitle : '',
    reading_passage: reqReading ? readingPassageText : '',
    passages: reqReading ? [
      {
        passage_index: 1,
        title: passageTitle,
        text: readingPassageText,
        questions: questions.filter(q => q.section === 'reading')
      }
    ] : [],

    // Writing Tasks
    writing_task1_prompt: reqWriting ? writingTask1Prompt : '',
    writing_task1_image: reqWriting ? selectedImage : '',
    writing_task1_image_url: reqWriting ? selectedImage : '',
    writing_task1_imageUrl: reqWriting ? selectedImage : '',
    writing_task2_prompt: reqWriting ? writingTask2Prompt : '',

    // Unified questions collection
    questions: questions,
    listening_questions: questions.filter(q => q.section === 'listening'),
    reading_questions: questions.filter(q => q.section === 'reading')
  };

  return examData;
}
