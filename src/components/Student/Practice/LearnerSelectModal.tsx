import React, { useState } from 'react';
import { LearnerProfile } from '../../../types/practice';
import { User, Check, Edit3, Save, X, Sparkles, Database, CloudCheck, AlertCircle } from 'lucide-react';

interface LearnerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  learners: LearnerProfile[];
  currentLearner: LearnerProfile;
  onSelectLearner: (learnerId: string) => void;
  onUpdateLearnerName: (learnerId: string, newName: string) => void;
  onSyncToSheets: () => Promise<void>;
  isSyncing: boolean;
}

export const LearnerSelectModal: React.FC<LearnerSelectModalProps> = ({
  isOpen,
  onClose,
  learners,
  currentLearner,
  onSelectLearner,
  onUpdateLearnerName,
  onSyncToSheets,
  isSyncing
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const startEdit = (learner: LearnerProfile) => {
    setEditingId(learner.student_id);
    setEditNameInput(learner.student_name);
  };

  const saveEdit = (learnerId: string) => {
    const clean = editNameInput.trim();
    if (clean) {
      onUpdateLearnerName(learnerId, clean);
      setFeedbackMsg(`Name updated to "${clean}"`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-purple-950/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-purple-100 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-[#3C2A63]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-purple-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#6B51A5] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3C2A63]">Learner Profile</h3>
              <p className="text-xs text-[#7C68A5]">Select or edit learner profile (3 Slots)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#7C68A5] hover:text-[#3C2A63] hover:bg-purple-50 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean Learner Notice */}
        <div className="p-3.5 bg-[#F5F2F9] border border-purple-100 rounded-2xl text-xs text-[#503A7A] leading-relaxed">
          Please enter your full name to save individual practice streaks, scores, and mastered questions.
        </div>

        {feedbackMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* 3 Learners Slots List */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C68A5] block">
            Select Active Learner:
          </span>

          {learners.map((learner) => {
            const isSelected = learner.student_id === currentLearner.student_id;
            const isEditing = editingId === learner.student_id;

            return (
              <div
                key={learner.student_id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-purple-50/70 border-[#6B51A5] shadow-sm ring-1 ring-[#6B51A5]/30'
                    : 'bg-white border-purple-100 hover:border-purple-200 hover:bg-[#F5F2F9]/50'
                }`}
              >
                {/* Avatar & Slot */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl ${learner.avatar_color} text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-xs`}>
                    {learner.student_id}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editNameInput}
                          onChange={(e) => setEditNameInput(e.target.value)}
                          placeholder="Enter your full name..."
                          autoFocus
                          className="px-2.5 py-1 text-xs font-bold border-2 border-[#6B51A5] rounded-lg bg-white text-[#3C2A63] focus:outline-none w-full"
                        />
                        <button
                          onClick={() => saveEdit(learner.student_id)}
                          className="px-2.5 py-1 bg-[#6B51A5] text-white rounded-lg text-xs font-bold hover:bg-[#503A7A] transition shrink-0 flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#3C2A63] truncate">
                          {learner.student_name}
                        </span>
                        <button
                          onClick={() => startEdit(learner)}
                          className="text-[#7C68A5] hover:text-[#6B51A5] p-1 rounded hover:bg-purple-100/50 transition cursor-pointer"
                          title="Edit learner name"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="text-[11px] text-[#7C68A5] block">
                      Slot {learner.slot_index} • ID: {learner.student_id}
                    </span>
                  </div>
                </div>

                {/* Select Button */}
                <div className="shrink-0">
                  {isSelected ? (
                    <span className="px-3 py-1.5 bg-[#6B51A5] text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectLearner(learner.student_id);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-[#F5F2F9] hover:bg-purple-100 text-[#503A7A] text-xs font-bold rounded-xl border border-purple-200 transition cursor-pointer"
                    >
                      Select
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-purple-100 flex-wrap">
          <button
            onClick={onSyncToSheets}
            disabled={isSyncing}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Database className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Progress to Sheets'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#6B51A5] hover:bg-[#503A7A] text-white text-xs font-bold rounded-xl shadow-md shadow-[#6B51A5]/20 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
