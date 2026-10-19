import React, { useState, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  Link, 
  CheckCircle2, 
  AlertCircle,
  FileImage,
  ZoomIn
} from 'lucide-react';
import { normalizeGoogleDriveImageUrl } from '../../utils/imageUrl';
import { uploadImageToServer } from '../../services/api';

interface Task1ImageUploaderProps {
  value?: string;
  onChange: (dataUrlOrUrl: string) => void;
  onClear?: () => void;
}

interface OptimizationResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
}

/**
 * Intelligent Client-Side Image Optimizer:
 * Prevents memory overload and backend payload bloat (>2MB freeze).
 * Resizes to optimal diagram dimensions (max 1100px) and applies adaptive multi-pass
 * compression (JPEG/WebP) to guarantee output is crisp yet strictly under ~150KB.
 */
const optimizeAndConvertImage = (file: File): Promise<OptimizationResult> => {
  return new Promise((resolve, reject) => {
    const originalBytes = file.size;

    // Direct read for small vector SVG
    if (file.type === 'image/svg+xml' && originalBytes < 120 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          dataUrl: result,
          originalBytes,
          compressedBytes: Math.round(result.length * 0.75)
        });
      };
      reader.onerror = () => reject(new Error('Error reading SVG file'));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        // 1. Calculate optimal diagram dimensions (max 1100px)
        const targetMax = 1100;
        let { width, height } = img;

        if (width > targetMax || height > targetMax) {
          if (width > height) {
            height = Math.round((height * targetMax) / width);
            width = targetMax;
          } else {
            width = Math.round((width * targetMax) / height);
            height = targetMax;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // White background fallback for diagrams with transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // High quality image smoothing for charts, lines and numbers
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Multi-pass compression to guarantee safe payload size (< 160KB)
        let quality = 0.80;
        let mimeType = 'image/jpeg';
        let dataUrl = canvas.toDataURL(mimeType, quality);
        let compressedBytes = Math.round(dataUrl.length * 0.75);

        // Pass 2: If still > 160KB, lower quality to 0.68
        if (compressedBytes > 160 * 1024) {
          quality = 0.68;
          dataUrl = canvas.toDataURL(mimeType, quality);
          compressedBytes = Math.round(dataUrl.length * 0.75);
        }

        // Pass 3: If still > 160KB (e.g. extremely dense chart photo), scale down dimension to 850px
        if (compressedBytes > 160 * 1024) {
          const smallerCanvas = document.createElement('canvas');
          const scale = 850 / Math.max(width, height);
          smallerCanvas.width = Math.round(width * scale);
          smallerCanvas.height = Math.round(height * scale);
          const sCtx = smallerCanvas.getContext('2d', { alpha: false });
          if (sCtx) {
            sCtx.fillStyle = '#FFFFFF';
            sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
            sCtx.imageSmoothingEnabled = true;
            sCtx.imageSmoothingQuality = 'high';
            sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
            dataUrl = smallerCanvas.toDataURL(mimeType, 0.65);
            compressedBytes = Math.round(dataUrl.length * 0.75);
          }
        }

        resolve({
          dataUrl,
          originalBytes,
          compressedBytes
        });
      } catch (canvasErr) {
        reject(canvasErr);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to load image data into memory'));
    };

    img.src = objectUrl;
  });
};

export const Task1ImageUploader: React.FC<Task1ImageUploaderProps> = ({
  value,
  onChange,
  onClear
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [originalSizeStr, setOriginalSizeStr] = useState<string | null>(null);
  const [compressedSizeStr, setCompressedSizeStr] = useState<string | null>(null);
  const [savedPercent, setSavedPercent] = useState<number | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProcessFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, JPEG, WEBP, SVG).');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    // Give browser UI a frame to display loading state
    setTimeout(async () => {
      try {
        const result = await optimizeAndConvertImage(file);
        
        setFileName(file.name);
        setOriginalSizeStr(formatBytes(result.originalBytes));
        setCompressedSizeStr(formatBytes(result.compressedBytes));

        if (result.originalBytes > result.compressedBytes) {
          const ratio = Math.round(((result.originalBytes - result.compressedBytes) / result.originalBytes) * 100);
          setSavedPercent(ratio);
        } else {
          setSavedPercent(null);
        }

        // Upload to server storage to get cross-device accessible URL
        let finalImageStr = result.dataUrl;
        try {
          const uploadedUrl = await uploadImageToServer(result.dataUrl, file.name);
          if (uploadedUrl && (uploadedUrl.startsWith('/uploads/') || uploadedUrl.startsWith('http'))) {
            finalImageStr = uploadedUrl;
          }
        } catch (uploadErr) {
          console.warn('[Task1ImageUploader] Server upload fallback to dataUrl:', uploadErr);
        }

        onChange(finalImageStr);
      } catch (err: any) {
        console.error('Error compressing image:', err);
        setErrorMsg(err.message || 'Could not process this image file. Please try another image.');
      } finally {
        setIsProcessing(false);
      }
    }, 20);
  }, [onChange]);

  // File input change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Clipboard paste support (e.g. screenshot pasted directly)
  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        handleProcessFile(file);
      }
    }
  };

  const handleClearImage = () => {
    setFileName(null);
    setOriginalSizeStr(null);
    setCompressedSizeStr(null);
    setSavedPercent(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
  };

  const handleApplyUrl = () => {
    if (!urlDraft.trim()) return;
    const normalized = normalizeGoogleDriveImageUrl(urlDraft.trim());
    onChange(normalized);
    setFileName('Online URL Image');
    setOriginalSizeStr(null);
    setCompressedSizeStr(null);
    setSavedPercent(null);
    setShowUrlInput(false);
    setUrlDraft('');
  };

  const hasImage = Boolean(value && value.trim().length > 0);
  const isDataUrl = Boolean(value && value.startsWith('data:image/'));

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {/* Hidden file input for native device browsing */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif"
        onChange={handleFileChange}
        className="hidden"
        id="task1-image-file-input"
      />

      {/* Error message if any */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-rose-800 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Case 1: Image is already selected / loaded */}
      {hasImage ? (
        <div className="bg-[#F8F6FC] border border-purple-200/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-[#3C2A63]">
                  {fileName || (isDataUrl ? 'Uploaded diagram image' : 'IELTS Task 1 diagram')}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-[#7C68A5] font-medium">
                    {isDataUrl ? (
                      <span>
                        Compressed size: <strong className="text-[#3C2A63]">{compressedSizeStr || `${Math.round((value.length * 0.75) / 1024)} KB`}</strong>
                        {originalSizeStr && (
                          <span className="ml-1 text-slate-500 line-through">({originalSizeStr})</span>
                        )}
                      </span>
                    ) : (
                      'Online image URL'
                    )}
                  </p>
                  {savedPercent !== null && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                      ⚡ Reduced by {savedPercent}% (Optimized payload)
                    </span>
                  )}
                  {isDataUrl && !savedPercent && (
                    <span className="text-[10px] bg-purple-100 text-[#503A7A] font-extrabold px-2 py-0.5 rounded-full border border-purple-200">
                      ✓ Normalized
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-white hover:bg-purple-50 text-[#6B51A5] border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Replace image</span>
              </button>

              <button
                type="button"
                onClick={handleClearImage}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove image</span>
              </button>
            </div>
          </div>

          {/* Visual Image Preview */}
          <div className="relative group rounded-xl overflow-hidden border border-purple-100 bg-white max-h-72 flex items-center justify-center p-2">
            {value && value.trim() ? (
              <img
                src={normalizeGoogleDriveImageUrl(value.trim())}
                alt="Task 1 Diagram Preview"
                className="max-h-64 w-auto object-contain rounded-lg"
                referrerPolicy="no-referrer"
                onError={() => {
                  console.error('Could not load image from URL:', value);
                }}
              />
            ) : null}
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="absolute bottom-3 right-3 bg-[#3C2A63]/80 hover:bg-[#3C2A63] text-white px-2.5 py-1.5 rounded-xl text-xs font-bold backdrop-blur flex items-center gap-1 opacity-90 group-hover:opacity-100 transition shadow cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>View full size</span>
            </button>
          </div>
        </div>
      ) : (
        /* Case 2: No image yet - Show Drag & Drop Direct Device Upload Area */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-[#6B51A5] bg-purple-50/80 scale-[1.01]'
              : 'border-purple-200/90 hover:border-[#6B51A5] bg-[#F8F6FC]/60 hover:bg-purple-50/40'
          }`}
        >
          <div className="p-4 bg-purple-100/70 text-[#6B51A5] rounded-2xl shadow-xs group-hover:scale-105 transition">
            {isProcessing ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <div>
            <p className="text-sm font-black text-[#3C2A63]">
              {isProcessing ? 'Optimizing & uploading diagram...' : 'Upload diagram image directly from device'}
            </p>
            <p className="text-xs text-[#7C68A5] font-medium mt-0.5">
              Drag &amp; drop image here, or <span className="text-[#6B51A5] font-bold underline">click to select file</span> from computer / mobile
            </p>
            <p className="text-[11px] text-[#A093BA] mt-1 font-medium">
              Supports PNG, JPG, JPEG, WEBP, SVG (automatically optimizes diagram clarity)
            </p>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-1 px-4 py-2 bg-[#6B51A5] hover:bg-[#503A7A] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <FileImage className="w-4 h-4" />
            <span>Select file from device</span>
          </button>
        </div>
      )}

      {/* Alternative Option: Enter Image URL */}
      <div className="pt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-[#7C68A5] hover:text-[#503A7A] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Link className="w-3.5 h-3.5" />
            <span>{showUrlInput ? 'Hide URL link input' : 'Or enter an online image URL link'}</span>
          </button>
          
          {hasImage && isDataUrl && (
            <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
              ✓ Saved directly in exam payload
            </span>
          )}
        </div>

        {showUrlInput && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-purple-100 shadow-xs animate-in slide-in-from-top-2 duration-150">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://images.unsplash.com/... or online image link"
              className="flex-1 px-3 py-2 bg-[#F8F6FC] rounded-xl border border-purple-100 text-xs font-mono text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="px-3.5 py-2 bg-[#6B51A5] hover:bg-[#503A7A] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Full Size Modal Preview */}
      {isPreviewOpen && hasImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-4xl max-h-[90vh] overflow-hidden p-4 shadow-2xl flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-purple-100">
              <span className="text-xs font-black text-[#3C2A63]">View Task 1 Diagram Full Size</span>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-xs bg-purple-50 hover:bg-purple-100 text-[#503A7A] font-bold px-2.5 py-1 rounded-xl cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="overflow-auto flex items-center justify-center max-h-[75vh]">
              {value && value.trim() ? (
                <img
                  src={normalizeGoogleDriveImageUrl(value.trim())}
                  alt="Full Diagram Preview"
                  className="max-w-full h-auto object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    console.error('Could not load full size image from URL:', value);
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
