import safeLocalStorage from '../utils/safeLocalStorage';

export interface ProjectPhoto {
  id: string;
  originalName: string;
  currentName: string;
  timestamp: number;
  day: number | null;
  bucket: string | null;
  sequence: number | null;
  favorite: boolean;
  rating: number;
  archived: boolean;
  thumbnail: string;
  mimeType?: string;
  fileHandle?: FileSystemFileHandle;
  filePath?: string;
  metadata?: {
    camera?: string;
    width?: number;
    height?: number;
  };
}

export interface ProjectSettings {
  autoDay: boolean;
  folderStructure: {
    daysFolder: string;
    archiveFolder: string;
    favoritesFolder: string;
    metaFolder: string;
  };
}

export interface ProjectState {
  projectName: string;
  rootPath: string;
  photos: ProjectPhoto[];
  settings: ProjectSettings;
  dayLabels?: Record<string, string>;
  // list of folder names that the user marked as day containers during onboarding
  dayContainers?: string[];
  lastModified?: number;
}

interface ProjectInitResponse {
  projectId: string;
  photos: ProjectPhoto[];
  suggestedDays: Record<string, string[]>;
}

const SUPPORTED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
const STATE_PREFIX = 'narrative:projectState:';
const HANDLE_DB = 'narrative:handles';
const HANDLE_STORE = 'projects';
const DEFAULT_SETTINGS: ProjectSettings = {
  autoDay: true,
  folderStructure: {
    daysFolder: '01_DAYS',
    archiveFolder: '98_ARCHIVE',
    favoritesFolder: 'FAV',
    metaFolder: '_meta',
  },
};

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(projectId: string, handle: FileSystemDirectoryHandle) {
  const db = await openHandleDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHandle(projectId: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(projectId);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
    req.onerror = () => reject(req.error);
  });
}

function isSupportedFile(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXT.includes(ext);
}

async function collectFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Array<{ handle: FileSystemFileHandle; path: string }>> {
  const entries: Array<{ handle: FileSystemFileHandle; path: string }> = [];
  // @ts-ignore entries() is supported in modern browsers
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'directory') {
      if (name.startsWith('.')) continue;
      const nested = await collectFiles(
        handle as FileSystemDirectoryHandle,
        prefix ? `${prefix}/${name}` : name,
      );
      entries.push(...nested);
    } else if (handle.kind === 'file') {
      if (!isSupportedFile(name)) continue;
      const relPath = prefix ? `${prefix}/${name}` : name;
      entries.push({ handle: handle as FileSystemFileHandle, path: relPath });
    }
  }
  return entries;
}

export async function heicToBlob(file: File): Promise<Blob> {
  // Create canvas from HEIC file using browser's native support
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // If we can't get a drawing context, return a tiny placeholder blob so callers
    // always receive a Blob (makes tests and headless environments simpler).
    return new Blob([''], { type: 'image/jpeg' });
  }

  try {
    // Try to use createImageBitmap if available
    if (typeof createImageBitmap !== 'undefined') {
      try {
        const bitmap = await createImageBitmap(file);
        canvas.width = bitmap.width || 400;
        canvas.height = bitmap.height || 300;
        try {
          ctx.drawImage(bitmap, 0, 0);
        } catch (drawErr) {
          // drawing may fail in some environments (headless or partial ImageBitmap mocks)
          // continue to create a blob from the (possibly blank) canvas so we still provide a preview
        }
        return new Promise((resolve, _reject) => {
          try {
            if (typeof canvas.toBlob === 'function') {
              canvas.toBlob(
                blob => {
                  if (blob) {
                    resolve(blob);
                    return;
                  }
                  // Fallback to toDataURL path below
                  try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const parts = dataUrl.split(',');
                    const match = parts[0].match(/:(.*?);/);
                    const base64 = parts[1];
                    let u8arr: Uint8Array;
                    if (typeof atob === 'function') {
                      const bstr = atob(base64);
                      let n = bstr.length;
                      u8arr = new Uint8Array(n);
                      while (n--) u8arr[n] = bstr.charCodeAt(n);
                    } else if (typeof Buffer !== 'undefined') {
                      const buf = Buffer.from(base64, 'base64');
                      u8arr = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
                    } else {
                      throw new Error('No base64 decoder available');
                    }
                    resolve(new Blob([u8arr], { type: (match && match[1]) || 'image/jpeg' }));
                  } catch (e) {
                    // If everything failed, resolve a tiny placeholder blob instead
                    resolve(new Blob([''], { type: 'image/jpeg' }));
                  }
                },
                'image/jpeg',
                0.8,
              );
            } else {
              // toBlob not present; use toDataURL fallback
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              const parts = dataUrl.split(',');
              const match = parts[0].match(/:(.*?);/);
              const base64 = parts[1];
              let u8arr: Uint8Array;
              if (typeof atob === 'function') {
                const bstr = atob(base64);
                let n = bstr.length;
                u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
              } else if (typeof Buffer !== 'undefined') {
                const buf = Buffer.from(base64, 'base64');
                u8arr = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
              } else {
                // fall back to placeholder blob when no decoder available
                return resolve(new Blob([''], { type: 'image/jpeg' }));
              }
              resolve(new Blob([u8arr], { type: (match && match[1]) || 'image/jpeg' }));
            }
          } catch (e) {
            // On unexpected errors, resolve a placeholder blob to guarantee callers
            // always receive a Blob rather than null/undefined.
            resolve(new Blob([''], { type: 'image/jpeg' }));
          }
        });
      } catch (bitmapErr) {
        // createImageBitmap failed, continue to fallback
      }
    }

    // Fallback: try loading into an Image element (some browsers can decode HEIC when used this way)
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.crossOrigin = 'Anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
      });
      // draw the loaded image onto canvas
      canvas.width = img.naturalWidth || img.width || 400;
      canvas.height = img.naturalHeight || img.height || 300;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return new Promise((resolve, _reject) => {
        canvas.toBlob(
          blob => {
            if (blob) {
              resolve(blob);
              return;
            }
            // Fallback to dataURL -> Blob if toBlob isn't available/failed
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              const parts = dataUrl.split(',');
              const match = parts[0].match(/:(.*?);/);
              const base64 = parts[1];
              let u8arr: Uint8Array;
              if (typeof atob === 'function') {
                const bstr = atob(base64);
                let n = bstr.length;
                u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
              } else if (typeof Buffer !== 'undefined') {
                const buf = Buffer.from(base64, 'base64');
                u8arr = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
              } else {
                // fall back to placeholder blob when no decoder available
                resolve(new Blob([''], { type: 'image/jpeg' }));
                return;
              }
              resolve(new Blob([u8arr], { type: (match && match[1]) || 'image/jpeg' }));
            } catch (e) {
              // resolve placeholder blob instead of rejecting to keep behaviour stable
              resolve(new Blob([''], { type: 'image/jpeg' }));
            }
          },
          'image/jpeg',
          0.8,
        );
      });
    } catch (imgErr) {
      // image decode fallback failed, continue to generate placeholder
    }

    // Fallback: create a placeholder canvas
    canvas.width = 400;
    canvas.height = 300;
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HEIC', 200, 140);
    ctx.font = '12px sans-serif';
    ctx.fillText('Preview not available', 200, 165);

    return new Promise(resolve => {
      // Ensure we always resolve with a Blob (even if small/empty) so callers don't
      // have to handle null/exceptional cases.
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
            return;
          }
          resolve(new Blob([''], { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.8,
      );
    });
  } catch (e) {
    return new Blob([''], { type: 'image/jpeg' });
  }
}

async function buildPhotosFromHandle(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ProjectPhoto[]> {
  const files = await collectFiles(dirHandle);
  const photos: ProjectPhoto[] = [];

  for (const entry of files) {
    const file = await entry.handle.getFile();
    const timestamp = file.lastModified;
    const id = generateId();
    const originalName = file.name;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isHeic = ext === 'heic' || ext === 'heif' || file.type.toLowerCase().includes('heic');

    let thumbnail = '';
    if (isHeic) {
      try {
        const blob = await heicToBlob(file);
        if (blob) {
          thumbnail = URL.createObjectURL(blob);
        }
      } catch (e) {
        console.warn(`Failed to generate preview for ${originalName}:`, e);
        // Keep thumbnail empty on error
      }
    } else {
      try {
        thumbnail = URL.createObjectURL(file);
      } catch (e) {
        console.warn(`Failed to create object URL for ${originalName}:`, e);
        // Keep thumbnail empty on error
      }
    }

    photos.push({
      id,
      originalName,
      currentName: originalName,
      timestamp,
      day: null,
      bucket: null,
      sequence: null,
      favorite: false,
      rating: 0,
      archived: false,
      thumbnail,
      mimeType: file.type || (isHeic ? 'image/heic' : ''),
      fileHandle: entry.handle,
      filePath: entry.path,
    });
  }

  return photos.sort((a, b) => a.timestamp - b.timestamp);
}

function clusterPhotosByTime(photos: ProjectPhoto[]) {
  const days: Record<string, string[]> = {};
  if (photos.length === 0) return days;

  let currentDay = 1;
  let lastTime = photos[0].timestamp;
  const gapThreshold = 6 * 60 * 60 * 1000;
  days[currentDay] = [];

  photos.forEach(photo => {
    if (photo.timestamp - lastTime > gapThreshold) {
      currentDay += 1;
      days[currentDay] = [];
    }
    days[currentDay].push(photo.id);
    lastTime = photo.timestamp;
  });
  return days;
}

function serializeState(state: ProjectState) {
  const edits = state.photos.map(photo => ({
    filePath: photo.filePath,
    day: photo.day,
    bucket: photo.bucket,
    sequence: photo.sequence,
    favorite: photo.favorite,
    rating: photo.rating,
    archived: photo.archived,
    currentName: photo.currentName,
    // Note: thumbnails are not cached as blob URLs are session-specific
  }));

  return {
    projectName: state.projectName,
    rootPath: state.rootPath,
    settings: state.settings,
    dayLabels: state.dayLabels || {},
    dayContainers: state.dayContainers || [],
    lastModified: state.lastModified ?? Date.now(),
    edits,
  };
}

function applyEdits(photos: ProjectPhoto[], edits: Array<any>) {
  const byPath = new Map<string, any>();
  edits.forEach(edit => {
    if (edit?.filePath) byPath.set(edit.filePath, edit);
  });
  return photos.map(photo => {
    const edit = photo.filePath ? byPath.get(photo.filePath) : null;
    return edit ? { ...photo, ...edit } : photo;
  });
}

function isArchiveFolderSegment(segment: string, archiveFolder: string) {
  const normalized = segment.toLowerCase();
  const simplified = normalized.replace(/[^a-z0-9]+/g, ' ').trim();
  const explicit = archiveFolder.toLowerCase();
  if (explicit && normalized === explicit) return true;
  if (normalized === 'archive' || normalized === 'archives') return true;
  if (normalized.endsWith('_archive') || normalized.endsWith('-archive')) return true;
  if (normalized.includes('archive') || simplified.includes('archive')) return true;
  return false;
}

function applyArchiveFolder(photos: ProjectPhoto[], archiveFolder: string): ProjectPhoto[] {
  if (!archiveFolder) return photos;
  return photos.map(photo => {
    if (!photo.filePath) return photo;
    const segments = photo.filePath.split(/[\\/]/).filter(Boolean);
    if (segments.some(segment => isArchiveFolderSegment(segment, archiveFolder))) {
      return { ...photo, archived: true, bucket: 'X' };
    }
    return photo;
  });
}

export async function initProject(options: {
  dirHandle: FileSystemDirectoryHandle;
  projectName?: string;
  rootLabel?: string;
}): Promise<ProjectInitResponse> {
  const { dirHandle, projectName, rootLabel } = options;
  const permission = await dirHandle.requestPermission({ mode: 'read' });
  if (permission !== 'granted') {
    throw new Error('Folder access was not granted.');
  }
  const projectId = generateId();
  const photos = applyArchiveFolder(
    await buildPhotosFromHandle(dirHandle),
    DEFAULT_SETTINGS.folderStructure.archiveFolder,
  );
  const suggestedDays = clusterPhotosByTime(photos);

  const state: ProjectState = {
    projectName: projectName?.trim() || dirHandle.name,
    rootPath: rootLabel || dirHandle.name,
    photos,
    settings: DEFAULT_SETTINGS,
    lastModified: Date.now(),
  };

  await saveHandle(projectId, dirHandle);
  safeLocalStorage.set(`${STATE_PREFIX}${projectId}`, JSON.stringify(serializeState(state)));

  return { projectId, photos, suggestedDays };
}

export async function getState(projectId: string): Promise<ProjectState> {
  const handle = await getHandle(projectId);
  if (!handle) {
    throw new Error('Project folder access not available. Please reselect the folder.');
  }
  const permission = await handle.requestPermission({ mode: 'read' });
  if (permission !== 'granted') {
    throw new Error('Folder access was not granted.');
  }

  const raw = safeLocalStorage.get(`${STATE_PREFIX}${projectId}`);
  const stored = raw ? JSON.parse(raw) : {};

  // Build photos from filesystem
  const freshPhotos = await buildPhotosFromHandle(handle);

  // If no photos found, the handle may be invalid (e.g., after page refresh)
  if (freshPhotos.length === 0) {
    throw new Error('Project folder access is no longer available. Please reselect the folder.');
  }

  // Apply cached edits (including thumbnails) if available
  let photos = freshPhotos;
  if (stored.edits) {
    // Create a map of cached edits by filePath
    const cachedEdits = new Map<string, any>();
    stored.edits.forEach((edit: any) => {
      if (edit?.filePath) cachedEdits.set(edit.filePath, edit);
    });

    // Apply cached data to fresh photos (thumbnails are always fresh)
    photos = freshPhotos.map(photo => {
      const cached = photo.filePath ? cachedEdits.get(photo.filePath) : null;
      if (cached) {
        // Apply cached edits but keep fresh thumbnail
        return {
          ...photo,
          day: cached.day,
          bucket: cached.bucket,
          sequence: cached.sequence,
          favorite: cached.favorite,
          rating: cached.rating,
          archived: cached.archived,
          currentName: cached.currentName,
        };
      }
      return photo;
    });
  }

  const settings = stored.settings || DEFAULT_SETTINGS;
  const archivedPhotos = applyArchiveFolder(
    photos,
    settings.folderStructure?.archiveFolder || DEFAULT_SETTINGS.folderStructure.archiveFolder,
  );

  return {
    projectName: stored.projectName || handle.name,
    rootPath: stored.rootPath || handle.name,
    photos: archivedPhotos,
    settings,
    dayLabels: stored.dayLabels || {},
    dayContainers: stored.dayContainers || [],
    lastModified: stored.lastModified,
  };
}

export async function saveState(projectId: string, state: ProjectState): Promise<void> {
  safeLocalStorage.set(`${STATE_PREFIX}${projectId}`, JSON.stringify(serializeState(state)));
}

export async function deleteProject(projectId: string): Promise<void> {
  // Remove stored state from localStorage
  try {
    safeLocalStorage.remove(`${STATE_PREFIX}${projectId}`);
  } catch (e) {
    // ignore
  }

  // Remove stored handle from IndexedDB
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite');
      tx.objectStore(HANDLE_STORE).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // ignore
  }
}
