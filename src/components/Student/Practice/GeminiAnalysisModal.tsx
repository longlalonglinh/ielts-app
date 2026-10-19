import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Layers, 
  BookOpen, 
  Lightbulb, 
  FileText, 
  HelpCircle, 
  Volume2, 
  Send, 
  Loader2, 
  Copy, 
  Check, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { SentenceAnalysisResponse } from '../../../types/practice';
import { practiceService } from '../../../services/practiceService';

interface GeminiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  sentence: string;
  targetWord?: string;
}

export const GeminiAnalysisModal: React.FC<GeminiAnalysisModalProps> = ({
  isOpen,
  onClose,
  sentence,
  targetWord
}) => {
  const [activeTab, setActiveTab] = useState<'syntax' | 'word' | 'grammar' | 'examples' | 'qa'>('syntax');
  const [analysis, setAnalysis] = useState<SentenceAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState<number>(1);
  const [loadProgress, setLoadProgress] = useState<number>(20);
  const [copied, setCopied] = useState(false);

  // Interactive Follow-up Question
  const [userQuery, setUserQuery] = useState('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState<Array<{ q: string; a: string }>>([]);

  useEffect(() => {
    let t1: any, t2: any;
    if (loading) {
      setLoadStage(1);
      setLoadProgress(30);
      t1 = setTimeout(() => {
        setLoadStage(2);
        setLoadProgress(65);
      }, 700);
      t2 = setTimeout(() => {
        setLoadStage(3);
        setLoadProgress(92);
      }, 1600);
    } else {
      setLoadProgress(100);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  useEffect(() => {
    if (isOpen && sentence) {
      fetchAnalysis();
      setFollowUpAnswers([]);
      setUserQuery('');
      setActiveTab('syntax');
    }
  }, [isOpen, sentence]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await practiceService.analyzeSentence(sentence, targetWord);
      setAnalysis(res);
    } catch (e) {
      console.error('Error fetching sentence analysis:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSpeak = (text: string) => {
    practiceService.speak(text, 'en-US');
  };

  const handleCopy = () => {
    if (!analysis) return;
    const textToCopy = `[SENTENCE]: ${analysis.original_sentence}\n[TRANSLATION]: ${analysis.sentence_translation_vi}\n\n[EXPLANATION]:\n${analysis.detailed_explanation_vi}\n\n[COMMON PITFALLS]: ${analysis.common_pitfalls}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || isAskingFollowUp) return;

    const query = userQuery.trim();
    setUserQuery('');
    setIsAskingFollowUp(true);

    try {
      const followUpRes = await practiceService.analyzeSentence(
        sentence,
        targetWord,
        query,
        analysis?.detailed_explanation_vi
      );

      setFollowUpAnswers(prev => [
        ...prev,
        {
          q: query,
          a: followUpRes.detailed_explanation_vi || 'Gemini has analyzed your query and updated the explanation below.'
        }
      ]);

      if (followUpRes) {
        setAnalysis(followUpRes);
      }
    } catch (e) {
      console.error('Follow up error:', e);
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-purple-950/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-purple-100 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#3C2A63]">
        
        {/* Header */}
        <div className="p-4 md:p-5 bg-white border-b border-purple-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#6B51A5] flex items-center justify-center font-bold shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#3C2A63] tracking-tight">Ask AI Gemini • Sentence Analysis</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-[#6B51A5] border border-purple-200 font-mono font-bold">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-[#7C68A5]">Deconstruct grammar, part of speech, collocations, and syntax</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleCopy}
              className="p-2 text-[#7C68A5] hover:text-[#3C2A63] hover:bg-purple-50 rounded-xl transition cursor-pointer"
              title="Copy analysis text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#7C68A5] hover:text-[#3C2A63] hover:bg-purple-50 rounded-xl transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Target Sentence Banner & System Model Clarification */}
        <div className="p-4 bg-[#F5F2F9] border-b border-purple-100 shrink-0 space-y-2.5">
          {/* Explicit System Model Badge to eliminate Gulf of Evaluation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-900">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>PROVISIONAL AI EVALUATION • Academic Reference Only</span>
            </div>
            <span className="text-[10px] text-[#7C68A5] font-semibold">
              Hick's Law: 4-tier structured cognitive breakdown
            </span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B51A5] mb-0.5 block">
                Sentence to analyze:
              </span>
              <p className="text-sm md:text-base font-semibold text-[#3C2A63] leading-relaxed">
                "{sentence}"
              </p>
              {analysis?.sentence_translation_vi && (
                <p className="text-xs text-emerald-800 font-medium mt-1 italic">
                  💡 {analysis.sentence_translation_vi}
                </p>
              )}
            </div>

            <button
              onClick={() => handleSpeak(sentence)}
              className="p-2.5 bg-white hover:bg-purple-100 text-[#6B51A5] border border-purple-200 rounded-xl transition shrink-0 cursor-pointer shadow-xs"
              title="Listen to full sentence"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white px-4 py-2 border-b border-purple-100 flex items-center space-x-2 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'syntax', label: 'Sentence Breakdown (S-V-O)', icon: Layers },
            { id: 'word', label: 'Keywords & IPA', icon: BookOpen },
            { id: 'grammar', label: 'Grammar & Collocations', icon: Lightbulb },
            { id: 'examples', label: 'Example Sentences', icon: FileText },
            { id: 'qa', label: `Q&A ${followUpAnswers.length > 0 ? `(${followUpAnswers.length})` : ''}`, icon: HelpCircle },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#6B51A5] text-white shadow-xs'
                    : 'bg-[#F5F2F9] text-[#503A7A] hover:text-[#3C2A63] hover:bg-purple-100/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-12 px-4 text-center space-y-4 max-w-md mx-auto">
              <div className="relative w-12 h-12 mx-auto">
                <Loader2 className="w-12 h-12 text-[#6B51A5] animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-black text-[#3C2A63]">
                  {loadStage === 1 && 'Phase 1/3: Analyzing syntax & S-V-O clauses...'}
                  {loadStage === 2 && 'Phase 2/3: Extracting keywords, IPA phonetics & collocations...'}
                  {loadStage === 3 && 'Phase 3/3: Evaluating common traps & synthesizing examples...'}
                </h4>
                <p className="text-xs text-[#7C68A5]">
                  {loadStage === 1 && 'Identifying Subject, Main Verb, Object, and dependent clauses.'}
                  {loadStage === 2 && 'Classifying part of speech, word families, and academic collocations.'}
                  {loadStage === 3 && 'Generating pedagogical feedback structured to minimize cognitive load.'}
                </p>
              </div>

              {/* MD3 Stepper Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#6B51A5] h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#7C68A5] font-bold">
                  <span>Analysis Progress: {loadProgress}%</span>
                  <span>Processing</span>
                </div>
              </div>
            </div>
          ) : !analysis ? (
            <div className="py-12 text-center text-[#7C68A5]">
              <AlertCircle className="w-8 h-8 text-[#7C68A5] mx-auto mb-2" />
              <p className="text-sm">Unable to load sentence analysis at this time.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: SYNTAX BREAKDOWN */}
              {activeTab === 'syntax' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7C68A5] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#6B51A5]" />
                    Sentence Syntax & Clause Breakdown
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
                        1. Subject (S)
                      </span>
                      <p className="text-xs md:text-sm text-[#3C2A63] font-semibold">
                        {analysis.syntax_breakdown.subject || 'Determined by context'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                        2. Main Verb & Tense (V)
                      </span>
                      <p className="text-xs md:text-sm text-[#3C2A63] font-semibold">
                        {analysis.syntax_breakdown.main_verb || 'Main sentence verb'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
                        3. Object / Complement (O / C)
                      </span>
                      <p className="text-xs md:text-sm text-[#3C2A63] font-semibold">
                        {analysis.syntax_breakdown.object_or_complement || 'Direct / indirect object'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#F5F2F9] border border-purple-100 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
                        4. Modifiers & Dependent Clauses
                      </span>
                      <p className="text-xs md:text-sm text-[#3C2A63] font-semibold">
                        {analysis.syntax_breakdown.modifiers_or_clauses || 'Adverbial or relative clause'}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Explanation */}
                  <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                    <h5 className="text-xs font-bold text-[#6B51A5] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#6B51A5]" />
                      Detailed Pedagogical Explanation
                    </h5>
                    <p className="text-xs md:text-sm text-[#3C2A63] leading-relaxed whitespace-pre-line">
                      {analysis.detailed_explanation_vi}
                    </p>
                  </div>

                  {/* Common Pitfalls Warning */}
                  {analysis.common_pitfalls && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold text-rose-800 block mb-0.5">Common Pitfalls & Traps:</span>
                        <p className="text-rose-900/90 leading-relaxed">{analysis.common_pitfalls}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: WORD BREAKDOWN */}
              {activeTab === 'word' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#F5F2F9] border border-purple-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg md:text-xl font-bold text-[#3C2A63] font-serif">
                          {analysis.word_analysis.target_word || targetWord}
                        </span>
                        {analysis.word_analysis.phonetic && (
                          <span className="text-xs font-mono text-[#6B51A5] bg-purple-100 px-2 py-0.5 rounded border border-purple-200 font-bold">
                            {analysis.word_analysis.phonetic}
                          </span>
                        )}
                        {analysis.word_analysis.part_of_speech && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white text-[#503A7A] border border-purple-200">
                            {analysis.word_analysis.part_of_speech}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#503A7A] mt-1.5 font-medium">
                        👉 {analysis.word_analysis.definition_vi}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSpeak(analysis.word_analysis.target_word || targetWord || '')}
                      className="p-3 bg-[#6B51A5] hover:bg-[#503A7A] text-white rounded-xl shadow-md transition cursor-pointer"
                      title="Pronounce word"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Word Family & Derivatives */}
                  {analysis.word_analysis.root_and_forms && analysis.word_analysis.root_and_forms.length > 0 && (
                    <div className="p-3.5 bg-white border border-purple-100 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C68A5] block mb-2">
                        Word Family & Derivative Forms:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {analysis.word_analysis.root_and_forms.map((item, idx) => (
                          <span key={idx} className="text-xs px-2.5 py-1 bg-[#F5F2F9] border border-purple-200 rounded-lg text-[#3C2A63] font-mono">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Synonyms & Antonyms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1.5">
                        Synonyms:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.word_analysis.synonyms && analysis.word_analysis.synonyms.length > 0 ? (
                          analysis.word_analysis.synonyms.map((s, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-white text-emerald-800 border border-emerald-200 rounded font-medium">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#7C68A5]">None found</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block mb-1.5">
                        Antonyms:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.word_analysis.antonyms && analysis.word_analysis.antonyms.length > 0 ? (
                          analysis.word_analysis.antonyms.map((a, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-white text-rose-800 border border-rose-200 rounded font-medium">
                              {a}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#7C68A5]">None or uncommon</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GRAMMAR & COLLOCATIONS */}
              {activeTab === 'grammar' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#6B51A5] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#6B51A5]" />
                      Core Grammar Rules
                    </h5>
                    <div className="space-y-2">
                      {analysis.key_grammar_rules.map((rule, idx) => (
                        <div key={idx} className="p-3 bg-[#F5F2F9] border border-purple-100 rounded-2xl flex items-start space-x-2.5">
                          <span className="w-5 h-5 rounded-full bg-purple-200 text-[#6B51A5] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs md:text-sm text-[#3C2A63]">{rule}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#6B51A5] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#6B51A5]" />
                      Natural Collocations & Idiomatic Phrases
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {analysis.collocations_and_phrases.map((colloc, idx) => (
                        <div key={idx} className="p-2.5 bg-[#F5F2F9] border border-purple-100 rounded-xl text-xs text-[#3C2A63] font-semibold flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6B51A5] shrink-0" />
                          <span>{colloc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EXAMPLE SENTENCES */}
              {activeTab === 'examples' && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#7C68A5] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#6B51A5]" />
                    Real-World Example Sentences
                  </h5>

                  {analysis.example_sentences.map((ex, idx) => (
                    <div key={idx} className="p-4 bg-[#F5F2F9] border border-purple-100 rounded-2xl space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs md:text-sm font-semibold text-[#3C2A63]">
                          {idx + 1}. "{ex.en}"
                        </p>
                        <button
                          onClick={() => handleSpeak(ex.en)}
                          className="p-1.5 text-[#7C68A5] hover:text-[#6B51A5] rounded transition cursor-pointer"
                          title="Listen to example sentence"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-[#503A7A] italic">
                        👉 {ex.vi}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: INTERACTIVE Q&A */}
              {activeTab === 'qa' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-[#503A7A]">
                      💬 Ask any question regarding this sentence (e.g., <em>"Why isn't the present perfect tense used here?", "Which prepositions can pair with this word?"</em>).
                    </div>

                    {followUpAnswers.map((item, idx) => (
                      <div key={idx} className="space-y-2 p-3.5 bg-[#F5F2F9] border border-purple-100 rounded-2xl text-xs">
                        <div className="font-bold text-[#6B51A5] flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Learner: "{item.q}"</span>
                        </div>
                        <p className="text-[#3C2A63] leading-relaxed whitespace-pre-line pl-4 border-l-2 border-[#6B51A5]">
                          {item.a}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Ask Gemini about grammar rules, collocations, or usage..."
                      className="flex-1 px-4 py-2.5 bg-[#F5F2F9] border border-purple-200 rounded-xl text-[#3C2A63] placeholder-[#7C68A5] text-xs focus:outline-none focus:border-[#6B51A5] transition"
                      disabled={isAskingFollowUp}
                    />
                    <button
                      type="submit"
                      disabled={isAskingFollowUp || !userQuery.trim()}
                      className="px-4 py-2.5 bg-[#6B51A5] hover:bg-[#503A7A] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shrink-0 cursor-pointer"
                    >
                      {isAskingFollowUp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Send</span>
                          <Send className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-purple-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#7C68A5]">
            Powered by Google Gemini 3.7 Flash • In-depth linguistic analysis
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#F5F2F9] hover:bg-purple-100 text-[#503A7A] text-xs font-bold rounded-xl border border-purple-200 transition cursor-pointer"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
