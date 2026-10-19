import React from 'react';
import { AlertTriangle, ArrowLeft, ShieldCheck, CheckCircle2, X } from 'lucide-react';

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  answeredCount: number;
  totalQuestions: number;
  examCode?: string;
}

/**
 * ExitConfirmationModal
 * Implements Heuristic #3 (User Control & Freedom) & #5 (Error Prevention) & Fitts's Law
 * Protects users from accidental test exit and data loss while providing calm, reassuring feedback.
 */
export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  answeredCount,
  totalQuestions,
  examCode = 'IELTS'
}) => {
  if (!isOpen) return null;

  const remainingCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <div 
        className="bg-white border border-purple-100 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl shadow-purple-950/20 space-y-6 relative overflow-hidden"
      >
        {/* Close Icon (Top Right) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          aria-label="Đóng hộp thoại"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 id="exit-modal-title" className="text-lg font-black text-[#3C2A63]">
              Bạn có chắc chắn muốn rời đi?
            </h3>
            <p className="text-xs text-[#7C68A5] font-medium">
              Bài thi: <strong className="text-[#6B51A5] font-bold">{examCode}</strong>
            </p>
          </div>
        </div>

        {/* Status Card & Reassurance */}
        <div className="space-y-3">
          <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#503A7A] font-medium">Tiến độ hiện tại:</span>
              <span className="font-mono font-extrabold text-[#6B51A5]">
                {answeredCount} / {totalQuestions} câu đã làm
              </span>
            </div>
            
            {/* Mini Progress Bar */}
            <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#6B51A5] to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
              />
            </div>

            {remainingCount > 0 ? (
              <p className="text-[11px] text-amber-800 font-semibold pt-1">
                ⚠️ Bạn vẫn còn <strong className="text-amber-950 font-black">{remainingCount} câu</strong> chưa hoàn thành!
              </p>
            ) : (
              <p className="text-[11px] text-emerald-800 font-semibold pt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                <span>Bạn đã trả lời đầy đủ tất cả các câu hỏi. Hãy nộp bài để lấy điểm chính thức.</span>
              </p>
            )}
          </div>

          {/* Safety Reassurance Notice */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-2.5 text-xs text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              <strong className="text-slate-800 font-bold">Lưu tự động:</strong> Đáp án của bạn đã được ghi nhận an toàn trên thiết bị. Tuy nhiên, nếu rời khỏi trang, đồng hồ tính giờ có thể vẫn tiếp tục đếm.
            </p>
          </div>
        </div>

        {/* Action Buttons: Fitts's Law spacing & Visual Hierarchy */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2 border-t border-purple-100">
          <button
            type="button"
            onClick={onConfirmExit}
            className="w-full sm:w-auto px-4 py-2.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl border border-transparent hover:border-rose-200 transition cursor-pointer text-center"
          >
            Xác nhận rời đi
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-3 bg-[#6B51A5] hover:bg-[#503A7A] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-950/15 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
          >
            <span>Tiếp tục làm bài (Khuyên dùng)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
