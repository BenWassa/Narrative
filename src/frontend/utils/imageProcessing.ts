/**
 * Image processing utilities
 * Uses Web Worker for resizing when available, falls back to main thread
 */

let worker: Worker | null = null;
let messageId = 0;
const pendingRequests = new Map<
  string,
  { resolve: (blob: Blob) => void; reject: (error: Error) => void }
>();

/**
 * Initialize the image resizing worker
 */
function initializeWorker(): Worker {
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/imageResizer.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent) => {
        const { id, blob, error } = event.data;
        const pending = pendingRequests.get(id);

        if (pending) {
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(blob);
          }
          pendingRequests.delete(id);
        }
      };

      worker.onerror = error => {
        console.error('Image resizer worker error:', error);
        worker = null; // Mark worker as failed, will fall back to main thread
      };
    } catch (err) {
      console.warn('Failed to create image resizer worker, falling back to main thread:', err);
      worker = null;
    }
  }

  return worker as Worker;
}

/**
 * Resize image in Web Worker if available, otherwise use main thread
 */
export async function resizeImageBlob(
  blob: Blob,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  // Try worker first
  if (typeof Worker !== 'undefined') {
    try {
      const w = initializeWorker();
      if (w) {
        const id = String(messageId++);

        return new Promise((resolve, reject) => {
          pendingRequests.set(id, { resolve, reject });

          // Timeout after 10 seconds
          const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error('Image resizing timed out'));
          }, 10000);

          w.postMessage(
            { id, blob, width, height, quality },
            undefined, // transfer list will be added if needed
          );
        });
      }
    } catch (err) {
      console.warn('Failed to use worker for image resizing:', err);
      // Fall through to main thread
    }
  }

  // Fall back to main thread
  return resizeImageOnMainThread(blob, width, height, quality);
}

/**
 * Fallback: resize image on main thread
 */
async function resizeImageOnMainThread(
  blob: Blob,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  // Try OffscreenCanvas first (more efficient)
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const imageBitmap = await createImageBitmap(blob);
      const offscreenCanvas = new OffscreenCanvas(width, height);
      const ctx = offscreenCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(imageBitmap, 0, 0, width, height);
      imageBitmap.close();

      return offscreenCanvas.convertToBlob({
        type: 'image/jpeg',
        quality,
      });
    } catch (err) {
      console.warn('OffscreenCanvas failed, falling back to regular canvas:', err);
      // Fall through to regular canvas
    }
  }

  // Fall back to regular canvas (for older browsers)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          resizedBlob => {
            if (resizedBlob) {
              resolve(resizedBlob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          'image/jpeg',
          quality,
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read blob'));
    };

    reader.readAsDataURL(blob);
  });
}
