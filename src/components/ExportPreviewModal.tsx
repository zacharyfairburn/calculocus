import React, { useState } from 'react';
import {
  Download,
  Share2,
  Copy,
  Check,
  X,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { copyBlobToClipboard, isIOSDevice } from '../utils/exportGraph';

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataUrl: string;
  blob: Blob | null;
  filename: string;
  width: number;
  height: number;
  is3D: boolean;
  theme?: 'dark' | 'light';
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  dataUrl,
  blob,
  filename,
  width,
  height,
  is3D,
  theme = 'dark',
}) => {
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  if (!isOpen || !dataUrl) return null;

  const isLight = theme === 'light';
  const isIOS = isIOSDevice();

  const handleDownload = () => {
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (e) {
      console.warn('Manual download trigger failed:', e);
    }
  };

  const handleWebShare = async () => {
    if (!blob) return;
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Calculocus Graph Export',
          text: `Calculocus ${is3D ? '3D Surface' : '2D Graph'} snapshot`,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } else {
        handleDownload();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.warn('Web Share execution failed:', err);
      }
    }
  };

  const handleCopy = async () => {
    if (!blob) return;
    const ok = await copyBlobToClipboard(blob);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenNewTab = () => {
    if (!dataUrl) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<!DOCTYPE html><html><head><title>${filename}</title><style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;}img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 10px 30px rgba(0,0,0,0.5);}</style></head><body><img src="${dataUrl}" alt="Graph Export"/></body></html>`
      );
    }
  };

  return (
    <div
      id="export-preview-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="export-preview-modal-container"
        className={`w-full max-w-xl max-h-[90vh] flex flex-col border shadow-2xl rounded-none overflow-hidden ${
          isLight ? 'bg-white text-black border-neutral-300' : 'bg-neutral-950 text-white border-neutral-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#00693E]" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Export Graph Image (.PNG)
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 transition-colors ${
              isLight ? 'text-neutral-500 hover:text-black hover:bg-neutral-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Image Canvas Preview Container */}
          <div
            className={`relative w-full aspect-[16/10] flex items-center justify-center p-2 border overflow-hidden ${
              isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
            }`}
          >
            <img
              src={dataUrl}
              alt="Calculocus Graph Snapshot"
              className="max-w-full max-h-full object-contain border shadow-sm select-none"
            />
          </div>

          {/* Metadata Specs */}
          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono opacity-75 px-1">
            <span>Dimensions: {width} × {height} px</span>
            <span>Format: PNG Image</span>
            <span className="truncate max-w-[200px]">{filename}</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Native Share / Save to Photos (especially powerful on iOS) */}
            <button
              onClick={handleWebShare}
              className="px-3 py-2 bg-[#00693E] hover:bg-[#005230] text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              title="Share or Save to Photos"
            >
              {shareSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Shared</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isIOS ? 'Save to Photos' : 'Share Image'}</span>
                </>
              )}
            </button>

            {/* Direct File Download */}
            <button
              onClick={handleDownload}
              className={`px-3 py-2 border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-900'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
              }`}
              title="Download PNG to disk"
            >
              <Download className="w-3.5 h-3.5 text-[#00693E]" />
              <span>Download .PNG</span>
            </button>

            {/* Copy to Clipboard */}
            <button
              onClick={handleCopy}
              className={`px-3 py-2 border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-900'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
              }`}
              title="Copy image to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00693E]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#00693E]" />
                  <span>Copy Image</span>
                </>
              )}
            </button>
          </div>

          {/* iOS Guidance Banner */}
          <div
            className={`p-3 border text-xs font-mono flex items-start gap-2.5 ${
              isLight
                ? 'bg-[#00693E]/5 border-[#00693E]/20 text-[#00693E]'
                : 'bg-[#00693E]/10 border-[#00693E]/30 text-emerald-300'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">iOS & iPadOS Direct Save:</p>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                Tap <strong>Save to Photos</strong> above, or <strong>touch & hold</strong> the preview image and select <strong>&quot;Save to Photos&quot;</strong> or <strong>&quot;Share&quot;</strong>.
              </p>
            </div>
          </div>

          {/* New Tab Option */}
          <div className="flex justify-end">
            <button
              onClick={handleOpenNewTab}
              className={`text-[11px] font-mono flex items-center gap-1 underline underline-offset-2 transition-colors ${
                isLight ? 'text-neutral-600 hover:text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open raw image in new tab</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
