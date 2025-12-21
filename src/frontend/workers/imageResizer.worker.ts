/**
 * Web Worker for image resizing and compression
 * Offloads heavy computation off the main thread
 */

interface ResizeRequest {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  quality: number;
}

interface ResizeResponse {
  id: string;
  blob: Blob;
  error?: string;
}

/**
 * Resize image blob to specified dimensions and quality
 */
async function resizeImage(
  blob: Blob,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
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

/**
 * Handle messages from the main thread
 */
self.onmessage = async (event: MessageEvent<ResizeRequest>) => {
  const { id, blob, width, height, quality } = event.data;

  try {
    const resizedBlob = await resizeImage(blob, width, height, quality);
    self.postMessage({ id, blob: resizedBlob } as ResizeResponse);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } as ResizeResponse);
  }
};
