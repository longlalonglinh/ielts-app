import React, { useState, useRef, useEffect } from 'react';
import { Question } from '../../types';
import { 
  Play, 
  Volume2, 
  VolumeX, 
  Headphones, 
  CheckCircle2, 
  Lock,
  Sparkles,
  ChevronRight,
  Info,
  AlertCircle,
  Save
} from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { IELTSQuestionCard } from './IELTSQuestionCard';
import { 
  saveAudioProgressToIndexedDB, 
  getAudioProgressFromIndexedDB 
} from '../../services/indexedDb';
import { resolvePlayableAudioUrl, isGoogleDriveAudio } from '../../utils/audioUrl';

interface ListeningModuleProps {
  audioUrl?: string;
  questions: Question[];
  userAnswers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  testMode?: 'TEST' | 'PRACTICE';
  durationMins?: number;
  examCode?: string;
  candidateId?: string;
  onTimeExpire?: () => void;
}

export const ListeningModule: React.FC<ListeningModuleProps> = ({
  audioUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3',
  questions,
  userAnswers,
  onAnswerChange,
  testMode = 'TEST',
  durationMins = 30,
  examCode = 'IELTS01',
  candidateId = 'STUDENT',
  onTimeExpire
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activePart, setActivePart] = useState<1 | 2 | 3 | 4>(1);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [useDirectStream, setUseDirectStream] = useState(false);

  const cleanAudioUrl = (audioUrl && typeof audioUrl === 'string' && audioUrl.trim().length > 0) ? audioUrl.trim() : null;
  const playableUrl = cleanAudioUrl ? resolvePlayableAudioUrl(cleanAudioUrl, useDirectStream) : null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maxAllowedTimeRef = useRef<number>(0);
  const lastSavedTimeRef = useRef<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [autoSaveTime, setAutoSaveTime] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());

  const handleToggleFlag = (questionId: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (Object.keys(userAnswers).length > 0) {
      setIsSaving(true);
      const timer = setTimeout(() => {
        setAutoSaveTime(new Date().toLocaleTimeString());
        setIsSaving(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [userAnswers]);

  // Group questions into IELTS Parts (Part 1, 2, 3, 4)
  const getPartForQuestion = (q: Question, idx: number): 1 | 2 | 3 | 4 => {
    if (q.part && [1, 2, 3, 4].includes(q.part)) return q.part as 1 | 2 | 3 | 4;
    if (idx < 10) return 1;
    if (idx < 20) return 2;
    if (idx < 30) return 3;
    return 4;
  };

  const questionsWithPart = questions.map((q, idx) => ({
    ...q,
    computedPart: getPartForQuestion(q, idx),
    globalNumber: q.question_number || (idx + 1)
  }));

  // Auto-switch to the first part that actually contains questions (supports single-part tests)
  useEffect(() => {
    if (questionsWithPart.length > 0) {
      const partsWithQuestions = Array.from(new Set(questionsWithPart.map(q => q.computedPart))).sort((a, b) => a - b);
      if (partsWithQuestions.length > 0 && !partsWithQuestions.includes(activePart)) {
        setActivePart(partsWithQuestions[0]);
      }
    }
  }, [questionsWithPart, activePart]);

  const filteredQuestions = questionsWithPart.filter(q => q.computedPart === activePart);

  // Calculate answered stats
  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => Boolean(userAnswers[q.question_id]?.trim())).length;

  // Requirement 4: Restore audio position from IndexedDB on mount / reload
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedTime = await getAudioProgressFromIndexedDB(examCode, candidateId);
        if (isMounted && savedTime > 1) {
          maxAllowedTimeRef.current = savedTime;
          setCurrentTime(savedTime);
          setHasStarted(true);

          if (audioRef.current) {
            audioRef.current.currentTime = savedTime;
          }

          const mins = Math.floor(savedTime / 60);
          const secs = Math.floor(savedTime % 60);
          const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          setResumeNotice(`Session restored: Audio stream resumed from ${timeStr} (seeking locked per IELTS standards).`);
        }
      } catch (err) {
        console.warn('Could not restore audio timestamp:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [examCode, candidateId]);

  // Handle Audio Player Events and Anti-Seeking Enforcement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const nowTime = audio.currentTime;

      // In TEST mode: strictly block seeking backward or jumping forward
      if (testMode === 'TEST') {
        // If user attempted to seek backwards by more than 0.75 second, snap back to highest point reached
        if (nowTime < maxAllowedTimeRef.current - 0.75) {
          audio.currentTime = maxAllowedTimeRef.current;
          return;
        }

        // If user attempted to jump forward beyond recorded progress, snap back
        if (nowTime > maxAllowedTimeRef.current + 1.5) {
          audio.currentTime = maxAllowedTimeRef.current;
          return;
        }

        // Update maximum playthrough watermark
        if (nowTime > maxAllowedTimeRef.current) {
          maxAllowedTimeRef.current = nowTime;
        }
      }

      setCurrentTime(audio.currentTime);

      // Throttled persistence to IndexedDB every 1 second
      if (Math.abs(audio.currentTime - lastSavedTimeRef.current) >= 1) {
        lastSavedTimeRef.current = audio.currentTime;
        saveAudioProgressToIndexedDB(examCode, candidateId, audio.currentTime).catch(() => {});
      }
    };

    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
        // If restored position is already at or near end, mark finished
        if (maxAllowedTimeRef.current > 0 && maxAllowedTimeRef.current >= audio.duration - 2) {
          setHasEnded(true);
          setIsPlaying(false);
        }
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setHasEnded(true);
      if (audio.duration) {
        saveAudioProgressToIndexedDB(examCode, candidateId, audio.duration).catch(() => {});
      }
    };

    const onSeeking = () => {
      // Prevent manual seeking in TEST mode
      if (testMode === 'TEST') {
        audio.currentTime = maxAllowedTimeRef.current;
      }
    };

    // TC-CAND-03: Handle peripheral output change / headphone disconnection without losing timestamp
    const onPause = () => {
      if (testMode === 'TEST' && !audio.ended && maxAllowedTimeRef.current < (audio.duration || 9999) - 2) {
        setIsPlaying(false);
        // Attempt seamless resume on new audio output device without seeking back
        audio.play().then(() => {
          setIsPlaying(true);
          setAudioError(null);
        }).catch(() => {
          setAudioError('Audio device changed or paused. Click "Resume Audio" to continue uninterrupted.');
        });
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('pause', onPause);
    };
  }, [testMode, examCode, candidateId, cleanAudioUrl]);

  // Requirement 4: Single Playthrough Audio Lock
  const handleStartAudio = () => {
    if (!audioRef.current || hasEnded || !playableUrl) return;
    setAudioError(null);

    if (testMode === 'TEST') {
      // Once started in TEST mode, audio plays continuously without pausing
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setHasStarted(true);
          setAudioError(null);
        }).catch(err => {
          console.warn('Audio play request error in TEST mode:', err);
          if (!useDirectStream) {
            setUseDirectStream(true);
            setAudioError('Proxy stream interrupted. Switched to direct audio stream. Please click Play again to start.');
          } else {
            setAudioError(`Audio playback error (${err.name || 'PlaybackBlocked'}): Tap Play again or check connection.`);
          }
          setIsPlaying(false);
        });
      }
    } else {
      // Practice mode allows play/pause toggle
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            setHasStarted(true);
            setAudioError(null);
          }).catch(err => {
            console.warn('Audio play request error in Practice mode:', err);
            if (!useDirectStream) {
              setUseDirectStream(true);
              setAudioError('Proxy stream interrupted. Switched to direct audio stream. Click Play to start.');
            } else {
              setAudioError('Audio playback blocked. Tap Play to start.');
            }
            setIsPlaying(false);
          });
        }
      }
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="space-y-4 pb-28">
      
      {/* TOP COUNTDOWN TIMER BAR */}
      <CountdownTimer
        initialMinutes={durationMins}
        testMode={testMode}
        sectionName={`ACADEMIC LISTENING (${questions.length} Questions)`}
        sessionKey={`${examCode || 'EXAM'}_${candidateId || 'USER'}_listening`}
        onTimeExpire={onTimeExpire}
      />

      {/* SESSION RECOVERY BANNER */}
      {resumeNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{resumeNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setResumeNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-black text-xs cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Audio Load Failure Alert & Diagnostics */}
      {audioError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{audioError}</span>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {cleanAudioUrl && isGoogleDriveAudio(cleanAudioUrl) && (
              <button
                type="button"
                onClick={() => {
                  setUseDirectStream(!useDirectStream);
                  setAudioError(null);
                  if (audioRef.current) {
                    setTimeout(() => {
                      if (audioRef.current) audioRef.current.load();
                    }, 50);
                  }
                }}
                className="px-3 py-1 bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 rounded-lg text-xs font-extrabold transition cursor-pointer"
              >
                {useDirectStream ? 'Use Proxy Stream' : 'Use Direct Stream'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAudioError(null);
                if (audioRef.current) audioRef.current.load();
              }}
              className="px-3 py-1 bg-rose-200 hover:bg-rose-300 text-rose-900 rounded-lg text-xs font-black transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* AUDIO PLAYER & ENFORCEMENT BANNER */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-5 shadow-xl shadow-purple-950/5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Audio Tag: controls={false} as mandated - rendered with resolved streamable proxy URL */}
        {playableUrl && (
          <audio 
            ref={audioRef} 
            src={playableUrl} 
            preload="auto" 
            controls={false}
            crossOrigin="anonymous"
            onError={() => {
              console.warn('Audio streaming error on URL:', playableUrl);
              if (!useDirectStream && cleanAudioUrl) {
                // Auto fallback to direct stream
                setUseDirectStream(true);
                setAudioError('Proxy stream interrupted. Switched to direct audio link. Tap Play to resume.');
              } else {
                setAudioError('Unable to stream audio. Please ensure Google Drive permissions are set to "Anyone with the link can view".');
              }
              setIsPlaying(false);
            }}
          />
        )}

        {/* Playback Controls & Non-Seekable Progress */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1 max-w-2xl">
          
          {/* Requirement 4: Single-Play Button */}
          {testMode === 'TEST' ? (
            <button
              type="button"
              onClick={handleStartAudio}
              disabled={!cleanAudioUrl || isPlaying || hasEnded}
              className={`px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-extrabold text-xs shadow-md transition shrink-0 ${
                !cleanAudioUrl
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : hasEnded
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : isPlaying
                  ? 'bg-emerald-600 text-white cursor-default shadow-emerald-900/10'
                  : 'bg-[#6B51A5] hover:bg-[#503A7A] text-white cursor-pointer active:scale-95 shadow-purple-950/15'
              }`}
            >
              {!cleanAudioUrl ? (
                <>
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>No Audio File (Exam without Audio)</span>
                </>
              ) : hasEnded ? (
                <>
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>Audio Finished (Single Playthrough Completed)</span>
                </>
              ) : isPlaying ? (
                <>
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span>Playing Audio (Single Playthrough Active)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Listening Audio (Single Playthrough)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartAudio}
              disabled={!cleanAudioUrl}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-950/10 transition shrink-0 ${
                !cleanAudioUrl
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-[#6B51A5] hover:bg-[#503A7A] text-white active:scale-95 cursor-pointer'
              }`}
              title={!cleanAudioUrl ? 'No audio track' : isPlaying ? 'Pause Audio' : 'Play Audio'}
            >
              {!cleanAudioUrl ? (
                <Lock className="w-5 h-5 text-slate-400" />
              ) : isPlaying ? (
                <Volume2 className="w-5 h-5 animate-pulse" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              )}
            </button>
          )}

          {/* Non-Interactive Progress Indicator (Seeking Locked) */}
          <div className="flex-1 min-w-[180px]">
            <div className="flex justify-between text-[11px] font-mono font-bold text-[#7C68A5] mb-1.5">
              <span>{formatTime(currentTime)}</span>
              <span className="flex items-center gap-1">
                <Headphones className="w-3 h-3 text-[#6B51A5]" />
                {formatTime(duration)}
              </span>
            </div>

            <div 
              className="w-full h-2.5 bg-[#E2DDEC] rounded-full overflow-hidden select-none"
              title="Seeking is strictly disabled per official IELTS exam standards"
            >
              <div 
                className="h-full bg-[#6B51A5] transition-[width] duration-300 ease-linear rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            {testMode === 'TEST' && (
              <p className="text-[10px] text-[#7C68A5] mt-1 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#6B51A5] inline" />
                Seeking locked. Progress securely tracked to IndexedDB.
              </p>
            )}
          </div>

          {/* Volume Mute & Speed */}
          <div className="flex items-center space-x-1 shrink-0">
            {testMode === 'PRACTICE' && (
              <select
                value={playbackRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="bg-[#F5F2F9] border border-purple-100 text-[#503A7A] text-xs font-bold rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#6B51A5] font-mono cursor-pointer"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>
            )}

            <button
              type="button"
              onClick={toggleMute}
              className="p-2 text-[#503A7A] hover:bg-[#E2DDEC] rounded-xl transition cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Answered Counter Pill & Auto-Save Feedback */}
        <div className="flex items-center space-x-3 shrink-0">
          <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all shadow-2xs ${
            isSaving 
              ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`} title="Tiến trình làm bài thi được tự động lưu liên tục vào IndexedDB offline">
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
            <span>{isSaving ? 'Đang lưu...' : autoSaveTime ? `✓ Đã tự động lưu (${autoSaveTime})` : '✓ Đã bảo vệ dữ liệu'}</span>
          </span>

          <div className="text-xs text-[#7C68A5] font-medium flex items-center gap-2">
            <span>Answered:</span>
            <span className="px-3 py-1 bg-purple-100 border border-purple-200 rounded-full text-xs font-black text-[#503A7A] font-mono">
              {answeredCount} / {totalQuestions}
            </span>
          </div>
        </div>

      </div>

      {/* PART TABS & QUESTION JUMP BAR */}
      <div className="bg-white border border-purple-100/80 rounded-3xl p-4 shadow-xl shadow-purple-950/5 flex flex-wrap items-center justify-between gap-3">
        
        {/* 4 Part Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {([1, 2, 3, 4] as const).map((partNum) => {
            const partQuestions = questionsWithPart.filter(q => q.computedPart === partNum);
            const partAnswered = partQuestions.filter(q => Boolean(userAnswers[q.question_id]?.trim())).length;
            const isActive = activePart === partNum;

            if (partQuestions.length === 0) return null;

            return (
              <button
                key={partNum}
                type="button"
                onClick={() => setActivePart(partNum)}
                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#6B51A5] text-white shadow-md'
                    : 'bg-[#F5F2F9] text-[#503A7A] hover:bg-[#E2DDEC] border border-purple-100'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Part {partNum}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : partAnswered === partQuestions.length && partQuestions.length > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-purple-200/80 text-[#503A7A]'
                }`}>
                  {partAnswered}/{partQuestions.length || 10}
                </span>
              </button>
            );
          })}
        </div>

        {/* Question Numbers Quick Navigator */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {filteredQuestions.map((q) => {
            const isFilled = Boolean(userAnswers[q.question_id]?.trim());
            return (
              <button
                key={`${q.question_id || 'lq_nav'}-${q.globalNumber}`}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`lq_box_${q.question_id}`) || document.getElementById(`q_box_${q.question_id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-4', 'ring-[#6B51A5]', 'rounded-3xl');
                    setTimeout(() => {
                      el.classList.remove('ring-4', 'ring-[#6B51A5]');
                    }, 2000);
                  }
                }}
                className={`w-7 h-7 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                  isFilled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-[#F5F2F9] text-[#503A7A] hover:bg-[#E2DDEC] border border-purple-100'
                }`}
                title={`Jump to Question ${q.globalNumber}`}
              >
                {q.globalNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN QUESTIONS WORKSPACE */}
      <div className="bg-white rounded-3xl border border-purple-100/80 p-6 md:p-8 shadow-xl shadow-purple-950/5 space-y-6">
        
        {/* Section Header with Info Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-100">
          <div>
            <h3 className="text-base font-extrabold text-[#3C2A63] flex items-center gap-2">
              <Headphones className="w-5 h-5 text-[#6B51A5]" />
              <span>Part {activePart} Questions ({filteredQuestions.length} Questions)</span>
            </h3>
            <p className="text-xs text-[#7C68A5] font-medium mt-0.5">
              Listen carefully to the recording and answer questions {filteredQuestions[0]?.globalNumber || 1} to {filteredQuestions[filteredQuestions.length - 1]?.globalNumber || filteredQuestions.length}.
            </p>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-[#7C68A5] bg-[#FAF8FE] border border-[#EBE4F7] px-3 py-1.5 rounded-xl">
            <Info className="w-3.5 h-3.5 text-[#6B51A5] shrink-0" />
            <span>Enter or select answers directly for each question below</span>
          </div>
        </div>

        {/* Questions Render List */}
        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center bg-[#FAF8FE] border border-[#EBE4F7] rounded-3xl">
            <Headphones className="w-12 h-12 text-[#7C68A5] mx-auto mb-3 opacity-60" />
            <p className="text-[#503A7A] text-sm font-bold">No questions available for Part {activePart}.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredQuestions.map((q, idx) => (
              <div
                key={`${q.question_id || 'lq'}-${idx}`}
                id={`lq_box_${q.question_id}`}
                className="transition-all duration-300 rounded-3xl"
              >
                <IELTSQuestionCard
                  question={q}
                  questionNumber={q.globalNumber}
                  userAnswer={userAnswers[q.question_id] || ''}
                  onAnswerChange={onAnswerChange}
                  headingsList={q.headings_list}
                  isFlagged={flaggedQuestions.has(q.question_id)}
                  onToggleFlag={handleToggleFlag}
                  allUserAnswers={userAnswers}
                  allQuestions={questions}
                />
              </div>
            ))}
          </div>
        )}

        {/* Next / Prev Part Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-purple-100">
          <button
            type="button"
            disabled={activePart === 1}
            onClick={() => setActivePart(prev => (prev > 1 ? (prev - 1 as 1 | 2 | 3 | 4) : prev))}
            className="px-4 py-2.5 bg-[#F5F2F9] hover:bg-[#E2DDEC] disabled:opacity-40 disabled:cursor-not-allowed text-[#503A7A] text-xs font-extrabold rounded-xl border border-purple-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            ← Previous Part
          </button>

          <button
            type="button"
            disabled={activePart === 4}
            onClick={() => setActivePart(prev => (prev < 4 ? (prev + 1 as 1 | 2 | 3 | 4) : prev))}
            className="px-5 py-2.5 bg-[#6B51A5] hover:bg-[#503A7A] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-purple-950/10 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Next Part</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* DEDICATED 40-QUESTION NAVIGATION FOOTER (Heuristic #6 Recognition rather than recall) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-purple-200/80 shadow-2xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Left metrics & 3-State Legend */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-[#3C2A63]">Listening Matrix:</span>
            </div>
            <span className="text-xs font-bold text-[#6B51A5] bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100">
              {answeredCount} / {totalQuestions} Answered
            </span>

            {/* 4-State Standardized Legend (Heuristic #4 & Audit Issue #3) */}
            <div className="hidden lg:flex items-center gap-2.5 text-[10px] text-[#7C68A5] font-semibold border-l border-purple-100 pl-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300 inline-block" />
                <span>Chưa làm</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-purple-100 border-2 border-[#6B51A5] inline-block" />
                <span>Phần hiện tại</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
                <span>Đã trả lời</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400 border border-amber-500 inline-block" />
                <span>Đánh dấu</span>
              </span>
            </div>
          </div>

          {/* All Questions Grid with 4 unambiguous states (Never green unless answered) */}
          <div className="flex-1 overflow-x-auto max-w-full pb-1">
            <div className="flex items-center gap-1 min-w-max justify-center">
              {questionsWithPart.map((q, idx) => {
                const isAnswered = Boolean(userAnswers[q.question_id]?.trim());
                const isFlagged = flaggedQuestions.has(q.question_id);
                const isCurrentPart = activePart === q.computedPart;

                let stateClasses = 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'; // Unanswered
                if (isFlagged) {
                  stateClasses = 'bg-amber-400 text-amber-950 font-black border border-amber-500 shadow-2xs hover:bg-amber-500'; // Flagged
                } else if (isAnswered) {
                  stateClasses = 'bg-emerald-600 text-white font-black shadow-xs hover:bg-emerald-700'; // Answered
                } else if (isCurrentPart) {
                  stateClasses = 'bg-purple-100 text-[#503A7A] border-2 border-purple-400 font-bold hover:bg-purple-200'; // Current part unattempted
                }

                return (
                  <button
                    key={`${q.question_id || 'all_listen'}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (activePart !== q.computedPart) {
                        setActivePart(q.computedPart);
                      }
                      setTimeout(() => {
                        const el = document.getElementById(`lq_box_${q.question_id}`) || document.getElementById(`q_box_${q.question_id}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('ring-4', 'ring-[#6B51A5]', 'rounded-3xl');
                          setTimeout(() => {
                            el.classList.remove('ring-4', 'ring-[#6B51A5]');
                          }, 2000);
                        }
                      }, 50);
                    }}
                    className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center relative ${stateClasses}`}
                    title={`Câu ${q.globalNumber} (Part ${q.computedPart}) - ${isFlagged ? 'Đã đánh dấu xem lại' : isAnswered ? 'Đã trả lời' : 'Chưa làm'}`}
                    aria-label={`Câu ${q.globalNumber} - ${isFlagged ? 'Đã đánh dấu' : isAnswered ? 'Đã trả lời' : 'Chưa làm'}`}
                  >
                    <span>{q.globalNumber}</span>
                    {isFlagged && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-950 absolute -top-0.5 -right-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Status Badge */}
          <div className="shrink-0 hidden sm:block">
            <span className="text-[11px] font-bold text-[#7C68A5] bg-[#F5F2F9] px-3 py-1 rounded-xl border border-purple-100">
              Part {activePart} Active
            </span>
          </div>

        </div>
      </div>

    </div>
  );
};
