import React, { useState, useEffect, useRef } from 'react';
import { 
  CustomPracticeDeck, 
  PracticeCard, 
  PracticeQuestionType, 
  PracticeOption,
  PracticeCardItem 
} from '../../types/practice';
import { practiceService } from '../../services/practiceService';
import { DEFAULT_API_URL } from '../../services/api';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  FileText, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Upload, 
  RotateCcw, 
  Loader2,
  BookOpen,
  ArrowRight,
  Code2,
  ListPlus,
  Database,
  RefreshCw,
  HelpCircle,
  X,
  ExternalLink,
  Search,
  Copy,
  Check,
  Filter,
  ArrowUp,
  ArrowDown,
  Tag,
  CheckSquare,
  Square,
  FileUp
} from 'lucide-react';

interface CustomPracticeManagerProps {
  gasUrl?: string;
}

export const CustomPracticeManager: React.FC<CustomPracticeManagerProps> = ({ gasUrl }) => {
  const effectiveGasUrl = gasUrl || localStorage.getItem('ielts_gas_url') || DEFAULT_API_URL;

  const [decks, setDecks] = useState<CustomPracticeDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<CustomPracticeDeck | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'library' | 'editor'>('library');

  // Search & Filters for Decks Library
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<CustomPracticeDeck | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  // Sheets Database Management State
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);
  const [dbStatus, setDbStatus] = useState(() => practiceService.getDatabaseStatus());

  // AI Generator Modal / Form State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCategory, setAiCategory] = useState<'Vocabulary' | 'Grammar' | 'Communication' | 'IELTS Academic'>('Vocabulary');
  const [aiLevel, setAiLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2'>('B1-B2');
  const [aiCount, setAiCount] = useState(8);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Current deck form state
  const [deckId, setDeckId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Vocabulary' | 'Grammar' | 'Communication' | 'IELTS Academic' | 'General English' | 'Custom'>('Vocabulary');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<'A1-A2' | 'B1-B2' | 'C1-C2'>('B1-B2');
  const [cards, setCards] = useState<PracticeCard[]>([]);

  // File input ref for JSON import
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshDecks();
  }, []);

  const refreshDecks = (preferredDeckId?: string) => {
    const all = practiceService.getAllDecks();
    setDecks(all);
    if (preferredDeckId) {
      const match = all.find(d => d.deck_id.toUpperCase() === preferredDeckId.toUpperCase());
      if (match) {
        handleSelectDeck(match);
        return;
      }
    }
    if (!selectedDeck && all.length > 0) {
      handleSelectDeck(all[0]);
    }
  };

  // Filtered decks computation
  const filteredDecks = decks.filter(deck => {
    const matchesSearch = searchTerm.trim() === '' || 
      deck.deck_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deck.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deck.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = filterLevel === 'ALL' || deck.level === filterLevel;
    const matchesCategory = filterCategory === 'ALL' || deck.category === filterCategory;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  // Google Sheets CSDL Handlers
  const handleInitDatabaseOnSheets = async () => {
    setIsSyncingSheets(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await practiceService.initDatabaseOnSheets(effectiveGasUrl);
      if (res.success) {
        setSuccessMsg(res.message || 'Cơ sở dữ liệu Practice đã khởi tạo thành công trên Google Sheets (Tab PRACTICE_QUESTIONS)!');
        setDbStatus(practiceService.getDatabaseStatus());
        refreshDecks();
      } else {
        setErrorMsg(res.error || 'Khởi tạo database trên Google Sheets thất bại. Vui lòng kiểm tra quyền truy cập Web App Anyone.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối khi khởi tạo database.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleFetchFromSheets = async () => {
    setIsFetchingSheets(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await practiceService.fetchFromSheets(effectiveGasUrl);
      if (res.success) {
        const count = res.decks?.length || 0;
        setSuccessMsg(
          count > 0
            ? `Đã tải thành công ${count} bộ đề từ tab PRACTICE_QUESTIONS!`
            : `Tab PRACTICE_QUESTIONS đã kết nối thành công (hiện đang trống, hãy tạo bộ đề mới và bấm Lưu).`
        );
        setDbStatus(practiceService.getDatabaseStatus());
        refreshDecks();
      } else {
        setErrorMsg(res.error || 'Chưa tìm thấy tab PRACTICE_QUESTIONS.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải dữ liệu từ Google Sheets.');
    } finally {
      setIsFetchingSheets(false);
    }
  };

  const handleSaveSelectedDeckToSheets = async () => {
    if (!selectedDeck) return;
    setIsSyncingSheets(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await practiceService.saveDeckToSheets(effectiveGasUrl, selectedDeck);
      if (res.success) {
        setSuccessMsg(`Đã đồng bộ bộ đề [${selectedDeck.deck_id}] lên Google Sheets thành công!`);
        setDbStatus(practiceService.getDatabaseStatus());
      } else {
        setErrorMsg(res.error || 'Lỗi khi đồng bộ bộ đề lên Google Sheets.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi mạng khi lưu dữ liệu lên Google Sheets.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleSelectDeck = (deck: CustomPracticeDeck) => {
    setSelectedDeck(deck);
    setDeckId(deck.deck_id);
    setTitle(deck.title);
    setCategory(deck.category);
    setDescription(deck.description);
    setLevel(deck.level);
    
    // Ensure all cards have type and options_data initialized
    const sanitizedCards = (deck.cards || []).map((c, idx) => {
      const cardType: PracticeQuestionType = c.type || (c.options && c.options.length > 0 ? 'multiple-choice' : 'multiple-choice');
      let optionsData: PracticeOption[] = c.options_data || [];

      if (!optionsData || optionsData.length === 0) {
        if (c.options && c.options.length > 0) {
          const target = (c.cloze_target || '').toLowerCase().trim();
          optionsData = c.options.map((optText, oIdx) => ({
            id: `opt_${oIdx + 1}`,
            text: optText,
            isCorrect: optText.toLowerCase().trim() === target || (c.accepted_answers || []).some(a => a.toLowerCase().trim() === optText.toLowerCase().trim()),
            distractorRationale: optText.toLowerCase().trim() === target 
              ? (c.explanation || 'Đáp án chính xác phù hợp với cấu trúc ngữ pháp học thuật.')
              : 'Phương án nhiễu: Không thỏa mãn ngữ cảnh hoặc sai từ loại.'
          }));
        } else {
          optionsData = [
            { id: 'opt_1', text: c.cloze_target || 'Option A', isCorrect: true, distractorRationale: 'Đáp án chính xác.' },
            { id: 'opt_2', text: 'Option B', isCorrect: false, distractorRationale: 'Phương án gây nhiễu.' },
            { id: 'opt_3', text: 'Option C', isCorrect: false, distractorRationale: 'Bẫy từ loại.' },
            { id: 'opt_4', text: 'Option D', isCorrect: false, distractorRationale: 'Bẫy ngữ nghĩa.' }
          ];
        }
      }

      return {
        ...c,
        id: c.id || `c_${Date.now()}_${idx + 1}`,
        type: cardType,
        cognitive_level: c.cognitive_level || 'applying',
        options_data: optionsData,
        min_selections: c.min_selections || (cardType === 'multiple-response' ? 2 : 1),
        max_selections: c.max_selections || (cardType === 'multiple-response' ? 2 : 1)
      };
    });

    setCards(sanitizedCards);
    setIsEditing(false);
    setSuccessMsg(null);
    setErrorMsg(null);
    setMobileTab('editor');
  };

  const handleNewDeck = () => {
    const newId = `PRACTICE_${Date.now().toString().slice(-4)}`;
    setSelectedDeck(null);
    setDeckId(newId);
    setTitle('Bộ bài tập học thuật mới');
    setCategory('Vocabulary');
    setDescription('Mô tả mục tiêu học tập và ngữ cảnh trọng tâm của bộ câu hỏi...');
    setLevel('B1-B2');
    setMobileTab('editor');
    setCards([
      {
        id: `c_${Date.now()}_1`,
        type: 'multiple-choice',
        cognitive_level: 'applying',
        sentence_en: 'The research committee decided to _____ the proposed environmental framework.',
        sentence_vi: 'Ủy ban nghiên cứu đã quyết định áp dụng khung môi trường được đề xuất.',
        cloze_target: 'adopt',
        target_word: 'adopt',
        part_of_speech: 'verb',
        phonetic: '/əˈdɒpt/',
        hints: 'chính thức thông qua và áp dụng',
        accepted_answers: ['adopt'],
        explanation: 'Động từ "adopt" kết hợp tự nhiên với policy/framework mang nghĩa chính thức áp dụng.',
        grammar_points: ['Collocation: adopt a framework'],
        options: ['adopt', 'adapt', 'adept', 'adoption'],
        options_data: [
          { id: 'opt_1', text: 'adopt', isCorrect: true, distractorRationale: 'Chính xác. "Adopt a framework" mang nghĩa chính thức thông qua và đưa vào thực hiện.' },
          { id: 'opt_2', text: 'adapt', isCorrect: false, distractorRationale: 'Bẫy từ vựng: "adapt" mang nghĩa điều chỉnh để thích nghi (thường đi với to).' },
          { id: 'opt_3', text: 'adept', isCorrect: false, distractorRationale: 'Bẫy từ loại: "adept" là tính từ (thành thạo), không thể đứng sau to-infinitive.' },
          { id: 'opt_4', text: 'adoption', isCorrect: false, distractorRationale: 'Bẫy từ loại: "adoption" là danh từ, vị trí này yêu cầu động từ nguyên mẫu.' }
        ],
        difficulty: 'medium'
      }
    ]);
    setIsEditing(true);
  };

  // Duplicate current deck
  const handleDuplicateDeck = () => {
    if (!selectedDeck) return;
    const cloned = practiceService.duplicateDeck(selectedDeck.deck_id);
    if (cloned) {
      setSuccessMsg(`Đã nhân bản bộ đề thành [${cloned.deck_id}] thành công!`);
      refreshDecks(cloned.deck_id);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg('Không thể nhân bản bộ đề.');
    }
  };

  // Open Delete Confirmation
  const promptDeleteDeck = (deck: CustomPracticeDeck) => {
    setDeckToDelete(deck);
    setShowDeleteModal(true);
  };

  // Confirm Delete
  const confirmDeleteDeck = () => {
    if (!deckToDelete) return;
    const idToDelete = deckToDelete.deck_id;
    const ok = practiceService.deleteDeck(idToDelete);
    if (ok) {
      setShowDeleteModal(false);
      setDeckToDelete(null);
      setSuccessMsg(`Đã xóa bộ đề [${idToDelete}] thành công.`);
      refreshDecks();
      if (selectedDeck?.deck_id === idToDelete) {
        setSelectedDeck(null);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg('Lỗi khi xóa bộ đề.');
    }
  };

  // Confirm Clear All Decks
  const handleClearAllDecks = () => {
    practiceService.clearAllPracticeDecks();
    setDecks([]);
    setSelectedDeck(null);
    setCards([]);
    setIsEditing(false);
    setShowClearAllModal(false);
    setSuccessMsg('Đã xóa sạch tất cả mã đề practice hiện có. Kho câu hỏi hiện trống để giáo viên làm lại từ đầu!');
    setDbStatus(practiceService.getDatabaseStatus());
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Card Management Functions
  const handleAddCard = (type: PracticeQuestionType = 'multiple-choice') => {
    const timestamp = Date.now();
    let defaultOptions: PracticeOption[] = [];

    if (type === 'true-false-not-given') {
      defaultOptions = [
        { id: 'opt_1', text: 'TRUE', isCorrect: true, distractorRationale: 'Nhận định hoàn toàn trùng khớp với thông tin trong văn bản gốc.' },
        { id: 'opt_2', text: 'FALSE', isCorrect: false, distractorRationale: 'Nhận định mâu thuẫn hoặc phủ định trực tiếp thông tin trong văn bản.' },
        { id: 'opt_3', text: 'NOT GIVEN', isCorrect: false, distractorRationale: 'Thông tin này không được đề cập hoặc kiểm chứng trong bài đọc.' }
      ];
    } else if (type === 'multiple-response') {
      defaultOptions = [
        { id: 'opt_1', text: 'compelling', isCorrect: true, distractorRationale: 'Chính xác. Tạo thành cụm kết hợp từ học thuật tự nhiên.' },
        { id: 'opt_2', text: 'conclusive', isCorrect: true, distractorRationale: 'Chính xác. Mang nghĩa đưa ra kết luận rõ ràng, thuyết phục.' },
        { id: 'opt_3', text: 'doubtfully', isCorrect: false, distractorRationale: 'Sai từ loại: Là phó từ không bổ nghĩa trực tiếp cho danh từ.' },
        { id: 'opt_4', text: 'narrowly', isCorrect: false, distractorRationale: 'Sai ngữ nghĩa học thuật trong ngữ cảnh bài thi.' }
      ];
    } else if (type === 'category-matching') {
      defaultOptions = [
        { id: 'opt_1', text: 'Furthermore', category: 'Addition (Bổ sung)', isCorrect: true, distractorRationale: 'Chính xác. Dùng để bổ sung luận cứ củng cố.' },
        { id: 'opt_2', text: 'In contrast', category: 'Contrast (Tương phản)', isCorrect: true, distractorRationale: 'Chính xác. Dùng để so sánh đối lập trực tiếp.' },
        { id: 'opt_3', text: 'Consequently', category: 'Result (Kết quả)', isCorrect: true, distractorRationale: 'Chính xác. Chỉ kết quả hoặc hệ quả phát sinh.' },
        { id: 'opt_4', text: 'Notwithstanding', category: 'Concession (Nhượng bộ)', isCorrect: true, distractorRationale: 'Chính xác. Dùng để thiết lập mệnh đề nhượng bộ.' }
      ];
    } else {
      defaultOptions = [
        { id: 'opt_1', text: 'sample', isCorrect: true, distractorRationale: 'Đáp án chính xác hoàn thành câu văn hoàn chỉnh.' },
        { id: 'opt_2', text: 'sampling', isCorrect: false, distractorRationale: 'Bẫy hình thái từ.' },
        { id: 'opt_3', text: 'sampled', isCorrect: false, distractorRationale: 'Bẫy thì và thể động từ.' },
        { id: 'opt_4', text: 'sampler', isCorrect: false, distractorRationale: 'Bẫy từ loại danh từ chỉ người/vật.' }
      ];
    }

    const newCard: PracticeCard = {
      id: `c_${timestamp}_${cards.length + 1}`,
      type: type,
      cognitive_level: 'applying',
      sentence_en: 'This is a sample sentence with a _____ blank for testing.',
      sentence_vi: 'Đây là câu ví dụ mẫu có ô trống để kiểm tra kiến thức.',
      cloze_target: defaultOptions.find(o => o.isCorrect)?.text || 'sample',
      target_word: 'sample',
      part_of_speech: 'adjective',
      phonetic: '/ˈsɑːm.pəl/',
      hints: 'gợi ý ngữ cảnh',
      accepted_answers: defaultOptions.filter(o => o.isCorrect).map(o => o.text),
      explanation: 'Giải thích cấu trúc ngữ pháp và cụm từ cố định tại đây...',
      grammar_points: ['Điểm ngữ pháp cần lưu ý'],
      options: defaultOptions.map(o => o.text),
      options_data: defaultOptions,
      min_selections: type === 'multiple-response' ? 2 : 1,
      max_selections: type === 'multiple-response' ? 2 : 1,
      difficulty: 'medium'
    };

    setCards([...cards, newCard]);
  };

  const handleDuplicateCard = (index: number) => {
    const target = cards[index];
    if (!target) return;
    const duplicated: PracticeCard = {
      ...target,
      id: `c_${Date.now()}_${cards.length + 1}`,
      sentence_en: `${target.sentence_en} (Copy)`,
      options_data: (target.options_data || []).map((o, oIdx) => ({
        ...o,
        id: `opt_${oIdx + 1}`
      }))
    };
    const updated = [...cards];
    updated.splice(index + 1, 0, duplicated);
    setCards(updated);
  };

  const handleMoveCard = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === cards.length - 1) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...cards];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setCards(updated);
  };

  const handleRemoveCard = (index: number) => {
    if (cards.length <= 1) {
      setErrorMsg('Bộ đề phải có ít nhất 1 câu hỏi.');
      return;
    }
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleCardChange = (index: number, field: keyof PracticeCard, value: any) => {
    const updated = [...cards];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setCards(updated);
  };

  // Option change helpers inside card
  const handleOptionChange = (cardIdx: number, optIdx: number, field: keyof PracticeOption, value: any) => {
    const updatedCards = [...cards];
    const card = updatedCards[cardIdx];
    const opts = [...(card.options_data || [])];
    
    if (field === 'isCorrect' && value === true) {
      if (card.type === 'multiple-choice' || card.type === 'true-false-not-given') {
        // Uncheck all other options
        opts.forEach((o, i) => {
          opts[i] = { ...o, isCorrect: i === optIdx };
        });
      } else {
        opts[optIdx] = { ...opts[optIdx], isCorrect: true };
      }
    } else {
      opts[optIdx] = { ...opts[optIdx], [field]: value };
    }

    // Synchronize cloze_target & accepted_answers
    const correctOpts = opts.filter(o => o.isCorrect).map(o => o.text);
    updatedCards[cardIdx] = {
      ...card,
      options_data: opts,
      options: opts.map(o => o.text),
      cloze_target: correctOpts[0] || card.cloze_target,
      accepted_answers: correctOpts.length > 0 ? correctOpts : card.accepted_answers
    };
    setCards(updatedCards);
  };

  const handleAddOptionToCard = (cardIdx: number) => {
    const updatedCards = [...cards];
    const card = updatedCards[cardIdx];
    const opts = [...(card.options_data || [])];
    const newOpt: PracticeOption = {
      id: `opt_${opts.length + 1}`,
      text: `Option ${String.fromCharCode(65 + opts.length)}`,
      isCorrect: opts.length === 0,
      distractorRationale: 'Phân tích phương án gây nhiễu hoặc lý do đáp án đúng.'
    };
    opts.push(newOpt);
    updatedCards[cardIdx] = {
      ...card,
      options_data: opts,
      options: opts.map(o => o.text)
    };
    setCards(updatedCards);
  };

  const handleRemoveOptionFromCard = (cardIdx: number, optIdx: number) => {
    const updatedCards = [...cards];
    const card = updatedCards[cardIdx];
    const opts = [...(card.options_data || [])];
    if (opts.length <= 2) {
      setErrorMsg('Mỗi câu hỏi trắc nghiệm cần tối thiểu 2 phương án lựa chọn.');
      return;
    }
    opts.splice(optIdx, 1);
    updatedCards[cardIdx] = {
      ...card,
      options_data: opts,
      options: opts.map(o => o.text)
    };
    setCards(updatedCards);
  };

  const handleApplyTfngPreset = (cardIdx: number, correctValue: 'TRUE' | 'FALSE' | 'NOT GIVEN' = 'TRUE') => {
    const updatedCards = [...cards];
    const tfngOptions: PracticeOption[] = [
      { 
        id: 'opt_1', 
        text: 'TRUE', 
        isCorrect: correctValue === 'TRUE', 
        distractorRationale: correctValue === 'TRUE' 
          ? 'Chính xác. Nhận định đồng thuận hoàn toàn với các dữ kiện trong đoạn văn.' 
          : 'Bẫy suy diễn: Đoạn văn không khẳng định thông tin như nhận định.'
      },
      { 
        id: 'opt_2', 
        text: 'FALSE', 
        isCorrect: correctValue === 'FALSE', 
        distractorRationale: correctValue === 'FALSE' 
          ? 'Chính xác. Nhận định trực tiếp mâu thuẫn hoặc đảo ngược dữ kiện của văn bản gốc.' 
          : 'Bẫy phủ định: Văn bản không hề đưa ra thông tin đối lập với câu hỏi.'
      },
      { 
        id: 'opt_3', 
        text: 'NOT GIVEN', 
        isCorrect: correctValue === 'NOT GIVEN', 
        distractorRationale: correctValue === 'NOT GIVEN' 
          ? 'Chính xác. Thông tin hoặc phạm vi nhận định hoàn toàn không được đề cập trong bài đọc.' 
          : 'Bẫy thiếu thông tin: Bài đọc đã cung cấp dữ kiện cụ thể, không phải trường hợp Not Given.'
      }
    ];

    updatedCards[cardIdx] = {
      ...updatedCards[cardIdx],
      type: 'true-false-not-given',
      cloze_target: correctValue,
      accepted_answers: [correctValue],
      options_data: tfngOptions,
      options: tfngOptions.map(o => o.text)
    };
    setCards(updatedCards);
  };

  // Save Deck Handler
  const handleSaveDeck = () => {
    if (!deckId.trim() || !title.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Mã bộ đề (Set Code) và Tiêu đề (Set Title).');
      return;
    }
    if (cards.length === 0) {
      setErrorMsg('Bộ đề phải có ít nhất 1 câu hỏi.');
      return;
    }

    const newDeck: CustomPracticeDeck = {
      deck_id: deckId.trim().toUpperCase(),
      title: title.trim(),
      category,
      description: description.trim(),
      target_language: 'English',
      native_language: 'Vietnamese',
      level,
      cards: cards.map(c => ({
        ...c,
        options: c.options_data?.map(o => o.text) || c.options || []
      })),
      is_custom: true,
      updated_at: new Date().toISOString()
    };

    const saved = practiceService.saveDeck(newDeck);
    if (saved) {
      setSuccessMsg(`Đã lưu thành công bộ đề [${newDeck.deck_id}].`);
      refreshDecks(newDeck.deck_id);
      setSelectedDeck(newDeck);
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg('Lỗi khi lưu bộ đề vào bộ nhớ máy.');
    }
  };

  // Generate Deck with AI Gemini via server
  const handleGenerateAiDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim() || isGeneratingAi) return;

    setIsGeneratingAi(true);
    setErrorMsg(null);
    try {
      const generated = await practiceService.generateDeck(
        aiTopic.trim(),
        aiCategory,
        aiLevel,
        aiCount
      );

      if (generated) {
        setIsAiModalOpen(false);
        setAiTopic('');
        refreshDecks(generated.deck_id);
        handleSelectDeck(generated);
        setSuccessMsg(`AI Gemini đã sinh thành công bộ bài tập [${generated.deck_id}] với ${generated.cards.length} câu hỏi đa dạng định dạng!`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg('Không thể sinh bộ bài tập vào lúc này. Vui lòng thử lại.');
      }
    } catch (e: any) {
      console.error('AI Generator Error:', e);
      setErrorMsg('Lỗi kết nối dịch vụ AI trên máy chủ. Vui lòng thử lại.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Export to JSON
  const handleExportJson = () => {
    if (!selectedDeck) return;
    const jsonStr = JSON.stringify(selectedDeck, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDeck.deck_id}_practice_deck.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Smart Multi-Format Adapter: Import JSON from backup, AI generated files, or custom question banks
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content || !content.trim()) {
          throw new Error('Tệp JSON rỗng (không có nội dung).');
        }

        let rawData: any;
        try {
          rawData = JSON.parse(content);
        } catch (jsonErr: any) {
          throw new Error(`Cú pháp JSON không hợp lệ: ${jsonErr.message}`);
        }

        // 1. Determine raw deck list flexibly
        let rawDecks: any[] = [];
        if (Array.isArray(rawData)) {
          // Could be array of decks OR array of pure questions
          const isArrayOfQuestions = rawData.length > 0 && 
            !rawData[0].cards && 
            !rawData[0].questions && 
            !rawData[0].items && 
            (rawData[0].sentence || rawData[0].question || rawData[0].stimulusText || rawData[0].targetWord || rawData[0].target_word);
          
          if (isArrayOfQuestions) {
            const fileNameClean = file.name.replace(/\.[^/.]+$/, '').trim();
            rawDecks = [{
              title: fileNameClean || 'Bộ đề luyện tập nhập từ JSON',
              code: 'IMPORTED_DECK',
              questions: rawData
            }];
          } else {
            rawDecks = rawData;
          }
        } else if (rawData && typeof rawData === 'object') {
          if (Array.isArray(rawData.decks)) {
            rawDecks = rawData.decks;
          } else if (Array.isArray(rawData.data)) {
            rawDecks = rawData.data;
          } else if (Array.isArray(rawData.items) && rawData.items.length > 0 && (rawData.items[0].cards || rawData.items[0].questions)) {
            rawDecks = rawData.items;
          } else if (rawData.cards || rawData.questions || rawData.deck_id || rawData.id || rawData.code || rawData.title) {
            rawDecks = [rawData];
          } else if (rawData.sentence || rawData.question || rawData.stimulusText) {
            rawDecks = [{
              title: 'Bộ đề luyện tập nhập từ JSON',
              code: 'IMPORTED_DECK',
              questions: [rawData]
            }];
          } else {
            throw new Error('Tệp JSON không chứa mảng bộ đề hoặc câu hỏi nào hợp lệ.');
          }
        } else {
          throw new Error('Định dạng tệp JSON không hợp lệ.');
        }

        if (rawDecks.length === 0) {
          throw new Error('Mảng dữ liệu bộ đề trong tệp JSON rỗng.');
        }

        // 2. Normalize and adapt every deck and question
        let totalImportedQuestions = 0;
        const sanitizedDecks: CustomPracticeDeck[] = rawDecks.map((deck: any, dIndex: number) => {
          const rawQList: any[] = Array.isArray(deck.cards)
            ? deck.cards
            : Array.isArray(deck.questions)
              ? deck.questions
              : Array.isArray(deck.items)
                ? deck.items
                : [];

          const rawId = deck.deck_id || deck.id || deck.code || `DECK_${Date.now()}_${dIndex + 1}`;
          const cleanDeckId = String(rawId).trim().toUpperCase();
          const deckTitle = deck.title || deck.name || `Bộ bài tập ${cleanDeckId}`;
          const rawCategory = deck.category || 'Vocabulary';
          const validCategories = ['Vocabulary', 'Grammar', 'Communication', 'IELTS Academic', 'IELTS Reading', 'IELTS Listening', 'IELTS Writing', 'General English', 'Custom'];
          const deckCategory = validCategories.includes(rawCategory) ? rawCategory : 'Vocabulary';
          
          let deckLevel: 'A1-A2' | 'B1-B2' | 'C1-C2' = 'B1-B2';
          if (deck.level) {
            const lvlStr = String(deck.level).toUpperCase();
            if (lvlStr.includes('A1') || lvlStr.includes('A2')) deckLevel = 'A1-A2';
            else if (lvlStr.includes('C1') || lvlStr.includes('C2')) deckLevel = 'C1-C2';
          }

          const sanitizedCards: PracticeCard[] = rawQList.map((q: any, qIndex: number) => {
            const cardId = String(q.id || q.card_id || q.question_id || `q_${Date.now()}_${dIndex}_${qIndex + 1}`);

            // A. Normalize type
            let qType: PracticeQuestionType = 'multiple-choice';
            const rawType = String(q.type || q.question_type || '').toLowerCase();
            if (rawType.includes('multi-response') || rawType.includes('multi_response') || rawType.includes('multiple-response')) {
              qType = 'multiple-response';
            } else if (rawType.includes('true-false') || rawType.includes('tfng') || rawType.includes('t/f/ng') || rawType.includes('true_false')) {
              qType = 'true-false-not-given';
            } else if (rawType.includes('category') || rawType.includes('matching')) {
              qType = 'category-matching';
            } else {
              qType = 'multiple-choice';
            }

            // B. Normalize cognitive level
            let cogLevel: 'remembering' | 'understanding' | 'applying' | 'analyzing' = 'applying';
            const rawCog = String(q.cognitiveLevel || q.cognitive_level || '').toLowerCase();
            if (rawCog.includes('remember')) cogLevel = 'remembering';
            else if (rawCog.includes('understand')) cogLevel = 'understanding';
            else if (rawCog.includes('analyz') || rawCog.includes('analys')) cogLevel = 'analyzing';

            // C. Normalize sentences / stimulus
            const sentenceEn = String(q.sentence || q.sentence_en || q.stimulusText || q.stimulus_text || q.question || q.prompt || '').trim();
            const sentenceVi = String(q.translation || q.sentence_vi || q.vietnameseContext || q.vietnamese_context || q.context || '').trim();

            // D. Normalize options
            let normalizedOptions: PracticeOption[] = [];
            const rawOpts = q.options_data || q.options;

            if (Array.isArray(rawOpts) && rawOpts.length > 0) {
              if (typeof rawOpts[0] === 'string') {
                // String array e.g. ["A. respiration", "B. photosynthesis"]
                normalizedOptions = rawOpts.map((optStr: any, optIdx: number) => {
                  const optLetter = String.fromCharCode(65 + optIdx);
                  const cleanText = String(optStr).replace(/^[A-F]\.\s*/i, '').trim();
                  
                  // Detect if this option is correct
                  let isCorrect = false;
                  if (Array.isArray(q.correctAnswer)) {
                    isCorrect = q.correctAnswer.includes(optLetter) || q.correctAnswer.includes(cleanText) || q.correctAnswer.includes(optIdx);
                  } else if (Array.isArray(q.accepted_answers)) {
                    isCorrect = q.accepted_answers.includes(optLetter) || q.accepted_answers.includes(cleanText);
                  } else if (q.correctAnswer !== undefined) {
                    isCorrect = String(q.correctAnswer).trim().toUpperCase() === optLetter || String(q.correctAnswer).trim().toLowerCase() === cleanText.toLowerCase();
                  } else if (q.correct_answer !== undefined) {
                    isCorrect = String(q.correct_answer).trim().toUpperCase() === optLetter || String(q.correct_answer).trim().toLowerCase() === cleanText.toLowerCase();
                  } else if (q.cloze_target) {
                    isCorrect = String(q.cloze_target).trim().toLowerCase() === cleanText.toLowerCase();
                  }

                  return {
                    id: `opt_${optIdx + 1}`,
                    text: cleanText || `Option ${optLetter}`,
                    isCorrect,
                    distractorRationale: q.explanation || q.distractorRationale || ''
                  };
                });
              } else {
                // Object array
                normalizedOptions = rawOpts.map((optObj: any, optIdx: number) => ({
                  id: optObj.id || `opt_${optIdx + 1}`,
                  text: String(optObj.text || optObj.label || optObj.value || `Option ${optIdx + 1}`),
                  isCorrect: Boolean(optObj.isCorrect || optObj.is_correct || optObj.correct),
                  distractorRationale: optObj.distractorRationale || optObj.explanation || '',
                  category: optObj.category
                }));
              }
            }

            // Ensure at least 1 correct option if multiple-choice
            if (qType === 'multiple-choice' && normalizedOptions.length > 0 && !normalizedOptions.some(o => o.isCorrect)) {
              normalizedOptions[0].isCorrect = true;
            }

            const minSel = Number(q.minSelections || q.min_selections || (qType === 'multiple-response' ? 2 : 1));
            const maxSel = Number(q.maxSelections || q.max_selections || (qType === 'multiple-response' ? 2 : 1));
            const targetWord = String(q.targetWord || q.target_word || q.cloze_target || '').trim();
            const ipa = String(q.ipa || q.phonetic || '').trim();
            const hints = String(q.hints || q.hint || '').trim();
            const grammarExp = String(q.grammarExplanation || q.grammar_explanation || q.explanation || '').trim();

            const correctAnswersList = normalizedOptions.filter(o => o.isCorrect).map(o => o.text);
            if (targetWord && !correctAnswersList.includes(targetWord)) {
              correctAnswersList.push(targetWord);
            }

            const item: PracticeCardItem = {
              id: cardId,
              type: qType,
              cognitiveLevel: cogLevel,
              learningOutcomeId: q.learningOutcomeId || 'LO_IMPORT',
              promptPrefix: q.promptPrefix || '',
              stimulusText: sentenceEn,
              promptSuffix: q.promptSuffix,
              options: normalizedOptions,
              minSelections: minSel,
              maxSelections: maxSel,
              targetWord,
              explanation: grammarExp,
              hints,
              categories: q.categories
            };

            const card: PracticeCard = {
              id: cardId,
              sentence_en: sentenceEn,
              sentence_vi: sentenceVi,
              cloze_target: targetWord || (correctAnswersList[0] || ''),
              target_word: targetWord,
              part_of_speech: q.partOfSpeech || q.part_of_speech || '',
              phonetic: ipa,
              hints,
              accepted_answers: correctAnswersList.length > 0 ? correctAnswersList : ['answer'],
              explanation: grammarExp,
              type: qType,
              cognitive_level: cogLevel,
              options_data: normalizedOptions,
              options: normalizedOptions.map(o => o.text),
              min_selections: minSel,
              max_selections: maxSel,
              item
            };

            return card;
          });

          totalImportedQuestions += sanitizedCards.length;

          return {
            deck_id: cleanDeckId,
            title: deckTitle,
            category: deckCategory as any,
            description: deck.description || '',
            target_language: deck.target_language || 'en',
            native_language: deck.native_language || 'vi',
            level: deckLevel,
            cards: sanitizedCards,
            created_at: deck.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_custom: true
          };
        });

        // 3. Save each sanitized deck to practiceService
        sanitizedDecks.forEach(d => {
          practiceService.saveDeck(d);
        });

        refreshDecks(sanitizedDecks[0]?.deck_id);
        setSuccessMsg(`Đã nhập thành công ${sanitizedDecks.length} bộ bài tập (${totalImportedQuestions} câu hỏi)!`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: any) {
        console.error('Chi tiết lỗi import JSON:', err);
        setErrorMsg(`Lỗi nhập tệp JSON: ${err.message || 'Tệp JSON không hợp lệ'}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJsonFile}
        accept=".json"
        className="hidden"
      />

      {/* Top Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Quản trị viên Khảo thí &amp; Học liệu Luyện tập Tự do</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Kho Bài Tập Thông Minh (Practice Decks CRUD)
          </h2>
          <p className="text-xs text-slate-400">
            Toàn quyền tạo mới, chỉnh sửa, xóa bộ đề và câu hỏi. Tích hợp 4 dạng bài tập chuẩn khảo thí và sinh đề bằng Gemini AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-purple-600/20 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Sinh bằng Gemini AI</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
            title="Nhập bộ đề từ tệp JSON sao lưu"
          >
            <FileUp className="w-4 h-4 text-emerald-400" />
            <span>Nhập JSON</span>
          </button>

          <button
            onClick={handleNewDeck}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Bộ Đề Mới</span>
          </button>

          <button
            onClick={() => setShowClearAllModal(true)}
            className="px-3.5 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
            title="Xóa toàn bộ mã đề practice hiện có để làm lại câu hỏi từ đầu"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Xóa sạch bộ đề (Reset)</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Database Synchronization Panel */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 rounded-2xl shrink-0 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Cơ sở Dữ liệu Google Sheets</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Tab PRACTICE_QUESTIONS
                </span>
              </h3>
              {dbStatus.is_on_sheets ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Đã đồng bộ lên Sheets ({dbStatus.total_cards} câu hỏi)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Lưu trữ cục bộ (Chưa đồng bộ lên Sheets)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Khởi tạo cấu trúc bảng tính, lưu trữ kho câu hỏi vĩnh viễn trên Google Sheets và tự động đồng bộ hai chiều.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={handleInitDatabaseOnSheets}
            disabled={isSyncingSheets}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-md shadow-emerald-900/20 disabled:opacity-50 cursor-pointer"
            title="Khởi tạo tab PRACTICE_QUESTIONS trên Google Sheets và nạp toàn bộ câu hỏi"
          >
            {isSyncingSheets ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Khởi tạo DB trên Sheet</span>
          </button>

          <button
            onClick={handleFetchFromSheets}
            disabled={isFetchingSheets}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            title="Tải câu hỏi mới nhất từ Google Sheets về ứng dụng"
          >
            {isFetchingSheets ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <RefreshCw className="w-4 h-4 text-indigo-400" />
            )}
            <span>Tải lại từ Sheet</span>
          </button>

          <button
            onClick={() => setShowSchemaModal(true)}
            className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-700 cursor-pointer"
            title="Xem sơ đồ 19 cột trên Google Sheets"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-rose-300 text-xs font-semibold animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setMobileTab('library')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'library'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Danh Sách Đề ({filteredDecks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'editor'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Biên Tập Đề {selectedDeck ? `(${selectedDeck.deck_id})` : ''}</span>
        </button>
      </div>

      {/* Main Grid: Deck List (Left) vs Deck Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Deck Library (4 Cols) */}
        <div className={`lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 ${
          mobileTab === 'editor' ? 'hidden lg:block' : 'block'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Kho Bộ Đề ({decks.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">Chọn đề để chỉnh sửa</span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã, tên hoặc từ khóa..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Cấp Độ:
              </label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tất cả cấp độ</option>
                <option value="A1-A2">A1 - A2</option>
                <option value="B1-B2">B1 - B2</option>
                <option value="C1-C2">C1 - C2</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Danh Mục:
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tất cả danh mục</option>
                <option value="Vocabulary">Vocabulary</option>
                <option value="Grammar">Grammar</option>
                <option value="Communication">Communication</option>
                <option value="IELTS Academic">IELTS Academic</option>
                <option value="General English">General English</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Deck List Scroll Area */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredDecks.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Không tìm thấy bộ đề phù hợp với bộ lọc.
              </div>
            ) : (
              filteredDecks.map((deck, idx) => {
                const isSelected = selectedDeck?.deck_id === deck.deck_id;
                return (
                  <div
                    key={`${deck.deck_id || 'deck'}-${idx}`}
                    onClick={() => handleSelectDeck(deck)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 relative group ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-700/40">
                        {deck.deck_id}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        {deck.category}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-1">
                      {deck.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>{deck.cards.length} câu hỏi</span>
                      <span className="text-emerald-400 font-semibold">{deck.level}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Deck Details & Question Editor (8 Cols) */}
        <div className={`lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-6 ${
          mobileTab === 'library' ? 'hidden lg:block' : 'block'
        }`}>
          {/* Back to library button on mobile */}
          <div className="lg:hidden flex items-center justify-between pb-3 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setMobileTab('library')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span>← Quay lại Kho Bộ Đề</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {selectedDeck ? selectedDeck.deck_id : 'Mới'}
            </span>
          </div>
          
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {selectedDeck ? `Chi Tiết Bộ Đề [${selectedDeck.deck_id}]` : 'Tạo Mới Bộ Luyện Tập'}
                </h3>
                {selectedDeck?.is_custom && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Tùy Chỉnh
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Thí sinh nhập mã bộ đề này khi đăng nhập để luyện tập tự do
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedDeck && (
                <>
                  <button
                    onClick={handleDuplicateDeck}
                    className="px-3 py-2 text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/50 rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Nhân bản bộ đề này"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Nhân Bản</span>
                  </button>

                  <button
                    onClick={handleExportJson}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition text-xs flex items-center gap-1"
                    title="Xuất JSON ra tệp"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => promptDeleteDeck(selectedDeck)}
                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
                    title="Xóa bộ đề này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={handleSaveDeck}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-md shadow-emerald-600/20 cursor-pointer"
                title="Lưu bộ đề vào kho dữ liệu"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Bộ Đề</span>
              </button>

              <button
                onClick={handleSaveSelectedDeckToSheets}
                disabled={isSyncingSheets || !selectedDeck}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
                title="Đồng bộ bộ đề này trực tiếp lên Google Sheets (Tab PRACTICE_QUESTIONS)"
              >
                {isSyncingSheets ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>Đẩy Lên Sheet</span>
              </button>
            </div>
          </div>

          {/* Form Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Mã Bộ Đề (Set Code) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={deckId}
                onChange={(e) => setDeckId(e.target.value.toUpperCase())}
                placeholder="VD: PRACTICE_01, VOCAB_B2"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Tiêu Đề Bộ Đề (Set Title) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Từ Vựng Học Thuật & Cụm Kết Hợp Từ IELTS Task 2"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Danh Mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="Vocabulary">Vocabulary (Từ vựng)</option>
                <option value="Grammar">Grammar (Ngữ pháp)</option>
                <option value="Communication">Communication (Giao tiếp)</option>
                <option value="IELTS Academic">IELTS Academic (Học thuật)</option>
                <option value="General English">General English (Tổng quát)</option>
                <option value="Custom">Custom (Tự do)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Cấp Độ (CEFR Level)
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="A1-A2">A1 - A2 (Cơ bản / Sơ cấp)</option>
                <option value="B1-B2">B1 - B2 (Trung cấp / IELTS 5.0 - 6.5)</option>
                <option value="C1-C2">C1 - C2 (Nâng cao / IELTS 7.0 - 9.0)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Mô Tả Ngắn Gọn
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mục tiêu bài tập, kỹ năng khảo thí..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Danh Sách Câu Hỏi ({cards.length})</span>
              </h4>

              {/* Add Card dropdown buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddCard('multiple-choice')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold rounded-lg text-xs flex items-center gap-1 border border-slate-700 transition"
                  title="Thêm câu hỏi Chọn 1 đáp án"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Multiple Choice</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddCard('multiple-response')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 font-semibold rounded-lg text-xs flex items-center gap-1 border border-slate-700 transition"
                  title="Thêm câu hỏi Chọn nhiều đáp án"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Multi Response</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddCard('true-false-not-given')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold rounded-lg text-xs flex items-center gap-1 border border-slate-700 transition"
                  title="Thêm câu hỏi True/False/Not Given"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ TFNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddCard('category-matching')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold rounded-lg text-xs flex items-center gap-1 border border-slate-700 transition"
                  title="Thêm câu hỏi Phân loại nhóm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Matching</span>
                </button>
              </div>
            </div>

            {/* Question Cards Container */}
            <div className="space-y-5 max-h-[700px] overflow-y-auto pr-1">
              {cards.map((card, idx) => {
                const cardType = card.type || 'multiple-choice';
                const options = card.options_data || [];

                return (
                  <div
                    key={`${card.id || 'card'}-${idx}`}
                    className="p-5 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-4 relative group transition shadow-sm"
                  >
                    {/* Card Header & Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>

                        {/* Format Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cardType === 'multiple-choice' ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30' :
                          cardType === 'multiple-response' ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30' :
                          cardType === 'true-false-not-given' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' :
                          'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {cardType}
                        </span>

                        {/* Cognitive Level Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          Bloom: {card.cognitive_level || 'applying'}
                        </span>
                      </div>

                      {/* Action buttons on card: Up, Down, Copy, Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveCard(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCard(idx, 'down')}
                          disabled={idx === cards.length - 1}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateCard(idx)}
                          className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition"
                          title="Nhân bản câu hỏi này"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(idx)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Format and Cognitive Level Selectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Định Dạng Bài Tập (Question Type):
                        </label>
                        <select
                          value={cardType}
                          onChange={(e) => handleCardChange(idx, 'type', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                        >
                          <option value="multiple-choice">1. multiple-choice (Chọn 1 đáp án)</option>
                          <option value="multiple-response">2. multiple-response (Chọn nhiều đáp án)</option>
                          <option value="true-false-not-given">3. true-false-not-given (Đúng / Sai / Không có thông tin)</option>
                          <option value="category-matching">4. category-matching (Phân loại / Nối nhóm từ loại)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Cấp Độ Nhận Thức (Bloom's Taxonomy):
                        </label>
                        <select
                          value={card.cognitive_level || 'applying'}
                          onChange={(e) => handleCardChange(idx, 'cognitive_level', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                        >
                          <option value="remembering">remembering (Nhận biết / Ghi nhớ định nghĩa)</option>
                          <option value="understanding">understanding (Thông hiểu ngữ cảnh)</option>
                          <option value="applying">applying (Vận dụng vào câu văn)</option>
                          <option value="analyzing">analyzing (Phân tích bẫy / Đối chiếu học thuật)</option>
                        </select>
                      </div>
                    </div>

                    {/* Sentence EN with cloze mark */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Câu Hỏi / Ngữ Cảnh Tiếng Anh (Dùng <code className="text-indigo-300">_____</code> cho ô trống):
                      </label>
                      <textarea
                        rows={2}
                        value={card.sentence_en}
                        onChange={(e) => handleCardChange(idx, 'sentence_en', e.target.value)}
                        placeholder="VD: The university committee decided to _____ the new environmental curriculum after extensive debate."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 leading-relaxed font-mono"
                      />
                    </div>

                    {/* Sentence VI */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Dịch Nghĩa Ngữ Cảnh / Diễn Giải Tiếng Việt:
                      </label>
                      <input
                        type="text"
                        value={card.sentence_vi}
                        onChange={(e) => handleCardChange(idx, 'sentence_vi', e.target.value)}
                        placeholder="VD: Hội đồng trường đại học đã quyết định áp dụng chương trình giảng dạy môi trường mới..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Extra config for multiple-response or true-false-not-given */}
                    {cardType === 'multiple-response' && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-1">
                            Lựa chọn tối thiểu (min_selections):
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={card.min_selections || 2}
                            onChange={(e) => handleCardChange(idx, 'min_selections', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-purple-500/40 rounded-lg text-white text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-1">
                            Lựa chọn tối đa (max_selections):
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={card.max_selections || 2}
                            onChange={(e) => handleCardChange(idx, 'max_selections', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-purple-500/40 rounded-lg text-white text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {cardType === 'true-false-not-given' && (
                      <div className="flex items-center justify-between p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs">
                        <span className="text-amber-300 font-semibold">
                          Tùy chọn nhanh đáp án đúng chuẩn TFNG:
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyTfngPreset(idx, 'TRUE')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              card.cloze_target === 'TRUE' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            TRUE
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyTfngPreset(idx, 'FALSE')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              card.cloze_target === 'FALSE' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            FALSE
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyTfngPreset(idx, 'NOT GIVEN')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              card.cloze_target === 'NOT GIVEN' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            NOT GIVEN
                          </button>
                        </div>
                      </div>
                    )}

                    {/* DYNAMIC OPTIONS DATA EDITOR */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Danh Sách Phương Án &amp; Phân Tích Bẫy (Options Data):</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddOptionToCard(idx)}
                          className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-semibold rounded-lg text-xs flex items-center gap-1 transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm Phương Án</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {options.map((opt, optIdx) => (
                          <div
                            key={opt.id || `opt-${optIdx}`}
                            className={`p-3 rounded-xl border transition ${
                              opt.isCorrect 
                                ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20' 
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Correct toggle checkbox */}
                              <button
                                type="button"
                                onClick={() => handleOptionChange(idx, optIdx, 'isCorrect', !opt.isCorrect)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                                  opt.isCorrect
                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                }`}
                                title={opt.isCorrect ? 'Phương án đúng' : 'Đánh dấu là phương án đúng'}
                              >
                                {opt.isCorrect ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                <span>{opt.isCorrect ? 'ĐÚNG' : 'SAI'}</span>
                              </button>

                              {/* Option text */}
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => handleOptionChange(idx, optIdx, 'text', e.target.value)}
                                placeholder={`Nội dung phương án ${optIdx + 1}...`}
                                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold text-xs focus:outline-none focus:border-indigo-500"
                              />

                              {/* Category input for category-matching */}
                              {cardType === 'category-matching' && (
                                <input
                                  type="text"
                                  value={opt.category || ''}
                                  onChange={(e) => handleOptionChange(idx, optIdx, 'category', e.target.value)}
                                  placeholder="Nhóm/Từ loại (VD: Noun, Verb, Addition)..."
                                  className="w-48 px-2.5 py-1.5 bg-slate-950 border border-emerald-700/50 rounded-lg text-emerald-300 text-xs focus:outline-none"
                                />
                              )}

                              {/* Remove option button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionFromCard(idx, optIdx)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                                title="Xóa phương án này"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Distractor Rationale input */}
                            <div className="mt-2 pl-2 border-l-2 border-indigo-500/30">
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                Giải thích cặn kẽ tại sao đúng hoặc phân tích bẫy (distractorRationale):
                              </label>
                              <input
                                type="text"
                                value={opt.distractorRationale || ''}
                                onChange={(e) => handleOptionChange(idx, optIdx, 'distractorRationale', e.target.value)}
                                placeholder="VD: Bẫy từ loại - 'adapt' mang nghĩa thích nghi, trong khi ngữ cảnh cần động từ 'adopt'..."
                                className="w-full px-2.5 py-1 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 text-[11px] focus:outline-none focus:border-indigo-400"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Target & Hints */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                          Từ Khóa / Đáp Án Mục Tiêu (Target Word):
                        </label>
                        <input
                          type="text"
                          value={card.cloze_target}
                          onChange={(e) => handleCardChange(idx, 'cloze_target', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 font-bold text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Từ Loại &amp; Phiên Âm IPA:
                        </label>
                        <input
                          type="text"
                          value={card.phonetic || ''}
                          onChange={(e) => handleCardChange(idx, 'phonetic', e.target.value)}
                          placeholder="VD: /əˈdɒpt/ (verb)"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                          Gợi Ý Làm Bài (Hints):
                        </label>
                        <input
                          type="text"
                          value={card.hints || ''}
                          onChange={(e) => handleCardChange(idx, 'hints', e.target.value)}
                          placeholder="VD: chấp nhận, ban hành, đưa vào sử dụng"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Giải Thích Ngữ Pháp &amp; Cụm Từ Học Thuật Tổng Quan:
                      </label>
                      <textarea
                        rows={2}
                        value={card.explanation}
                        onChange={(e) => handleCardChange(idx, 'explanation', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500 leading-relaxed"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* AI Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sinh Đề Tự Động Bằng Gemini AI</h3>
                  <p className="text-xs text-slate-400">Kết hợp 4 dạng bài tập chuẩn và giải thích phương án bẫy chi tiết</p>
                </div>
              </div>

              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateAiDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Chủ Đề Trọng Tâm (Topic) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="VD: Academic Collocations, Task 2 Environment, Relative Clauses..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Danh Mục
                  </label>
                  <select
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Vocabulary">Vocabulary</option>
                    <option value="Grammar">Grammar</option>
                    <option value="Communication">Communication</option>
                    <option value="IELTS Academic">IELTS Academic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Cấp Độ
                  </label>
                  <select
                    value={aiLevel}
                    onChange={(e) => setAiLevel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="A1-A2">A1 - A2</option>
                    <option value="B1-B2">B1 - B2</option>
                    <option value="C1-C2">C1 - C2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Số lượng câu hỏi ({aiCount} câu)
                </label>
                <input
                  type="range"
                  min={4}
                  max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini đang thiết kế đề và phân tích bẫy khảo thí...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo Bộ Bài Tập Ngay</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deckToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác Nhận Xóa Bộ Đề</h3>
                <p className="text-xs text-slate-400">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="font-mono text-indigo-300 font-bold">Mã: {deckToDelete.deck_id}</div>
              <div className="text-white font-semibold">{deckToDelete.title}</div>
              <div className="text-slate-400">{deckToDelete.cards.length} câu hỏi • Cấp độ {deckToDelete.level}</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeckToDelete(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteDeck}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-900/30"
              >
                Đồng Ý Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Practice Decks Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xóa Sạch Tất Cả Bộ Đề</h3>
                <p className="text-xs text-rose-300">Khởi tạo lại từ đầu cho giáo viên</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Hành động này sẽ xóa hoàn toàn tất cả các bộ đề luyện tập hiện có trong bộ nhớ máy (cả bộ đề mặc định và bộ đề tự tạo). Kho bài tập sẽ trở về trạng thái trống (0 câu hỏi) để quý Thầy/Cô biên soạn lại từ đầu.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleClearAllDecks}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-900/30 cursor-pointer"
              >
                Đồng Ý Xóa Sạch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Schema Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Sơ Đồ Cột Tab PRACTICE_QUESTIONS (Google Sheets)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Quy chuẩn 19 cột đồng bộ lưu trữ đám mây và tương tác hai chiều
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2 text-indigo-200">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Cơ Chế Đồng Bộ Tự Động &amp; An Toàn:</span>
                </p>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Khi nhấn <strong>"Khởi tạo DB trên Sheet"</strong>, hệ thống tự động tạo tab <code>PRACTICE_QUESTIONS</code> trong Google Sheet của Thầy/Cô (nếu chưa có) và ghi toàn bộ kho câu hỏi. Khi học sinh vào làm bài, hệ thống sẽ ưu tiên đọc dữ liệu từ Google Sheets này.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  Quy định 19 cột dữ liệu chuẩn:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột A (DECK_ID):</span> Mã bộ đề (VD: PRACTICE_01)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột B (DECK_TITLE):</span> Tên hiển thị của bộ đề
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột C (CATEGORY):</span> Vocabulary | Grammar | IELTS
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột D (DESCRIPTION):</span> Mô tả bộ đề
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột E (LEVEL):</span> A1-A2 | B1-B2 | C1-C2
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột F (CARD_ID):</span> Định danh câu hỏi duy nhất
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột G (SENTENCE_EN):</span> Câu hỏi / Ngữ cảnh có _____
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột H (SENTENCE_VI):</span> Dịch nghĩa / Giải nghĩa
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">Cột I (CLOZE_TARGET):</span> Từ khóa / Đáp án mục tiêu
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột J (TARGET_WORD):</span> Từ gốc (lemma)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột K (PART_OF_SPEECH):</span> Từ loại (noun, verb...)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột L (PHONETIC):</span> Phiên âm IPA (/ˈɪm.pækt/)
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột M (HINTS):</span> Gợi ý làm bài
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột N (OPTIONS_JSON):</span> Mảng phương án trắc nghiệm
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột O (ACCEPTED_ANSWERS_JSON):</span> Mảng đáp án chấp nhận
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột P (EXPLANATION):</span> Giải thích ngữ pháp &amp; collocations
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột Q (GRAMMAR_POINTS_JSON):</span> Điểm ngữ pháp cốt lõi
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột R (DIFFICULTY):</span> easy | medium | hard
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold">Cột S (UPDATED_AT):</span> Thời điểm cập nhật cuối
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSchemaModal(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
              >
                Đã Hiểu &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
