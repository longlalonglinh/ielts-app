export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT BACKEND REST API - IELTS EXAM SYSTEM (OPTIMIZED V2.5)
 * ============================================================================
 * 
 * FEATURES:
 * 1. High-speed CacheService to handle high-concurrency exam retrieval (<100ms)
 * 2. ScriptLock to prevent data corruption during simultaneous student submissions
 * 3. Automatic Audio URL normalization (Google Drive, Dropbox, CDNs)
 * 4. Case-insensitive action routing (get_exam / getExam, submit_exam / submitExam)
 * 5. Deduplication & in-place row updates for EXAMS & QUESTIONS
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet "IELTS_Exam_System"
 * 2. Click Extensions -> Apps Script
 * 3. Replace all code in Code.gs with this entire script
 * 4. Run the 'setupInitialSheets()' function once
 * 5. Click Deploy -> New deployment -> Select "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 6. Click Deploy, grant permissions, and copy the Web App URL into the Web App!
 * ============================================================================
 */

// Initialize 6 standard tabs for Google Sheets
function setupInitialSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Tab 1: EXAMS (11 standard columns A-K)
  var sheetExams = ss.getSheetByName('EXAMS') || ss.insertSheet('EXAMS');
  if (sheetExams.getLastRow() === 0) {
    sheetExams.appendRow([
      'EXAM_CODE', 'TITLE', 'TEST_TYPE', 'DURATION_MINS', 
      'AUDIO_URL', 'READING_PASSAGE', 'WRITING_TASK1_PROMPT', 'WRITING_TASK2_PROMPT', 
      'WRITING_TASK1_IMAGE', 'AUDIO_TITLE', 'CREATED_AT'
    ]);
    sheetExams.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
  }
  
  // Tab 2: QUESTIONS
  var sheetQuestions = ss.getSheetByName('QUESTIONS') || ss.insertSheet('QUESTIONS');
  if (sheetQuestions.getLastRow() === 0) {
    sheetQuestions.appendRow([
      'EXAM_CODE', 'QUESTION_ID', 'SECTION', 'QUESTION_TEXT', 
      'QUESTION_TYPE', 'OPTIONS_JSON', 'CORRECT_ANSWER', 'MAX_SCORE'
    ]);
    sheetQuestions.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
  }
  
  // Tab 3: SUBMISSIONS (18 standard columns A-R)
  var sheetSubmissions = ss.getSheetByName('SUBMISSIONS') || ss.insertSheet('SUBMISSIONS');
  if (sheetSubmissions.getLastRow() === 0) {
    sheetSubmissions.appendRow([
      'SUBMISSION_ID', 'SBD', 'STUDENT_NAME', 'EXAM_CODE', 'TEST_MODE', 
      'LISTENING_RAW', 'LISTENING_BAND', 'READING_RAW', 'READING_BAND',
      'WRITING_TASK1_TEXT', 'WRITING_TASK2_TEXT', 'ANSWERS_JSON', 'WRITING_SCORES_JSON', 
      'WRITING_BAND', 'OVERALL_BAND', 'STATUS', 'SUBMITTED_AT', 'VIOLATIONS_COUNT'
    ]);
    sheetSubmissions.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
  }
  
  // Tab 4: CHEATLOGS
  var sheetCheatlogs = ss.getSheetByName('CHEATLOGS') || ss.insertSheet('CHEATLOGS');
  if (sheetCheatlogs.getLastRow() === 0) {
    sheetCheatlogs.appendRow([
      'LOG_ID', 'SUBMISSION_ID', 'SBD', 'EXAM_CODE', 
      'VIOLATION_TYPE', 'VIOLATION_COUNT', 'TIMESTAMP'
    ]);
    sheetCheatlogs.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
  }
  
  // Tab 5: PRACTICE_QUESTIONS
  var sheetPractice = ss.getSheetByName('PRACTICE_QUESTIONS') || ss.insertSheet('PRACTICE_QUESTIONS');
  if (sheetPractice.getLastRow() === 0) {
    sheetPractice.appendRow([
      'DECK_ID', 'DECK_TITLE', 'CATEGORY', 'DESCRIPTION', 'LEVEL', 
      'CARD_ID', 'SENTENCE_EN', 'SENTENCE_VI', 'CLOZE_TARGET', 'TARGET_WORD', 
      'PART_OF_SPEECH', 'PHONETIC', 'HINTS', 'OPTIONS_JSON', 'ACCEPTED_ANSWERS_JSON', 
      'EXPLANATION', 'GRAMMAR_POINTS_JSON', 'DIFFICULTY', 'UPDATED_AT'
    ]);
    sheetPractice.getRange("1:1").setFontWeight("bold").setBackground("#c7d2fe");
  }
  
  // Tab 6: STUDENT_PROGRESS
  var sheetStudentProgress = ss.getSheetByName('STUDENT_PROGRESS') || ss.insertSheet('STUDENT_PROGRESS');
  if (sheetStudentProgress.getLastRow() === 0) {
    sheetStudentProgress.appendRow([
      'STUDENT_ID', 'STUDENT_NAME', 'DECK_ID', 'DECK_TITLE', 
      'CARDS_MASTERED', 'TOTAL_CARDS', 'MASTERY_PCT', 'CORRECT_COUNT', 
      'WRONG_COUNT', 'DAILY_STREAK', 'LAST_STUDIED_AT', 'NOTES'
    ]);
    sheetStudentProgress.getRange("1:1").setFontWeight("bold").setBackground("#ede9fe");
  }
  
  Logger.log("Successfully initialized all 6 standard sheets!");
}

// Case-insensitive flexible Sheet lookup helper
function getFlexibleSheet(ss, names) {
  var allSheets = ss.getSheets();
  for (var k = 0; k < allSheets.length; k++) {
    var actualName = allSheets[k].getName().trim().toLowerCase();
    for (var n = 0; n < names.length; n++) {
      if (actualName === names[n].trim().toLowerCase()) {
        return allSheets[k];
      }
    }
  }
  return null;
}

// JSON Output Helper with proper headers
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Normalize Google Drive Audio links into direct streamable link
function normalizeAudioUrl(url) {
  if (!url || typeof url !== 'string') return '';
  var clean = url.trim();
  
  var driveMatch = clean.match(/\\/file\\/d\\/([a-zA-Z0-9_-]{20,})/i) || 
                   clean.match(/[?&]id=([a-zA-Z0-9_-]{20,})/i) ||
                   clean.match(/open\\?id=([a-zA-Z0-9_-]{20,})/i);
  if (driveMatch && driveMatch[1]) {
    return 'https://drive.usercontent.google.com/download?id=' + driveMatch[1] + '&export=download&authuser=0';
  }
  
  if (clean.indexOf('dropbox.com') !== -1) {
    clean = clean.replace(/[?&]dl=0/g, '').replace(/[?&]dl=1/g, '');
    clean += (clean.indexOf('?') !== -1 ? '&' : '?') + 'raw=1';
    return clean;
  }
  
  return clean;
}

/**
 * ============================================================================
 * GET API: Load Exam, Submissions, Cheatlogs, Decks, Progress, Ping
 * ============================================================================
 */
function doGet(e) {
  var cache = CacheService.getScriptCache();
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = e ? e.parameter : {};
    var rawAction = params.action || '';
    var action = rawAction.toLowerCase().replace(/_/g, '');
    var examCode = (params.exam_code || params.examCode || params.code || '').toString().trim().toUpperCase();
    
    // 1. PING / HEALTH CHECK
    if (action === 'ping' || action === 'health') {
      return createJsonResponse({
        status: 'success',
        success: true,
        message: 'Google Apps Script backend is live and operational',
        spreadsheet_name: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. GET ALL EXAMS LIST
    if (action === 'getexams' || action === 'listexams') {
      var sheetE = getFlexibleSheet(ss, ['EXAMS', 'Exams', 'exams', 'DE_THI', 'De_Thi']);
      var examsList = [];
      if (sheetE) {
        var dataE = sheetE.getDataRange().getValues();
        for (var exI = 1; exI < dataE.length; exI++) {
          var rE = dataE[exI];
          var cCode = String(rE[0]).trim().toUpperCase();
          if (cCode) {
            examsList.push({
              exam_code: cCode,
              title: rE[1] || ('Exam ' + cCode),
              test_type: rE[2] || 'Academic',
              duration_mins: Number(rE[3]) || 60,
              has_audio: Boolean(rE[4]),
              created_at: rE[8] || ''
            });
          }
        }
      }
      return createJsonResponse({
        status: 'success',
        success: true,
        count: examsList.length,
        exams: examsList
      });
    }
    
    // 3. GET SINGLE EXAM BY CODE (High performance with CacheService)
    if (action === 'getexam' || examCode !== '') {
      var cacheKey = 'exam_' + examCode;
      var cachedJson = cache.get(cacheKey);
      if (cachedJson) {
        return ContentService.createTextOutput(cachedJson).setMimeType(ContentService.MimeType.JSON);
      }
      
      var sheetQ = getFlexibleSheet(ss, ['QUESTIONS', 'Questions', 'questions', 'CAU_HOI', 'Cau_Hoi', 'Sheet1']);
      var sheetE = getFlexibleSheet(ss, ['EXAMS', 'Exams', 'exams', 'DE_THI', 'De_Thi']);
      
      var questions = [];
      if (sheetQ) {
        var dataQ = sheetQ.getDataRange().getValues();
        for (var i = 1; i < dataQ.length; i++) {
          var row = dataQ[i];
          var codeInRow = String(row[0]).trim().toUpperCase();
          if (examCode === '' || codeInRow === examCode) {
            // Note: Omit row[6] (CORRECT_ANSWER) during test delivery for exam security
            questions.push({
              exam_code: row[0],
              question_id: String(row[1] || ('Q' + i)),
              section: String(row[2] || 'reading').toLowerCase(),
              question_text: row[3] || '',
              question_type: row[4] || 'multiple_choice',
              options: row[5] ? parseJsonSafe(row[5]) : [],
              max_score: Number(row[7]) || 1
            });
          }
        }
      }
      
      var examMeta = null;
      if (sheetE) {
        var dataE = sheetE.getDataRange().getValues();
        for (var j = 1; j < dataE.length; j++) {
          if (String(dataE[j][0]).trim().toUpperCase() === examCode) {
            var rawCol8 = String(dataE[j][8] || '');
            var rawCol9 = String(dataE[j][9] || '');
            // Flexible detection: if column 9 is an image URL/path, use it; otherwise check col 10
            var isCol8Img = rawCol8.indexOf('http') === 0 || rawCol8.indexOf('data:image') === 0 || rawCol8.indexOf('/') === 0 || rawCol8.indexOf('drive.google') !== -1;
            var resolvedTask1Img = isCol8Img ? rawCol8 : (rawCol9.indexOf('http') === 0 || rawCol9.indexOf('data:image') === 0 || rawCol9.indexOf('/') === 0 ? rawCol9 : '');

            examMeta = {
              exam_code: dataE[j][0],
              title: dataE[j][1] || ('IELTS Examination - ' + examCode),
              test_type: dataE[j][2] || 'Academic',
              duration_mins: Number(dataE[j][3]) || 60,
              audio_url: normalizeAudioUrl(String(dataE[j][4] || '')),
              reading_passage: dataE[j][5] || '',
              writing_task1_prompt: dataE[j][6] || '',
              writing_task2_prompt: dataE[j][7] || '',
              writing_task1_image: resolvedTask1Img,
              writing_task1_image_url: resolvedTask1Img,
              writing_task1_imageUrl: resolvedTask1Img
            };
            break;
          }
        }
      }
      
      var response = {
        status: 'success',
        success: true,
        exam_code: examCode,
        exam_meta: examMeta,
        questions_count: questions.length,
        questions: questions,
        data: questions
      };
      
      var responseStr = JSON.stringify(response);
      // Cache for 600 seconds (10 minutes)
      if (examCode) {
        try { cache.put(cacheKey, responseStr, 600); } catch (cErr) {}
      }
      
      return ContentService.createTextOutput(responseStr).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. GET SUBMISSIONS
    if (action === 'getsubmissions') {
      var sheetS = getFlexibleSheet(ss, ['SUBMISSIONS', 'Submissions', 'submissions']);
      if (!sheetS) return createJsonResponse({ status: 'error', success: false, message: 'Sheet SUBMISSIONS does not exist' });
      
      var dataS = sheetS.getDataRange().getValues();
      var submissions = [];
      for (var k = 1; k < dataS.length; k++) {
        var r = dataS[k];
        submissions.push({
          submission_id: r[0],
          sbd: r[1],
          student_name: r[2] || '',
          exam_code: r[3],
          test_mode: r[4],
          listening_raw: r[5],
          listening_band: r[6],
          reading_raw: r[7],
          reading_band: r[8],
          writing_task1_text: r[9],
          writing_task2_text: r[10],
          answers: parseJsonSafe(r[11]),
          answers_json: r[11],
          writing_scores: parseJsonSafe(r[12]),
          writing_band: r[13],
          overall_band: r[14],
          status: r[15] || 'PENDING_TEACHER',
          writing_status: r[15] || 'PENDING_TEACHER',
          submitted_at: r[16],
          violations_count: r[17] || 0
        });
      }
      return createJsonResponse({ status: 'success', success: true, count: submissions.length, data: submissions, submissions: submissions });
    }
    
    // 5. GET CHEAT LOGS
    if (action === 'getcheatlogs') {
      var sheetC = getFlexibleSheet(ss, ['CHEATLOGS', 'Cheatlogs', 'cheatlogs', 'CHEAT_LOGS']);
      if (!sheetC) return createJsonResponse({ status: 'error', success: false, message: 'Sheet CHEATLOGS does not exist' });
      
      var dataC = sheetC.getDataRange().getValues();
      var cheatlogs = [];
      for (var cl = 1; cl < dataC.length; cl++) {
        var rc = dataC[cl];
        cheatlogs.push({
          log_id: rc[0],
          submission_id: rc[1],
          sbd: rc[2],
          exam_code: rc[3],
          violation_type: rc[4],
          violation_count: rc[5],
          timestamp: rc[6]
        });
      }
      return createJsonResponse({ status: 'success', success: true, count: cheatlogs.length, data: cheatlogs, cheatlogs: cheatlogs });
    }
    
    // Fallback: system info
    return createJsonResponse({
      status: 'success',
      success: true,
      message: 'IELTS Google Apps Script API V2.5 Ready.',
      available_actions: ['ping', 'get_exams', 'get_exam', 'get_submissions', 'get_cheatlogs']
    });
    
  } catch (err) {
    return createJsonResponse({ status: 'error', success: false, message: err.toString() });
  }
}

/**
 * ============================================================================
 * POST API: Submit Exam, Grade Writing, Upload Exam, Sync Progress
 * ============================================================================
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 10 seconds for script lock to prevent race condition row corruptions
  var hasLock = lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    
    var rawAction = payload.action || 'submit_exam';
    var action = rawAction.toLowerCase().replace(/_/g, '');
    var response = { status: 'error', message: 'Unknown action' };
    
    // 1. SUBMIT EXAM
    if (action === 'submitexam') {
      var sbd = payload.sbd || 'GUEST';
      var examCode = (payload.exam_code || 'TEST01').toString().trim().toUpperCase();
      var testMode = payload.test_mode || 'TEST';
      var listeningAnswers = payload.listening_answers || payload.user_answers || {};
      var readingAnswers = payload.reading_answers || payload.user_answers || {};
      var writingTask1Text = payload.writing_task1_text || '';
      var writingTask2Text = payload.writing_task2_text || '';
      var cheatLogs = payload.cheat_logs || payload.violation_logs || [];
      var violationsCount = payload.violations_count || 0;
      
      var timestampStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
      var submissionId = payload.submission_id || (sbd + "_" + examCode + "_" + timestampStr);
      var submittedAt = payload.submitted_at || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      
      // Server-side scoring check against QUESTIONS sheet
      var sheetQ = getFlexibleSheet(ss, ['QUESTIONS', 'Questions', 'questions']);
      var correctAnswersMap = {};
      if (sheetQ) {
        var dataQ = sheetQ.getDataRange().getValues();
        for (var i = 1; i < dataQ.length; i++) {
          if (String(dataQ[i][0]).toUpperCase() === examCode) {
            var qId = String(dataQ[i][1]);
            correctAnswersMap[qId] = {
              section: String(dataQ[i][2]).toLowerCase(),
              correct: String(dataQ[i][6]).trim().toUpperCase(),
              max_score: Number(dataQ[i][7]) || 1
            };
          }
        }
      }
      
      var listeningRaw = payload.listening_raw || payload.listening_raw_score || 0;
      var readingRaw = payload.reading_raw || payload.reading_raw_score || 0;
      var listeningBand = payload.listening_band || 0;
      var readingBand = payload.reading_band || 0;
      
      // If client didn't supply pre-calculated bands, calculate using Sheet key
      if (!listeningBand && Object.keys(correctAnswersMap).length > 0) {
        var lRaw = 0; var lMax = 0;
        for (var lKey in listeningAnswers) {
          var lVal = String(listeningAnswers[lKey]).trim().toUpperCase();
          if (correctAnswersMap[lKey] && correctAnswersMap[lKey].section === 'listening') {
            lMax += correctAnswersMap[lKey].max_score;
            if (lVal === correctAnswersMap[lKey].correct) lRaw += correctAnswersMap[lKey].max_score;
          }
        }
        listeningRaw = lRaw;
        listeningBand = convertRawToIeltsBand(listeningRaw, lMax || 40);
      }
      
      if (!readingBand && Object.keys(correctAnswersMap).length > 0) {
        var rRaw = 0; var rMax = 0;
        for (var rKey in readingAnswers) {
          var rVal = String(readingAnswers[rKey]).trim().toUpperCase();
          if (correctAnswersMap[rKey] && correctAnswersMap[rKey].section === 'reading') {
            rMax += correctAnswersMap[rKey].max_score;
            if (rVal === correctAnswersMap[rKey].correct) rRaw += correctAnswersMap[rKey].max_score;
          }
        }
        readingRaw = rRaw;
        readingBand = convertRawToIeltsBand(readingRaw, rMax || 40);
      }
      
      var studentName = payload.student_name || payload.candidate_name || '';
      var answersJson = JSON.stringify({
        answers: payload.answers || {},
        listening: payload.listening_answers || {},
        reading: payload.reading_answers || {}
      });
      var writingScoresJson = JSON.stringify(payload.writing_scores || { TR: 0, CC: 0, LR: 0, GRA: 0 });
      var writingBand = payload.writing_band || 0;
      var status = payload.status || 'PENDING_TEACHER';

      var sheetSubmissions = ss.getSheetByName('SUBMISSIONS') || ss.insertSheet('SUBMISSIONS');
      sheetSubmissions.appendRow([
        submissionId,
        sbd,
        studentName,
        examCode,
        testMode,
        listeningRaw,
        listeningBand,
        readingRaw,
        readingBand,
        writingTask1Text,
        writingTask2Text,
        answersJson,
        writingScoresJson,
        writingBand,
        payload.overall_band || 0,
        status,
        submittedAt,
        violationsCount
      ]);
      
      // Record cheat logs without index errors (c < cheatLogs.length)
      if (cheatLogs && cheatLogs.length > 0) {
        var sheetCheatlogs = ss.getSheetByName('CHEATLOGS') || ss.insertSheet('CHEATLOGS');
        for (var c = 0; c < cheatLogs.length; c++) {
          var log = cheatLogs[c];
          sheetCheatlogs.appendRow([
            log.log_id || ('LOG_' + Date.now() + '_' + c),
            submissionId,
            sbd,
            examCode,
            log.violation_type || 'ONBLUR',
            log.violation_count || 1,
            log.timestamp || submittedAt
          ]);
        }
      }
      
      response = {
        status: 'success',
        success: true,
        submission_id: submissionId,
        sbd: sbd,
        exam_code: examCode,
        listening_raw: listeningRaw,
        listening_band: listeningBand,
        reading_raw: readingRaw,
        reading_band: readingBand,
        writing_status: 'PENDING_TEACHER',
        submitted_at: submittedAt
      };
    }
    
    // 2. GRADE WRITING
    else if (action === 'gradewriting') {
      var subId = payload.submission_id;
      var scores = payload.writing_scores || { TR: 6, CC: 6, LR: 6, GRA: 6 };
      var feedback = payload.writing_feedback || '';
      var writingBand = Math.round(((scores.TR + scores.CC + scores.LR + scores.GRA) / 4) * 2) / 2;
      
      var sheetS = ss.getSheetByName('SUBMISSIONS');
      if (sheetS) {
        var dataS = sheetS.getDataRange().getValues();
        for (var rowIdx = 1; rowIdx < dataS.length; rowIdx++) {
          if (String(dataS[rowIdx][0]) === String(subId)) {
            var lB = Number(dataS[rowIdx][6]) || 0;
            var rB = Number(dataS[rowIdx][8]) || 0;
            var overallB = Math.round(((lB + rB + writingBand) / 3) * 2) / 2;
            
            sheetS.getRange(rowIdx + 1, 13).setValue(JSON.stringify(scores));
            sheetS.getRange(rowIdx + 1, 14).setValue(writingBand);
            sheetS.getRange(rowIdx + 1, 15).setValue(overallB);
            sheetS.getRange(rowIdx + 1, 16).setValue('GRADED');
            
            response = {
              status: 'success',
              success: true,
              submission_id: subId,
              writing_band: writingBand,
              overall_band: overallB
            };
            break;
          }
        }
      }
    }
    
    // 3. UPLOAD / UPDATE EXAM
    else if (action === 'uploadexam') {
      var exam = payload.exam_data;
      if (!exam) return createJsonResponse({ status: 'error', message: 'Missing exam_data' });
      
      var sheetE = ss.getSheetByName('EXAMS') || ss.insertSheet('EXAMS');
      var sheetQ = ss.getSheetByName('QUESTIONS') || ss.insertSheet('QUESTIONS');
      
      var eCode = (exam.exam_code || 'IELTS01').toString().trim().toUpperCase();
      var eTitle = exam.title || ('IELTS Exam ' + eCode);
      var eType = exam.test_type || 'Academic';
      var eDuration = exam.duration_mins || 60;
      var examSkills = exam.skills || [];
      var isOneSkill = exam.exam_type === 'one_skill' || examSkills.length === 1;

      var allowListening = !isOneSkill || examSkills.indexOf('listening') !== -1;
      var allowReading = !isOneSkill || examSkills.indexOf('reading') !== -1;
      var allowWriting = !isOneSkill || examSkills.indexOf('writing') !== -1;

      var eAudio = allowListening ? normalizeAudioUrl(exam.audio_url || '') : '';
      
      // Reading passage text extraction
      var ePassage = '';
      if (allowReading) {
        if (exam.passages && exam.passages.length > 0) {
          ePassage = exam.passages.map(function(p) { return p.text || ''; }).join('\\n\\n--- Passage Divider ---\\n\\n');
        } else if (exam.passage_text) {
          ePassage = exam.passage_text;
        }
      }
      
      var eW1 = allowWriting ? (exam.writing_task1_prompt || '') : '';
      var eW2 = allowWriting ? (exam.writing_task2_prompt || '') : '';
      var rawTask1Img = allowWriting ? (exam.writing_task1_image || exam.writing_task1_image_url || exam.writing_task1_imageUrl || '') : '';
      // Limit cell character length to avoid Google Sheets 50k cell overflow error
      var eW1Img = (rawTask1Img && rawTask1Img.length > 45000 && rawTask1Img.indexOf('data:image') === 0) ? '' : rawTask1Img;
      var eAudioTitle = exam.audio_title || '';

      var nowTime = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      
      // In-place update or append to EXAMS tab
      var dataE = sheetE.getDataRange().getValues();
      var existingRowIdx = -1;
      for (var er = 1; er < dataE.length; er++) {
        if (String(dataE[er][0]).trim().toUpperCase() === eCode) {
          existingRowIdx = er + 1;
          break;
        }
      }
      
      var examRow = [eCode, eTitle, eType, eDuration, eAudio, ePassage, eW1, eW2, eW1Img, eAudioTitle, nowTime];
      if (existingRowIdx > 0) {
        sheetE.getRange(existingRowIdx, 1, 1, examRow.length).setValues([examRow]);
      } else {
        sheetE.appendRow(examRow);
      }
      
      // Delete old questions for this exam code to prevent duplicates
      var dataQ = sheetQ.getDataRange().getValues();
      for (var qr = dataQ.length - 1; qr >= 1; qr--) {
        if (String(dataQ[qr][0]).trim().toUpperCase() === eCode) {
          sheetQ.deleteRow(qr + 1);
        }
      }
      
      // Insert updated questions according to exam skills (One Skill tests only save that skill's questions)
      var listeningQs = allowListening ? (exam.listening_questions || []) : [];
      var readingQs = allowReading ? (exam.reading_questions || []) : [];

      var allQuestions = [];
      if (isOneSkill) {
        if (examSkills.indexOf('listening') !== -1) {
          allQuestions = listeningQs;
        } else if (examSkills.indexOf('reading') !== -1) {
          allQuestions = readingQs;
        } else {
          allQuestions = []; // Writing-only exam has no objective questions in QUESTIONS tab
        }
      } else {
        allQuestions = exam.questions || [];
        if (allQuestions.length === 0) {
          allQuestions = listeningQs.concat(readingQs);
        } else if (examSkills.length > 0) {
          allQuestions = allQuestions.filter(function(q) {
            var sec = (q.section || 'reading').toLowerCase();
            return examSkills.indexOf(sec) !== -1;
          });
        }
      }
      
      for (var qi = 0; qi < allQuestions.length; qi++) {
        var curQ = allQuestions[qi];
        var optStr = Array.isArray(curQ.options) ? JSON.stringify(curQ.options) : (curQ.options || '[]');
        sheetQ.appendRow([
          eCode,
          curQ.question_id || ('Q' + (qi + 1)),
          curQ.section || 'reading',
          curQ.question_text || '',
          curQ.question_type || 'multiple_choice',
          optStr,
          curQ.correct_answer || '',
          curQ.max_score || 1
        ]);
      }
      
      // Invalidate script cache
      var cache = CacheService.getScriptCache();
      try { cache.remove('exam_' + eCode); } catch (rcErr) {}
      
      response = {
        status: 'success',
        success: true,
        exam_code: eCode,
        questions_count: allQuestions.length,
        message: 'Exam uploaded and synchronized successfully!'
      };
    }
    
    return createJsonResponse(response);
    
  } catch (err) {
    return createJsonResponse({ status: 'error', success: false, message: err.toString() });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

function parseJsonSafe(str) {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch (e) {
    if (typeof str === 'string' && str.indexOf('|') !== -1) {
      return str.split('|').map(function(s) { return s.trim(); });
    }
    return [str];
  }
}

function convertRawToIeltsBand(raw, max) {
  if (!raw || raw <= 0) return 0;
  var scaled = (raw / (max || 40)) * 40;
  if (scaled >= 39) return 9.0;
  if (scaled >= 37) return 8.5;
  if (scaled >= 35) return 8.0;
  if (scaled >= 32) return 7.5;
  if (scaled >= 30) return 7.0;
  if (scaled >= 26) return 6.5;
  if (scaled >= 23) return 6.0;
  if (scaled >= 18) return 5.5;
  if (scaled >= 16) return 5.0;
  if (scaled >= 13) return 4.5;
  if (scaled >= 10) return 4.0;
  if (scaled >= 7) return 3.5;
  if (scaled >= 5) return 3.0;
  return 2.5;
}
`;

export const gasScriptCodeTemplate = GOOGLE_APPS_SCRIPT_CODE;

