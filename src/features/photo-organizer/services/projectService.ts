import safeLocalStorage from '../utils/safeLocalStorage';
import { analyzePathStructure } from '../../../lib/folderDetectionService';
import { thumbnailCache } from '../utils/thumbnailCache';
import { BUCKET_LABELS, MECE_BUCKETS } from '../constants/meceBuckets';

export type ProjectMode = 'single_day' | 'multi_day';

export interface ProjectTreeNode {
  id: string;
  name: string;
  relativePath: string;
  parentPath: string | null;
  kind: 'folder' | 'bucket' | 'day' | 'system';
  children: ProjectTreeNode[];
  photoCount: number;
  isCanonical: boolean;
  dayNumber?: number | null;
}

export interface ProjectPhoto {
  id: string;
  mediaKind?: 'photo' | 'video';
  originalName: string;
  currentName: string;
  timestamp: number;
  fileModifiedTimestamp: number;
  timestampSource: 'exif' | 'filesystem';
  fileSize?: number;
  day: number | null;
  bucket: string | null;
  sequence: number | null;
  favorite: boolean;
  rating: number;
  archived: boolean;
  thumbnail: string;
  mimeType?: string;
  durationSec?: number;
  fileHandle?: FileSystemFileHandle;
  filePath?: string;
  metadata?: {
    camera?: string;
    width?: number;
    height?: number;
  };
  sourceFolder?: string;
  folderHierarchy?: string[];
  detectedDay?: number | null;
  detectedBucket?: string | null;
  isPreOrganized?: boolean;
  organizationConfidence?: 'high' | 'medium' | 'low' | 'none';
  subfolderOverride?: string | null;
}

export interface ProjectSettings {
  autoDay: boolean;
  folderStructure: {
    inboxFolder: string;
    daysFolder: string;
    archiveFolder: string;
  };
}

function mergeProjectSettings(settings?: Partial<ProjectSettings> | null): ProjectSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    folderStructure: {
      ...DEFAULT_SETTINGS.folderStructure,
      ...(settings?.folderStructure || {}),
    },
  };
}

export interface ExportOperation {
  sourcePath: string;
  destinationPath: string;
  destinationRelativePath?: string;
  fileSize: number;
  checksum?: string;
  operation: 'copy' | 'move';
}

export interface ExportManifest {
  timestamp: number;
  operations: ExportOperation[];
  sourceRoot: string;
  destinationRoot: string;
  ingested: boolean;
  source?: 'script' | 'direct';
}

export interface ProjectState {
  projectName: string;
  rootPath: string;
  photos: ProjectPhoto[];
  settings: ProjectSettings;
  projectMode?: ProjectMode;
  dayLabels?: Record<number, string>;
  dayNotes?: Record<number, string>;
  // list of folder names that the user marked as day containers during onboarding
  dayContainers?: string[];
  lastModified?: number;
  // Ingest tracking: whether photos have been copied into project structure
  ingested?: boolean;
  // Original source path (for non-ingested projects)
  sourceRoot?: string;
  // Last export operation for undo
  lastExportManifest?: ExportManifest;
}

interface ProjectManifestPhoto {
  filePath?: string;
  mediaKind?: 'photo' | 'video';
  originalName: string;
  currentName: string;
  timestamp: number;
  fileModifiedTimestamp: number;
  timestampSource: 'exif' | 'filesystem';
  fileSize?: number;
  durationSec?: number;
  day: number | null;
  bucket: string | null;
  sequence: number | null;
  favorite: boolean;
  rating: number;
  archived: boolean;
  subfolderOverride?: string | null;
}

interface ProjectManifest {
  version: 1;
  projectName: string;
  rootPath: string;
  settings: ProjectSettings;
  projectMode?: ProjectMode;
  dayLabels?: Record<number, string>;
  dayNotes?: Record<number, string>;
  dayContainers?: string[];
  lastModified?: number;
  ingested?: boolean;
  sourceRoot?: string;
  photos: ProjectManifestPhoto[];
}

interface ProjectInitResponse {
  projectId: string;
  photos: ProjectPhoto[];
  suggestedDays: Record<string, string[]>;
  projectMode: ProjectMode;
}

export interface ProjectScaffoldingPlan {
  createPaths: string[];
  renamePaths: Array<{ from: string; to: string }>;
  importDisposition: 'new' | 'existing';
  hasExistingContent: boolean;
  hasCanonicalStructure: boolean;
}

export interface ProjectFolderInspection {
  hasExistingContent: boolean;
  hasCanonicalStructure: boolean;
  inferredProjectMode: ProjectMode | null;
  recommendedAction: 'create' | 'import';
}

const SUPPORTED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'mp4', 'mov', 'webm', 'avi', 'mkv'];
const STATE_PREFIX = 'narrative:projectState:';
const HANDLE_DB = 'narrative:handles';
const HANDLE_STORE = 'projects';
const EXPORT_DESTINATION_STORE = 'export-destinations';
const MANIFEST_FILENAME = '.narrative.json';
const DEFAULT_SETTINGS: ProjectSettings = {
  autoDay: true,
  folderStructure: {
    inboxFolder: 'Inbox',
    daysFolder: '01_DAYS',
    archiveFolder: 'X_Archive',
  },
};
const DEBUG_LOGS =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.localStorage?.getItem('narrative:debug') === '1';

const ROOT_BUCKET_KEYS = MECE_BUCKETS.filter(bucket => bucket.key !== 'X').map(
  bucket => bucket.key,
);

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const OPEN_DB_TIMEOUT_MS = 10000;

async function requestDirectoryPermission(
  dirHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite',
) {
  if (!('requestPermission' in dirHandle)) {
    throw new Error('File System Access API is not available or supported in this environment.');
  }
  return (dirHandle as any).requestPermission({ mode });
}

async function requestImportWritePermission(dirHandle: FileSystemDirectoryHandle) {
  try {
    return await requestDirectoryPermission(dirHandle, 'readwrite');
  } catch (err) {
    console.warn('Permission request failed:', err);
    throw new Error('Unable to request folder access. Please try again.');
  }
}

async function openHandleDb(): Promise<IDBDatabase> {
  if (!window.indexedDB) {
    throw new Error('IndexedDB is not available in this environment.');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (cb: () => void) => {
      if (settled) return;
      settled = true;
      cb();
    };
    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('IndexedDB open timed out.')));
    }, OPEN_DB_TIMEOUT_MS);

    const req = indexedDB.open(HANDLE_DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
      if (!db.objectStoreNames.contains(EXPORT_DESTINATION_STORE)) {
        db.createObjectStore(EXPORT_DESTINATION_STORE);
      }
    };
    req.onsuccess = () => {
      window.clearTimeout(timer);
      finish(() => resolve(req.result));
    };
    req.onerror = () => {
      window.clearTimeout(timer);
      finish(() => reject(req.error));
    };
    req.onblocked = () => {
      window.clearTimeout(timer);
      finish(() =>
        reject(
          new Error('IndexedDB open was blocked. Please close other Narrative tabs and retry.'),
        ),
      );
    };
  });
}

export async function saveHandle(projectId: string, handle: FileSystemDirectoryHandle) {
  const db = await openHandleDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getHandle(projectId: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(projectId);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveExportDestinationHandle(
  projectId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openHandleDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EXPORT_DESTINATION_STORE, 'readwrite');
    tx.objectStore(EXPORT_DESTINATION_STORE).put(handle, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getExportDestinationHandle(
  projectId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPORT_DESTINATION_STORE, 'readonly');
    const req = tx.objectStore(EXPORT_DESTINATION_STORE).get(projectId);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function removeExportDestinationHandle(projectId: string): Promise<void> {
  const db = await openHandleDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EXPORT_DESTINATION_STORE, 'readwrite');
    tx.objectStore(EXPORT_DESTINATION_STORE).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeHandle(projectId: string): Promise<void> {
  const db = await openHandleDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function isSupportedFile(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXT.includes(ext);
}

function isVideoFile(file: File) {
  if (file.type.startsWith('video/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
}

function readVideoDuration(file: File): Promise<number | undefined> {
  if (typeof document === 'undefined') return Promise.resolve(undefined);

  return new Promise(resolve => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;

    const finish = (duration?: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(duration && Number.isFinite(duration) ? Math.round(duration * 10) / 10 : undefined);
    };

    const timer = window.setTimeout(() => finish(undefined), 1500);
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(undefined);
    video.src = url;
  });
}

function shouldSkipFile(name: string) {
  const lower = name.toLowerCase();
  return (
    name.startsWith('.') ||
    name.startsWith('._') ||
    lower === 'thumbs.db' ||
    lower === 'desktop.ini'
  );
}

function normalizeRelativePath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).join('/');
}

function bucketFolderName(bucketKey: string) {
  const bucketLabel = BUCKET_LABELS[bucketKey] || bucketKey;
  return `${bucketKey}_${bucketLabel}`;
}

function isBucketFolderName(name: string) {
  const firstToken = (name.split(/[_\s-]+/)[0] || '').toUpperCase();
  return ROOT_BUCKET_KEYS.includes(firstToken);
}

function inferProjectModeFromPhotos(
  photos: ProjectPhoto[],
  settings: ProjectSettings,
): ProjectMode {
  const daysFolder = settings.folderStructure.daysFolder;
  const hasDayPaths = photos.some(photo => {
    const path = normalizeRelativePath(photo.filePath || '');
    return Boolean(path) && (path === daysFolder || path.startsWith(`${daysFolder}/`));
  });
  return hasDayPaths ? 'multi_day' : 'single_day';
}

async function ensureDirectoryPath(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle> {
  const segments = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  let current = rootHandle;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

async function readTopLevelEntries(dirHandle: FileSystemDirectoryHandle) {
  const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
  // @ts-ignore entries() is supported in modern browsers
  for await (const [name, entry] of dirHandle.entries()) {
    if (shouldSkipFile(name) || name === MANIFEST_FILENAME) {
      continue;
    }
    entries.push({ name, kind: entry.kind });
  }
  return entries;
}

function hasDayLikeFolder(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return /^day\s*\d{1,2}$/.test(normalized) || /^d\s*\d{1,2}$/.test(normalized);
}

function simplifyFolderName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactFolderName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function scoreArchiveVariant(name: string, archiveFolder: string) {
  const compact = compactFolderName(name);
  const canonicalCompact = compactFolderName(archiveFolder);
  const simplified = simplifyFolderName(name);
  if (compact === canonicalCompact) return 100;
  if (/^x\s+archives?$/.test(simplified) || /^xarchives?$/.test(compact)) return 90;
  if (/^[a-z]\s+archives?$/.test(simplified) || /^[a-z]archives?$/.test(compact)) return 75;
  if (/^\d+\s+archives?$/.test(simplified) || /^\d+archives?$/.test(compact)) return 70;
  if (simplified === 'archive' || simplified === 'archives') return 60;
  return 0;
}

function findArchiveFolderVariant(
  topLevelDirectories: string[],
  archiveFolder: string,
): string | null {
  const canonicalCompact = compactFolderName(archiveFolder);
  const canonicalExact = topLevelDirectories.find(name => name === archiveFolder);
  if (canonicalExact) {
    return null;
  }

  const candidates = topLevelDirectories
    .filter(name => {
      if (name === archiveFolder) return false;
      const compact = compactFolderName(name);
      const simplified = simplifyFolderName(name);
      return (
        compact === canonicalCompact ||
        simplified === 'archive' ||
        simplified === 'archives' ||
        /^[a-z]\s+archives?$/.test(simplified) ||
        /^\d+\s+archives?$/.test(simplified) ||
        /^[a-z]archives?$/.test(compact) ||
        /^\d+archives?$/.test(compact)
      );
    })
    .sort((a, b) => scoreArchiveVariant(b, archiveFolder) - scoreArchiveVariant(a, archiveFolder));

  return candidates[0] || null;
}

async function planProjectScaffolding(
  dirHandle: FileSystemDirectoryHandle,
  projectMode: ProjectMode,
  settings: ProjectSettings = DEFAULT_SETTINGS,
): Promise<ProjectScaffoldingPlan> {
  const entries = await readTopLevelEntries(dirHandle);
  const topLevelDirectories = entries
    .filter(entry => entry.kind === 'directory')
    .map(entry => entry.name);
  const topLevelFiles = entries.filter(entry => entry.kind === 'file').map(entry => entry.name);
  const { inboxFolder, daysFolder, archiveFolder } = settings.folderStructure;

  const hasTopLevelFolder = (name: string) =>
    topLevelDirectories.some(entry => normalizeRelativePath(entry) === normalizeRelativePath(name));
  const archiveVariant = findArchiveFolderVariant(topLevelDirectories, archiveFolder);
  const hasBucketRoots = topLevelDirectories.some(name => isBucketFolderName(name));
  const hasDayRoots = topLevelDirectories.some(name => hasDayLikeFolder(name));
  const hasCanonicalStructure =
    hasTopLevelFolder(inboxFolder) ||
    hasTopLevelFolder(archiveFolder) ||
    hasTopLevelFolder(daysFolder) ||
    hasBucketRoots ||
    hasDayRoots;
  const hasExistingContent = topLevelDirectories.length > 0 || topLevelFiles.length > 0;
  const importDisposition: 'new' | 'existing' =
    hasExistingContent || hasCanonicalStructure ? 'existing' : 'new';

  const createPaths: string[] = [];
  const renamePaths: Array<{ from: string; to: string }> = [];
  if (!hasTopLevelFolder(inboxFolder)) {
    createPaths.push(inboxFolder);
  }
  if (archiveVariant && !hasTopLevelFolder(archiveFolder)) {
    renamePaths.push({ from: archiveVariant, to: archiveFolder });
  } else if (!hasTopLevelFolder(archiveFolder)) {
    createPaths.push(archiveFolder);
  }

  if (projectMode === 'single_day') {
    if (importDisposition === 'new' || hasBucketRoots) {
      for (const bucketKey of ROOT_BUCKET_KEYS) {
        const folderName = bucketFolderName(bucketKey);
        if (!hasTopLevelFolder(folderName)) {
          createPaths.push(folderName);
        }
      }
    }
  } else if (importDisposition === 'new' || hasTopLevelFolder(daysFolder) || hasDayRoots) {
    if (!hasTopLevelFolder(daysFolder)) {
      createPaths.push(daysFolder);
    }
  }

  return {
    createPaths,
    renamePaths,
    importDisposition,
    hasExistingContent,
    hasCanonicalStructure,
  };
}

async function inspectProjectFolderState(
  dirHandle: FileSystemDirectoryHandle,
  settings: ProjectSettings = DEFAULT_SETTINGS,
): Promise<ProjectFolderInspection> {
  const entries = await readTopLevelEntries(dirHandle);
  const topLevelDirectories = entries
    .filter(entry => entry.kind === 'directory')
    .map(entry => entry.name);
  const topLevelFiles = entries.filter(entry => entry.kind === 'file').map(entry => entry.name);
  const { inboxFolder, daysFolder, archiveFolder } = settings.folderStructure;

  const hasTopLevelFolder = (name: string) =>
    topLevelDirectories.some(entry => normalizeRelativePath(entry) === normalizeRelativePath(name));
  const hasBucketRoots = topLevelDirectories.some(name => isBucketFolderName(name));
  const hasDayRoots = topLevelDirectories.some(name => hasDayLikeFolder(name));
  const hasCanonicalStructure =
    hasTopLevelFolder(inboxFolder) ||
    hasTopLevelFolder(archiveFolder) ||
    hasTopLevelFolder(daysFolder) ||
    hasBucketRoots ||
    hasDayRoots;
  const hasExistingContent = topLevelDirectories.length > 0 || topLevelFiles.length > 0;

  let inferredProjectMode: ProjectMode | null = null;
  if (hasTopLevelFolder(daysFolder) || hasDayRoots) {
    inferredProjectMode = 'multi_day';
  } else if (hasBucketRoots) {
    inferredProjectMode = 'single_day';
  }

  return {
    hasExistingContent,
    hasCanonicalStructure,
    inferredProjectMode,
    recommendedAction: hasCanonicalStructure ? 'import' : 'create',
  };
}

async function getDirectoryHandleByPath(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle> {
  const segments = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  let current = rootHandle;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment);
  }
  return current;
}

async function copyDirectoryContents(
  sourceHandle: FileSystemDirectoryHandle,
  destinationHandle: FileSystemDirectoryHandle,
) {
  // @ts-ignore entries() is supported in modern browsers
  for await (const [name, entry] of sourceHandle.entries()) {
    if (entry.kind === 'directory') {
      const nextDestination = await destinationHandle.getDirectoryHandle(name, { create: true });
      await copyDirectoryContents(entry as FileSystemDirectoryHandle, nextDestination);
      continue;
    }

    const sourceFile = await (entry as FileSystemFileHandle).getFile();
    const destinationFileHandle = await destinationHandle.getFileHandle(name, { create: true });
    const writable = await destinationFileHandle.createWritable();
    try {
      await writable.write(sourceFile);
    } finally {
      await writable.close();
    }
  }
}

async function moveDirectory(
  rootHandle: FileSystemDirectoryHandle,
  sourceRelativePath: string,
  destinationRelativePath: string,
) {
  const normalizedSource = normalizeRelativePath(sourceRelativePath);
  const normalizedDestination = normalizeRelativePath(destinationRelativePath);
  if (!normalizedSource || !normalizedDestination || normalizedSource === normalizedDestination) {
    return;
  }

  const sourceParentPath = normalizedSource.split('/').slice(0, -1).join('/');
  const sourceName = normalizedSource.split('/').slice(-1)[0];
  const destinationParentPath = normalizedDestination.split('/').slice(0, -1).join('/');
  const destinationName = normalizedDestination.split('/').slice(-1)[0];

  const sourceParent = sourceParentPath
    ? await getDirectoryHandleByPath(rootHandle, sourceParentPath)
    : rootHandle;
  const sourceHandle = await sourceParent.getDirectoryHandle(sourceName);
  const destinationParent = destinationParentPath
    ? await ensureDirectoryPath(rootHandle, destinationParentPath)
    : rootHandle;
  const destinationHandle = await destinationParent.getDirectoryHandle(destinationName, {
    create: true,
  });

  await copyDirectoryContents(sourceHandle, destinationHandle);
  await sourceParent.removeEntry(sourceName, { recursive: true });
}

async function relocateRootMediaToInbox(
  rootHandle: FileSystemDirectoryHandle,
  inboxFolder: string,
): Promise<{ moved: string[]; skipped: string[] }> {
  const inboxHandle = await ensureDirectoryPath(rootHandle, inboxFolder);
  const moved: string[] = [];
  const skipped: string[] = [];

  // @ts-ignore entries() is supported in modern browsers
  for await (const [name, entry] of rootHandle.entries()) {
    if (entry.kind !== 'file') continue;
    if (shouldSkipFile(name)) continue;
    if (!isSupportedFile(name)) continue;

    let destinationExists = false;
    try {
      await inboxHandle.getFileHandle(name);
      destinationExists = true;
    } catch (error: any) {
      if (error?.name !== 'NotFoundError') {
        throw error;
      }
    }

    if (destinationExists) {
      skipped.push(name);
      continue;
    }

    const sourceFile = await (entry as FileSystemFileHandle).getFile();
    const destinationFileHandle = await inboxHandle.getFileHandle(name, { create: true });
    const writable = await destinationFileHandle.createWritable();
    try {
      await writable.write(sourceFile);
    } finally {
      await writable.close();
    }
    await rootHandle.removeEntry(name);
    moved.push(name);
  }

  return { moved, skipped };
}

function isWriteFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const name = (error as any)?.name || '';
  return (
    name === 'NoModificationAllowedError' ||
    name === 'NotAllowedError' ||
    name === 'InvalidModificationError' ||
    message.includes('could not be modified due to the state of the underlying filesystem') ||
    message.toLowerCase().includes('read-only') ||
    message.toLowerCase().includes('permission denied')
  );
}

async function assertDirectoryWritable(dirHandle: FileSystemDirectoryHandle): Promise<void> {
  const probeName = '.narrative-write-test';
  let writable: FileSystemWritableFileStream | null = null;
  try {
    const fileHandle = await dirHandle.getFileHandle(probeName, { create: true });
    writable = await fileHandle.createWritable();
    await writable.write('');
    await writable.close();
    writable = null;
    await dirHandle.removeEntry(probeName);
  } catch (error) {
    if (writable) {
      try {
        await writable.close();
      } catch {}
    }
    try {
      await dirHandle.removeEntry(probeName);
    } catch {}
    throw error;
  }
}

function replacePathPrefix(path: string | undefined, fromPrefix: string, toPrefix: string) {
  if (!path) return path;
  const normalizedPath = normalizeRelativePath(path);
  const normalizedFrom = normalizeRelativePath(fromPrefix);
  const normalizedTo = normalizeRelativePath(toPrefix);

  if (normalizedPath === normalizedFrom) {
    return normalizedTo;
  }
  if (!normalizedPath.startsWith(`${normalizedFrom}/`)) {
    return normalizedPath;
  }
  return `${normalizedTo}${normalizedPath.slice(normalizedFrom.length)}`;
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
      if (shouldSkipFile(name)) continue;
      if (!isSupportedFile(name)) continue;
      const relPath = prefix ? `${prefix}/${name}` : name;
      entries.push({ handle: handle as FileSystemFileHandle, path: relPath });
    }
  }
  return entries;
}

async function readManifest(dirHandle: FileSystemDirectoryHandle): Promise<ProjectManifest | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(MANIFEST_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (parsed?.version !== 1 || !Array.isArray(parsed.photos)) {
      return null;
    }
    return parsed as ProjectManifest;
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return null;
    console.warn('Failed to read project manifest:', err);
    return null;
  }
}

async function writeManifest(
  dirHandle: FileSystemDirectoryHandle,
  manifest: ProjectManifest,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(MANIFEST_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    const payload = JSON.stringify(manifest, null, 2);
    await writable.write(payload);
  } finally {
    await writable.close();
  }
}

function parseExifDateString(value: string): number | null {
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const charCode = view.getUint8(offset + i);
    if (charCode === 0) break;
    result += String.fromCharCode(charCode);
  }
  return result;
}

function extractExifTimestampFromJpegBuffer(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return null;
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    if (marker === 0xffda || marker === 0xffd9) break;
    if ((marker & 0xff00) !== 0xff00 || offset + 2 > view.byteLength) break;

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;

    if (marker === 0xffe1 && segmentLength >= 10) {
      const exifHeader = readAscii(view, offset + 2, 6);
      if (exifHeader === 'Exif') {
        const tiffOffset = offset + 8;
        const littleEndian = readAscii(view, tiffOffset, 2) === 'II';
        const getUint16 = (pos: number) => view.getUint16(pos, littleEndian);
        const getUint32 = (pos: number) => view.getUint32(pos, littleEndian);
        const firstIfdOffset = getUint32(tiffOffset + 4);
        const dateTags = new Set([0x9003, 0x0132]);

        const readIfd = (ifdOffset: number): number | null => {
          if (ifdOffset <= 0 || tiffOffset + ifdOffset + 2 > view.byteLength) return null;
          const absoluteIfdOffset = tiffOffset + ifdOffset;
          const entryCount = getUint16(absoluteIfdOffset);

          for (let i = 0; i < entryCount; i += 1) {
            const entryOffset = absoluteIfdOffset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) return null;

            const tag = getUint16(entryOffset);
            const type = getUint16(entryOffset + 2);
            const count = getUint32(entryOffset + 4);
            const valueOffset = getUint32(entryOffset + 8);

            if (tag === 0x8769) {
              const nested = readIfd(valueOffset);
              if (nested !== null) return nested;
            }

            if (!dateTags.has(tag) || type !== 2 || count <= 0) {
              continue;
            }

            const stringOffset = count <= 4 ? entryOffset + 8 : tiffOffset + valueOffset;
            if (stringOffset + count > view.byteLength) continue;

            const parsed = parseExifDateString(readAscii(view, stringOffset, count));
            if (parsed !== null) return parsed;
          }

          return null;
        };

        return readIfd(firstIfdOffset);
      }
    }

    offset += segmentLength;
  }

  return null;
}

async function extractCaptureTimestamp(file: File): Promise<number | null> {
  const mimeType = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isJpeg =
    mimeType === 'image/jpeg' || mimeType === 'image/jpg' || ext === 'jpg' || ext === 'jpeg';
  if (!isJpeg) return null;

  try {
    const chunk = file.slice(0, 256 * 1024) as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
    if (typeof chunk.arrayBuffer !== 'function') {
      return null;
    }
    const buffer = await chunk.arrayBuffer();
    return extractExifTimestampFromJpegBuffer(buffer);
  } catch (error) {
    console.warn(`Failed to read EXIF timestamp for ${file.name}:`, error);
    return null;
  }
}

async function resolvePhotoTimestamp(file: File): Promise<{
  timestamp: number;
  fileModifiedTimestamp: number;
  timestampSource: 'exif' | 'filesystem';
}> {
  const fileModifiedTimestamp = file.lastModified;
  const captureTimestamp = await extractCaptureTimestamp(file);

  if (captureTimestamp !== null) {
    return {
      timestamp: captureTimestamp,
      fileModifiedTimestamp,
      timestampSource: 'exif',
    };
  }

  return {
    timestamp: fileModifiedTimestamp,
    fileModifiedTimestamp,
    timestampSource: 'filesystem',
  };
}

export async function heicToBlob(file: File): Promise<Blob> {
  // First check if the file is already readable by the browser
  try {
    // Try to create an ImageBitmap to see if the file is already readable
    if (typeof createImageBitmap !== 'undefined') {
      const testBitmap = await createImageBitmap(file);
      testBitmap.close(); // Clean up
      // If we get here, the file is already browser-readable, return it as-is
      return file;
    }
  } catch (testErr) {
    // File is not readable, continue with conversion
  }

  try {
    // Try using heic2any library first - most reliable for HEIC conversion
    const heic2any = (await import('heic2any')).default;
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8,
      });
      return convertedBlob as Blob;
    } catch (heicErr: any) {
      // Check if the error indicates the file is already readable
      if (
        heicErr?.message?.includes('already browser readable') ||
        heicErr?.message?.includes('ERR_USER') ||
        heicErr?.code === 1
      ) {
        return file;
      }
      console.warn(`heic2any conversion failed for ${file.name}:`, heicErr);
      // Fall through to other methods
    }
  } catch (importErr) {
    console.warn('heic2any library not available, trying fallbacks');
  }

  // Fallback: Create canvas from HEIC file using browser's native support
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
                    resolve(
                      new Blob([u8arr as BlobPart], { type: (match && match[1]) || 'image/jpeg' }),
                    );
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
              resolve(new Blob([u8arr as BlobPart], { type: (match && match[1]) || 'image/jpeg' }));
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
              resolve(new Blob([u8arr as BlobPart], { type: (match && match[1]) || 'image/jpeg' }));
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

export async function buildPhotosFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: number, message: string) => void,
): Promise<ProjectPhoto[]> {
  const files = await collectFiles(dirHandle);
  const photos: ProjectPhoto[] = [];
  // Track seen files by (name + timestamp) to detect duplicates
  // (same file copied/symlinked to multiple locations)
  const seenFiles = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const entry = files[i];
    const progress = Math.round(((i + 1) / files.length) * 100);
    onProgress?.(progress, `Processing ${entry.handle.name}...`);

    const file = await entry.handle.getFile();
    const { timestamp, fileModifiedTimestamp, timestampSource } = await resolvePhotoTimestamp(file);
    const originalName = file.name;
    const fileSize = file.size;

    // Create a fingerprint to detect duplicates
    // Use filename + timestamp + size to identify same file in multiple locations
    const fileFingerprint = `${originalName}|${timestamp}|${file.size}`;

    // Skip if we've already seen this exact file
    if (seenFiles.has(fileFingerprint)) {
      if (DEBUG_LOGS) {
        console.debug(
          `[ProjectService] Skipping duplicate file: ${entry.path} (matches ${originalName})`,
        );
      }
      continue;
    }
    seenFiles.add(fileFingerprint);

    const id = generateId();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isHeic = ext === 'heic' || ext === 'heif' || file.type.toLowerCase().includes('heic');
    const mediaKind = isVideoFile(file) ? 'video' : 'photo';
    const durationSec = mediaKind === 'video' ? await readVideoDuration(file) : undefined;

    let thumbnail = '';
    if (isHeic) {
      try {
        const cacheKey = entry.path;
        const cachedThumbnail = await thumbnailCache.get(cacheKey);
        if (cachedThumbnail) {
          thumbnail = cachedThumbnail;
        } else {
          const blob = await heicToBlob(file);
          if (blob) {
            thumbnail = URL.createObjectURL(blob);
            await thumbnailCache.set(cacheKey, blob);
          }
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

    const pathAnalysis = analyzePathStructure(entry.path);
    const pathSegments = entry.path.split(/[\\/]/).filter(Boolean);
    const folderSegments = pathSegments.length > 1 ? pathSegments.slice(0, -1) : [];
    const sourceFolder = folderSegments[folderSegments.length - 1] || 'root';

    let day: number | null = null;
    let bucket: string | null = null;
    // Accept both 'high' and 'medium' confidence for pre-organized detection
    // 'medium' occurs when folder structure is present but without explicit 01_DAYS prefix
    if (
      pathAnalysis.isPreOrganized &&
      (pathAnalysis.confidence === 'high' || pathAnalysis.confidence === 'medium')
    ) {
      day = pathAnalysis.detectedDay;
      bucket = pathAnalysis.detectedBucket;
    }

    photos.push({
      id,
      mediaKind,
      originalName,
      currentName: originalName,
      timestamp,
      fileModifiedTimestamp,
      timestampSource,
      fileSize,
      day,
      bucket,
      sequence: null,
      favorite: false,
      rating: 0,
      archived: false,
      thumbnail,
      durationSec,
      mimeType: file.type || (isHeic ? 'image/heic' : ''),
      fileHandle: entry.handle,
      filePath: entry.path,
      sourceFolder,
      folderHierarchy: folderSegments,
      detectedDay: pathAnalysis.detectedDay,
      detectedBucket: pathAnalysis.detectedBucket,
      isPreOrganized: pathAnalysis.isPreOrganized,
      organizationConfidence: pathAnalysis.confidence,
    });
  }

  return photos.sort((a, b) => a.timestamp - b.timestamp);
}

export async function buildPhotosFromHandleForTest(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: number, message: string) => void,
): Promise<ProjectPhoto[]> {
  return buildPhotosFromHandle(dirHandle, onProgress);
}

function clusterPhotosByTime(photos: ProjectPhoto[]) {
  const days: Record<string, string[]> = {};
  if (photos.length === 0) return days;

  const hasOnlyExifTimestamps = photos.every(photo => photo.timestampSource === 'exif');
  if (!hasOnlyExifTimestamps) {
    days[1] = photos.map(photo => photo.id);
    return days;
  }

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

export async function ensureProjectScaffolding(
  dirHandle: FileSystemDirectoryHandle,
  projectMode: ProjectMode,
  settings: ProjectSettings = DEFAULT_SETTINGS,
): Promise<void> {
  const plan = await planProjectScaffolding(dirHandle, projectMode, settings);
  for (const renamePath of plan.renamePaths) {
    await moveDirectory(dirHandle, renamePath.from, renamePath.to);
  }
  for (const relativePath of plan.createPaths) {
    await ensureDirectoryPath(dirHandle, relativePath);
  }
}

function buildPhotoCountMap(photos: ProjectPhoto[]) {
  const counts = new Map<string, number>();
  photos.forEach(photo => {
    const path = normalizeRelativePath(photo.filePath || '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length <= 1) {
      return;
    }
    for (let index = 1; index < segments.length; index += 1) {
      const folderPath = segments.slice(0, index).join('/');
      counts.set(folderPath, (counts.get(folderPath) || 0) + 1);
    }
  });
  return counts;
}

function classifyTreeNode(
  name: string,
  relativePath: string,
  parentPath: string | null,
  projectMode: ProjectMode,
  settings: ProjectSettings,
): Pick<ProjectTreeNode, 'kind' | 'isCanonical' | 'dayNumber'> {
  const normalizedPath = normalizeRelativePath(relativePath);
  const daysFolder = settings.folderStructure.daysFolder;
  const inboxFolder = settings.folderStructure.inboxFolder;
  const archiveFolder = settings.folderStructure.archiveFolder;

  if (normalizedPath === inboxFolder || normalizedPath === archiveFolder) {
    return { kind: 'system', isCanonical: true, dayNumber: null };
  }

  if (
    projectMode === 'multi_day' &&
    parentPath === daysFolder &&
    normalizedPath.startsWith(`${daysFolder}/`)
  ) {
    return { kind: 'day', isCanonical: true, dayNumber: null };
  }

  if (
    (projectMode === 'single_day' && !parentPath && isBucketFolderName(name)) ||
    (projectMode === 'multi_day' && parentPath?.startsWith(daysFolder) && isBucketFolderName(name))
  ) {
    return { kind: 'bucket', isCanonical: true, dayNumber: null };
  }

  return { kind: 'folder', isCanonical: false, dayNumber: null };
}

async function readProjectTreeNodes(
  dirHandle: FileSystemDirectoryHandle,
  projectMode: ProjectMode,
  settings: ProjectSettings,
  photos: ProjectPhoto[],
  prefix = '',
  parentPath: string | null = null,
): Promise<ProjectTreeNode[]> {
  const photoCountMap = buildPhotoCountMap(photos);
  const nodes: ProjectTreeNode[] = [];

  // @ts-ignore entries() is supported in modern browsers
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'directory') {
      continue;
    }
    if (name.startsWith('.')) {
      continue;
    }
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const children = await readProjectTreeNodes(
      entry as FileSystemDirectoryHandle,
      projectMode,
      settings,
      photos,
      relativePath,
      relativePath,
    );
    const classification = classifyTreeNode(name, relativePath, parentPath, projectMode, settings);
    nodes.push({
      id: relativePath,
      name,
      relativePath,
      parentPath,
      kind: classification.kind,
      children,
      photoCount: photoCountMap.get(relativePath) || 0,
      isCanonical: classification.isCanonical,
      dayNumber: classification.dayNumber,
    });
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return nodes;
}

export async function buildProjectTree(
  dirHandle: FileSystemDirectoryHandle,
  projectMode: ProjectMode,
  settings: ProjectSettings,
  photos: ProjectPhoto[],
): Promise<ProjectTreeNode[]> {
  const rootNodes = await readProjectTreeNodes(dirHandle, projectMode, settings, photos);
  if (projectMode !== 'multi_day') {
    return rootNodes;
  }

  const daysFolder = settings.folderStructure.daysFolder;
  const promotedDaysNode = rootNodes.find(node => node.relativePath === daysFolder);
  if (!promotedDaysNode) {
    return rootNodes;
  }

  return [
    ...promotedDaysNode.children.map(node => ({ ...node, parentPath: null })),
    ...rootNodes.filter(node => node.relativePath !== daysFolder),
  ];
}

function serializeState(state: ProjectState) {
  const edits = state.photos.map(photo => ({
    filePath: photo.filePath,
    mediaKind: photo.mediaKind,
    originalName: photo.originalName,
    day: photo.day,
    bucket: photo.bucket,
    sequence: photo.sequence,
    favorite: photo.favorite,
    rating: photo.rating,
    archived: photo.archived,
    currentName: photo.currentName,
    timestamp: photo.timestamp,
    fileModifiedTimestamp: photo.fileModifiedTimestamp,
    timestampSource: photo.timestampSource,
    durationSec: photo.durationSec,
    sourceFolder: photo.sourceFolder,
    folderHierarchy: photo.folderHierarchy,
    detectedDay: photo.detectedDay,
    detectedBucket: photo.detectedBucket,
    isPreOrganized: photo.isPreOrganized,
    organizationConfidence: photo.organizationConfidence,
    subfolderOverride: photo.subfolderOverride,
    // Thumbnails are not persisted in project state (blob URLs are session-specific).
  }));

  return {
    projectName: state.projectName,
    rootPath: state.rootPath,
    settings: state.settings,
    projectMode: state.projectMode,
    dayLabels: state.dayLabels || {},
    dayNotes: state.dayNotes || {},
    dayContainers: state.dayContainers || [],
    lastModified: state.lastModified ?? Date.now(),
    ingested: state.ingested,
    sourceRoot: state.sourceRoot,
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

function applyManifestEdits(photos: ProjectPhoto[], edits: ProjectManifestPhoto[]) {
  const byPath = new Map<string, ProjectManifestPhoto>();
  const byFingerprint = new Map<string, ProjectManifestPhoto>();

  edits.forEach(edit => {
    if (edit?.filePath) byPath.set(edit.filePath, edit);
    const fingerprint = `${edit.originalName}|${edit.timestamp}|${edit.fileSize ?? '0'}`;
    byFingerprint.set(fingerprint, edit);
  });

  return photos.map(photo => {
    let edit = photo.filePath ? byPath.get(photo.filePath) : null;
    if (!edit) {
      const fingerprint = `${photo.originalName}|${photo.timestamp}|${photo.fileSize ?? '0'}`;
      edit = byFingerprint.get(fingerprint) || null;
    }
    if (!edit) return photo;
    return {
      ...photo,
      originalName: edit.originalName,
      currentName: edit.currentName,
      timestamp: edit.timestamp,
      fileModifiedTimestamp: edit.fileModifiedTimestamp,
      timestampSource: edit.timestampSource,
      fileSize: edit.fileSize,
      day: edit.day,
      bucket: edit.bucket,
      sequence: edit.sequence,
      favorite: edit.favorite,
      rating: edit.rating,
      archived: edit.archived,
      subfolderOverride: edit.subfolderOverride,
    };
  });
}

function dedupeLogicalPhotos(
  photos: ProjectPhoto[],
  settings: ProjectSettings,
  preferredPaths = new Set<string>(),
) {
  const groups = new Map<string, ProjectPhoto[]>();

  photos.forEach(photo => {
    const key = `${photo.originalName}|${photo.timestamp}|${photo.fileSize ?? '0'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(photo);
  });

  const scorePhoto = (photo: ProjectPhoto) => {
    let score = 0;
    if (photo.filePath && preferredPaths.has(photo.filePath)) score += 100;
    if (photo.currentName !== photo.originalName) score += 25;
    if (photo.isPreOrganized) score += 20;
    if (photo.filePath?.includes(`${settings.folderStructure.daysFolder}/`)) score += 10;
    if (photo.filePath?.includes(`${settings.folderStructure.archiveFolder}/`)) score += 10;
    if (photo.bucket && photo.day !== null) score += 5;
    return score;
  };

  return Array.from(groups.values())
    .map(
      group =>
        group.slice().sort((a, b) => {
          const scoreDiff = scorePhoto(b) - scorePhoto(a);
          if (scoreDiff !== 0) return scoreDiff;
          return (a.filePath || '').localeCompare(b.filePath || '');
        })[0],
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function buildManifest(state: ProjectState): ProjectManifest {
  const photos: ProjectManifestPhoto[] = state.photos.map(photo => ({
    filePath: photo.filePath,
    mediaKind: photo.mediaKind,
    originalName: photo.originalName,
    currentName: photo.currentName,
    timestamp: photo.timestamp,
    fileModifiedTimestamp: photo.fileModifiedTimestamp,
    timestampSource: photo.timestampSource,
    fileSize: photo.fileSize,
    durationSec: photo.durationSec,
    day: photo.day,
    bucket: photo.bucket,
    sequence: photo.sequence,
    favorite: photo.favorite,
    rating: photo.rating,
    archived: photo.archived,
    subfolderOverride: photo.subfolderOverride,
  }));

  return {
    version: 1,
    projectName: state.projectName,
    rootPath: state.rootPath,
    settings: state.settings,
    projectMode: state.projectMode,
    dayLabels: state.dayLabels || {},
    dayNotes: state.dayNotes || {},
    dayContainers: state.dayContainers || [],
    lastModified: state.lastModified ?? Date.now(),
    ingested: state.ingested,
    sourceRoot: state.sourceRoot,
    photos,
  };
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
  projectMode?: ProjectMode;
  onProgress?: (progress: number, message: string) => void;
}): Promise<ProjectInitResponse> {
  const { dirHandle, projectName, rootLabel, projectMode = 'single_day', onProgress } = options;

  // Import requires write access; do not continue under read-only permission.
  const permission = await requestImportWritePermission(dirHandle);
  if (permission !== 'granted') {
    throw new Error(
      'Write access was not granted. Narrative needs permission to create folders, move media into Inbox, and save project metadata. Please try again and allow write access.',
    );
  }

  onProgress?.(5, 'Scanning folder structure...');
  const projectId = generateId();

  let photos: ProjectPhoto[];
  let suggestedDays: Record<string, string[]>;
  try {
    onProgress?.(10, 'Checking folder write access...');
    await assertDirectoryWritable(dirHandle);

    onProgress?.(15, 'Preparing project folders...');
    await ensureProjectScaffolding(dirHandle, projectMode, DEFAULT_SETTINGS);

    onProgress?.(25, 'Moving root media into Inbox...');
    await relocateRootMediaToInbox(dirHandle, DEFAULT_SETTINGS.folderStructure.inboxFolder);

    onProgress?.(30, 'Collecting image files...');
    photos = applyArchiveFolder(
      await buildPhotosFromHandle(dirHandle, (progress, message) => {
        // Map file processing progress (0-100) to 30-75 range
        const mappedProgress = 30 + progress * 0.45;
        onProgress?.(mappedProgress, message);
      }),
      DEFAULT_SETTINGS.folderStructure.archiveFolder,
    );

    onProgress?.(80, 'Analyzing photo timestamps...');
    suggestedDays = clusterPhotosByTime(photos);
  } catch (error) {
    if (isWriteFailure(error)) {
      throw new Error(
        `The selected folder is not writable. Narrative needs write access to create project folders, move root media into Inbox, and save project metadata. Check the folder permissions or choose a different folder.`,
      );
    }
    throw error;
  }

  onProgress?.(85, 'Saving project data...');
  const state: ProjectState = {
    projectName: projectName?.trim() || dirHandle.name,
    rootPath: rootLabel || dirHandle.name,
    photos,
    settings: DEFAULT_SETTINGS,
    projectMode,
    lastModified: Date.now(),
  };

  await saveHandle(projectId, dirHandle);
  safeLocalStorage.set(`${STATE_PREFIX}${projectId}`, JSON.stringify(serializeState(state)));
  try {
    await writeManifest(dirHandle, buildManifest(state));
  } catch (err) {
    console.warn('Failed to write project manifest:', err);
  }

  onProgress?.(95, 'Project initialized successfully');
  return { projectId, photos, suggestedDays, projectMode };
}

export async function getState(projectId: string): Promise<ProjectState> {
  const handle = await getHandle(projectId);
  if (!handle) {
    throw new Error('Project folder access not available. Please reselect the folder.');
  }

  let permission;
  try {
    permission = await requestDirectoryPermission(handle, 'readwrite');
    if (permission !== 'granted') {
      permission = await requestDirectoryPermission(handle, 'read');
    }
  } catch (err) {
    // If requestPermission throws, the handle is likely stale/invalid
    // Remove the invalid handle so user can reselect
    console.warn('Permission request failed, removing stale handle:', err);
    await removeHandle(projectId);
    throw new Error(
      'Project folder access has expired. Please click the project again to reselect the folder.',
    );
  }
  if (permission !== 'granted') {
    throw new Error('Folder access was not granted. Please allow access to continue.');
  }

  const raw = safeLocalStorage.get(`${STATE_PREFIX}${projectId}`);
  const stored = raw ? JSON.parse(raw) : {};
  const manifest = await readManifest(handle);

  // Build photos from filesystem
  const freshPhotos = await buildPhotosFromHandle(handle);

  // If no photos found, the handle may be invalid (e.g., after page refresh)
  if (freshPhotos.length === 0) {
    throw new Error('Project folder access is no longer available. Please reselect the folder.');
  }

  // Apply cached edits (including thumbnails) if available
  let photos = freshPhotos;
  if (manifest?.photos?.length) {
    photos = applyManifestEdits(freshPhotos, manifest.photos);
  } else if (stored.edits) {
    // Create a map of cached edits by filePath
    const cachedEdits = new Map<string, any>();
    stored.edits.forEach((edit: any) => {
      if (edit?.filePath) cachedEdits.set(edit.filePath, edit);
    });

    // Apply cached data to fresh photos (thumbnails are always fresh)
    photos = freshPhotos.map(photo => {
      const cached = photo.filePath ? cachedEdits.get(photo.filePath) : null;
      if (cached) {
        // Apply cached edits but keep fresh thumbnail and freshly-detected bucket if not explicitly set in cache
        // This ensures that newly fixed bucket detection doesn't get overridden by old cached data
        return {
          ...photo,
          day: cached.day,
          bucket: cached.bucket || photo.bucket,
          sequence: cached.sequence,
          favorite: cached.favorite,
          rating: cached.rating,
          archived: cached.archived,
          currentName: cached.currentName,
          subfolderOverride: cached.subfolderOverride,
        };
      }
      return photo;
    });
  }

  const settings = mergeProjectSettings(manifest?.settings || stored.settings);
  const archivedPhotos = applyArchiveFolder(
    photos,
    settings.folderStructure?.archiveFolder || DEFAULT_SETTINGS.folderStructure.archiveFolder,
  );
  const dedupedPhotos = dedupeLogicalPhotos(
    archivedPhotos,
    settings,
    new Set((manifest?.photos || []).map(photo => photo.filePath).filter(Boolean) as string[]),
  );
  const projectMode =
    manifest?.projectMode ||
    stored.projectMode ||
    inferProjectModeFromPhotos(dedupedPhotos, settings);

  if (permission === 'granted') {
    try {
      await ensureProjectScaffolding(handle, projectMode, settings);
    } catch (err) {
      console.warn('Failed to ensure project scaffolding on load:', err);
    }
  }

  return {
    projectName: manifest?.projectName || stored.projectName || handle.name,
    rootPath: manifest?.rootPath || stored.rootPath || handle.name,
    photos: dedupedPhotos,
    settings,
    projectMode,
    dayLabels: manifest?.dayLabels || stored.dayLabels || {},
    dayNotes: manifest?.dayNotes || stored.dayNotes || {},
    dayContainers: manifest?.dayContainers || stored.dayContainers || [],
    lastModified: manifest?.lastModified || stored.lastModified,
    ingested: manifest?.ingested ?? stored.ingested ?? true,
    sourceRoot: manifest?.sourceRoot ?? stored.sourceRoot,
  };
}

export async function renameProjectFolder(
  projectId: string,
  state: ProjectState,
  fromRelativePath: string,
  newName: string,
): Promise<ProjectState> {
  const trimmedName = newName.trim();
  if (!trimmedName) {
    throw new Error('Folder name is required.');
  }

  const handle = await getHandle(projectId);
  if (!handle) {
    throw new Error('Project folder access not available.');
  }

  const normalizedFrom = normalizeRelativePath(fromRelativePath);
  const segments = normalizedFrom.split('/').filter(Boolean);
  const parentPath = segments.slice(0, -1).join('/');
  const nextPath = parentPath ? `${parentPath}/${trimmedName}` : trimmedName;
  await moveDirectory(handle, normalizedFrom, nextPath);

  const nextPhotos = state.photos.map(photo => ({
    ...photo,
    filePath: replacePathPrefix(photo.filePath, normalizedFrom, nextPath),
  }));

  const nextState: ProjectState = {
    ...state,
    photos: nextPhotos,
    lastModified: Date.now(),
  };
  await saveState(projectId, nextState);
  return nextState;
}

export async function deleteProjectFolder(
  projectId: string,
  state: ProjectState,
  relativePath: string,
): Promise<ProjectState> {
  const handle = await getHandle(projectId);
  if (!handle) {
    throw new Error('Project folder access not available.');
  }

  const normalizedPath = normalizeRelativePath(relativePath);
  const segments = normalizedPath.split('/').filter(Boolean);
  const folderName = segments.pop();
  if (!folderName) {
    throw new Error('Folder path is required.');
  }

  const parentHandle =
    segments.length > 0 ? await getDirectoryHandleByPath(handle, segments.join('/')) : handle;
  await parentHandle.removeEntry(folderName, { recursive: true });

  const nextPhotos = state.photos.filter(photo => {
    const photoPath = normalizeRelativePath(photo.filePath || '');
    return photoPath !== normalizedPath && !photoPath.startsWith(`${normalizedPath}/`);
  });

  const nextState: ProjectState = {
    ...state,
    photos: nextPhotos,
    lastModified: Date.now(),
  };
  await saveState(projectId, nextState);
  return nextState;
}

export async function convertProjectToMultiDay(
  projectId: string,
  state: ProjectState,
): Promise<ProjectState> {
  if (state.projectMode === 'multi_day') {
    return state;
  }

  const handle = await getHandle(projectId);
  if (!handle) {
    throw new Error('Project folder access not available.');
  }

  const dayLabel =
    state.dayLabels?.['1'] ||
    state.dayLabels?.[1 as unknown as keyof typeof state.dayLabels] ||
    'Day 01';
  const daysRoot = state.settings.folderStructure.daysFolder;
  await ensureDirectoryPath(handle, `${daysRoot}/${dayLabel}`);

  for (const bucketKey of ROOT_BUCKET_KEYS) {
    const folderName = bucketFolderName(bucketKey);
    try {
      await moveDirectory(handle, folderName, `${daysRoot}/${dayLabel}/${folderName}`);
    } catch (error) {
      // Ignore missing folders during conversion.
    }
  }

  const nextPhotos = state.photos.map(photo => {
    if (!photo.bucket || photo.archived) {
      return photo;
    }
    const folderName = bucketFolderName(photo.bucket);
    const filePath = photo.filePath
      ? replacePathPrefix(photo.filePath, folderName, `${daysRoot}/${dayLabel}/${folderName}`)
      : photo.filePath;
    return {
      ...photo,
      day: photo.day ?? 1,
      filePath,
    };
  });

  const nextState: ProjectState = {
    ...state,
    projectMode: 'multi_day',
    photos: nextPhotos,
    dayLabels: {
      ...(state.dayLabels || {}),
      1: dayLabel,
    },
    lastModified: Date.now(),
  };
  await saveState(projectId, nextState);
  return nextState;
}

export async function saveState(projectId: string, state: ProjectState): Promise<void> {
  safeLocalStorage.set(`${STATE_PREFIX}${projectId}`, JSON.stringify(serializeState(state)));
  try {
    const handle = await getHandle(projectId);
    if (handle) {
      await writeManifest(handle, buildManifest(state));
    }
  } catch (err) {
    console.warn('Failed to persist project manifest:', err);
  }
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

  try {
    await removeExportDestinationHandle(projectId);
  } catch (e) {
    // ignore
  }
}

export async function planProjectScaffoldingPreview(
  dirHandle: FileSystemDirectoryHandle,
  projectMode: ProjectMode,
  settings: ProjectSettings = DEFAULT_SETTINGS,
): Promise<ProjectScaffoldingPlan> {
  return planProjectScaffolding(dirHandle, projectMode, settings);
}

export async function inspectProjectFolder(
  dirHandle: FileSystemDirectoryHandle,
  settings: ProjectSettings = DEFAULT_SETTINGS,
): Promise<ProjectFolderInspection> {
  return inspectProjectFolderState(dirHandle, settings);
}

export async function relocateRootMediaToInboxForTest(
  rootHandle: FileSystemDirectoryHandle,
  inboxFolder: string,
): Promise<{ moved: string[]; skipped: string[] }> {
  return relocateRootMediaToInbox(rootHandle, inboxFolder);
}
