import { CustomPracticeDeck } from '../types/practice';

export const STARTER_PRACTICE_DECKS: CustomPracticeDeck[] = [
  {
    deck_id: 'ON_TAP_01',
    title: 'General English & High-Frequency Academic Vocabulary',
    category: 'Vocabulary',
    description: 'Master core academic vocabulary, context recognition, and essential lexical combinations for IELTS.',
    target_language: 'English',
    native_language: 'English',
    level: 'B1-B2',
    icon: 'Sparkles',
    cover_gradient: 'from-indigo-600 via-purple-600 to-pink-500',
    cards: [
      {
        id: 'c1',
        sentence_en: 'The government has implemented stricter regulations to _____ industrial air pollution.',
        sentence_vi: 'The state authorities enacted stricter policies to restrain and control industrial smog and emissions.',
        cloze_target: 'curb',
        target_word: 'curb',
        part_of_speech: 'verb',
        phonetic: '/kɜːb/',
        hints: 'to restrain, limit, or keep in check (verb)',
        accepted_answers: ['curb', 'limit', 'reduce'],
        explanation: 'The collocation "curb pollution" is a high-frequency academic combination. A bare infinitive follows the "to-infinitive of purpose".',
        grammar_points: [
          'Collocation: curb pollution / curb emissions',
          'Grammar: To-infinitive of purpose (to + V-bare)',
          'Synonyms: restrain, suppress, restrict'
        ],
        options: ['curb', 'curbed', 'curbing', 'curbment'],
        difficulty: 'medium'
      },
      {
        id: 'c2',
        sentence_en: 'Renewable energy plays a _____ role in combating global climate change.',
        sentence_vi: 'Sustainable energy sources hold a crucial, decisive position in the fight against planetary warming.',
        cloze_target: 'pivotal',
        target_word: 'pivotal',
        part_of_speech: 'adjective',
        phonetic: '/ˈpɪv.ə.təl/',
        hints: 'crucial, central, or of vital importance (adjective)',
        accepted_answers: ['pivotal', 'crucial', 'vital', 'key'],
        explanation: '"Play a pivotal role in" is an essential academic phrase meaning to have a central, decisive influence.',
        grammar_points: [
          'Collocation: play a pivotal role in + V-ing / Noun',
          'Syntax: Attributive adjective preceding the noun "role"',
          'Synonyms: crucial, vital, paramount'
        ],
        options: ['pivotal', 'pivot', 'pivotally', 'pivoting'],
        difficulty: 'easy'
      },
      {
        id: 'c3',
        sentence_en: 'Many young graduates struggle to _____ the gap between theoretical knowledge and practical workplace skills.',
        sentence_vi: 'Recent university leavers often find it challenging to connect formal academic theory with real-world job skills.',
        cloze_target: 'bridge',
        target_word: 'bridge',
        part_of_speech: 'verb',
        phonetic: '/brɪdʒ/',
        hints: 'to connect, reconcile, or close a divide (verb)',
        accepted_answers: ['bridge', 'close', 'narrow'],
        explanation: 'The standard collocation "bridge the gap" denotes connecting or reducing disparity between two disparate areas.',
        grammar_points: [
          'Collocation: bridge the gap between A and B',
          'Structure: struggle to + V-bare',
          'Context: Education & employment'
        ],
        options: ['bridge', 'bridged', 'bridging', 'bridges'],
        difficulty: 'medium'
      },
      {
        id: 'c4',
        sentence_en: 'The scientist conducted several experiments to _____ the hypotheses proposed last year.',
        sentence_vi: 'The researcher carried out multiple trials to prove and provide solid evidence for last year’s scientific conjectures.',
        cloze_target: 'substantiate',
        target_word: 'substantiate',
        part_of_speech: 'verb',
        phonetic: '/səbˈstæn.ʃi.eɪt/',
        hints: 'to prove, verify, or support with evidence (verb)',
        accepted_answers: ['substantiate', 'verify', 'prove', 'validate'],
        explanation: '"Substantiate a hypothesis / claim" means to supply factual evidence in order to validate a proposition.',
        grammar_points: [
          'Word class: Infinitive verb following to-infinitive',
          'Reduced relative clause: "hypotheses proposed last year" = "hypotheses that were proposed..."',
          'Word family: Substantial (adj), Substance (noun)'
        ],
        options: ['substantiate', 'substantial', 'substantiation', 'substantially'],
        difficulty: 'hard'
      },
      {
        id: 'c5',
        sentence_en: 'Prolonged exposure to excessive screen time can be _____ to children\'s cognitive development.',
        sentence_vi: 'Extended duration spent in front of digital displays can exert harmful effects on young people’s mental growth.',
        cloze_target: 'detrimental',
        target_word: 'detrimental',
        part_of_speech: 'adjective',
        phonetic: '/ˌdet.rɪˈmen.təl/',
        hints: 'causing harm or damage; adverse (adjective)',
        accepted_answers: ['detrimental', 'harmful', 'damaging', 'adverse'],
        explanation: '"Be detrimental to something" is an academic adjective phrase denoting a damaging or adverse impact.',
        grammar_points: [
          'Preposition: detrimental TO something (do not use with or for)',
          'Pattern: be + adjective + to + noun phrase',
          'Antonyms: beneficial, advantageous'
        ],
        options: ['detrimental', 'detriment', 'detrimentally', 'detriments'],
        difficulty: 'medium'
      },
      {
        id: 'c6',
        sentence_en: 'The local community took the _____ to launch a city-wide recycling initiative.',
        sentence_vi: 'Local residents acted independently and proactively to establish a municipality-wide waste recovery program.',
        cloze_target: 'initiative',
        target_word: 'initiative',
        part_of_speech: 'noun',
        phonetic: '/ɪˈnɪʃ.ə.tɪv/',
        hints: 'the ability or act of taking leadership and decisive action (noun)',
        accepted_answers: ['initiative'],
        explanation: 'The academic idiom "take the initiative" signifies proactively starting a course of action before others do.',
        grammar_points: [
          'Collocation: take the initiative to do something',
          'Word family: Initiate (verb), Initial (adj), Initiative (noun)',
          'Theme: Civic engagement & environment'
        ],
        options: ['initiative', 'initiate', 'initially', 'initiation'],
        difficulty: 'medium'
      },
      {
        id: 'c7',
        sentence_en: 'Economic analysts forecast that inflation will gradually _____ over the next two quarters.',
        sentence_vi: 'Financial experts predict that consumer price spikes will steadily abate and return to moderate levels over the coming months.',
        cloze_target: 'subside',
        target_word: 'subside',
        part_of_speech: 'verb',
        phonetic: '/səbˈsaɪd/',
        hints: 'to become less intense, severe, or active (verb)',
        accepted_answers: ['subside', 'decrease', 'decline', 'moderate'],
        explanation: '"Subside" expresses gradual abatement or decline in intensity for phenomena like inflation, storms, or pain.',
        grammar_points: [
          'Tense: Simple future with modal will + V-bare',
          'Adverbial collocation: gradually subside',
          'Synonyms: abate, diminish, ease off'
        ],
        options: ['subside', 'subsidence', 'subsiding', 'subsided'],
        difficulty: 'hard'
      },
      {
        id: 'c8',
        sentence_en: 'We need to foster an environment where employees feel empowered to express their opinions _____ .',
        sentence_vi: 'Organizations must build a transparent culture where staff feel free to voice their thoughts truthfully and without fear.',
        cloze_target: 'candidly',
        target_word: 'candidly',
        part_of_speech: 'adverb',
        phonetic: '/ˈkæn.dɪd.li/',
        hints: 'frankly, honestly, and directly (adverb)',
        accepted_answers: ['candidly', 'openly', 'frankly', 'freely'],
        explanation: 'The adverb "candidly" post-modifies the verb phrase "express their opinions" to denote honesty and directness.',
        grammar_points: [
          'Syntax: Manner adverb placed after the direct object clause',
          'Word family: Candid (adj), Candor (noun)',
          'Collocation: speak candidly, express candidly'
        ],
        options: ['candidly', 'candid', 'candor', 'candidness'],
        difficulty: 'medium'
      }
    ]
  },
  {
    deck_id: 'GRAMMAR_MASTER',
    title: 'Essential Grammar & Advanced Sentence Structures',
    category: 'Grammar',
    description: 'Master advanced syntactic structures: negative inversion, mixed conditionals, reduced relative clauses, and the subjunctive mood.',
    target_language: 'English',
    native_language: 'English',
    level: 'B1-B2',
    icon: 'BookOpen',
    cover_gradient: 'from-blue-600 via-cyan-600 to-teal-500',
    cards: [
      {
        id: 'g1',
        sentence_en: 'Not until the investigation was completed _____ the authorities reveal the full report.',
        sentence_vi: 'Only after the formal inquiry had concluded did the governing body make the comprehensive findings public.',
        cloze_target: 'did',
        target_word: 'did',
        part_of_speech: 'auxiliary verb',
        phonetic: '/dɪd/',
        hints: 'auxiliary verb for past simple negative inversion',
        accepted_answers: ['did'],
        explanation: 'Negative inversion rule: "Not until + clause/time + auxiliary + subject + main verb". Past simple requires auxiliary "did".',
        grammar_points: [
          'Negative Inversion: Not until + S1 + V1 + Auxiliary + S2 + V2-bare',
          'Past Simple tense: Use "did" with base form "reveal"',
          'Common pitfall: Omitting subject-auxiliary inversion in the main clause'
        ],
        options: ['did', 'had', 'was', 'were'],
        difficulty: 'hard'
      },
      {
        id: 'g2',
        sentence_en: 'If he had followed the doctor\'s advice, he _____ be feeling much better today.',
        sentence_vi: 'Had he adhered to medical guidance in the past, his current physical condition would be significantly improved right now.',
        cloze_target: 'would',
        target_word: 'would',
        part_of_speech: 'modal verb',
        phonetic: '/wʊd/',
        hints: 'modal verb used in mixed conditional for present outcome',
        accepted_answers: ['would', 'might', 'could'],
        explanation: 'Mixed conditional (Type 3-2): An unfulfilled past condition ("had followed") yielding a present hypothetical result ("today -> would + V-bare").',
        grammar_points: [
          'Mixed Conditional (3-2): If + Past Perfect, S + would/could + V-bare (now/today)',
          'Temporal indicator: "today" signals a present result',
          'Contrast: Pure third conditional requires "would have + past participle"'
        ],
        options: ['would', 'would have', 'will', 'had'],
        difficulty: 'hard'
      },
      {
        id: 'g3',
        sentence_en: 'The proposal, _____ by the board of directors yesterday, will take effect next month.',
        sentence_vi: 'The initiative, which received official endorsement from executive leadership yesterday, will become operational soon.',
        cloze_target: 'approved',
        target_word: 'approved',
        part_of_speech: 'past participle',
        phonetic: '/əˈpruːvd/',
        hints: 'passive past participle for reduced relative clause',
        accepted_answers: ['approved', 'ratified', 'passed'],
        explanation: 'Reduced relative clause in passive voice: "which was approved by..." is condensed into the past participle "approved".',
        grammar_points: [
          'Reduced Relative Clause: Passive uses Past Participle (V-ed/V3)',
          'Non-defining relative clause enclosed in commas',
          'Collocation: take effect (become legally active)'
        ],
        options: ['approved', 'approving', 'approve', 'approval'],
        difficulty: 'medium'
      },
      {
        id: 'g4',
        sentence_en: 'It is vital that every participant _____ notified of the schedule changes immediately.',
        sentence_vi: 'It is imperative that all attendees receive prompt notification regarding updates to the timetable.',
        cloze_target: 'be',
        target_word: 'be',
        part_of_speech: 'subjunctive verb',
        phonetic: '/biː/',
        hints: 'subjunctive base form of verb to be in passive construction',
        accepted_answers: ['be', 'should be', 'is'],
        explanation: 'Mandative subjunctive structure: "It is vital/essential/imperative that + subject + (should) + base verb / be + past participle".',
        grammar_points: [
          'Mandative Subjunctive: It is vital that + S + (be/V-bare)',
          'Passive subjunctive form: be + V3 (be notified)',
          'Avoid indicative errors: Do not use "is notified" in formal subjunctive contexts'
        ],
        options: ['be', 'is', 'was', 'being'],
        difficulty: 'hard'
      }
    ]
  },
  {
    deck_id: 'COMMUNICATION_01',
    title: 'Daily Communication & Natural Expressions',
    category: 'Communication',
    description: 'Idiomatic phrases and conversational expressions for academic discussions, collaborative teamwork, and natural spoken fluency.',
    target_language: 'English',
    native_language: 'English',
    level: 'A1-A2',
    icon: 'MessageSquare',
    cover_gradient: 'from-emerald-600 via-teal-600 to-green-500',
    cards: [
      {
        id: 'cm1',
        sentence_en: 'Could you please give me a _____ with these heavy boxes?',
        sentence_vi: 'Would you be kind enough to assist me with transporting these bulky containers?',
        cloze_target: 'hand',
        target_word: 'hand',
        part_of_speech: 'noun',
        phonetic: '/hænd/',
        hints: 'assist someone (idiom: give someone a hand)',
        accepted_answers: ['hand'],
        explanation: 'The idiom "give someone a hand" is a natural, polite conversational phrase meaning to provide assistance.',
        grammar_points: [
          'Idiom: give somebody a hand with something',
          'Polite request formula: Could you please + base verb... ?'
        ],
        options: ['hand', 'arm', 'help', 'finger'],
        difficulty: 'easy'
      },
      {
        id: 'cm2',
        sentence_en: 'I am really looking forward to _____ from you soon.',
        sentence_vi: 'I eagerly anticipate receiving your response and corresponding further in the near future.',
        cloze_target: 'hearing',
        target_word: 'hearing',
        part_of_speech: 'gerund',
        phonetic: '/ˈhɪə.rɪŋ/',
        hints: 'receiving news or a reply (gerund following preposition to)',
        accepted_answers: ['hearing'],
        explanation: 'In the fixed expression "look forward to + V-ing", "to" functions as a preposition requiring a gerund or noun phrase.',
        grammar_points: [
          'Fixed expression: look forward to + V-ing / Noun',
          'Common pitfall: Writing "hear" instead of gerund "hearing"'
        ],
        options: ['hearing', 'hear', 'heard', 'hears'],
        difficulty: 'easy'
      },
      {
        id: 'cm3',
        sentence_en: 'Let\'s call it a _____ and continue working on this project tomorrow morning.',
        sentence_vi: 'Let us conclude our work for this evening and resume tasks during our next morning session.',
        cloze_target: 'day',
        target_word: 'day',
        part_of_speech: 'noun',
        phonetic: '/deɪ/',
        hints: 'conclude working for the day (idiom: call it a day)',
        accepted_answers: ['day'],
        explanation: 'The workplace idiom "call it a day" signifies stopping work for the remainder of the working day.',
        grammar_points: [
          'Idiom: Call it a day (finish work for the day)',
          'Suggestion formula: Let\'s + V-bare'
        ],
        options: ['day', 'night', 'time', 'break'],
        difficulty: 'easy'
      }
    ]
  },
  {
    deck_id: 'IELTS_READ_TFNG',
    title: 'IELTS Reading: True / False / Not Given & Synonym Traps',
    category: 'IELTS Reading',
    description: 'Master strategies for recognizing factual contradictions, absolute qualifiers (always, completely), and lexical paraphrasing.',
    target_language: 'English',
    native_language: 'English',
    level: 'B1-B2',
    icon: 'BookOpen',
    cover_gradient: 'from-blue-600 via-indigo-600 to-violet-500',
    cards: [
      {
        id: 'tf1',
        sentence_en: 'The author claims that climate change will _____ eliminate Arctic wildlife within fifty years.',
        sentence_vi: 'The writer asserts that shifting weather patterns will cause total, absolute extinction of polar fauna within half a century.',
        cloze_target: 'completely',
        target_word: 'completely',
        part_of_speech: 'adverb',
        phonetic: '/kəmˈpliːt.li/',
        hints: 'totally, entirely (extreme modifier trap: completely, entirely, totally)',
        accepted_answers: ['completely', 'entirely', 'totally'],
        explanation: 'In True/False/Not Given questions, absolute adverbs (completely, entirely, always) often distinguish between TRUE and FALSE when the text only supports a moderate degree.',
        grammar_points: [
          'TFNG Strategy: Scrutinize Extreme Modifiers (completely, always, never)',
          'Text contrast: Passage state "severely reduce" does not equal "completely eliminate"'
        ],
        options: ['completely', 'partially', 'likely', 'rarely'],
        difficulty: 'medium'
      },
      {
        id: 'tf2',
        sentence_en: 'The research suggests an _____ link between sleep deprivation and cognitive decline.',
        sentence_vi: 'Scientific trials demonstrate an indisputable correlation between insufficient rest and reduced brain performance.',
        cloze_target: 'undeniable',
        target_word: 'undeniable',
        part_of_speech: 'adjective',
        phonetic: '/ˌʌn.dɪˈnaɪ.ə.bəl/',
        hints: 'indisputable, incontestable, or clear (adjective)',
        accepted_answers: ['undeniable', 'incontestable', 'clear'],
        explanation: 'IELTS paraphrasing: "undeniable link" regularly corresponds to "incontrovertible evidence of a correlation" in academic texts.',
        grammar_points: [
          'Part of speech: Pre-nominal adjective modifying "link"',
          'IELTS synonyms: undeniable = indisputable = unequivocal'
        ],
        options: ['undeniable', 'undeniably', 'denial', 'denied'],
        difficulty: 'hard'
      },
      {
        id: 'tf3',
        sentence_en: 'Contrary to previous assumptions, the fossils did not _____ to a marine reptile.',
        sentence_vi: 'Opposite to earlier scientific beliefs, the excavated remains were not associated with an aquatic prehistoric organism.',
        cloze_target: 'belong',
        target_word: 'belong',
        part_of_speech: 'verb',
        phonetic: '/bɪˈlɒŋ/',
        hints: 'to be a member or property of (verb taking preposition to)',
        accepted_answers: ['belong'],
        explanation: 'The verb "belong to" is a standard dependent preposition pair. With the negative auxiliary "did not", use base form "belong".',
        grammar_points: [
          'Verb + Preposition: belong to someone / something',
          'Auxiliary syntax: did not + bare infinitive'
        ],
        options: ['belong', 'relate', 'refer', 'pertain'],
        difficulty: 'medium'
      }
    ]
  },
  {
    deck_id: 'IELTS_READ_HEADINGS',
    title: 'IELTS Reading: Matching Headings & Topic Sentence Mastery',
    category: 'IELTS Reading',
    description: 'Skimming and paragraph analysis techniques to extract central themes, evaluate topic sentences, and reject distractors.',
    target_language: 'English',
    native_language: 'English',
    level: 'B1-B2',
    icon: 'FileText',
    cover_gradient: 'from-amber-600 via-orange-600 to-rose-500',
    cards: [
      {
        id: 'mh1',
        sentence_en: 'The opening paragraph serves as an _____ to the historical background of urban architecture.',
        sentence_vi: 'The introductory section functions as an initial overview outlining the chronological evolution of metropolitan design.',
        cloze_target: 'introduction',
        target_word: 'introduction',
        part_of_speech: 'noun',
        phonetic: '/ˌɪn.trəˈdʌk.ʃən/',
        hints: 'preliminary overview or opening section (noun)',
        accepted_answers: ['introduction', 'overview'],
        explanation: 'A heading like "An introduction to..." typically matches Paragraph A where the author sets context, definitions, or historical roots.',
        grammar_points: [
          'Indefinite article "an" precedes vowel sounds: an introduction to',
          'Headings technique: Read the initial sentence and concluding transition of the paragraph'
        ],
        options: ['introduction', 'introduce', 'introductory', 'introductor'],
        difficulty: 'easy'
      },
      {
        id: 'mh2',
        sentence_en: 'Section B focuses on the economic _____ of prolonged agricultural droughts.',
        sentence_vi: 'The second segment concentrates upon the financial ramifications and negative outcomes brought about by extended dry spells.',
        cloze_target: 'consequences',
        target_word: 'consequence',
        part_of_speech: 'noun (plural)',
        phonetic: '/ˈkɒn.sɪ.kwənsɪz/',
        hints: 'outcomes, results, or repercussions (plural noun)',
        accepted_answers: ['consequences', 'impacts', 'effects', 'repercussions'],
        explanation: 'IELTS headings frequently use abstract umbrella nouns like "The consequences / effects / repercussions of..." to summarize paragraphs describing losses or aftermaths.',
        grammar_points: [
          'Summarizing vocabulary: consequences of something',
          'Advanced academic synonyms: ramifications, repercussions, aftermath'
        ],
        options: ['consequences', 'consequent', 'consequently', 'consequence'],
        difficulty: 'medium'
      },
      {
        id: 'mh3',
        sentence_en: 'The scientist proposed an innovative _____ to tackle drinking water scarcity.',
        sentence_vi: 'The researcher formulated a cutting-edge methodology to resolve clean potable water deficits.',
        cloze_target: 'solution',
        target_word: 'solution',
        part_of_speech: 'noun',
        phonetic: '/səˈluː.ʃən/',
        hints: 'a means of solving a problem; remedy (noun + to)',
        accepted_answers: ['solution', 'approach', 'measure', 'method'],
        explanation: 'Headings featuring "A potential solution / An innovative approach" standardly align with concluding paragraphs that present fixes following earlier problem analyses.',
        grammar_points: [
          'Collocation: innovative solution to something',
          'Academic verbs for addressing challenges: tackle = address = combat = resolve'
        ],
        options: ['solution', 'solve', 'soluble', 'solvation'],
        difficulty: 'easy'
      }
    ]
  },
  {
    deck_id: 'IELTS_LISTEN_P1',
    title: 'IELTS Listening: Part 1 Form, Notes & Number Completion',
    category: 'IELTS Listening',
    description: 'Precision training for proper names, alphabetical spelling, calendar dates, telephone numbers, and currency values.',
    target_language: 'English',
    native_language: 'English',
    level: 'A1-A2',
    icon: 'Headphones',
    cover_gradient: 'from-cyan-600 via-teal-600 to-emerald-500',
    cards: [
      {
        id: 'lp1',
        sentence_en: 'Customer name: Sarah _____ (Spelled: M - A - C - K - E - N - Z - I - E).',
        sentence_vi: 'Client surname: Sarah Mackenzie (Individually spelled aloud letter by letter).',
        cloze_target: 'Mackenzie',
        target_word: 'Mackenzie',
        part_of_speech: 'proper noun',
        phonetic: '/məˈkɛnzi/',
        hints: 'client surname (capitalize the initial letter M)',
        accepted_answers: ['Mackenzie', 'mackenzie', 'MACKENZIE'],
        explanation: 'In IELTS Listening Part 1, uncommon proper names are always spelled out letter by letter. Watch for easily confused pairs like A / E / I, J / G, and W / U.',
        grammar_points: [
          'Listening convention: Capitalize first letters of proper nouns',
          'Spelling variation: British English pronounces Z as /zɛd/; American as /ziː/'
        ],
        options: ['Mackenzie', 'Mckenzie', 'Makenzie', 'Mackensey'],
        difficulty: 'easy'
      },
      {
        id: 'lp2',
        sentence_en: 'Delivery date: Tuesday, the _____ of September.',
        sentence_vi: 'Scheduled arrival: Tuesday, the fourteenth day of the ninth calendar month.',
        cloze_target: '14th',
        target_word: 'fourteenth',
        part_of_speech: 'ordinal number',
        phonetic: '/ˌfɔːˈtiːnθ/',
        hints: 'fourteenth day (acceptable as 14th or 14)',
        accepted_answers: ['14th', '14', 'fourteenth'],
        explanation: 'In IELTS Listening, date formats can be recorded as numerals or words. Writing "14" or "14th" is marked fully correct.',
        grammar_points: [
          'Date conventions: the 14th of September or 14 September',
          'Phonetic distinction: 14 (/fɔːˈtiːn/ with final stress) vs 40 (/ˈfɔːti/)'
        ],
        options: ['14th', '40th', '4th', '140th'],
        difficulty: 'easy'
      },
      {
        id: 'lp3',
        sentence_en: 'Total rental cost includes insurance: $_____ per month.',
        sentence_vi: 'Complete leasing expense inclusive of coverage: four hundred and fifty dollars monthly.',
        cloze_target: '450',
        target_word: '450',
        part_of_speech: 'cardinal number',
        phonetic: '/fɔːr ˈhʌndrəd ˈfɪfti/',
        hints: 'amount: four hundred and fifty (currency symbol $ is already printed)',
        accepted_answers: ['450', 'four hundred and fifty', 'four hundred fifty'],
        explanation: 'When the exam question already provides the currency symbol "$", write only the numerical digits (450) without repeating the dollar sign.',
        grammar_points: [
          'IELTS rule: Do not repeat pre-printed units ($, %, kg, cm)',
          'Number listening: Note the coordinating conjunction "and" in British numeral phrasing'
        ],
        options: ['450', '415', '45', '540'],
        difficulty: 'easy'
      }
    ]
  },
  {
    deck_id: 'IELTS_ACAD_VOCAB',
    title: 'Band 7.5+ Academic Collocations & Precision Verbs',
    category: 'Vocabulary',
    description: 'High-value academic word partnerships and precision verbs designed to elevate Lexical Resource ratings in Writing and Speaking.',
    target_language: 'English',
    native_language: 'English',
    level: 'B1-B2',
    icon: 'Sparkles',
    cover_gradient: 'from-fuchsia-600 via-purple-600 to-indigo-600',
    cards: [
      {
        id: 'av1',
        sentence_en: 'Excessive reliance on fossil fuels poses a grave _____ to sustainable development.',
        sentence_vi: 'Overdependence on non-renewable energy sources creates a severe hazard and risk for long-term ecological balance.',
        cloze_target: 'threat',
        target_word: 'threat',
        part_of_speech: 'noun',
        phonetic: '/θrɛt/',
        hints: 'a danger or hazard (collocation: pose a grave threat to)',
        accepted_answers: ['threat', 'danger', 'risk'],
        explanation: 'Band 7+ collocation: "pose a grave threat to" effectively replaces basic informal phrasing such as "is dangerous for".',
        grammar_points: [
          'Collocation: pose a threat / risk / challenge to',
          'Academic adjective: grave = severe = serious'
        ],
        options: ['threat', 'threaten', 'threatening', 'threats'],
        difficulty: 'medium'
      },
      {
        id: 'av2',
        sentence_en: 'Governments should allocate more _____ to scientific research and public education.',
        sentence_vi: 'State institutions ought to designate greater financial funding and human capital toward scientific innovation.',
        cloze_target: 'resources',
        target_word: 'resource',
        part_of_speech: 'noun (plural)',
        phonetic: '/rɪˈzɔːsɪz/',
        hints: 'funds, assets, or capital (plural noun: resources)',
        accepted_answers: ['resources', 'funds', 'budget'],
        explanation: '"Allocate resources to something" is an essential academic phrase in IELTS Writing Task 2 for governmental and educational essays.',
        grammar_points: [
          'Collocation: allocate resources / funds / budget to',
          'Verb syntax: allocate takes preposition "to"'
        ],
        options: ['resources', 'resourceful', 'resourced', 'resourcefulness'],
        difficulty: 'medium'
      },
      {
        id: 'av3',
        sentence_en: 'The sudden economic crisis had an _____ effect on low-income families.',
        sentence_vi: 'The unexpected financial downturn produced severely damaging, unfavorable consequences for disadvantaged households.',
        cloze_target: 'adverse',
        target_word: 'adverse',
        part_of_speech: 'adjective',
        phonetic: '/ˈæd.vɜːs/',
        hints: 'harmful, unfavorable, or detrimental (adjective starting with vowel a)',
        accepted_answers: ['adverse', 'harmful', 'detrimental'],
        explanation: '"Have an adverse effect on" represents formal academic phrasing to articulate negative consequences.',
        grammar_points: [
          'Indefinite article: "an" precedes the vowel sound in "adverse effect on"',
          'Word differentiation: adverse (unfavorable) vs averse (disinclined/opposed)'
        ],
        options: ['adverse', 'adversely', 'adversity', 'aversive'],
        difficulty: 'hard'
      }
    ]
  },
  {
    deck_id: 'IELTS_WRITING_COHESION',
    title: 'IELTS Writing Task 2: Advanced Cohesive Devices & Concession',
    category: 'IELTS Writing',
    description: 'Master formal discourse markers, concession clauses, and transition signposts for top-band Coherence & Cohesion scores.',
    target_language: 'English',
    native_language: 'English',
    level: 'B1-B2',
    icon: 'PenTool',
    cover_gradient: 'from-rose-600 via-pink-600 to-amber-500',
    cards: [
      {
        id: 'wc1',
        sentence_en: '_____, some opponents argue that technological automation will cause mass unemployment.',
        sentence_vi: 'From a contrasting perspective, critics maintain that robotic mechanization will displace substantial numbers of human workers.',
        cloze_target: 'Conversely',
        target_word: 'conversely',
        part_of_speech: 'adverb / transition',
        phonetic: '/kənˈvɜːs.li/',
        hints: 'in an opposite way; on the contrary (sentence-initial transition + comma)',
        accepted_answers: ['Conversely', 'conversely', 'On the contrary', 'In contrast'],
        explanation: 'Sentence-initial "Conversely," introduces an opposing argument or reciprocal contrast in formal academic discourse.',
        grammar_points: [
          'Punctuation: Initial transition words are followed by a comma',
          'Synonyms: In contrast, On the other hand, By comparison'
        ],
        options: ['Conversely', 'However', 'Furthermore', 'Therefore'],
        difficulty: 'medium'
      },
      {
        id: 'wc2',
        sentence_en: '_____ the substantial investment in green public transport, traffic congestion remains severe.',
        sentence_vi: 'In spite of major capital funding poured into eco-friendly transit, vehicular gridlock continues unabated.',
        cloze_target: 'Despite',
        target_word: 'despite',
        part_of_speech: 'preposition',
        phonetic: '/dɪˈspaɪt/',
        hints: 'in spite of; notwithstanding (preposition taking noun phrase)',
        accepted_answers: ['Despite', 'despite', 'In spite of', 'Notwithstanding'],
        explanation: 'Preposition "Despite" takes a noun phrase object ("the substantial investment..."). Do not use "Despite of".',
        grammar_points: [
          'Syntax: Despite / In spite of + Noun phrase / V-ing',
          'Contrast: Although / Even though introduce full clauses with finite verbs'
        ],
        options: ['Despite', 'Although', 'Even though', 'Whereas'],
        difficulty: 'easy'
      },
      {
        id: 'wc3',
        sentence_en: 'It is widely acknowledged that international tourism yields immense economic benefits; _____, its environmental footprint cannot be overlooked.',
        sentence_vi: 'Most experts agree that overseas travel provides substantial monetary gains; nonetheless, its ecological consequences require urgent mitigation.',
        cloze_target: 'nevertheless',
        target_word: 'nevertheless',
        part_of_speech: 'conjunctive adverb',
        phonetic: '/ˌnɛv.ə.ðəˈlɛs/',
        hints: 'in spite of that; nonetheless (conjunctive adverb following semicolon and before comma)',
        accepted_answers: ['nevertheless', 'nonetheless', 'however'],
        explanation: 'Academic punctuation rhythm: Independent clause ; nevertheless , independent clause creates a refined concession cadence.',
        grammar_points: [
          'Semicolon linkage: [Clause 1] ; nevertheless , [Clause 2]',
          'Tone: Higher academic formality than conversational "but"'
        ],
        options: ['nevertheless', 'therefore', 'consequently', 'moreover'],
        difficulty: 'hard'
      }
    ]
  }
];
