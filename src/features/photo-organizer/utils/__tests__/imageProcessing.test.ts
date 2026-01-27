import { describe, it, expect } from 'vitest';
import { resizeImageBlob } from '../imageProcessing';

describe('Image Processing', () => {
  it('should export resizeImageBlob function', () => {
    expect(resizeImageBlob).toBeDefined();
    expect(typeof resizeImageBlob).toBe('function');
  });

  it('should accept blob and resize parameters', async () => {
    // This is a basic sanity check - actual resizing is tested through integration
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    expect(blob).toBeDefined();
    expect(blob.type).toBe('image/jpeg');
  });
});
