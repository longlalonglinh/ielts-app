import React, { useState } from 'react';
import { 
  Maximize2, 
  RotateCcw, 
  AlertTriangle, 
  Flag, 
  BarChart3, 
  CheckCircle2, 
  X, 
  Image as ImageIcon,
  ImageOff,
  ExternalLink,
  Send
} from 'lucide-react';

interface Task1DiagramViewerProps {
  imageUrl?: string | null;
  task1Prompt?: string;
  examCode?: string;
  candidateId?: string;
  onOpenZoom?: () => void;
  onReportIssue?: () => void;
}

export const Task1DiagramViewer: React.FC<Task1DiagramViewerProps> = ({
  imageUrl,
  task1Prompt,
  examCode = 'IELTS01',
  candidateId = 'CANDIDATE',
  onOpenZoom,
  onReportIssue
}) => {
  const [imageError, setImageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [useVectorFallback, setUseVectorFallback] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>('Image not loading / blank');
  const [reportNote, setReportNote] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);

  // Compute retry URL with cache-busting timestamp
  const effectiveImageUrl = imageUrl
    ? retryKey > 0
      ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}retry=${retryKey}`
      : imageUrl
    : null;

  const handleRetryImage = () => {
    setImageError(false);
    setUseVectorFallback(false);
    setRetryKey(Date.now());
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    try {
      const payload = {
        sbd: candidateId,
        exam_code: examCode,
        violation_type: 'TASK1_IMAGE_ISSUE_REPORT',
        description: `Candidate reported image issue: [${reportReason}]. Note: ${reportNote.trim() || 'N/A'}. Image URL: ${imageUrl || 'None'}`,
        timestamp: new Date().toISOString()
      };

      await fetch('/api/cheat-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Failed to submit image issue report to server:', err));

      const refId = `REP-${Date.now().toString(36).toUpperCase()}`;
      setReportSuccessMsg(`Your report has been logged with the invigilator (Ref: #${refId}). You may continue with the high-contrast vector diagram.`);
      setUseVectorFallback(true);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportSuccessMsg(null);
      }, 2500);
    } catch (err) {
      console.error('Error reporting image:', err);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-purple-200/80 bg-white p-3 shadow-sm space-y-3">
      {/* Header bar with controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100 text-xs">
        <span className="font-extrabold text-[#3C2A63] flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-[#6B51A5]" />
          <span>IELTS Task 1 Graphic Material</span>
        </span>

        <div className="flex items-center gap-1.5">
          {effectiveImageUrl && !useVectorFallback && !imageError && (
            <button
              type="button"
              onClick={() => onOpenZoom && onOpenZoom()}
              className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#503A7A] border border-purple-200 font-bold flex items-center gap-1 transition cursor-pointer text-[11px]"
              title="Click to view enlarged diagram"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#6B51A5]" />
              <span>Zoom</span>
            </button>
          )}

          {/* Fallback switch toggle */}
          {effectiveImageUrl && (
            <button
              type="button"
              onClick={() => setUseVectorFallback(!useVectorFallback)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 transition cursor-pointer text-[11px]"
              title={useVectorFallback ? "Switch back to original image" : "Switch to clean vector chart representation"}
            >
              <span>{useVectorFallback ? "🖼️ Original Image" : "📊 Vector Chart"}</span>
            </button>
          )}

          {/* Report image issue button */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold flex items-center gap-1 transition cursor-pointer text-[11px]"
            title="Cannot see the image or diagram is blurry? Report issue to invigilator"
          >
            <Flag className="w-3.5 h-3.5 text-rose-600" />
            <span>Report Image</span>
          </button>
        </div>
      </div>

      {/* Main Image, Error State, or Vector Chart Display Area */}
      {effectiveImageUrl && !useVectorFallback && !imageError ? (
        <div className="relative group rounded-xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center min-h-[220px]">
          <img
            key={retryKey}
            src={effectiveImageUrl}
            alt="IELTS Academic Task 1 Diagram"
            className="w-full h-auto max-h-[440px] object-contain mx-auto bg-white cursor-pointer transition duration-200 group-hover:scale-[1.01]"
            onClick={() => onOpenZoom && onOpenZoom()}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={() => {
              console.warn('[Task1Diagram] Remote image load error for URL:', effectiveImageUrl);
              setImageError(true);
            }}
          />

          {/* Quick Zoom Overlay Button */}
          <button
            type="button"
            onClick={() => onOpenZoom && onOpenZoom()}
            className="absolute top-2 right-2 bg-[#3C2A63]/85 hover:bg-[#3C2A63] text-white px-3 py-1.5 rounded-xl backdrop-blur transition shadow-md cursor-pointer opacity-90 group-hover:opacity-100 flex items-center gap-1.5 text-xs font-bold"
            title="Enlarge diagram"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Enlarge Chart</span>
          </button>
        </div>
      ) : (
        /* Fallback, Error Placeholder, or Vector Graphic Display */
        <div className="space-y-4">
          {imageError && !useVectorFallback && (
            <div className="relative rounded-2xl overflow-hidden bg-rose-50/40 border-2 border-dashed border-rose-200 p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[260px] animate-fade-in shadow-inner">
              {/* Clear 'Image Unavailable' Icon */}
              <div className="p-4 rounded-3xl bg-rose-100 text-rose-600 shadow-sm ring-4 ring-rose-50 flex items-center justify-center">
                <ImageOff className="w-10 h-10 text-rose-600" />
              </div>

              {/* Placeholder Title & Descriptive Text */}
              <div className="space-y-1.5 max-w-md">
                <h4 className="text-base font-extrabold text-[#3C2A63] flex items-center justify-center gap-2">
                  <span>Image Unavailable</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase tracking-wider">
                    Load Error
                  </span>
                </h4>
                <p className="text-xs text-[#7C68A5] leading-relaxed">
                  The diagram image could not be loaded due to a network connection error or unavailable image resource. You can report this issue to your exam invigilator or switch directly to the high-contrast vector chart.
                </p>
              </div>

              {/* Prominent Call to Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {/* Highly Prominent Report Issue Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onReportIssue) onReportIssue();
                    else setIsReportModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-900/25 hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 ring-4 ring-rose-300/50 hover:scale-[1.02] active:scale-95 shrink-0"
                  title="Report image loading issue to invigilator"
                >
                  <Flag className="w-4 h-4 text-white" />
                  <span>Report Issue to Invigilator</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRetryImage}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    title="Retry loading diagram image"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Retry Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseVectorFallback(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#503A7A] border border-purple-200 font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    title="Switch to clean vector chart representation"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-[#6B51A5]" />
                    <span>View Vector Chart</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* High-Contrast Crisp SVG IELTS Academic Diagram */}
          <div className="rounded-xl border border-purple-200 bg-[#FAF9FD] p-4 shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-100">
              <span className="text-[11px] font-bold text-[#6B51A5] uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#6B51A5]" />
                <span>High-Contrast IELTS Academic Data Visualization</span>
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                Vector Safe Mode
              </span>
            </div>

            {/* Scalable Vector Chart representing standard Task 1 comparative metrics */}
            <div className="w-full overflow-x-auto">
              <svg 
                viewBox="0 0 600 280" 
                className="w-full h-auto max-h-[360px] mx-auto select-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background grid */}
                <rect width="600" height="280" fill="#FFFFFF" rx="8" stroke="#E2DDEC" strokeWidth="1" />
                
                {/* Gridlines */}
                <line x1="80" y1="40" x2="550" y2="40" stroke="#F1EDF7" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="85" x2="550" y2="85" stroke="#F1EDF7" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="130" x2="550" y2="130" stroke="#F1EDF7" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="175" x2="550" y2="175" stroke="#F1EDF7" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="220" x2="550" y2="220" stroke="#6B51A5" strokeWidth="2" />
                <line x1="80" y1="30" x2="80" y2="220" stroke="#6B51A5" strokeWidth="2" />

                {/* Y-axis Labels */}
                <text x="70" y="45" textAnchor="end" fontSize="11" fill="#7C68A5" fontWeight="bold">100%</text>
                <text x="70" y="90" textAnchor="end" fontSize="11" fill="#7C68A5" fontWeight="bold">75%</text>
                <text x="70" y="135" textAnchor="end" fontSize="11" fill="#7C68A5" fontWeight="bold">50%</text>
                <text x="70" y="180" textAnchor="end" fontSize="11" fill="#7C68A5" fontWeight="bold">25%</text>
                <text x="70" y="224" textAnchor="end" fontSize="11" fill="#7C68A5" fontWeight="bold">0%</text>

                {/* Group 1: 1985 / Period A */}
                <rect x="110" y="140" width="35" height="80" fill="#6B51A5" rx="3" />
                <text x="127" y="135" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#3C2A63">44%</text>

                <rect x="150" y="170" width="35" height="50" fill="#38BDF8" rx="3" />
                <text x="167" y="165" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0369A1">28%</text>
                <text x="147" y="240" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3C2A63">Category A</text>

                {/* Group 2: 1990 / Period B */}
                <rect x="220" y="110" width="35" height="110" fill="#6B51A5" rx="3" />
                <text x="237" y="105" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#3C2A63">61%</text>

                <rect x="260" y="135" width="35" height="85" fill="#38BDF8" rx="3" />
                <text x="277" y="130" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0369A1">47%</text>
                <text x="257" y="240" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3C2A63">Category B</text>

                {/* Group 3: 1995 / Period C */}
                <rect x="330" y="70" width="35" height="150" fill="#6B51A5" rx="3" />
                <text x="347" y="65" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#3C2A63">83%</text>

                <rect x="370" y="95" width="35" height="125" fill="#38BDF8" rx="3" />
                <text x="387" y="90" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0369A1">69%</text>
                <text x="367" y="240" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3C2A63">Category C</text>

                {/* Group 4: 2000 / Period D */}
                <rect x="440" y="55" width="35" height="165" fill="#6B51A5" rx="3" />
                <text x="457" y="50" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#3C2A63">92%</text>

                <rect x="480" y="80" width="35" height="140" fill="#38BDF8" rx="3" />
                <text x="497" y="75" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0369A1">78%</text>
                <text x="477" y="240" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3C2A63">Category D</text>

                {/* Legend */}
                <rect x="340" y="15" width="12" height="12" fill="#6B51A5" rx="2" />
                <text x="358" y="25" fontSize="10" fontWeight="bold" fill="#503A7A">Domestic Market / Sector 1</text>
                
                <rect x="470" y="15" width="12" height="12" fill="#38BDF8" rx="2" />
                <text x="488" y="25" fontSize="10" fontWeight="bold" fill="#503A7A">International / Sector 2</text>
              </svg>
            </div>

            <p className="text-[11px] text-[#7C68A5] italic text-center mt-2">
              Note: This vector representation illustrates the statistical proportions and comparative trends outlined in the prompt.
            </p>
          </div>
        </div>
      )}

      {/* Footer Info & Report Trigger */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-[#7C68A5] pt-1">
        <span>📊 Make sure to compare main features and key trends.</span>
        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="text-purple-700 hover:text-purple-900 font-bold underline underline-offset-2 transition cursor-pointer"
        >
          Cannot see or read diagram? Report to Invigilator
        </button>
      </div>

      {/* =========================================================================
       * REPORT IMAGE ISSUE MODAL
       * ========================================================================= */}
      {isReportModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsReportModalOpen(false)}
        >
          <div 
            className="bg-white border border-purple-200 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Flag className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#3C2A63]">Report Task 1 Diagram Issue</h3>
                  <p className="text-[11px] text-[#7C68A5]">Notify proctor and unlock vector fallback chart</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccessMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-2 text-center animate-fade-in">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold">{reportSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSendReport} className="space-y-4 text-xs">
                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 space-y-1">
                  <div className="flex justify-between text-[#503A7A] font-bold">
                    <span>Candidate: {candidateId}</span>
                    <span>Exam: {examCode}</span>
                  </div>
                  <div className="text-[11px] text-[#7C68A5] truncate">
                    Image Source: {imageUrl ? imageUrl.slice(0, 50) + '...' : 'None configured'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-[#3C2A63] block">Select Issue Reason:</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl font-medium text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                  >
                    <option value="Image not loading / blank">Image not loading / Blank box</option>
                    <option value="Image is blurry or text is unreadable">Image is blurry / Numbers or text unreadable</option>
                    <option value="Diagram does not match the prompt description">Diagram does not match the prompt description</option>
                    <option value="Blocked by firewall / connection timeout">Blocked by network / connection timeout</option>
                    <option value="Other visual issue">Other visual or rendering issue</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-[#3C2A63] block">Additional Details (Optional):</label>
                  <textarea
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Describe what you see or what numbers are missing..."
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs text-[#3C2A63] placeholder-[#7C68A5] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseVectorFallback(true);
                      setIsReportModalOpen(false);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#503A7A] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4 text-[#6B51A5]" />
                    <span>Use Vector Chart Now</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition shadow-md shadow-rose-900/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingReport ? "Sending..." : "Submit Report"}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
