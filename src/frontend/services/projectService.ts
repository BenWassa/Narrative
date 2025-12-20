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
  lastModified?: number;
}

export interface ProjectInitResponse {
  projectId: string;
  photos: ProjectPhoto[];
  suggestedDays: Record<string, string[]>;
}

const SUPPORTED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
const STATE_PREFIX = 'narrative:projectState:';
const HANDLE_DB = 'narrative:handles';
const HANDLE_STORE = 'projects';

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
      const nested = await collectFiles(handle as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name);
      entries.push(...nested);
    } else if (handle.kind === 'file') {
      if (!isSupportedFile(name)) continue;
      const relPath = prefix ? `${prefix}/${name}` : name;
      entries.push({ handle: handle as FileSystemFileHandle, path: relPath });
    }
  }
  return entries;
}

async function buildPhotosFromHandle(dirHandle: FileSystemDirectoryHandle): Promise<ProjectPhoto[]> {
  const files = await collectFiles(dirHandle);
  const photos: ProjectPhoto[] = [];

  for (const entry of files) {
    const file = await entry.handle.getFile();
    const timestamp = file.lastModified;
    const id = generateId();
    const originalName = file.name;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isHeic = ext === 'heic' || ext === 'heif' || file.type.toLowerCase().includes('heic');
    const thumbnail = isHeic ? '' : URL.createObjectURL(file);

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
  }));

  return {
    projectName: state.projectName,
    rootPath: state.rootPath,
    settings: state.settings,
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
  const photos = await buildPhotosFromHandle(dirHandle);
  const suggestedDays = clusterPhotosByTime(photos);

  const state: ProjectState = {
    projectName: projectName?.trim() || dirHandle.name,
    rootPath: rootLabel || dirHandle.name,
    photos,
    settings: {
      autoDay: true,
      folderStructure: {
        daysFolder: '01_DAYS',
        archiveFolder: '98_ARCHIVE',
        favoritesFolder: 'FAV',
        metaFolder: '_meta',
      },
    },
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
  const photos = await buildPhotosFromHandle(handle);
  const mergedPhotos = stored.edits ? applyEdits(photos, stored.edits) : photos;

  return {
    projectName: stored.projectName || handle.name,
    rootPath: stored.rootPath || handle.name,
    photos: mergedPhotos,
    settings: stored.settings || {
      autoDay: true,
      folderStructure: {
        daysFolder: '01_DAYS',
        archiveFolder: '98_ARCHIVE',
        favoritesFolder: 'FAV',
        metaFolder: '_meta',
      },
    },
    lastModified: stored.lastModified,
  };
}

export async function saveState(projectId: string, state: ProjectState): Promise<void> {
  safeLocalStorage.set(`${STATE_PREFIX}${projectId}`, JSON.stringify(serializeState(state)));
}
