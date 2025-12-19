import JSZip from 'jszip';

import { ProjectPhoto } from './projectService';

// Check for File System Access API support
export function supportsFileSystemAccess(): boolean {
  // @ts-ignore - showDirectoryPicker is experimental
  return typeof (window as any).showDirectoryPicker === 'function';
}

export async function exportAsZip(photos: Array<ProjectPhoto | { file?: File; blob?: Blob; originalName: string; day?: number; newName?: string }>) {
  const zip = new JSZip();

  for (const p of photos) {
    // try to obtain Blob
    let blob: Blob | null = null;
    if ('file' in p && p.file) blob = p.file;
    else if ('blob' in p && p.blob) blob = p.blob as Blob;
    else if ((p as any).thumbnail && typeof (p as any).thumbnail === 'string') {
      // thumbnails might be a data URL or remote URL; skip
      continue;
    }

    if (!blob) continue;

    const folder = `Day ${p.day ?? 'unsorted'}`;
    const folderRef = zip.folder(folder) as any;
    const name = p.newName || p.originalName;
    folderRef.file(name, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  return content;
}

export async function applyOrganizationInPlace(dirHandle: any, photos: Array<{ originalName: string; newName: string; day: number; fileHandle?: any }>, onProgress?: (done: number, total: number) => void) {
  // dirHandle: FileSystemDirectoryHandle
  let done = 0;
  const total = photos.length;

  for (const p of photos) {
    // Create or get day directory
    const dayName = `Day ${p.day}`;
    const dayHandle = await dirHandle.getDirectoryHandle(dayName, { create: true });

    // If fileHandle provided, read from it; otherwise get from root
    let sourceHandle = p.fileHandle;
    if (!sourceHandle) {
      try {
        sourceHandle = await dirHandle.getFileHandle(p.originalName);
      } catch (err) {
        // if missing, skip
        done++;
        onProgress?.(done, total);
        continue;
      }
    }

    const file = await sourceHandle.getFile();

    const destHandle = await dayHandle.getFileHandle(p.newName, { create: true });
    const writable = await destHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Optionally remove original
    try {
      await dirHandle.removeEntry(p.originalName);
    } catch (e) {
      // ignore if can't remove
    }

    done++;
    onProgress?.(done, total);
  }

  return { done, total };
}

export default {
  supportsFileSystemAccess,
  exportAsZip,
  applyOrganizationInPlace,
};
