/**
 * Calculocus Graph PNG Export Utility
 * Comprehensive support for iOS Safari, iPadOS, WebViews, Desktop, and Mobile browsers.
 */

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOSPlatform = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOSPlatform || isIPadOS;
}

export function getCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback to Data URL conversion
            try {
              const dataUrl = canvas.toDataURL('image/png');
              const byteString = atob(dataUrl.split(',')[1]);
              const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              resolve(new Blob([ab], { type: mimeString }));
            } catch (err) {
              reject(err);
            }
          }
        },
        'image/png'
      );
    } catch (e) {
      reject(e);
    }
  });
}

export interface ExportResult {
  blob: Blob;
  dataUrl: string;
  filename: string;
  width: number;
  height: number;
  sharedViaWebShare: boolean;
  downloadTriggered: boolean;
}

/**
 * Executes a full export of the provided canvas to PNG,
 * seamlessly attempting Web Share API on iOS/Mobile, and falling back to standard file download.
 */
export async function exportGraphToPNG(
  canvas: HTMLCanvasElement,
  is3D: boolean,
  triggerDownload = true
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `calculocus-${is3D ? '3d-surface' : '2d-graph'}-${timestamp}.png`;

  const blob = await getCanvasBlob(canvas);
  const dataUrl = canvas.toDataURL('image/png');
  const width = canvas.width;
  const height = canvas.height;

  let sharedViaWebShare = false;
  let downloadTriggered = false;

  const isIOS = isIOSDevice();

  // If on iOS or mobile, check if Web Share API is supported with files
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Calculocus Graph Export',
          text: `Calculocus ${is3D ? '3D' : '2D'} Graph snapshot`,
        });
        sharedViaWebShare = true;
      }
    } catch (shareErr: unknown) {
      // User might have aborted share sheet (AbortError) or Web Share failed
      if (shareErr instanceof Error && shareErr.name !== 'AbortError') {
        console.warn('Web Share failed, falling back to download:', shareErr);
      }
    }
  }

  // If not shared via Web Share or on desktop/fallback, trigger programmatic <a> download
  if (!sharedViaWebShare && triggerDownload) {
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
      downloadTriggered = true;
    } catch (downloadErr) {
      console.warn('Programmatic download trigger error:', downloadErr);
    }
  }

  return {
    blob,
    dataUrl,
    filename,
    width,
    height,
    sharedViaWebShare,
    downloadTriggered,
  };
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
    return false;
  }
  try {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    return false;
  }
}
