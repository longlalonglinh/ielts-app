export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT BACKEND REST API - IELTS EXAM SYSTEM (OPTIMIZED V3.0)
 * ============================================================================
 * 
 * PERFORMANCE & STORAGE ARCHITECTURE:
 * 1. Zero Row-by-Row Loops: Batch setValues() / clearContent() for O(1) Sheets I/O
 *    (10x-50x faster than appendRow/deleteRow loops on large exams & decks)
 * 2. Chunk-Safe CacheService (up to ~450KB per exam, bypassing 100KB key limit)
 *    for EXAMS, EXAM_LIST, and PRACTICE_DECKS (<50ms edge retrieval)
 * 3. Lock-Free Reads & Smart ScriptLock: Read-only requests never contend with
 *    mutating submissions; 30s waitLock protects concurrent writes
 * 4. Google Sheets Storage Hardening:
 *    - 50,000-char cell overflow guard (prevents batch write crashes)
 *    - Formula-injection & #ERROR! protection for essays & plain-text cells
 *    - Submission ID idempotency check (prevents duplicate rows on 302 retries)
 *    - Column-projection reads for get_exams / grade_writing (95% less I/O)
 *    - Auto/manual sheet compaction (optimizeSheetsStorage) to trim blank rows
 * 5. Full Feature Parity: EXAMS, QUESTIONS, SUBMISSIONS, CHEATLOGS,
 *    PRACTICE_QUESTIONS, and STUDENT_PROGRESS (composite-key batch upsert)
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

var CACHE_TTL_EXAM = 600;      // 10 minutes
var CACHE_TTL_LIST = 300;      // 5 minutes
var CACHE_TTL_PRACTICE = 600;  // 10 minutes
var MAX_CELL_CHARS = 49000;    // Safe margin under Google Sheets 50,000-char cell limit
var CACHE_CHUNK_SIZE = 85000;  // Safe margin under GAS CacheService 100KB limit

var PRACTICE_HEADERS = [
  'id', 'code', 'title', 'category', 'level', 'description',
  'question_id', 'type', 'cognitive_level', 'sentence', 'translation',
  'min_selections', 'max_selections', 'options_json', 'target_word',
  'ipa', 'hints', 'grammar_explanation', 'updated_at'
];

var PROGRESS_HEADERS = [
  'STUDENT_ID', 'STUDENT_NAME', 'DECK_ID', 'DECK_TITLE',
  'CARDS_MASTERED', 'TOTAL_CARDS', 'MASTERY_PCT', 'CORRECT_COUNT',
  'WRONG_COUNT', 'DAILY_STREAK', 'LAST_STUDIED_AT', 'NOTES'
];

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
    sheetExams.setFrozenRows(1);
  }

  // Tab 2: QUESTIONS (8 standard columns A-H)
  var sheetQuestions = ss.getSheetByName('QUESTIONS') || ss.insertSheet('QUESTIONS');
  if (sheetQuestions.getLastRow() === 0) {
    sheetQuestions.appendRow([
      'EXAM_CODE', 'QUESTION_ID', 'SECTION', 'QUESTION_TEXT',
      'QUESTION_TYPE', 'OPTIONS_JSON', 'CORRECT_ANSWER', 'MAX_SCORE'
    ]);
    sheetQuestions.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
    sheetQuestions.setFrozenRows(1);
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
    sheetSubmissions.setFrozenRows(1);
  }

  // Tab 4: CHEATLOGS (7 standard columns A-G)
  var sheetCheatlogs = ss.getSheetByName('CHEATLOGS') || ss.insertSheet('CHEATLOGS');
  if (sheetCheatlogs.getLastRow() === 0) {
    sheetCheatlogs.appendRow([
      'LOG_ID', 'SUBMISSION_ID', 'SBD', 'EXAM_CODE',
      'VIOLATION_TYPE', 'VIOLATION_COUNT', 'TIMESTAMP'
    ]);
    sheetCheatlogs.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
    sheetCheatlogs.setFrozenRows(1);
  }

  // Tab 5: PRACTICE_QUESTIONS (19 standard columns for Multi-Format & Bloom Taxonomy)
  var sheetPractice = ss.getSheetByName('PRACTICE_QUESTIONS') || ss.insertSheet('PRACTICE_QUESTIONS');
  if (sheetPractice.getLastRow() === 0) {
    sheetPractice.appendRow(PRACTICE_HEADERS);
    sheetPractice.getRange("1:1").setFontWeight("bold").setBackground("#c7d2fe");
    sheetPractice.setFrozenRows(1);
  }

  // Tab 6: STUDENT_PROGRESS (12 standard columns A-L)
  var sheetStudentProgress = ss.getSheetByName('STUDENT_PROGRESS') || ss.insertSheet('STUDENT_PROGRESS');
  if (sheetStudentProgress.getLastRow() === 0) {
    sheetStudentProgress.appendRow(PROGRESS_HEADERS);
    sheetStudentProgress.getRange("1:1").setFontWeight("bold").setBackground("#ede9fe");
    sheetStudentProgress.setFrozenRows(1);
  }

  Logger.log("Successfully initialized all 6 standard sheets (V3.0 Optimized)!");
}

// ============================================================================
// STORAGE, BATCH I/O & CACHE HELPERS
// ============================================================================

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

// Ensure sheet exists with frozen header row
function ensureSheetWithHeader_(ss, name, headers, headerBg) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(headerBg || "#e2e8f0");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Guard against Google Sheets 50,000-char limit & formula injection (#ERROR! / #NAME?)
function sanitizeCell_(val, maxLen, protectFormula) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  var str = String(val);
  var limit = maxLen || MAX_CELL_CHARS;
  if (str.length > limit) {
    str = str.substring(0, limit);
  }
  if (protectFormula && str.length > 0) {
    var first = str.charAt(0);
    if (first === '=' || first === '+' || first === '@') {
      str = "'" + str;
    } else if (first === '-' && str.length > 1 && !/^-[0-9.]/.test(str)) {
      str = "'" + str;
    }
  }
  return str;
}

// Pad or slice a 2D rows matrix to exact width for setValues()
function normalizeRowWidth_(row, width) {
  var out = new Array(width);
  for (var i = 0; i < width; i++) {
    out[i] = (i < row.length && row[i] !== undefined && row[i] !== null) ? row[i] : '';
  }
  return out;
}

// Batch append rows in a SINGLE setValues() call
function batchAppendRows_(sheet, rows, totalCols) {
  if (!rows || rows.length === 0) return;
  var width = totalCols || rows[0].length;
  var normalized = new Array(rows.length);
  for (var i = 0; i < rows.length; i++) {
    normalized[i] = normalizeRowWidth_(rows[i], width);
  }
  var startRow = Math.max(sheet.getLastRow(), 1) + 1;
  sheet.getRange(startRow, 1, normalized.length, width).setValues(normalized);
}

// Batch replace rows matching any key column index in ONE read + ONE write (zero deleteRow/appendRow loops)
function replaceRowsByKey_(sheet, keyColIndexes, targetKeyUpper, newRows, totalCols) {
  var lastRow = sheet.getLastRow();
  var keptRows = [];

  if (lastRow > 1) {
    var existing = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
    for (var i = 0; i < existing.length; i++) {
      var row = existing[i];
      var isEmptyRow = true;
      var matches = false;

      for (var c = 0; c < totalCols; c++) {
        if (String(row[c] !== undefined && row[c] !== null ? row[c] : '').trim() !== '') {
          isEmptyRow = false;
          break;
        }
      }
      if (isEmptyRow) continue;

      for (var k = 0; k < keyColIndexes.length; k++) {
        var colVal = String(row[keyColIndexes[k]] || '').trim().toUpperCase();
        if (colVal === targetKeyUpper) {
          matches = true;
          break;
        }
      }

      if (!matches) {
        keptRows.push(normalizeRowWidth_(row, totalCols));
      }
    }
  }

  var finalRows = keptRows;
  for (var n = 0; n < newRows.length; n++) {
    finalRows.push(normalizeRowWidth_(newRows[n], totalCols));
  }

  if (finalRows.length > 0) {
    sheet.getRange(2, 1, finalRows.length, totalCols).setValues(finalRows);
  }

  var oldDataCount = Math.max(0, lastRow - 1);
  if (oldDataCount > finalRows.length) {
    var clearStart = 2 + finalRows.length;
    var clearCount = oldDataCount - finalRows.length;
    sheet.getRange(clearStart, 1, clearCount, totalCols).clearContent();
  }
}

// Chunk-safe CacheService writer (transparently handles payloads > 100KB up to ~425KB)
function putCacheSafe_(cache, key, str, ttlSeconds) {
  if (!cache || !key || !str) return;
  try {
    if (str.length <= CACHE_CHUNK_SIZE) {
      cache.put(key, str, ttlSeconds || 300);
      return;
    }
    var chunksCount = Math.ceil(str.length / CACHE_CHUNK_SIZE);
    if (chunksCount > 5) return; // Skip caching extremely huge payloads > 425KB
    var batchMap = {};
    for (var i = 0; i < chunksCount; i++) {
      batchMap[key + '__p' + i] = str.substring(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE);
    }
    batchMap[key] = JSON.stringify({ __chunked: true, n: chunksCount });
    cache.putAll(batchMap, ttlSeconds || 300);
  } catch (e) {}
}

// Chunk-safe CacheService reader
function getCacheSafe_(cache, key) {
  if (!cache || !key) return null;
  try {
    var raw = cache.get(key);
    if (!raw) return null;
    if (raw.indexOf('{"__chunked":true') === 0) {
      var meta = JSON.parse(raw);
      var partKeys = [];
      for (var i = 0; i < meta.n; i++) {
        partKeys.push(key + '__p' + i);
      }
      var partsMap = cache.getAll(partKeys);
      var joined = '';
      for (var j = 0; j < partKeys.length; j++) {
        var seg = partsMap[partKeys[j]];
        if (!seg) return null;
        joined += seg;
      }
      return joined;
    }
    return raw;
  } catch (e) {
    return null;
  }
}

// Remove primary and chunked cache entries
function removeCacheSafe_(cache, key) {
  if (!cache || !key) return;
  try {
    cache.removeAll([key, key + '__p0', key + '__p1', key + '__p2', key + '__p3', key + '__p4']);
  } catch (e) {
    try { cache.remove(key); } catch (e2) {}
  }
}

// Trim excess trailing blank rows/columns and deduplicate SUBMISSIONS
function compactSheet_(sheet, minBufferRows) {
  if (!sheet) return { trimmedRows: 0, trimmedCols: 0 };
  var buf = minBufferRows || 5;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var maxRows = sheet.getMaxRows();
  var trimmedRows = 0;
  if (maxRows > lastRow + buf) {
    var rowsToDelete = maxRows - (lastRow + buf);
    sheet.deleteRows(lastRow + buf + 1, rowsToDelete);
    trimmedRows = rowsToDelete;
  }

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var maxCols = sheet.getMaxColumns();
  var trimmedCols = 0;
  if (maxCols > lastCol + 2) {
    var colsToDelete = maxCols - (lastCol + 2);
    sheet.deleteColumns(lastCol + 3, colsToDelete);
    trimmedCols = colsToDelete;
  }
  return { trimmedRows: trimmedRows, trimmedCols: trimmedCols };
}

function optimizeSheetsStorage() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = ['EXAMS', 'QUESTIONS', 'SUBMISSIONS', 'CHEATLOGS', 'PRACTICE_QUESTIONS', 'STUDENT_PROGRESS'];
  var report = {};

  // Deduplicate SUBMISSIONS by SUBMISSION_ID (keep newest / last row)
  var sheetS = getFlexibleSheet(ss, ['SUBMISSIONS', 'Submissions', 'submissions']);
  var dedupedCount = 0;
  if (sheetS && sheetS.getLastRow() > 2) {
    var lastRow = sheetS.getLastRow();
    var dataS = sheetS.getRange(2, 1, lastRow - 1, 18).getValues();
    var seenMap = {};
    var uniqueReversed = [];
    for (var i = dataS.length - 1; i >= 0; i--) {
      var sid = String(dataS[i][0] || '').trim();
      if (!sid) continue;
      if (!seenMap[sid]) {
        seenMap[sid] = true;
        uniqueReversed.push(normalizeRowWidth_(dataS[i], 18));
      } else {
        dedupedCount++;
      }
    }
    if (dedupedCount > 0) {
      uniqueReversed.reverse();
      if (uniqueReversed.length > 0) {
        sheetS.getRange(2, 1, uniqueReversed.length, 18).setValues(uniqueReversed);
      }
      if (dataS.length > uniqueReversed.length) {
        sheetS.getRange(2 + uniqueReversed.length, 1, dataS.length - uniqueReversed.length, 18).clearContent();
      }
    }
  }

  for (var s = 0; s < sheetNames.length; s++) {
    var sh = ss.getSheetByName(sheetNames[s]);
    if (sh) {
      sh.setFrozenRows(1);
      report[sheetNames[s]] = compactSheet_(sh, 5);
    }
  }

  return {
    status: 'success',
    success: true,
    deduplicated_submissions: dedupedCount,
    compacted: report
  };
}

// JSON Output Helper
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Normalize Google Drive & Dropbox Audio links into direct streamable link
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

// Shared Practice Decks Parser (eliminates GET/POST code duplication)
function buildPracticeDecksResponse_(ss) {
  var sheetP = getFlexibleSheet(ss, ['PRACTICE_QUESTIONS', 'Practice_Questions', 'practice_questions', 'PRACTICE']);
  if (!sheetP || sheetP.getLastRow() <= 1) {
    return {
      status: 'success',
      success: true,
      is_initialized: Boolean(sheetP),
      count: 0,
      decks: [],
      message: 'No practice questions found on sheet.'
    };
  }

  var lastRow = sheetP.getLastRow();
  var dataP = sheetP.getRange(2, 1, lastRow - 1, 19).getValues();
  var decksMap = {};

  for (var pi = 0; pi < dataP.length; pi++) {
    var pRow = dataP[pi];
    var deckKey = String(pRow[0] || pRow[1] || '').trim().toUpperCase();
    if (!deckKey) continue;

    if (!decksMap[deckKey]) {
      decksMap[deckKey] = {
        deck_id: deckKey,
        code: String(pRow[1] || deckKey),
        title: String(pRow[2] || ('Practice Set ' + deckKey)),
        category: String(pRow[3] || 'Vocabulary'),
        level: String(pRow[4] || 'B1-B2'),
        description: String(pRow[5] || ''),
        target_language: 'en',
        native_language: 'vi',
        cards: [],
        is_custom: true
      };
    }

    var optionsParsed = parseJsonSafe(pRow[13]);
    var targetWordStr = String(pRow[14] || '');
    var targetClean = targetWordStr.trim().toLowerCase();

    var optionsData = undefined;
    var optionsPlain = undefined;
    if (Array.isArray(optionsParsed) && optionsParsed.length > 0) {
      var seenOptIds = {};
      optionsData = [];
      optionsPlain = [];
      for (var idx = 0; idx < optionsParsed.length; idx++) {
        var item = optionsParsed[idx];
        var rawId = (typeof item === 'object' && item !== null && item.id) ? String(item.id).trim() : '';
        var oId = (rawId && !seenOptIds[rawId]) ? rawId : ('opt_' + (idx + 1));
        seenOptIds[oId] = true;

        var oText = typeof item === 'string'
          ? item.trim()
          : String((item && (item.text || item.label || item.value)) || ('Option ' + (idx + 1))).trim();
        if (!oText) oText = 'Option ' + (idx + 1);

        var isCor = false;
        if (typeof item === 'object' && item !== null) {
          if (typeof item.isCorrect === 'boolean') isCor = item.isCorrect;
          else if (typeof item.is_correct === 'boolean') isCor = item.is_correct;
          else if (typeof item.correct === 'boolean') isCor = item.correct;
        }
        if (!isCor && targetClean) {
          var lowText = oText.toLowerCase();
          if (lowText === targetClean || targetClean.indexOf(lowText) !== -1 || lowText.indexOf(targetClean) !== -1) {
            isCor = true;
          }
        }

        optionsData.push({
          id: oId,
          text: oText,
          isCorrect: isCor,
          distractorRationale: (typeof item === 'object' && item !== null && (item.distractorRationale || item.explanation))
            ? String(item.distractorRationale || item.explanation)
            : ''
        });
        optionsPlain.push(oText);
      }
    }

    var cardObj = {
      id: String(pRow[6] || ('Q_' + (pi + 1))),
      type: String(pRow[7] || 'multiple-choice'),
      cognitive_level: String(pRow[8] || 'applying'),
      sentence_en: String(pRow[9] || ''),
      sentence_vi: String(pRow[10] || ''),
      min_selections: Number(pRow[11]) || 1,
      max_selections: Number(pRow[12]) || 1,
      cloze_target: targetWordStr,
      target_word: targetWordStr,
      phonetic: String(pRow[15] || ''),
      hints: String(pRow[16] || ''),
      explanation: String(pRow[17] || ''),
      accepted_answers: targetWordStr ? [targetWordStr] : [],
      options_data: optionsData,
      options: optionsPlain,
      updated_at: String(pRow[18] || '')
    };

    if (cardObj.options_data) {
      cardObj.item = {
        id: cardObj.id,
        type: cardObj.type,
        cognitiveLevel: cardObj.cognitive_level,
        learningOutcomeId: 'LO_SHEETS',
        promptPrefix: '',
        stimulusText: cardObj.sentence_en,
        options: cardObj.options_data,
        minSelections: cardObj.min_selections,
        maxSelections: cardObj.max_selections,
        targetWord: cardObj.target_word,
        explanation: cardObj.explanation,
        hints: cardObj.hints
      };
    }

    decksMap[deckKey].cards.push(cardObj);
  }

  var decksList = Object.keys(decksMap).map(function(k) { return decksMap[k]; });
  return {
    status: 'success',
    success: true,
    is_initialized: true,
    count: decksList.length,
    decks: decksList
  };
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
        message: 'Google Apps Script backend V3.0 is live and operational',
        spreadsheet_name: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. GET ALL EXAMS LIST (Column-projected + Cached: skips giant passage & base64 image columns!)
    if (action === 'getexams' || action === 'listexams') {
      var cachedExamsList = getCacheSafe_(cache, 'exams_list_v1');
      if (cachedExamsList) {
        return ContentService.createTextOutput(cachedExamsList).setMimeType(ContentService.MimeType.JSON);
      }

      var sheetE = getFlexibleSheet(ss, ['EXAMS', 'Exams', 'exams', 'DE_THI', 'De_Thi']);
      var examsList = [];
      if (sheetE && sheetE.getLastRow() > 1) {
        var lastExRow = sheetE.getLastRow();
        var metaColsAE = sheetE.getRange(2, 1, lastExRow - 1, 5).getValues();
        var metaColsJK = sheetE.getLastColumn() >= 11
          ? sheetE.getRange(2, 10, lastExRow - 1, 2).getValues()
          : [];

        for (var exI = 0; exI < metaColsAE.length; exI++) {
          var rE = metaColsAE[exI];
          var cCode = String(rE[0] || '').trim().toUpperCase();
          if (cCode) {
            var jk = metaColsJK[exI] || ['', ''];
            examsList.push({
              exam_code: cCode,
              title: rE[1] || ('Exam ' + cCode),
              test_type: rE[2] || 'Academic',
              duration_mins: Number(rE[3]) || 60,
              has_audio: Boolean(rE[4]),
              audio_title: jk[0] || '',
              created_at: jk[1] || ''
            });
          }
        }
      }

      var examsListJson = JSON.stringify({
        status: 'success',
        success: true,
        count: examsList.length,
        exams: examsList
      });
      putCacheSafe_(cache, 'exams_list_v1', examsListJson, CACHE_TTL_LIST);
      return ContentService.createTextOutput(examsListJson).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. GET SINGLE EXAM BY CODE (Chunk-Safe CacheService + Legacy JSON unwrapping)
    if (action === 'getexam' || examCode !== '') {
      var cacheKey = 'exam_' + examCode;
      var cachedJson = examCode ? getCacheSafe_(cache, cacheKey) : null;
      if (cachedJson) {
        return ContentService.createTextOutput(cachedJson).setMimeType(ContentService.MimeType.JSON);
      }

      var sheetQ = getFlexibleSheet(ss, ['QUESTIONS', 'Questions', 'questions', 'CAU_HOI', 'Cau_Hoi', 'Sheet1']);
      var sheetE = getFlexibleSheet(ss, ['EXAMS', 'Exams', 'exams', 'DE_THI', 'De_Thi']);

      var questions = [];
      if (sheetQ && sheetQ.getLastRow() > 1) {
        var lastQRow = sheetQ.getLastRow();
        var qColCount = Math.min(Math.max(sheetQ.getLastColumn(), 8), 8);
        var dataQ = sheetQ.getRange(2, 1, lastQRow - 1, qColCount).getValues();
        for (var i = 0; i < dataQ.length; i++) {
          var row = dataQ[i];
          var codeInRow = String(row[0] || '').trim().toUpperCase();
          if (examCode === '' || codeInRow === examCode) {
            var qText = String(row[3] || '').trim();
            var qType = String(row[4] || 'multiple_choice').toLowerCase().trim();
            var parsedOpts = row[5] ? parseJsonSafe(row[5]) : [];

            // Backward compatibility: unwrap legacy JSON object in Col F if Col D is a short token
            if (parsedOpts && !Array.isArray(parsedOpts) && typeof parsedOpts === 'object') {
              if (parsedOpts.question_text && (qText.length <= 9)) {
                qText = String(parsedOpts.question_text).trim();
              }
              if (parsedOpts.question_type) {
                qType = String(parsedOpts.question_type).toLowerCase().trim();
              }
              parsedOpts = Array.isArray(parsedOpts.options) ? parsedOpts.options : [];
            }

            // Omit row[6] (CORRECT_ANSWER) during test delivery for exam security
            questions.push({
              exam_code: codeInRow,
              question_id: String(row[1] || ('Q' + (i + 1))),
              section: String(row[2] || 'reading').toLowerCase().trim(),
              question_text: qText,
              question_type: qType,
              options: Array.isArray(parsedOpts) ? parsedOpts : [],
              max_score: Number(row[7]) || 1
            });
          }
        }
      }

      var examMeta = null;
      if (sheetE && sheetE.getLastRow() > 1) {
        var lastERow = sheetE.getLastRow();
        var eColCount = Math.min(Math.max(sheetE.getLastColumn(), 11), 11);
        var dataE = sheetE.getRange(2, 1, lastERow - 1, eColCount).getValues();
        for (var j = 0; j < dataE.length; j++) {
          if (String(dataE[j][0] || '').trim().toUpperCase() === examCode) {
            var rawCol8 = String(dataE[j][8] || '');
            var rawCol9 = String(dataE[j][9] || '');
            var isCol8Img = rawCol8.indexOf('http') === 0 || rawCol8.indexOf('data:image') === 0 || rawCol8.indexOf('/') === 0 || rawCol8.indexOf('drive.google') !== -1;
            var resolvedTask1Img = isCol8Img ? rawCol8 : (rawCol9.indexOf('http') === 0 || rawCol9.indexOf('data:image') === 0 || rawCol9.indexOf('/') === 0 ? rawCol9 : '');

            examMeta = {
              exam_code: String(dataE[j][0]).trim().toUpperCase(),
              title: dataE[j][1] || ('IELTS Examination - ' + examCode),
              test_type: dataE[j][2] || 'Academic',
              duration_mins: Number(dataE[j][3]) || 60,
              audio_url: normalizeAudioUrl(String(dataE[j][4] || '')),
              audio_title: isCol8Img ? rawCol9 : '',
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
      // Never cache negative/empty lookups (prevents 10-min stale "not found" after typing before upload)
      if (examCode && (examMeta !== null || questions.length > 0)) {
        putCacheSafe_(cache, cacheKey, responseStr, CACHE_TTL_EXAM);
      }

      return ContentService.createTextOutput(responseStr).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. GET SUBMISSIONS (Supports optional exam_code / sbd / status / limit filters)
    if (action === 'getsubmissions') {
      var sheetS = getFlexibleSheet(ss, ['SUBMISSIONS', 'Submissions', 'submissions']);
      if (!sheetS) return createJsonResponse({ status: 'error', success: false, message: 'Sheet SUBMISSIONS does not exist' });

      var lastSRow = sheetS.getLastRow();
      if (lastSRow <= 1) {
        return createJsonResponse({ status: 'success', success: true, count: 0, data: [], submissions: [] });
      }

      var filterExam = (params.exam_code || '').toString().trim().toUpperCase();
      var filterSbd = (params.sbd || '').toString().trim().toUpperCase();
      var filterStatus = (params.status || '').toString().trim().toUpperCase();
      var limitNum = Number(params.limit) || 0;

      var dataS = sheetS.getRange(2, 1, lastSRow - 1, 18).getValues();
      var submissions = [];
      for (var k = 0; k < dataS.length; k++) {
        var r = dataS[k];
        if (!r[0]) continue;
        if (filterExam && String(r[3] || '').trim().toUpperCase() !== filterExam) continue;
        if (filterSbd && String(r[1] || '').trim().toUpperCase() !== filterSbd) continue;
        var st = String(r[15] || 'PENDING_TEACHER');
        if (filterStatus && st.toUpperCase() !== filterStatus) continue;

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
          status: st,
          writing_status: st,
          submitted_at: r[16],
          violations_count: r[17] || 0
        });
      }

      if (limitNum > 0 && submissions.length > limitNum) {
        submissions = submissions.slice(submissions.length - limitNum);
      }

      return createJsonResponse({ status: 'success', success: true, count: submissions.length, data: submissions, submissions: submissions });
    }

    // 5. GET CHEAT LOGS (Supports optional exam_code / sbd / limit filters)
    if (action === 'getcheatlogs') {
      var sheetC = getFlexibleSheet(ss, ['CHEATLOGS', 'Cheatlogs', 'cheatlogs', 'CHEAT_LOGS']);
      if (!sheetC) return createJsonResponse({ status: 'error', success: false, message: 'Sheet CHEATLOGS does not exist' });

      var lastCRow = sheetC.getLastRow();
      if (lastCRow <= 1) {
        return createJsonResponse({ status: 'success', success: true, count: 0, data: [], cheatlogs: [] });
      }

      var cFilterExam = (params.exam_code || '').toString().trim().toUpperCase();
      var cFilterSbd = (params.sbd || '').toString().trim().toUpperCase();
      var cLimit = Number(params.limit) || 0;

      var dataC = sheetC.getRange(2, 1, lastCRow - 1, 7).getValues();
      var cheatlogs = [];
      for (var cl = 0; cl < dataC.length; cl++) {
        var rc = dataC[cl];
        if (!rc[0]) continue;
        if (cFilterExam && String(rc[3] || '').trim().toUpperCase() !== cFilterExam) continue;
        if (cFilterSbd && String(rc[2] || '').trim().toUpperCase() !== cFilterSbd) continue;

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

      if (cLimit > 0 && cheatlogs.length > cLimit) {
        cheatlogs = cheatlogs.slice(cheatlogs.length - cLimit);
      }

      return createJsonResponse({ status: 'success', success: true, count: cheatlogs.length, data: cheatlogs, cheatlogs: cheatlogs });
    }

    // 6. GET PRACTICE DECKS (Cached in CacheService for ultra-fast load)
    if (action === 'getpracticedecks' || action === 'getpracticesheet' || action === 'getdecks') {
      var cachedPractice = getCacheSafe_(cache, 'practice_decks_v1');
      if (cachedPractice) {
        return ContentService.createTextOutput(cachedPractice).setMimeType(ContentService.MimeType.JSON);
      }
      var pResp = buildPracticeDecksResponse_(ss);
      var pJson = JSON.stringify(pResp);
      if (pResp.decks && pResp.decks.length > 0) {
        putCacheSafe_(cache, 'practice_decks_v1', pJson, CACHE_TTL_PRACTICE);
      }
      return ContentService.createTextOutput(pJson).setMimeType(ContentService.MimeType.JSON);
    }

    // 7. GET STUDENT PROGRESS (STUDENT_PROGRESS tab)
    if (action === 'getstudentprogress') {
      var sheetSP = getFlexibleSheet(ss, ['STUDENT_PROGRESS', 'Student_Progress', 'student_progress']);
      if (!sheetSP || sheetSP.getLastRow() <= 1) {
        return createJsonResponse({ status: 'success', success: true, count: 0, records: [] });
      }
      var filterStudent = (params.student_id || params.sbd || '').toString().trim().toUpperCase();
      var lastSPRow = sheetSP.getLastRow();
      var dataSP = sheetSP.getRange(2, 1, lastSPRow - 1, 12).getValues();
      var records = [];
      for (var sp = 0; sp < dataSP.length; sp++) {
        var rSP = dataSP[sp];
        var stId = String(rSP[0] || '').trim();
        if (!stId) continue;
        if (filterStudent && stId.toUpperCase() !== filterStudent) continue;

        records.push({
          student_id: stId,
          student_name: String(rSP[1] || ''),
          deck_id: String(rSP[2] || ''),
          deck_title: String(rSP[3] || ''),
          cards_mastered: Number(rSP[4]) || 0,
          total_cards: Number(rSP[5]) || 0,
          mastery_pct: Number(rSP[6]) || 0,
          correct_count: Number(rSP[7]) || 0,
          wrong_count: Number(rSP[8]) || 0,
          daily_streak: Number(rSP[9]) || 0,
          last_studied_at: String(rSP[10] || ''),
          notes: String(rSP[11] || '')
        });
      }
      return createJsonResponse({ status: 'success', success: true, count: records.length, records: records });
    }

    // Fallback: system info
    return createJsonResponse({
      status: 'success',
      success: true,
      message: 'IELTS Google Apps Script API V3.0 (Batch & Cache Optimized) Ready.',
      available_actions: [
        'ping', 'get_exams', 'get_exam', 'get_submissions',
        'get_cheatlogs', 'get_practice_decks', 'get_student_progress'
      ]
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', success: false, message: err.toString() });
  }
}

/**
 * ============================================================================
 * POST API: Lock-free Reads + ScriptLock-Protected Batch Mutations
 * ============================================================================
 */
function doPost(e) {
  var cache = CacheService.getScriptCache();
  var payload = {};

  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (parseErr) {
    return createJsonResponse({ status: 'error', success: false, message: 'Invalid JSON payload: ' + parseErr.toString() });
  }

  var rawAction = payload.action || 'submit_exam';
  var action = rawAction.toLowerCase().replace(/_/g, '');

  // Fast-path Read-only POST actions WITHOUT waiting on ScriptLock
  if (action === 'getpracticedecks' || action === 'getpracticesheet' || action === 'getdecks') {
    try {
      var cachedP = getCacheSafe_(cache, 'practice_decks_v1');
      if (cachedP) {
        return ContentService.createTextOutput(cachedP).setMimeType(ContentService.MimeType.JSON);
      }
      var ssRead = SpreadsheetApp.getActiveSpreadsheet();
      var pResp = buildPracticeDecksResponse_(ssRead);
      var pJson = JSON.stringify(pResp);
      if (pResp.decks && pResp.decks.length > 0) {
        putCacheSafe_(cache, 'practice_decks_v1', pJson, CACHE_TTL_PRACTICE);
      }
      return ContentService.createTextOutput(pJson).setMimeType(ContentService.MimeType.JSON);
    } catch (readErr) {
      return createJsonResponse({ status: 'error', success: false, message: readErr.toString() });
    }
  }

  // Acquire ScriptLock strictly for mutating actions
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    lock.waitLock(30000);
    hasLock = true;
  } catch (lockErr) {
    hasLock = lock.tryLock(5000);
  }

  if (!hasLock) {
    return createJsonResponse({
      status: 'ERROR',
      success: false,
      message: 'Concurrent write lock busy in Google Sheets. Please retry.'
    });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var response = { status: 'error', success: false, message: 'Unknown action: ' + rawAction };

    // 1. SUBMIT EXAM (Idempotent deduplication + Batch Cheatlog append + Cell guard)
    if (action === 'submitexam') {
      var sbd = payload.sbd || 'GUEST';
      var examCode = (payload.exam_code || 'TEST01').toString().trim().toUpperCase();
      var testMode = payload.test_mode || 'TEST';
      var listeningAnswers = payload.listening_answers || payload.user_answers || {};
      var readingAnswers = payload.reading_answers || payload.user_answers || {};
      var writingTask1Text = sanitizeCell_(payload.writing_task1_text || payload.writing_task1 || '', MAX_CELL_CHARS, true);
      var writingTask2Text = sanitizeCell_(payload.writing_task2_text || payload.writing_task2 || '', MAX_CELL_CHARS, true);
      var cheatLogs = payload.cheat_logs || payload.violation_logs || [];
      var violationsCount = Number(payload.violations_count || 0);

      var timestampStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
      var submissionId = String(payload.submission_id || (sbd + "_" + examCode + "_" + timestampStr)).trim();
      var submittedAt = payload.submitted_at || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

      var sheetSubmissions = ensureSheetWithHeader_(ss, 'SUBMISSIONS', [
        'SUBMISSION_ID', 'SBD', 'STUDENT_NAME', 'EXAM_CODE', 'TEST_MODE',
        'LISTENING_RAW', 'LISTENING_BAND', 'READING_RAW', 'READING_BAND',
        'WRITING_TASK1_TEXT', 'WRITING_TASK2_TEXT', 'ANSWERS_JSON', 'WRITING_SCORES_JSON',
        'WRITING_BAND', 'OVERALL_BAND', 'STATUS', 'SUBMITTED_AT', 'VIOLATIONS_COUNT'
      ], "#e2e8f0");

      // Idempotency check: scan ONLY column A to avoid duplicate row on client retry
      var existingSubRowIdx = -1;
      var subLastRow = sheetSubmissions.getLastRow();
      if (subLastRow > 1) {
        var existingIds = sheetSubmissions.getRange(2, 1, subLastRow - 1, 1).getValues();
        for (var si = 0; si < existingIds.length; si++) {
          if (String(existingIds[si][0] || '').trim() === submissionId) {
            existingSubRowIdx = si + 2;
            break;
          }
        }
      }

      var listeningRaw = payload.listening_raw !== undefined ? payload.listening_raw : (payload.listening_raw_score || 0);
      var readingRaw = payload.reading_raw !== undefined ? payload.reading_raw : (payload.reading_raw_score || 0);
      var listeningBand = payload.listening_band || 0;
      var readingBand = payload.reading_band || 0;

      // Server-side scoring check if bands not supplied by client
      if ((!listeningBand || !readingBand) && examCode) {
        var sheetQ = getFlexibleSheet(ss, ['QUESTIONS', 'Questions', 'questions']);
        var correctAnswersMap = {};
        if (sheetQ && sheetQ.getLastRow() > 1) {
          var qData = sheetQ.getRange(2, 1, sheetQ.getLastRow() - 1, 8).getValues();
          for (var qi = 0; qi < qData.length; qi++) {
            if (String(qData[qi][0] || '').trim().toUpperCase() === examCode) {
              correctAnswersMap[String(qData[qi][1])] = {
                section: String(qData[qi][2] || '').toLowerCase(),
                correct: String(qData[qi][6] || '').trim().toUpperCase(),
                max_score: Number(qData[qi][7]) || 1
              };
            }
          }
        }

        if (!listeningBand && Object.keys(correctAnswersMap).length > 0) {
          var lRaw = 0; var lMax = 0;
          for (var lKey in listeningAnswers) {
            var lVal = String(listeningAnswers[lKey] || '').trim().toUpperCase();
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
            var rVal = String(readingAnswers[rKey] || '').trim().toUpperCase();
            if (correctAnswersMap[rKey] && correctAnswersMap[rKey].section === 'reading') {
              rMax += correctAnswersMap[rKey].max_score;
              if (rVal === correctAnswersMap[rKey].correct) rRaw += correctAnswersMap[rKey].max_score;
            }
          }
          readingRaw = rRaw;
          readingBand = convertRawToIeltsBand(readingRaw, rMax || 40);
        }
      }

      var studentName = sanitizeCell_(payload.student_name || payload.candidate_name || '', 500, true);
      var answersJson = sanitizeCell_(JSON.stringify({
        answers: payload.answers || {},
        listening: payload.listening_answers || {},
        reading: payload.reading_answers || {}
      }), MAX_CELL_CHARS, false);
      var writingScoresJson = JSON.stringify(payload.writing_scores || { TR: 0, CC: 0, LR: 0, GRA: 0 });
      var writingBand = payload.writing_band || 0;
      var status = payload.status || payload.writing_status || 'PENDING_TEACHER';

      var subRowData = [
        submissionId,
        sanitizeCell_(sbd, 100, true),
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
      ];

      if (existingSubRowIdx > 0) {
        // Update existing submission row in-place (prevents duplicates on retry)
        sheetSubmissions.getRange(existingSubRowIdx, 1, 1, 18).setValues([subRowData]);
      } else {
        batchAppendRows_(sheetSubmissions, [subRowData], 18);
      }

      // Batch append cheat logs in ONE setValues() call
      if (cheatLogs && cheatLogs.length > 0 && existingSubRowIdx === -1) {
        var sheetCheatlogs = ensureSheetWithHeader_(ss, 'CHEATLOGS', [
          'LOG_ID', 'SUBMISSION_ID', 'SBD', 'EXAM_CODE',
          'VIOLATION_TYPE', 'VIOLATION_COUNT', 'TIMESTAMP'
        ], "#e2e8f0");
        var cheatRows = [];
        for (var c = 0; c < cheatLogs.length; c++) {
          var log = cheatLogs[c] || {};
          cheatRows.push([
            log.log_id || ('LOG_' + Date.now() + '_' + c),
            submissionId,
            sanitizeCell_(sbd, 100, true),
            examCode,
            log.violation_type || 'ONBLUR',
            log.violation_count || 1,
            log.timestamp || submittedAt
          ]);
        }
        batchAppendRows_(sheetCheatlogs, cheatRows, 7);
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
        writing_status: status,
        submitted_at: submittedAt,
        deduplicated: existingSubRowIdx > 0
      };
    }

    // 2. GRADE WRITING (Column-A index scan + Single-range batch update)
    else if (action === 'gradewriting') {
      var subId = String(payload.submission_id || '').trim();
      var scores = payload.writing_scores || { TR: 6, CC: 6, LR: 6, GRA: 6 };
      var computedBand = Math.round((((Number(scores.TR) || 0) + (Number(scores.CC) || 0) + (Number(scores.LR) || 0) + (Number(scores.GRA) || 0)) / 4) * 2) / 2;
      var writingBand = (payload.writing_band !== undefined && payload.writing_band !== null) ? Number(payload.writing_band) : computedBand;

      var sheetS = getFlexibleSheet(ss, ['SUBMISSIONS', 'Submissions', 'submissions']);
      if (sheetS && sheetS.getLastRow() > 1) {
        var sLastRow = sheetS.getLastRow();
        var colA = sheetS.getRange(2, 1, sLastRow - 1, 1).getValues();
        for (var rowIdx = 0; rowIdx < colA.length; rowIdx++) {
          if (String(colA[rowIdx][0] || '').trim() === subId) {
            var sheetRowNum = rowIdx + 2;
            var bandsRow = sheetS.getRange(sheetRowNum, 7, 1, 3).getValues()[0]; // Col G (7)=L_BAND, Col I (9)=R_BAND
            var lB = Number(bandsRow[0]) || 0;
            var rB = Number(bandsRow[2]) || 0;

            var activeBands = [];
            if (lB > 0) activeBands.push(lB);
            if (rB > 0) activeBands.push(rB);
            if (writingBand > 0) activeBands.push(writingBand);
            var overallB = activeBands.length > 0
              ? Math.round((activeBands.reduce(function(a, b) { return a + b; }, 0) / activeBands.length) * 2) / 2
              : writingBand;

            // Single batch write across columns M:P (13..16)
            sheetS.getRange(sheetRowNum, 13, 1, 4).setValues([[
              JSON.stringify(scores),
              writingBand,
              overallB,
              'GRADED'
            ]]);

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

    // 3. UPLOAD / UPDATE EXAM (Batch replace in QUESTIONS — zero deleteRow/appendRow loops!)
    else if (action === 'uploadexam') {
      var exam = payload.exam_data;
      if (!exam) return createJsonResponse({ status: 'error', success: false, message: 'Missing exam_data' });

      var sheetE = ensureSheetWithHeader_(ss, 'EXAMS', [
        'EXAM_CODE', 'TITLE', 'TEST_TYPE', 'DURATION_MINS',
        'AUDIO_URL', 'READING_PASSAGE', 'WRITING_TASK1_PROMPT', 'WRITING_TASK2_PROMPT',
        'WRITING_TASK1_IMAGE', 'AUDIO_TITLE', 'CREATED_AT'
      ], "#e2e8f0");
      var sheetQ = ensureSheetWithHeader_(ss, 'QUESTIONS', [
        'EXAM_CODE', 'QUESTION_ID', 'SECTION', 'QUESTION_TEXT',
        'QUESTION_TYPE', 'OPTIONS_JSON', 'CORRECT_ANSWER', 'MAX_SCORE'
      ], "#e2e8f0");

      var eCode = (exam.exam_code || 'IELTS01').toString().trim().toUpperCase();
      var eTitle = sanitizeCell_(exam.title || ('IELTS Exam ' + eCode), 500, true);
      var eType = exam.test_type || 'Academic';
      var eDuration = Number(exam.duration_mins) || 60;
      var examSkills = exam.skills || [];
      var isOneSkill = exam.exam_type === 'one_skill' || examSkills.length === 1;

      var allowListening = !isOneSkill || examSkills.indexOf('listening') !== -1;
      var allowReading = !isOneSkill || examSkills.indexOf('reading') !== -1;
      var allowWriting = !isOneSkill || examSkills.indexOf('writing') !== -1;

      var eAudio = allowListening ? normalizeAudioUrl(exam.audio_url || '') : '';

      var ePassage = '';
      if (allowReading) {
        if (exam.passages && exam.passages.length > 0) {
          ePassage = exam.passages.map(function(p) { return p.text || ''; }).join('\\n\\n--- Passage Divider ---\\n\\n');
        } else if (exam.passage_text || exam.reading_passage) {
          ePassage = exam.passage_text || exam.reading_passage;
        }
      }
      ePassage = sanitizeCell_(ePassage, MAX_CELL_CHARS, true);

      var eW1 = allowWriting ? sanitizeCell_(exam.writing_task1_prompt || '', MAX_CELL_CHARS, true) : '';
      var eW2 = allowWriting ? sanitizeCell_(exam.writing_task2_prompt || '', MAX_CELL_CHARS, true) : '';
      var rawTask1Img = allowWriting ? (exam.writing_task1_image || exam.writing_task1_image_url || exam.writing_task1_imageUrl || '') : '';
      var eW1Img = (rawTask1Img && rawTask1Img.length > 45000 && rawTask1Img.indexOf('data:image') === 0) ? '' : sanitizeCell_(rawTask1Img, MAX_CELL_CHARS, false);
      var eAudioTitle = sanitizeCell_(exam.audio_title || '', 500, true);
      var nowTime = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

      // In-place update or append in EXAMS tab (scan Col A only)
      var existingRowIdx = -1;
      var eLastRow = sheetE.getLastRow();
      if (eLastRow > 1) {
        var examCodesCol = sheetE.getRange(2, 1, eLastRow - 1, 1).getValues();
        for (var er = 0; er < examCodesCol.length; er++) {
          if (String(examCodesCol[er][0] || '').trim().toUpperCase() === eCode) {
            existingRowIdx = er + 2;
            break;
          }
        }
      }

      var examRow = [eCode, eTitle, eType, eDuration, eAudio, ePassage, eW1, eW2, eW1Img, eAudioTitle, nowTime];
      if (existingRowIdx > 0) {
        sheetE.getRange(existingRowIdx, 1, 1, examRow.length).setValues([examRow]);
      } else {
        batchAppendRows_(sheetE, [examRow], 11);
      }

      var listeningQs = allowListening ? (exam.listening_questions || []) : [];
      var readingQs = allowReading ? (exam.reading_questions || []) : [];

      var allQuestions = [];
      if (isOneSkill) {
        if (examSkills.indexOf('listening') !== -1) {
          allQuestions = listeningQs;
        } else if (examSkills.indexOf('reading') !== -1) {
          allQuestions = readingQs;
        } else {
          allQuestions = [];
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

      var questionRows = [];
      for (var qi = 0; qi < allQuestions.length; qi++) {
        var curQ = allQuestions[qi];
        var optStr = Array.isArray(curQ.options) ? JSON.stringify(curQ.options) : (curQ.options || '[]');
        questionRows.push([
          eCode,
          curQ.question_id || ('Q' + (qi + 1)),
          curQ.section || 'reading',
          sanitizeCell_(curQ.question_text || '', MAX_CELL_CHARS, true),
          curQ.question_type || 'multiple_choice',
          sanitizeCell_(optStr, MAX_CELL_CHARS, false),
          sanitizeCell_(curQ.correct_answer || '', 5000, true),
          Number(curQ.max_score) || 1
        ]);
      }

      // Single batch replace in QUESTIONS
      replaceRowsByKey_(sheetQ, [0], eCode, questionRows, 8);

      // Invalidate caches
      removeCacheSafe_(cache, 'exam_' + eCode);
      removeCacheSafe_(cache, 'exams_list_v1');

      response = {
        status: 'success',
        success: true,
        exam_code: eCode,
        questions_count: questionRows.length,
        message: 'Exam uploaded and synchronized in batch mode successfully!'
      };
    }

    // 3B. DELETE EXAM (Batch removal + cache invalidation)
    else if (action === 'deleteexam') {
      var delCode = String(payload.exam_code || payload.code || '').trim().toUpperCase();
      if (!delCode) return createJsonResponse({ status: 'error', success: false, message: 'Missing exam_code' });

      var sheetE = getFlexibleSheet(ss, ['EXAMS', 'Exams', 'exams']);
      var sheetQ = getFlexibleSheet(ss, ['QUESTIONS', 'Questions', 'questions']);
      if (sheetE) replaceRowsByKey_(sheetE, [0], delCode, [], 11);
      if (sheetQ) replaceRowsByKey_(sheetQ, [0], delCode, [], 8);

      removeCacheSafe_(cache, 'exam_' + delCode);
      removeCacheSafe_(cache, 'exams_list_v1');

      response = {
        status: 'success',
        success: true,
        exam_code: delCode,
        message: 'Exam and associated questions deleted successfully.'
      };
    }

    // 4. INIT PRACTICE DB (Batch write all cards in ONE setValues() call)
    else if (action === 'initpracticedb' || action === 'initpracticesheet' || action === 'initpracticequestions') {
      var sheetP = ensureSheetWithHeader_(ss, 'PRACTICE_QUESTIONS', PRACTICE_HEADERS, "#c7d2fe");
      var mode = payload.mode || 'replace_all';
      var decks = payload.decks || [];

      if (mode === 'replace_all' && sheetP.getLastRow() > 1) {
        sheetP.getRange(2, 1, sheetP.getLastRow() - 1, PRACTICE_HEADERS.length).clearContent();
      }

      var nowTime = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      var rowsToWrite = [];

      for (var d = 0; d < decks.length; d++) {
        var curDeck = decks[d];
        var dId = String(curDeck.deck_id || curDeck.id || curDeck.code || ('DECK_' + (d + 1))).trim().toUpperCase();
        var dCode = String(curDeck.code || dId);
        var dTitle = sanitizeCell_(curDeck.title || ('Practice Set ' + dId), 500, true);
        var dCategory = curDeck.category || 'Vocabulary';
        var dLevel = curDeck.level || 'B1-B2';
        var dDesc = sanitizeCell_(curDeck.description || '', 2000, true);

        var cards = curDeck.cards || curDeck.questions || curDeck.items || [];
        for (var c = 0; c < cards.length; c++) {
          var card = cards[c];
          var qId = String(card.id || card.card_id || card.question_id || ('Q_' + (c + 1)));
          var qType = String(card.type || 'multiple-choice');
          if (qType === 'multi-response') qType = 'multiple-response';
          var cogLevel = String(card.cognitive_level || card.cognitiveLevel || 'applying');
          var sentence = sanitizeCell_(card.sentence_en || card.sentence || card.stimulusText || card.question || '', MAX_CELL_CHARS, true);
          var translation = sanitizeCell_(card.sentence_vi || card.translation || card.vietnameseContext || '', MAX_CELL_CHARS, true);
          var minSel = Number(card.min_selections || card.minSelections || (qType === 'multiple-response' ? 2 : 1));
          var maxSel = Number(card.max_selections || card.maxSelections || (qType === 'multiple-response' ? 2 : 1));
          var optionsJson = sanitizeCell_(JSON.stringify(card.options_data || card.options || []), MAX_CELL_CHARS, false);
          var targetWord = sanitizeCell_(card.target_word || card.targetWord || card.cloze_target || '', 2000, true);
          var ipa = sanitizeCell_(card.phonetic || card.ipa || '', 500, true);
          var hints = sanitizeCell_(card.hints || card.hint || '', 5000, true);
          var grammarExp = sanitizeCell_(card.explanation || card.grammar_explanation || card.grammarExplanation || '', MAX_CELL_CHARS, true);
          var updatedAt = card.updated_at || nowTime;

          rowsToWrite.push([
            dId, dCode, dTitle, dCategory, dLevel, dDesc,
            qId, qType, cogLevel, sentence, translation,
            minSel, maxSel, optionsJson, targetWord,
            ipa, hints, grammarExp, updatedAt
          ]);
        }
      }

      if (rowsToWrite.length > 0) {
        if (mode === 'replace_all') {
          sheetP.getRange(2, 1, rowsToWrite.length, PRACTICE_HEADERS.length).setValues(rowsToWrite);
        } else {
          batchAppendRows_(sheetP, rowsToWrite, PRACTICE_HEADERS.length);
        }
      }

      removeCacheSafe_(cache, 'practice_decks_v1');

      response = {
        status: 'success',
        success: true,
        message: 'Practice database initialized in batch mode on Google Sheets successfully!',
        total_cards: rowsToWrite.length
      };
    }

    // 5. SAVE / UPDATE PRACTICE DECK (Batch replace by deck ID/code — zero deleteRow/appendRow loops!)
    else if (action === 'savepracticedeck' || action === 'savepracticequestions') {
      var sheetP = ensureSheetWithHeader_(ss, 'PRACTICE_QUESTIONS', PRACTICE_HEADERS, "#c7d2fe");
      var targetDeck = payload.deck || payload.practice_deck || {};
      var targetId = String(targetDeck.deck_id || targetDeck.id || targetDeck.code || '').trim().toUpperCase();
      var dCode = String(targetDeck.code || targetId);
      var dTitle = sanitizeCell_(targetDeck.title || ('Practice Set ' + targetId), 500, true);
      var dCategory = targetDeck.category || 'Vocabulary';
      var dLevel = targetDeck.level || 'B1-B2';
      var dDesc = sanitizeCell_(targetDeck.description || '', 2000, true);
      var cards = targetDeck.cards || targetDeck.questions || targetDeck.items || [];
      var nowTime = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

      var deckRows = [];
      for (var sc = 0; sc < cards.length; sc++) {
        var sCard = cards[sc];
        var sqId = String(sCard.id || sCard.card_id || sCard.question_id || ('Q_' + (sc + 1)));
        var sqType = String(sCard.type || 'multiple-choice');
        if (sqType === 'multi-response') sqType = 'multiple-response';
        var scog = String(sCard.cognitive_level || sCard.cognitiveLevel || 'applying');
        var sSent = sanitizeCell_(sCard.sentence_en || sCard.sentence || sCard.stimulusText || sCard.question || '', MAX_CELL_CHARS, true);
        var sTrans = sanitizeCell_(sCard.sentence_vi || sCard.translation || sCard.vietnameseContext || '', MAX_CELL_CHARS, true);
        var sMin = Number(sCard.min_selections || sCard.minSelections || (sqType === 'multiple-response' ? 2 : 1));
        var sMax = Number(sCard.max_selections || sCard.maxSelections || (sqType === 'multiple-response' ? 2 : 1));
        var sOpt = sanitizeCell_(JSON.stringify(sCard.options_data || sCard.options || []), MAX_CELL_CHARS, false);
        var sWord = sanitizeCell_(sCard.target_word || sCard.targetWord || sCard.cloze_target || '', 2000, true);
        var sIpa = sanitizeCell_(sCard.phonetic || sCard.ipa || '', 500, true);
        var sHint = sanitizeCell_(sCard.hints || sCard.hint || '', 5000, true);
        var sGram = sanitizeCell_(sCard.explanation || sCard.grammar_explanation || sCard.grammarExplanation || '', MAX_CELL_CHARS, true);

        deckRows.push([
          targetId, dCode, dTitle, dCategory, dLevel, dDesc,
          sqId, sqType, scog, sSent, sTrans,
          sMin, sMax, sOpt, sWord,
          sIpa, sHint, sGram, nowTime
        ]);
      }

      if (targetId) {
        replaceRowsByKey_(sheetP, [0, 1], targetId, deckRows, PRACTICE_HEADERS.length);
      } else {
        batchAppendRows_(sheetP, deckRows, PRACTICE_HEADERS.length);
      }

      removeCacheSafe_(cache, 'practice_decks_v1');

      response = {
        status: 'success',
        success: true,
        deck_id: targetId,
        cards_count: deckRows.length,
        message: 'Practice deck saved to Google Sheets in batch mode successfully!'
      };
    }

    // 5B. DELETE PRACTICE DECK
    else if (action === 'deletepracticedeck') {
      var delDeckId = String(payload.deck_id || payload.id || payload.code || '').trim().toUpperCase();
      if (!delDeckId) return createJsonResponse({ status: 'error', success: false, message: 'Missing deck_id' });

      var sheetP = getFlexibleSheet(ss, ['PRACTICE_QUESTIONS', 'Practice_Questions', 'practice_questions', 'PRACTICE']);
      if (sheetP) {
        replaceRowsByKey_(sheetP, [0, 1], delDeckId, [], PRACTICE_HEADERS.length);
      }
      removeCacheSafe_(cache, 'practice_decks_v1');

      response = {
        status: 'success',
        success: true,
        deck_id: delDeckId,
        message: 'Practice deck deleted from Google Sheets successfully!'
      };
    }

    // 6. SYNC STUDENT PROGRESS (Batch Upsert by composite key STUDENT_ID + DECK_ID)
    else if (action === 'syncstudentprogress') {
      var sheetSP = ensureSheetWithHeader_(ss, 'STUDENT_PROGRESS', PROGRESS_HEADERS, "#ede9fe");
      var records = payload.progress_records || payload.records || [];
      if (!Array.isArray(records) || records.length === 0) {
        return createJsonResponse({ status: 'success', success: true, updated_count: 0, message: 'No records to sync.' });
      }

      var spLastRow = sheetSP.getLastRow();
      var existingRows = spLastRow > 1 ? sheetSP.getRange(2, 1, spLastRow - 1, PROGRESS_HEADERS.length).getValues() : [];
      var keyToIdx = {};
      for (var ei = 0; ei < existingRows.length; ei++) {
        var ek = String(existingRows[ei][0] || '').trim().toUpperCase() + '::' + String(existingRows[ei][2] || '').trim().toUpperCase();
        if (ek !== '::') keyToIdx[ek] = ei;
      }

      var nowProgressTime = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      for (var ri = 0; ri < records.length; ri++) {
        var rec = records[ri];
        if (!rec) continue;
        var stId = String(rec.student_id || 'GUEST').trim();
        var dkId = String(rec.deck_id || 'DEFAULT').trim();
        var compKey = stId.toUpperCase() + '::' + dkId.toUpperCase();
        var rowArr = [
          sanitizeCell_(stId, 100, true),
          sanitizeCell_(rec.student_name || '', 200, true),
          sanitizeCell_(dkId, 100, true),
          sanitizeCell_(rec.deck_title || '', 300, true),
          Number(rec.cards_mastered) || 0,
          Number(rec.total_cards) || 0,
          Number(rec.mastery_pct) || 0,
          Number(rec.correct_count) || 0,
          Number(rec.wrong_count) || 0,
          Number(rec.daily_streak) || 0,
          rec.last_studied_at || nowProgressTime,
          sanitizeCell_(rec.notes || '', 2000, true)
        ];

        if (keyToIdx[compKey] !== undefined) {
          existingRows[keyToIdx[compKey]] = rowArr;
        } else {
          keyToIdx[compKey] = existingRows.length;
          existingRows.push(rowArr);
        }
      }

      if (existingRows.length > 0) {
        sheetSP.getRange(2, 1, existingRows.length, PROGRESS_HEADERS.length).setValues(existingRows);
      }

      response = {
        status: 'success',
        success: true,
        updated_count: records.length,
        message: 'Student progress batch-synchronized to Google Sheets!'
      };
    }

    // 7. OPTIMIZE & COMPACT SHEETS STORAGE
    else if (action === 'optimizesheets' || action === 'compactsheets') {
      response = optimizeSheetsStorage();
    }

    return createJsonResponse(response);

  } catch (err) {
    return createJsonResponse({ status: 'error', success: false, message: err.toString() });
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (relErr) {}
    }
  }
}

function parseJsonSafe(str) {
  if (!str) return [];
  if (typeof str === 'object') return str;
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
