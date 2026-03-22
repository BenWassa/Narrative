import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  buildPhotosFromHandleForTest,
  buildProjectTree,
  inspectProjectFolder,
  heicToBlob,
  planProjectScaffoldingForTest,
  ensureProjectScaffolding,
  type ProjectPhoto,
} from '../projectService';

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
      children,
      async *entries() {
        for (const [entryName, handle] of Object.entries(children)) {
          yield [entryName, handle];
        }
      },
      async getDirectoryHandle(entryName: string, options?: { create?: boolean }) {
        const existing = children[entryName];
        if (existing?.kind === 'directory') {
          return existing;
        }
        if (options?.create) {
          const created = makeDirHandle(entryName, {});
          children[entryName] = created;
          return created;
        }
        throw new DOMException(`Directory "${entryName}" not found`, 'NotFoundError');
      },
    } as unknown as FileSystemDirectoryHandle);

  const settings = {
    autoDay: true,
    folderStructure: {
      inboxFolder: 'Inbox',
      daysFolder: '01_DAYS',
      archiveFolder: 'X_Archive',
    },
  };

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
    expect(photos.every(photo => photo.fileModifiedTimestamp > 0)).toBe(true);
    expect(photos.every(photo => photo.timestampSource === 'filesystem')).toBe(true);
  });

  test('buildProjectTree exposes root bucket folders for single-day projects', async () => {
    const root = makeDirHandle('root', {
      A_Establishing: makeDirHandle('A_Establishing', {
        'IMG_0001.jpg': makeFileHandle(
          new File(['a'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 1000 }),
        ),
      }),
      misc: makeDirHandle('misc', {}),
    });

    const photos: ProjectPhoto[] = [
      {
        id: 'photo-1',
        originalName: 'IMG_0001.jpg',
        currentName: 'IMG_0001.jpg',
        timestamp: 1000,
        fileModifiedTimestamp: 1000,
        timestampSource: 'filesystem',
        day: 1,
        bucket: 'A',
        sequence: 1,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: '',
        filePath: 'A_Establishing/IMG_0001.jpg',
      },
    ];

    const tree = await buildProjectTree(root, 'single_day', settings, photos);
    expect(tree.map(node => [node.name, node.kind])).toEqual([
      ['A_Establishing', 'bucket'],
      ['misc', 'folder'],
    ]);
  });

  test('buildProjectTree promotes day folders for multi-day projects', async () => {
    const root = makeDirHandle('root', {
      '01_DAYS': makeDirHandle('01_DAYS', {
        'Day 01': makeDirHandle('Day 01', {
          A_Establishing: makeDirHandle('A_Establishing', {
            'IMG_0001.jpg': makeFileHandle(
              new File(['a'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 1000 }),
            ),
          }),
        }),
      }),
      Inbox: makeDirHandle('Inbox', {}),
      X_Archive: makeDirHandle('X_Archive', {}),
    });

    const photos: ProjectPhoto[] = [
      {
        id: 'photo-1',
        originalName: 'IMG_0001.jpg',
        currentName: 'IMG_0001.jpg',
        timestamp: 1000,
        fileModifiedTimestamp: 1000,
        timestampSource: 'filesystem',
        day: 1,
        bucket: 'A',
        sequence: 1,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: '',
        filePath: '01_DAYS/Day 01/A_Establishing/IMG_0001.jpg',
      },
    ];

    const tree = await buildProjectTree(root, 'multi_day', settings, photos);
    expect(tree[0].name).toBe('Day 01');
    expect(tree[0].kind).toBe('day');
    expect(tree[0].children[0].kind).toBe('bucket');
    expect(tree.some(node => node.name === 'Inbox' && node.kind === 'system')).toBe(true);
    expect(tree.some(node => node.name === 'X_Archive' && node.kind === 'system')).toBe(true);
  });

  test('plans minimal scaffolding for existing single-day folders without canonical structure', async () => {
    const root = makeDirHandle('root', {
      RAW: makeDirHandle('RAW', {
        'IMG_0001.jpg': makeFileHandle(
          new File(['a'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 1000 }),
        ),
      }),
      edits: makeDirHandle('edits', {}),
    });

    const plan = await planProjectScaffoldingForTest(root, 'single_day', settings);

    expect(plan.importDisposition).toBe('existing');
    expect(plan.hasCanonicalStructure).toBe(false);
    expect(plan.createPaths).toEqual(['Inbox', 'X_Archive']);
  });

  test('fills missing canonical bucket folders when single-day structure already exists', async () => {
    const root = makeDirHandle('root', {
      A_Establishing: makeDirHandle('A_Establishing', {}),
      Inbox: makeDirHandle('Inbox', {}),
    });

    const plan = await planProjectScaffoldingForTest(root, 'single_day', settings);

    expect(plan.importDisposition).toBe('existing');
    expect(plan.hasCanonicalStructure).toBe(true);
    expect(plan.createPaths).toEqual([
      'X_Archive',
      'B_People',
      'C_Culture-Detail',
      'D_Action-Moment',
      'E_Transition',
      'M_Mood-Food',
    ]);
  });

  test('adds only missing support folders for existing multi-day roots', async () => {
    const root = makeDirHandle('root', {
      'Day 01': makeDirHandle('Day 01', {}),
    });

    const plan = await planProjectScaffoldingForTest(root, 'multi_day', settings);

    expect(plan.importDisposition).toBe('existing');
    expect(plan.createPaths).toEqual(['Inbox', 'X_Archive', '01_DAYS']);
  });

  test('creates full single-day scaffold for empty folders', async () => {
    const root = makeDirHandle('root', {});

    const plan = await planProjectScaffoldingForTest(root, 'single_day', settings);

    expect(plan.importDisposition).toBe('new');
    expect(plan.createPaths).toEqual([
      'Inbox',
      'X_Archive',
      'A_Establishing',
      'B_People',
      'C_Culture-Detail',
      'D_Action-Moment',
      'E_Transition',
      'M_Mood-Food',
    ]);
  });

  test('ensureProjectScaffolding only creates planned directories for existing projects', async () => {
    const root = makeDirHandle('root', {
      RAW: makeDirHandle('RAW', {}),
    }) as any;

    await ensureProjectScaffolding(root, 'single_day', settings);

    expect(Object.keys(root.children).sort()).toEqual(['Inbox', 'RAW', 'X_Archive']);
    expect(root.children.A_Establishing).toBeUndefined();
    expect(root.children.B_People).toBeUndefined();
  });

  test('inspects canonical single-day structure as importable existing project', async () => {
    const root = makeDirHandle('root', {
      A_Establishing: makeDirHandle('A_Establishing', {}),
      Inbox: makeDirHandle('Inbox', {}),
    });

    const inspection = await inspectProjectFolder(root, settings);

    expect(inspection.recommendedAction).toBe('import');
    expect(inspection.inferredProjectMode).toBe('single_day');
    expect(inspection.hasCanonicalStructure).toBe(true);
  });

  test('inspects canonical multi-day structure as importable existing project', async () => {
    const root = makeDirHandle('root', {
      'Day 01': makeDirHandle('Day 01', {}),
    });

    const inspection = await inspectProjectFolder(root, settings);

    expect(inspection.recommendedAction).toBe('import');
    expect(inspection.inferredProjectMode).toBe('multi_day');
    expect(inspection.hasCanonicalStructure).toBe(true);
  });

  test('inspects non-canonical folders as new project creation flow', async () => {
    const root = makeDirHandle('root', {
      RAW: makeDirHandle('RAW', {}),
      selects: makeDirHandle('selects', {}),
    });

    const inspection = await inspectProjectFolder(root, settings);

    expect(inspection.recommendedAction).toBe('create');
    expect(inspection.inferredProjectMode).toBeNull();
    expect(inspection.hasCanonicalStructure).toBe(false);
    expect(inspection.hasExistingContent).toBe(true);
  });
});
