import { Exam } from '../types';

const RAW_DEFAULT_EXAMS = [
  {
    exam_code: 'TEST01',
    title: 'IELTS Academic Official Mock Test 01 (Full 4-Skills)',
    test_type: 'TEST',
    duration_mins: 150,
    listening_duration_mins: 35,
    reading_duration_mins: 60,
    writing_duration_mins: 60,
    audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=english-conversation-11823.mp3',
    audio_title: 'IELTS Listening Parts 1 - 4 Comprehensive Audio Stream',
    passages: [
      {
        passage_index: 1,
        title: 'Passage 1: The History and Evolution of Renewable Energy Technologies',
        text: `Paragraph A
For centuries, human civilization relied almost exclusively on wood, wind, and water power to drive mills, pump water, and navigate the seas. However, the Industrial Revolution ushered in an era dominated by fossil fuels—coal, oil, and natural gas. While coal and oil fueled rapid technological advancements and economic growth, they also introduced severe environmental degradation and greenhouse gas emissions.

Paragraph B
In the mid-20th century, scientists began sounding alarm bells regarding resource depletion and atmospheric pollution. Early photovoltaic (PV) solar cells were developed in 1954 at Bell Labs, initially operating at a modest 6% efficiency. Simultaneously, modern wind turbines gained traction in Denmark and California during the 1970s oil crises. These early innovations laid the groundwork for today's high-efficiency silicon PV modules and offshore wind farms with capacities exceeding 15 megawatts per turbine.

Paragraph C
Despite technological progress, widespread adoption faced economic hurdles. Until the 2010s, generating electricity from solar panels remained far more costly than burning natural gas or coal. Government subsidies, tax incentives, and feed-in tariffs in countries like Germany and China drastically expanded manufacturing scale. As production scaled up globally, the levelized cost of energy (LCOE) for solar energy plummeted by nearly 85% between 2010 and 2020.

Paragraph D
One of the most pressing challenges remaining for renewable systems is grid integration and energy intermittency. Solar energy is unavailable at night, and wind generation varies with weather patterns. To overcome this limitation, advanced lithium-ion battery energy storage systems (BESS) and green hydrogen generation are being deployed worldwide to smooth out power supply and ensure grid stability.`
      },
      {
        passage_index: 2,
        title: 'Passage 2: Marine Megafauna and Ocean Thermohaline Circulation',
        text: `Paragraph A
The world ocean functions as a giant convective thermal engine. Driven by gradients in temperature and salinity, the global thermohaline circulation (THC) redistributes immense quantities of heat from equatorial waters toward polar latitudes, moderating regional climates and oxygenating deep abyssal zones.

Paragraph B
Recent satellite telemetry reveals that large pelagic organisms—such as blue whales, leatherback turtles, and basking sharks—exert measurable biophysical effects on oceanic mixing. As massive pods dive into the mesopelagic layer to feed on krill and resurface to breathe, their synchronized movement generates turbulent kinetic energy that churns nutrient-rich deep waters upward.

Paragraph C
Biologists term this phenomenon 'biomixing'. Mathematical fluid simulations suggest that marine animals contribute comparable mixing power to ocean tides and atmospheric wind stress. However, anthropogenic overfishing, plastic ingestion, and ship strikes have reduced pelagic megafauna biomass by over 60% since 1950, creating cascading disruptions in benthic nutrient cycles.

Paragraph D
Marine protected areas (MPAs) spanning international migratory corridors are vital to preserving this biological nutrient pump. Intergovernmental treaties now seek to enforce vessel speed restrictions and acoustic buffers around sensitive migration bottlenecks.`
      },
      {
        passage_index: 3,
        title: 'Passage 3: The Psychology of Algorithmic Decision-Making and Human Trust',
        text: `Paragraph A
As automated artificial intelligence systems assume decisive roles in judicial sentencing, medical diagnosis, and credit allocation, behavioral scientists are interrogating the psychological mechanisms underpinning human trust in algorithms. Known as 'algorithm aversion', humans routinely demonstrate harsher intolerance for computational errors than for equivalent human blunders.

Paragraph B
Experiments conducted by Dr. Berkeley Dietvorst demonstrate that participants who observed an algorithmic forecasting tool make a minor mathematical mistake immediately lost confidence in the system, even when statistical evidence proved the algorithm outperformed human experts over the long run.

Paragraph C
Conversely, when algorithmic user interfaces permit humans to modify the software's output—even by a trivial margin of 2 to 5 percent—user satisfaction and algorithmic compliance increase exponentially. Psychological ownership and perceived autonomy drastically diminish algorithmic resentment.

Paragraph D
Designing transparent explainable AI (XAI) frameworks is therefore not merely a technical software objective, but an ergonomic and psychological imperative. When algorithmic predictions are accompanied by accessible causal explanations, domain professionals integrate decision-support recommendations with far greater fidelity.`
      }
    ],
    reading_passage_title: 'Passage 1: The History and Evolution of Renewable Energy Technologies',
    reading_passage: `Paragraph A
For centuries, human civilization relied almost exclusively on wood, wind, and water power to drive mills, pump water, and navigate the seas. However, the Industrial Revolution ushered in an era dominated by fossil fuels—coal, oil, and natural gas.

Paragraph B
In the mid-20th century, scientists began sounding alarm bells regarding resource depletion. Early photovoltaic (PV) solar cells were developed in 1954 at Bell Labs, operating at 6% efficiency.

Paragraph C
Government subsidies and feed-in tariffs in Germany and China expanded manufacturing scale. The cost of solar plummeted by nearly 85% between 2010 and 2020.

Paragraph D
To overcome intermittency, advanced lithium-ion battery energy storage systems (BESS) and green hydrogen generation are being deployed worldwide.`,
    writing_task1_prompt: 'The chart below shows the total global renewable energy investment (in billion USD) and capacity addition between 2010 and 2024. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. (Write at least 150 words)',
    writing_task1_image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80',
    writing_task2_prompt: 'Some people believe that government funding should be devoted exclusively to renewable energy development, while others argue that fossil fuels should continue to receive subsidies to maintain low energy prices for low-income households. Discuss both views and give your own opinion. (Write at least 250 words)',
    questions: [
      // LISTENING QUESTIONS (PART 1: Q1 - Q10)
      {
        question_id: 'L1',
        section: 'listening',
        part: 1,
        question_text: '1. What is the main purpose of the visitor\'s inquiry at the student center?',
        question_type: 'multiple_choice',
        options: [
          'A. To register for a university accommodation placement',
          'B. To request a course transfer to the engineering department',
          'C. To inquire about campus library opening hours'
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L2',
        section: 'listening',
        part: 1,
        question_text: '2. Form Completion: Maximum contract duration is ________ months.',
        question_type: 'form_note_table_flowchart_completion',
        instruction: 'Write ONE WORD ONLY AND/OR A NUMBER.',
        word_limit: 'A NUMBER',
        correct_answer: '12',
        max_score: 1
      },
      {
        question_id: 'L3',
        section: 'listening',
        part: 1,
        question_text: '3. Rent payment includes internet connectivity and utility bills.',
        question_type: 'multiple_choice',
        options: ['A. All utilities included', 'B. Electricity paid separately', 'C. Internet requires extra fee'],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L4',
        section: 'listening',
        part: 1,
        question_text: '4. The student must submit their deposit before July ________.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'A NUMBER',
        correct_answer: '15',
        max_score: 1
      },
      {
        question_id: 'L5',
        section: 'listening',
        part: 1,
        question_text: '5. Student Surname: ________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'WILKINSON',
        max_score: 1
      },
      {
        question_id: 'L6',
        section: 'listening',
        part: 1,
        question_text: '6. Room type chosen: Single en-suite with shared ________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'KITCHEN',
        max_score: 1
      },
      {
        question_id: 'L7',
        section: 'listening',
        part: 1,
        question_text: '7. Preferred residence hall: ________ Court',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'VICTORIA',
        max_score: 1
      },
      {
        question_id: 'L8',
        section: 'listening',
        part: 1,
        question_text: '8. Payment frequency selected: Paid every ________ weeks',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'A NUMBER',
        correct_answer: '4',
        max_score: 1
      },
      {
        question_id: 'L9',
        section: 'listening',
        part: 1,
        question_text: '9. Dietary requirements: Vegetarian and strictly ________ free',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'NUT',
        max_score: 1
      },
      {
        question_id: 'L10',
        section: 'listening',
        part: 1,
        question_text: '10. Key collection point: Campus Security Desk at Gate ________',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD OR NUMBER',
        correct_answer: '3',
        max_score: 1
      },

      // LISTENING (PART 2: Q11 - Q20)
      {
        question_id: 'L11',
        section: 'listening',
        part: 2,
        question_text: '11. Label the community sports complex map: Indoor Olympic Pool',
        question_type: 'plan_map_diagram_labelling',
        instruction: 'Label the map below. Choose the correct letter, A–G, for each question.',
        diagram_labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        correct_answer: 'B',
        max_score: 1
      },
      {
        question_id: 'L12',
        section: 'listening',
        part: 2,
        question_text: '12. Location of Squash Courts on the floor plan:',
        question_type: 'plan_map_diagram_labelling',
        diagram_labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        correct_answer: 'E',
        max_score: 1
      },
      {
        question_id: 'L13',
        section: 'listening',
        part: 2,
        question_text: '13. Location of Physiotherapy Clinic:',
        question_type: 'plan_map_diagram_labelling',
        diagram_labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        correct_answer: 'C',
        max_score: 1
      },
      {
        question_id: 'L14',
        section: 'listening',
        part: 2,
        question_text: '14. Match membership tier to benefit: Gold Annual Pass',
        question_type: 'matching',
        matching_options: [
          { id: 'A', text: 'Includes unlimited personal coaching and sauna access' },
          { id: 'B', text: 'Off-peak access on weekdays before 14:00 only' },
          { id: 'C', text: 'Free towel rental and 10 guest passes per year' }
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L15',
        section: 'listening',
        part: 2,
        question_text: '15. Silver Standard Pass benefit:',
        question_type: 'matching',
        matching_options: [
          { id: 'A', text: 'Includes unlimited personal coaching and sauna access' },
          { id: 'B', text: 'Off-peak access on weekdays before 14:00 only' },
          { id: 'C', text: 'Free towel rental and 10 guest passes per year' }
        ],
        correct_answer: 'C',
        max_score: 1
      },
      {
        question_id: 'L16',
        section: 'listening',
        part: 2,
        question_text: '16. Bronze Off-Peak Pass benefit:',
        question_type: 'matching',
        matching_options: [
          { id: 'A', text: 'Includes unlimited personal coaching and sauna access' },
          { id: 'B', text: 'Off-peak access on weekdays before 14:00 only' },
          { id: 'C', text: 'Free towel rental and 10 guest passes per year' }
        ],
        correct_answer: 'B',
        max_score: 1
      },
      {
        question_id: 'L17',
        section: 'listening',
        part: 2,
        question_text: '17. What new facility was added to the complex during recent renovation?',
        question_type: 'multiple_choice',
        options: ['A. Outdoor climbing wall', 'B. Hydrotherapy spa bath', 'C. Rooftop running track'],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L18',
        section: 'listening',
        part: 2,
        question_text: '18. Locker padlocks can be borrowed with a refundable deposit of $________.',
        question_type: 'short_answer_questions',
        word_limit: 'A NUMBER',
        correct_answer: '5',
        max_score: 1
      },
      {
        question_id: 'L19',
        section: 'listening',
        part: 2,
        question_text: '19. Parking is free for all members for up to ________ hours per visit.',
        question_type: 'sentence_completion',
        word_limit: 'A NUMBER',
        correct_answer: '3',
        max_score: 1
      },
      {
        question_id: 'L20',
        section: 'listening',
        part: 2,
        question_text: '20. Fitness classes must be booked via the mobile app at least ________ hours in advance.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'A NUMBER',
        correct_answer: '24',
        max_score: 1
      },

      // LISTENING (PART 3: Q21 - Q30)
      {
        question_id: 'L21',
        section: 'listening',
        part: 3,
        question_text: '21. What was the main finding of the students\' environmental survey?',
        question_type: 'multiple_choice',
        options: [
          'A. Microplastic concentration increased near river estuaries',
          'B. Local recycling compliance fell below regional targets',
          'C. Public awareness of biodegradable plastics was high'
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L22',
        section: 'listening',
        part: 3,
        question_text: '22. Which TWO sampling methods did the research team utilize?',
        question_type: 'multiple_choice_multi',
        options: [
          'A. Surface manta trawl netting',
          'B. Deep sediment core drilling',
          'C. Aerial infrared drone imagery',
          'D. Water column filtration pumps',
          'E. Satellite thermal imaging'
        ],
        correct_answer: 'A, D',
        max_score: 1
      },
      {
        question_id: 'L23',
        section: 'listening',
        part: 3,
        question_text: '23. Flow-chart: Step 1 involves extracting sediment samples and passing through a 5mm ________.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'SIEVE',
        max_score: 1
      },
      {
        question_id: 'L24',
        section: 'listening',
        part: 3,
        question_text: '24. Flow-chart: Step 2 applies density separation using a saturated ________ solution.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'SALT',
        max_score: 1
      },
      {
        question_id: 'L25',
        section: 'listening',
        part: 3,
        question_text: '25. Flow-chart: Step 3 performs spectroscopic identification using ________ microscopy.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'INFRARED',
        max_score: 1
      },
      {
        question_id: 'L26',
        section: 'listening',
        part: 3,
        question_text: '26. What limitation did the academic supervisor highlight regarding their statistical sample?',
        question_type: 'multiple_choice',
        options: [
          'A. Seasonal weather changes were not accounted for',
          'B. The laboratory equipment was uncalibrated',
          'C. Sample sizes were too small in rural testing zones'
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L27',
        section: 'listening',
        part: 3,
        question_text: '27. The project presentation slides will be uploaded by next ________ morning.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'FRIDAY',
        max_score: 1
      },
      {
        question_id: 'L28',
        section: 'listening',
        part: 3,
        question_text: '28. Match task to student: Chemical reagents preparation',
        question_type: 'matching',
        matching_options: [{ id: 'A', text: 'Liam' }, { id: 'B', text: 'Emma' }, { id: 'C', text: 'Liam and Emma together' }],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L29',
        section: 'listening',
        part: 3,
        question_text: '29. Match task to student: Statistical data visualization charts',
        question_type: 'matching',
        matching_options: [{ id: 'A', text: 'Liam' }, { id: 'B', text: 'Emma' }, { id: 'C', text: 'Liam and Emma together' }],
        correct_answer: 'B',
        max_score: 1
      },
      {
        question_id: 'L30',
        section: 'listening',
        part: 3,
        question_text: '30. Match task to student: Final bibliography and citations audit',
        question_type: 'matching',
        matching_options: [{ id: 'A', text: 'Liam' }, { id: 'B', text: 'Emma' }, { id: 'C', text: 'Liam and Emma together' }],
        correct_answer: 'C',
        max_score: 1
      },

      // LISTENING (PART 4: Q31 - Q40)
      {
        question_id: 'L31',
        section: 'listening',
        part: 4,
        question_text: '31. Lecture: Urban microclimate warming is intensified by the low ________ of asphalt surfaces.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'ALBEDO',
        max_score: 1
      },
      {
        question_id: 'L32',
        section: 'listening',
        part: 4,
        question_text: '32. Vegetated green roofs decrease building cooling demands through ________ cooling.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'EVAPORATIVE',
        max_score: 1
      },
      {
        question_id: 'L33',
        section: 'listening',
        part: 4,
        question_text: '33. Porous concrete pavements facilitate stormwater infiltration and recharge local ________.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'AQUIFERS',
        max_score: 1
      },
      {
        question_id: 'L34',
        section: 'listening',
        part: 4,
        question_text: '34. Urban tree canopies filter harmful airborne particulate matter known as PM________.',
        question_type: 'short_answer_questions',
        word_limit: 'A NUMBER OR CODE',
        correct_answer: '2.5',
        max_score: 1
      },
      {
        question_id: 'L35',
        section: 'listening',
        part: 4,
        question_text: '35. Wind corridor design in high-density districts prevents the accumulation of vehicular ________.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'EMISSIONS',
        max_score: 1
      },
      {
        question_id: 'L36',
        section: 'listening',
        part: 4,
        question_text: '36. Highly reflective building coatings are manufactured using titanium ________ nanoparticles.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'DIOXIDE',
        max_score: 1
      },
      {
        question_id: 'L37',
        section: 'listening',
        part: 4,
        question_text: '37. In Singapore, biophilic building guidelines require a green replacement ratio of ________ percent.',
        question_type: 'sentence_completion',
        word_limit: 'A NUMBER',
        correct_answer: '100',
        max_score: 1
      },
      {
        question_id: 'L38',
        section: 'listening',
        part: 4,
        question_text: '38. Pocket parks located within 300 meters of residences enhance community mental ________.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'HEALTH',
        max_score: 1
      },
      {
        question_id: 'L39',
        section: 'listening',
        part: 4,
        question_text: '39. Urban cooling initiatives produce economic benefits by reducing electrical peak ________.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'DEMAND',
        max_score: 1
      },
      {
        question_id: 'L40',
        section: 'listening',
        part: 4,
        question_text: '40. Municipal zoning ordinances must balance thermal mitigation with infrastructure ________ costs.',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'MAINTENANCE',
        max_score: 1
      },

      // READING QUESTIONS (PASSAGE 1: Q1 - Q13)
      {
        question_id: 'R1',
        section: 'reading',
        passage_index: 1,
        question_text: '1. Which paragraph contains information regarding the initial 6% efficiency of early photovoltaic cells?',
        question_type: 'matching_information',
        options: ['Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D'],
        correct_answer: 'B',
        max_score: 1
      },
      {
        question_id: 'R2',
        section: 'reading',
        passage_index: 1,
        question_text: '2. Between 2010 and 2020, the levelized cost of solar energy dropped by nearly 85%.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R3',
        section: 'reading',
        passage_index: 1,
        question_text: '3. What technology is deployed alongside green hydrogen to resolve renewable energy intermittency?',
        question_type: 'sentence_completion',
        word_limit: 'NO MORE THAN THREE WORDS',
        correct_answer: 'LITHIUM-ION BATTERY',
        max_score: 1
      },
      {
        question_id: 'R4',
        section: 'reading',
        passage_index: 1,
        question_text: '4. Germany and China utilized government feed-in tariffs to scale up manufacturing capacity.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R5',
        section: 'reading',
        passage_index: 1,
        question_text: '5. Modern offshore wind turbines can produce electricity output exceeding 15 megawatts.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R6',
        section: 'reading',
        passage_index: 1,
        question_text: '6. The Industrial Revolution completely eliminated fossil fuel reliance.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      },
      {
        question_id: 'R7',
        section: 'reading',
        passage_index: 1,
        question_text: '7. Solar panels are capable of generating peak electrical power during nighttime hours.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      },
      {
        question_id: 'R8',
        section: 'reading',
        passage_index: 1,
        question_text: '8. In which country did modern wind turbines gain traction during the 1970s oil crisis?',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'DENMARK',
        max_score: 1
      },
      {
        question_id: 'R9',
        section: 'reading',
        passage_index: 1,
        question_text: '9. What energy storage acronym is used in the text to describe large-scale battery facilities?',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD (ACRONYM)',
        correct_answer: 'BESS',
        max_score: 1
      },
      {
        question_id: 'R10',
        section: 'reading',
        passage_index: 1,
        question_text: '10. Summary: Early human industry relied principally on wood, wind, and ________ power.',
        question_type: 'summary_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'WATER',
        max_score: 1
      },
      {
        question_id: 'R11',
        section: 'reading',
        passage_index: 1,
        question_text: '11. Summary: In 1954, photovoltaic development began at Bell ________.',
        question_type: 'summary_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'LABS',
        max_score: 1
      },
      {
        question_id: 'R12',
        section: 'reading',
        passage_index: 1,
        question_text: '12. Which paragraph discusses economic subsidies and drastic reductions in solar panel prices?',
        question_type: 'matching_information',
        options: ['Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D'],
        correct_answer: 'C',
        max_score: 1
      },
      {
        question_id: 'R13',
        section: 'reading',
        passage_index: 1,
        question_text: '13. What is the primary obstacle to continuous renewable power availability mentioned in Paragraph D?',
        question_type: 'multiple_choice',
        options: [
          'A. Energy intermittency and night/weather dependency',
          'B. Scarcity of silicon raw material supplies',
          'C. Complete refusal of regional governments to connect power grids',
          'D. Danger of hydrogen fuel leakage in household appliances'
        ],
        correct_answer: 'A',
        max_score: 1
      },

      // READING QUESTIONS (PASSAGE 2: Q14 - Q26)
      {
        question_id: 'R14',
        section: 'reading',
        passage_index: 2,
        question_text: '14. Match heading for Paragraph A:',
        question_type: 'matching_headings',
        headings_list: [
          { id: 'i', text: 'The global oceanic heat distribution engine' },
          { id: 'ii', text: 'Biological mixing generated by diving megafauna' },
          { id: 'iii', text: 'Human impacts and sharp population collapses' },
          { id: 'iv', text: 'International marine sanctuaries and legal corridors' }
        ],
        correct_answer: 'i',
        max_score: 1
      },
      {
        question_id: 'R15',
        section: 'reading',
        passage_index: 2,
        question_text: '15. Match heading for Paragraph B:',
        question_type: 'matching_headings',
        headings_list: [
          { id: 'i', text: 'The global oceanic heat distribution engine' },
          { id: 'ii', text: 'Biological mixing generated by diving megafauna' },
          { id: 'iii', text: 'Human impacts and sharp population collapses' },
          { id: 'iv', text: 'International marine sanctuaries and legal corridors' }
        ],
        correct_answer: 'ii',
        max_score: 1
      },
      {
        question_id: 'R16',
        section: 'reading',
        passage_index: 2,
        question_text: '16. Match heading for Paragraph C:',
        question_type: 'matching_headings',
        headings_list: [
          { id: 'i', text: 'The global oceanic heat distribution engine' },
          { id: 'ii', text: 'Biological mixing generated by diving megafauna' },
          { id: 'iii', text: 'Human impacts and sharp population collapses' },
          { id: 'iv', text: 'International marine sanctuaries and legal corridors' }
        ],
        correct_answer: 'iii',
        max_score: 1
      },
      {
        question_id: 'R17',
        section: 'reading',
        passage_index: 2,
        question_text: '17. Match heading for Paragraph D:',
        question_type: 'matching_headings',
        headings_list: [
          { id: 'i', text: 'The global oceanic heat distribution engine' },
          { id: 'ii', text: 'Biological mixing generated by diving megafauna' },
          { id: 'iii', text: 'Human impacts and sharp population collapses' },
          { id: 'iv', text: 'International marine sanctuaries and legal corridors' }
        ],
        correct_answer: 'iv',
        max_score: 1
      },
      {
        question_id: 'R18',
        section: 'reading',
        passage_index: 2,
        question_text: '18. Thermohaline circulation is driven by gradients in temperature and ________.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'SALINITY',
        max_score: 1
      },
      {
        question_id: 'R19',
        section: 'reading',
        passage_index: 2,
        question_text: '19. Pods of whales dive into the ________ layer to hunt krill.',
        question_type: 'sentence_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'MESOPELAGIC',
        max_score: 1
      },
      {
        question_id: 'R20',
        section: 'reading',
        passage_index: 2,
        question_text: '20. What scientific term describes the upward churning of ocean nutrients by animals?',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'BIOMIXING',
        max_score: 1
      },
      {
        question_id: 'R21',
        section: 'reading',
        passage_index: 2,
        question_text: '21. Pelagic megafauna biomass has fallen by over ________ percent since 1950.',
        question_type: 'sentence_completion',
        word_limit: 'A NUMBER',
        correct_answer: '60',
        max_score: 1
      },
      {
        question_id: 'R22',
        section: 'reading',
        passage_index: 2,
        question_text: '22. What acronym is used in Paragraph D to describe designated marine reserves?',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD (ACRONYM)',
        correct_answer: 'MPAS',
        max_score: 1
      },
      {
        question_id: 'R23',
        section: 'reading',
        passage_index: 2,
        question_text: '23. Match species to characteristic: Leatherback turtles',
        question_type: 'matching_features',
        matching_options: [
          { id: 'A', text: 'Perform vertical dives that generate measurable turbulent energy' },
          { id: 'B', text: 'Generate electricity directly within deep abyssal hydrothermal vents' },
          { id: 'C', text: 'Are immune to ship strikes and plastic pollution' }
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R24',
        section: 'reading',
        passage_index: 2,
        question_text: '24. Match feature: International vessel speed restrictions',
        question_type: 'matching_features',
        matching_options: [
          { id: 'A', text: 'Aims to reduce lethal ship strikes in critical migratory corridors' },
          { id: 'B', text: 'Increases commercial shipping speeds across all oceans' },
          { id: 'C', text: 'Eliminates deep-sea ocean salinity entirely' }
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R25',
        section: 'reading',
        passage_index: 2,
        question_text: '25. Global thermohaline circulation carries heat from polar latitudes toward the equator.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      },
      {
        question_id: 'R26',
        section: 'reading',
        passage_index: 2,
        question_text: '26. Mathematical fluid models show animal mixing power is comparable to tides and wind.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },

      // READING QUESTIONS (PASSAGE 3: Q27 - Q40)
      {
        question_id: 'R27',
        section: 'reading',
        passage_index: 3,
        question_text: '27. Humans are generally more tolerant of algorithmic errors than human mistakes.',
        question_type: 'yes_no_not_given',
        correct_answer: 'NO',
        max_score: 1
      },
      {
        question_id: 'R28',
        section: 'reading',
        passage_index: 3,
        question_text: '28. Dr. Berkeley Dietvorst researched psychological reactions to algorithmic forecasting mistakes.',
        question_type: 'yes_no_not_given',
        correct_answer: 'YES',
        max_score: 1
      },
      {
        question_id: 'R29',
        section: 'reading',
        passage_index: 3,
        question_text: '29. Financial traders never experience algorithm aversion in high-frequency trading.',
        question_type: 'yes_no_not_given',
        correct_answer: 'NOT GIVEN',
        max_score: 1
      },
      {
        question_id: 'R30',
        section: 'reading',
        passage_index: 3,
        question_text: '30. Allowing users to make minor adjustments to AI outputs increases user satisfaction.',
        question_type: 'yes_no_not_given',
        correct_answer: 'YES',
        max_score: 1
      },
      {
        question_id: 'R31',
        section: 'reading',
        passage_index: 3,
        question_text: '31. What percentage adjustment margin was shown to significantly increase algorithmic trust?',
        question_type: 'short_answer_questions',
        word_limit: 'NO MORE THAN TWO WORDS',
        correct_answer: '2 TO 5 PERCENT',
        max_score: 1
      },
      {
        question_id: 'R32',
        section: 'reading',
        passage_index: 3,
        question_text: '32. What acronym stands for Explainable Artificial Intelligence in software design?',
        question_type: 'short_answer_questions',
        word_limit: 'ONE WORD (ACRONYM)',
        correct_answer: 'XAI',
        max_score: 1
      },
      {
        question_id: 'R33',
        section: 'reading',
        passage_index: 3,
        question_text: '33. Summary: The psychological bias against computational mistakes is termed algorithm ________.',
        question_type: 'summary_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'AVERSION',
        max_score: 1
      },
      {
        question_id: 'R34',
        section: 'reading',
        passage_index: 3,
        question_text: '34. Summary: Granting users a feeling of psychological ________ reduces resentment toward AI.',
        question_type: 'summary_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'OWNERSHIP',
        max_score: 1
      },
      {
        question_id: 'R35',
        section: 'reading',
        passage_index: 3,
        question_text: '35. Summary: Providing causal explanations helps domain ________ adopt AI recommendations.',
        question_type: 'summary_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'PROFESSIONALS',
        max_score: 1
      },
      {
        question_id: 'R36',
        section: 'reading',
        passage_index: 3,
        question_text: '36. Match sentence ending: When users witness an algorithmic tool commit a minor mistake...',
        question_type: 'matching_sentence_endings',
        matching_options: [
          { id: 'A', text: 'they rapidly lose confidence even if the algorithm outperforms human peers.' },
          { id: 'B', text: 'they immediately double their financial investment in the system.' },
          { id: 'C', text: 'they completely disable all firewall protections.' }
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R37',
        section: 'reading',
        passage_index: 3,
        question_text: '37. Match sentence ending: Incorporating explainable AI frameworks...',
        question_type: 'matching_sentence_endings',
        matching_options: [
          { id: 'A', text: 'fulfills an essential ergonomic and cognitive necessity for human integration.' },
          { id: 'B', text: 'guarantees that software will never make computational errors.' },
          { id: 'C', text: 'causes algorithms to run significantly slower on all servers.' }
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R38',
        section: 'reading',
        passage_index: 3,
        question_text: '38. What fields are automated AI systems actively deployed in according to Paragraph A?',
        question_type: 'multiple_choice',
        options: [
          'A. Judicial sentencing, medical diagnosis, and credit allocation',
          'B. Traditional woodworking and manual agriculture exclusively',
          'C. Deep oceanic exploration without human supervision',
          'D. Space station exterior maintenance'
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R39',
        section: 'reading',
        passage_index: 3,
        question_text: '39. Why do users appreciate being able to slightly modify algorithmic outputs?',
        question_type: 'multiple_choice',
        options: [
          'A. It restores a feeling of autonomy and control',
          'B. It deletes the computer code from server disks',
          'C. It speeds up electrical battery recharging',
          'D. It avoids paying software subscription fees'
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'R40',
        section: 'reading',
        passage_index: 3,
        question_text: '40. What is the ultimate objective of Explainable AI (XAI) according to the conclusion?',
        question_type: 'multiple_choice',
        options: [
          'A. To provide transparent causal reasons that build healthy professional trust',
          'B. To replace all doctors and judges with robot hardware',
          'C. To eliminate the need for human training and education',
          'D. To hide computational processes behind secret algorithms'
        ],
        correct_answer: 'A',
        max_score: 1
      }
    ]
  },
  {
    exam_code: 'IELTS01',
    title: 'IELTS Academic Official Examination 01 (Full 4-Skills)',
    test_type: 'TEST',
    duration_mins: 150,
    listening_duration_mins: 35,
    reading_duration_mins: 60,
    writing_duration_mins: 60,
    audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=english-conversation-11823.mp3',
    audio_title: 'IELTS Listening Parts 1 - 4 Comprehensive Audio Stream',
    passages: [
      {
        passage_index: 1,
        title: 'Passage 1: The History and Evolution of Renewable Energy Technologies',
        text: `Paragraph A
For centuries, human civilization relied almost exclusively on wood, wind, and water power to drive mills, pump water, and navigate the seas. However, the Industrial Revolution ushered in an era dominated by fossil fuels—coal, oil, and natural gas.

Paragraph B
In the mid-20th century, scientists began sounding alarm bells regarding resource depletion. Early photovoltaic (PV) solar cells were developed in 1954 at Bell Labs, operating at 6% efficiency.

Paragraph C
Government subsidies and feed-in tariffs in Germany and China expanded manufacturing scale. The cost of solar plummeted by nearly 85% between 2010 and 2020.

Paragraph D
To overcome intermittency, advanced lithium-ion battery energy storage systems (BESS) and green hydrogen generation are being deployed worldwide.`
      },
      {
        passage_index: 2,
        title: 'Passage 2: Marine Megafauna and Ocean Thermohaline Circulation',
        text: `Paragraph A
The world ocean functions as a giant convective thermal engine. Driven by gradients in temperature and salinity, the global thermohaline circulation (THC) redistributes immense quantities of heat from equatorial waters toward polar latitudes.

Paragraph B
Recent satellite telemetry reveals that large pelagic organisms—such as blue whales, leatherback turtles, and basking sharks—exert measurable biophysical effects on oceanic mixing.

Paragraph C
Biologists term this phenomenon 'biomixing'. Anthropogenic overfishing, plastic ingestion, and ship strikes have reduced pelagic megafauna biomass by over 60% since 1950.

Paragraph D
Marine protected areas (MPAs) spanning international migratory corridors are vital to preserving this biological nutrient pump.`
      },
      {
        passage_index: 3,
        title: 'Passage 3: The Psychology of Algorithmic Decision-Making and Human Trust',
        text: `Paragraph A
As automated artificial intelligence systems assume decisive roles in judicial sentencing, medical diagnosis, and credit allocation, behavioral scientists are interrogating the psychological mechanisms underpinning human trust in algorithms.

Paragraph B
Experiments conducted by Dr. Berkeley Dietvorst demonstrate that participants who observed an algorithmic forecasting tool make a minor mathematical mistake immediately lost confidence in the system.

Paragraph C
Conversely, when algorithmic user interfaces permit humans to modify the software's output—even by a trivial margin of 2 to 5 percent—user satisfaction and algorithmic compliance increase exponentially.

Paragraph D
Designing transparent explainable AI (XAI) frameworks is therefore not merely a technical software objective, but an ergonomic and psychological imperative.`
      }
    ],
    reading_passage_title: 'Passage 1: The History and Evolution of Renewable Energy Technologies',
    reading_passage: `Paragraph A\nFor centuries, human civilization relied almost exclusively on wood, wind, and water power. However, the Industrial Revolution ushered in an era dominated by fossil fuels—coal, oil, and natural gas.`,
    writing_task1_prompt: 'The chart below shows the total global renewable energy investment (in billion USD) and capacity addition between 2010 and 2024. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. (Write at least 150 words)',
    writing_task1_image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80',
    writing_task2_prompt: 'Some people believe that government funding should be devoted exclusively to renewable energy development, while others argue that fossil fuels should continue to receive subsidies to maintain low energy prices for low-income households. Discuss both views and give your own opinion. (Write at least 250 words)',
    questions: [
      {
        question_id: 'L1',
        section: 'listening',
        part: 1,
        question_text: '1. What is the main purpose of the visitor\'s inquiry at the student center?',
        question_type: 'multiple_choice',
        options: [
          'A. To register for a university accommodation placement',
          'B. To request a course transfer to the engineering department',
          'C. To inquire about campus library opening hours'
        ],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L2',
        section: 'listening',
        part: 1,
        question_text: '2. Form Completion: Maximum contract duration is ________ months.',
        question_type: 'form_note_table_flowchart_completion',
        instruction: 'Write ONE WORD ONLY AND/OR A NUMBER.',
        word_limit: 'A NUMBER',
        correct_answer: '12',
        max_score: 1
      },
      {
        question_id: 'L3',
        section: 'listening',
        part: 1,
        question_text: '3. Rent payment includes internet connectivity and utility bills.',
        question_type: 'multiple_choice',
        options: ['A. All utilities included', 'B. Electricity paid separately', 'C. Internet requires extra fee'],
        correct_answer: 'A',
        max_score: 1
      },
      {
        question_id: 'L4',
        section: 'listening',
        part: 1,
        question_text: '4. The student must submit their deposit before July ________.',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'A NUMBER',
        correct_answer: '15',
        max_score: 1
      },
      {
        question_id: 'L5',
        section: 'listening',
        part: 1,
        question_text: '5. Student Surname: ________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'WILKINSON',
        max_score: 1
      },
      {
        question_id: 'L6',
        section: 'listening',
        part: 1,
        question_text: '6. Room type chosen: Single en-suite with shared ________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'KITCHEN',
        max_score: 1
      },
      {
        question_id: 'L7',
        section: 'listening',
        part: 1,
        question_text: '7. Monthly accommodation fee: £________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'A NUMBER',
        correct_answer: '650',
        max_score: 1
      },
      {
        question_id: 'L8',
        section: 'listening',
        part: 1,
        question_text: '8. Catering preference: Self-catered with communal dining access.',
        question_type: 'multiple_choice',
        options: ['A. Fully catered', 'B. Self-catered', 'C. Half-board meal plan'],
        correct_answer: 'B',
        max_score: 1
      },
      {
        question_id: 'L9',
        section: 'listening',
        part: 1,
        question_text: '9. Emergency contact relationship: ________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'UNCLE',
        max_score: 1
      },
      {
        question_id: 'L10',
        section: 'listening',
        part: 1,
        question_text: '10. Distance from campus: approximately 15 minutes by ________',
        question_type: 'form_note_table_flowchart_completion',
        word_limit: 'ONE WORD ONLY',
        correct_answer: 'BICYCLE',
        max_score: 1
      },
      {
        question_id: 'R1',
        section: 'reading',
        passage_index: 1,
        question_text: '1. For centuries prior to the Industrial Revolution, human society relied primarily on fossil fuels.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      },
      {
        question_id: 'R2',
        section: 'reading',
        passage_index: 1,
        question_text: '2. The photovoltaic solar cells developed in 1954 at Bell Labs achieved over 20% conversion efficiency.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      },
      {
        question_id: 'R3',
        section: 'reading',
        passage_index: 1,
        question_text: '3. Between 2010 and 2020, the levelized cost of energy (LCOE) for solar fell by roughly 85 percent.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R4',
        section: 'reading',
        passage_index: 1,
        question_text: '4. Battery energy storage systems (BESS) are designed to help overcome renewable energy intermittency.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R5',
        section: 'reading',
        passage_index: 1,
        question_text: '5. Modern offshore wind turbines can reach capacities exceeding 15 megawatts.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R6',
        section: 'reading',
        passage_index: 2,
        question_text: '6. The global thermohaline circulation (THC) is driven by temperature and salinity differences.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R7',
        section: 'reading',
        passage_index: 2,
        question_text: '7. Pelagic megafauna biomass has increased significantly over the past 70 years.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      },
      {
        question_id: 'R8',
        section: 'reading',
        passage_index: 3,
        question_text: '8. Algorithm aversion describes human tendency to quickly lose confidence after software mistakes.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R9',
        section: 'reading',
        passage_index: 3,
        question_text: '9. Allowing humans to slightly modify an algorithmic prediction increases their satisfaction.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'R10',
        section: 'reading',
        passage_index: 3,
        question_text: '10. Explainable AI aims to replace human expert oversight entirely in critical fields.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      }
    ]
  },
  {
    exam_code: 'WT1003',
    title: 'IELTS Writing Task 1 & 2 Practice Paper (Set WT1003)',
    test_type: 'PRACTICE',
    duration_mins: 60,
    listening_duration_mins: 0,
    reading_duration_mins: 0,
    writing_duration_mins: 60,
    passages: [],
    writing_task1_prompt: 'The charts below show the comparison of water usage for domestic, industrial, and agricultural purposes across different world regions. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
    writing_task1_image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=60',
    writing_task2_prompt: 'In many countries, an increasing number of students choose to take a gap year before entering university, either to work or travel. Do you think the advantages of taking a gap year outweigh the disadvantages? Give reasons for your answer and include relevant examples. Write at least 250 words.',
    questions: []
  },
  {
    exam_code: 'WT1001',
    title: 'IELTS Writing Task 1 & 2 Practice Paper (Set WT1001)',
    test_type: 'PRACTICE',
    duration_mins: 60,
    listening_duration_mins: 0,
    reading_duration_mins: 0,
    writing_duration_mins: 60,
    passages: [],
    writing_task1_prompt: 'The graph below shows the proportion of energy generated from renewable sources in four European nations between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
    writing_task1_image: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&auto=format&fit=crop&q=60',
    writing_task2_prompt: 'Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university should be to give access to knowledge for its own sake, regardless of whether the course is useful to an employer. What, in your opinion, should be the main function of a university? Write at least 250 words.',
    questions: []
  },
  {
    exam_code: 'WT1004',
    title: 'IELTS Academic Writing One-Skill Retake (Set WT1004)',
    test_type: 'PRACTICE',
    exam_type: 'one_skill',
    skills: ['writing'],
    retakeMode: true,
    targetSkill: 'writing',
    duration_mins: 60,
    listening_duration_mins: 0,
    reading_duration_mins: 0,
    writing_duration_mins: 60,
    passages: [],
    writing_task1_prompt: "The charts below show the number of Japanese tourists travelling abroad between 1985 and 1995 and Australia's share of the Japanese tourist market.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
    writing_task1_image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=60',
    writing_task1_image_url: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=60',
    writing_task1_imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=60',
    writing_task2_prompt: 'Some people believe that international tourism brings only positive benefits to host countries, while others argue that it causes environmental and cultural harm. Discuss both views and give your own opinion.\n\nWrite at least 250 words.',
    questions: []
  },
  {
    exam_code: 'RW2001',
    title: 'IELTS Academic Reading & Writing Dual-Skill Paper (Set RW2001)',
    test_type: 'PRACTICE',
    exam_type: 'two_skills',
    skills: ['reading', 'writing'],
    duration_mins: 120,
    listening_duration_mins: 0,
    reading_duration_mins: 60,
    writing_duration_mins: 60,
    passage_title: 'The Evolution of Modern Artificial Intelligence',
    passage_text: 'Artificial intelligence (AI) has developed rapidly over the past decade, moving from narrow machine learning models to multimodal foundational models capable of human-level reasoning across complex tasks.\n\nIn medicine, deep neural networks are increasingly employed to assist radiologists in detecting malignancies with unprecedented accuracy. Autonomous systems are revolutionizing logistical supply chains, optimizing freight routes and reducing carbon emissions globally.\n\nHowever, ethical concerns regarding data governance, algorithmic bias, and cognitive dependency remain active areas of public and regulatory debate.',
    passages: [
      {
        passage_index: 1,
        title: 'The Evolution of Modern Artificial Intelligence',
        text: 'Artificial intelligence (AI) has developed rapidly over the past decade, moving from narrow machine learning models to multimodal foundational models capable of human-level reasoning across complex tasks.\n\nIn medicine, deep neural networks are increasingly employed to assist radiologists in detecting malignancies with unprecedented accuracy. Autonomous systems are revolutionizing logistical supply chains, optimizing freight routes and reducing carbon emissions globally.\n\nHowever, ethical concerns regarding data governance, algorithmic bias, and cognitive dependency remain active areas of public and regulatory debate.',
        questions: []
      }
    ],
    writing_task1_prompt: "The bar chart illustrates the percentage of global corporate investment in artificial intelligence, cloud infrastructure, and cybersecurity between 2018 and 2024.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
    writing_task1_image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    writing_task1_image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    writing_task1_imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    writing_task2_prompt: 'With the rapid advancement of artificial intelligence, many routine white-collar jobs are being automated. Some argue this will cause widespread unemployment, while others believe AI will generate new higher-value industries. Discuss both views and give your opinion.\n\nWrite at least 250 words.',
    questions: [
      {
        question_id: 'rw2001_q1',
        question_number: 1,
        section: 'reading',
        passage_index: 1,
        question_text: '1. AI algorithms are currently used in hospitals to aid in detecting health conditions.',
        question_type: 'true_false_not_given',
        correct_answer: 'TRUE',
        max_score: 1
      },
      {
        question_id: 'rw2001_q2',
        question_number: 2,
        section: 'reading',
        passage_index: 1,
        question_text: '2. All governments have established uniform worldwide standards for AI regulation.',
        question_type: 'true_false_not_given',
        correct_answer: 'FALSE',
        max_score: 1
      }
    ]
  }
];

export const DEFAULT_EXAMS: Exam[] = RAW_DEFAULT_EXAMS.map(exam => {
  const allQs = exam.questions || [];
  const passages = (exam.passages || []).map((p: any) => {
    const pQs = allQs.filter((q: any) => 
      q.section === 'reading' && 
      (q.passage_index === p.passage_index || (!q.passage_index && p.passage_index === 1))
    );
    return {
      passage_index: p.passage_index as 1 | 2 | 3,
      title: p.title || `Reading Passage ${p.passage_index}`,
      text: p.text || '',
      questions: (p.questions && p.questions.length > 0 ? p.questions : pQs)
    };
  });

  const listeningQs = allQs.filter((q: any) => q.section === 'listening');
  const readingQs = allQs.filter((q: any) => q.section === 'reading');

  const resolvedT1Img = exam.writing_task1_image || 
    (exam as any).writing_task1_image_url || 
    (exam as any).writing_task1_imageUrl || 
    (exam as any).image_url || 
    (exam as any).imageUrl || 
    '';

  const sections: any[] = [];
  if (listeningQs.length > 0 || exam.audio_url) {
    sections.push({
      skill: 'listening',
      title: 'IELTS Listening Section',
      durationMinutes: exam.listening_duration_mins || 35,
      audioUrl: exam.audio_url || '',
      questions: listeningQs
    });
  }

  if (readingQs.length > 0 || passages.length > 0) {
    sections.push({
      skill: 'reading',
      title: 'IELTS Reading Section',
      durationMinutes: exam.reading_duration_mins || 60,
      passages: passages,
      questions: readingQs
    });
  }

  if (exam.writing_task1_prompt || exam.writing_task2_prompt || resolvedT1Img) {
    sections.push({
      skill: 'writing',
      title: 'IELTS Academic Writing Section',
      durationMinutes: exam.writing_duration_mins || 60,
      tasks: [
        {
          id: 'task-1',
          task_number: 1,
          title: 'Writing Task 1 (Report)',
          prompt: exam.writing_task1_prompt || '',
          image_url: resolvedT1Img,
          imageUrl: resolvedT1Img,
          min_words: 150,
          suggested_time_minutes: 20
        },
        {
          id: 'task-2',
          task_number: 2,
          title: 'Writing Task 2 (Essay)',
          prompt: exam.writing_task2_prompt || '',
          min_words: 250,
          suggested_time_minutes: 40
        }
      ]
    });
  }

  const detectedSkills = [];
  if (listeningQs.length > 0 || exam.audio_url) detectedSkills.push('listening');
  if (readingQs.length > 0 || passages.length > 0) detectedSkills.push('reading');
  if (exam.writing_task1_prompt || exam.writing_task2_prompt) detectedSkills.push('writing');

  const isOneSkill = (exam as any).exam_type === 'one_skill' || (exam as any).retakeMode || detectedSkills.length === 1;

  return {
    ...exam,
    exam_type: (exam as any).exam_type || (detectedSkills.length === 1 ? 'one_skill' : detectedSkills.length === 2 ? 'two_skills' : 'full_test'),
    skills: (exam as any).skills || detectedSkills,
    retakeMode: (exam as any).retakeMode ?? (isOneSkill && detectedSkills.includes('writing')),
    targetSkill: (exam as any).targetSkill || (isOneSkill ? detectedSkills[0] : undefined),
    passages,
    listening_questions: listeningQs,
    reading_questions: readingQs,
    questions: allQs,
    sections,
    writing_task1_image: resolvedT1Img,
    writing_task1_image_url: resolvedT1Img,
    writing_task1_imageUrl: resolvedT1Img,
    image_url: resolvedT1Img,
    imageUrl: resolvedT1Img
  } as Exam;
});

export default DEFAULT_EXAMS;

