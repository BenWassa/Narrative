import { describe, test, expect, vi, beforeEach } from 'vitest';
import { heicToBlob } from '../projectService';

// Note: we'll import the function directly and stub global APIs where needed.

describe('HEIC preview generation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('heicToBlob returns a blob when createImageBitmap succeeds', async () => {
    // Stub global createImageBitmap to simulate browser decoding
    // @ts-ignore
    global.createImageBitmap = async (_file: File) => ({ width: 16, height: 12 });

    const file = new File(['test'], 'IMG_0001.HEIC', { type: 'image/heic' });
    const blob = await heicToBlob(file);
    expect(blob).toBeTruthy();
    expect(blob instanceof Blob).toBe(true);
  });

  test('heicToBlob returns a blob when Image fallback is used', async () => {
    // Ensure createImageBitmap is not available
    // @ts-ignore
    global.createImageBitmap = undefined;

    // Mock Image to successfully "load"
    const origImage = (global as any).Image;
    function FakeImage(this: any) {
      this.crossOrigin = '';
      this.width = 16;
      this.height = 12;
      this.naturalWidth = 16;
      this.naturalHeight = 12;
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'src', {
        set: (val: string) => {
          // simulate successful load on next tick
          setTimeout(() => this.onload && this.onload());
        },
      });
    }
    // @ts-ignore
    global.Image = FakeImage;

    const file = new File(['test'], 'IMG_0002.heic', { type: 'image/heic' });
    const blob = await heicToBlob(file);
    expect(blob).toBeTruthy();
    expect(blob instanceof Blob).toBe(true);

    // restore
    // @ts-ignore
    global.Image = origImage;
  });
});
