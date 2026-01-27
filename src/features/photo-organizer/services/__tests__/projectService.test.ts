import { describe, test, expect, vi, beforeEach } from 'vitest';
import { heicToBlob, buildPhotosFromHandleForTest } from '../projectService';

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

describe('Project file collection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock');
  });

  const makeFileHandle = (file: File) =>
    ({
      kind: 'file',
      name: file.name,
      async getFile() {
        return file;
      },
    } as unknown as FileSystemFileHandle);

  const makeDirHandle = (name: string, children: Record<string, any>) =>
    ({
      kind: 'directory',
      name,
      async *entries() {
        for (const [entryName, handle] of Object.entries(children)) {
          yield [entryName, handle];
        }
      },
    } as unknown as FileSystemDirectoryHandle);

  test('collects supported files, skips duplicates and system files', async () => {
    const img1 = new File(['aaa'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 1000 });
    const img1Dup = new File(['aaa'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 1000 });
    const img2 = new File(['bbbb'], 'IMG_0002.jpg', { type: 'image/jpeg', lastModified: 2000 });
    const rootImg = new File(['cc'], 'ROOT_0001.jpg', { type: 'image/jpeg', lastModified: 1500 });
    const dsStore = new File(['x'], '.DS_Store', { type: 'application/octet-stream' });
    const notes = new File(['note'], 'notes.txt', { type: 'text/plain' });

    const day1 = makeDirHandle('Day1', {
      'IMG_0001.jpg': makeFileHandle(img1),
      '.DS_Store': makeFileHandle(dsStore),
      'notes.txt': makeFileHandle(notes),
    });
    const day2 = makeDirHandle('Day2', {
      'IMG_0001.jpg': makeFileHandle(img1Dup),
      'IMG_0002.jpg': makeFileHandle(img2),
    });

    const root = makeDirHandle('root', {
      Day1: day1,
      Day2: day2,
      'ROOT_0001.jpg': makeFileHandle(rootImg),
      '.DS_Store': makeFileHandle(dsStore),
    });

    const photos = await buildPhotosFromHandleForTest(root);
    const names = photos.map(p => p.originalName);
    const paths = photos.map(p => p.filePath);

    expect(photos).toHaveLength(3);
    expect(names.filter(name => name === 'IMG_0001.jpg')).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(['IMG_0002.jpg', 'ROOT_0001.jpg']));
    expect(paths).toEqual(
      expect.arrayContaining(['Day1/IMG_0001.jpg', 'Day2/IMG_0002.jpg', 'ROOT_0001.jpg']),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining(['Day1/.DS_Store', 'Day1/notes.txt', '.DS_Store']),
    );

    const fingerprints = await Promise.all(
      photos.map(async photo => {
        const file = await photo.fileHandle!.getFile();
        return `${photo.originalName}|${photo.timestamp}|${file.size}`;
      }),
    );
    expect(new Set(fingerprints).size).toBe(photos.length);
  });
});
