import { describe, it, expect, vi } from 'vitest';
import { exportAsZip, supportsFileSystemAccess, applyOrganizationInPlace } from '../services/fileSystemService';

describe('fileSystemService', () => {
  it('supportsFileSystemAccess checks for showDirectoryPicker', () => {
    const orig = (global as any).showDirectoryPicker;
    // remove if present
    // @ts-ignore
    delete (global as any).showDirectoryPicker;
    expect(supportsFileSystemAccess()).toBe(false);
    // add back
    // @ts-ignore
    (global as any).showDirectoryPicker = () => {};
    expect(supportsFileSystemAccess()).toBe(true);
    (global as any).showDirectoryPicker = orig;
  });

  it('exportAsZip generates a blob for provided files', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const blob = await exportAsZip([{ file, originalName: 'a.txt', day: 1 } as any]);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('applyOrganizationInPlace iterates and writes files', async () => {
    // Mock directory and file handles
    const writes: Array<{ name: string; content: string }> = [];

    const createWritable = async () => ({
      write: async (f: any) => {
        let txt = 'written';
        if (f && typeof f.text === 'function') {
          txt = await f.text();
        } else if (f && typeof f === 'string') {
          txt = f;
        }
        writes.push({ name: 'unknown', content: txt });
      },
      close: async () => {},
    });

    const fileHandle = {
      getFile: async () => new File(['data'], 'orig.jpg', { type: 'image/jpeg' }),
    };

    const dayHandle = {
      getFileHandle: async (_name: string, opts?: any) => ({ createWritable }),
    };

    const dirHandle = {
      getDirectoryHandle: async (_name: string, opts?: any) => dayHandle,
      getFileHandle: async (_name: string) => fileHandle,
      removeEntry: async (_name: string) => {},
    };

    const photos = [{ originalName: 'orig.jpg', newName: 'D01_orig.jpg', day: 1 }];

    const res = await applyOrganizationInPlace(dirHandle as any, photos as any, (done, total) => {
      // progress callback invoked
    });

    expect(res.total).toBe(1);
    expect(res.done).toBe(1);
  });
});
