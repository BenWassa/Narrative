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
 * Uses createImageBitmap which is available in Web Workers
 */
async function resizeImage(
  blob: Blob,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  // Create an image bitmap from the blob
  const imageBitmap = await createImageBitmap(blob);

  // Create an offscreen canvas
  const offscreenCanvas = new OffscreenCanvas(width, height);
  const ctx = offscreenCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw the image onto the canvas
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Convert canvas to blob with specified quality
  const resizedBlob = await offscreenCanvas.convertToBlob({
    type: 'image/jpeg',
    quality,
  });

  // Clean up the bitmap
  imageBitmap.close();

  return resizedBlob;
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
