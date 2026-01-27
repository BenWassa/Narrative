/**
 * IndexedDB-based cover photo storage service
 * Replaces base64 strings in localStorage with blob storage for better performance
 * and reduced memory footprint.
 */

const DB_NAME = 'narrative-covers';
const DB_VERSION = 1;
const COVER_STORE = 'covers';
const METADATA_STORE = 'metadata';

interface CoverMetadata {
  projectId: string;
  coverKey: string;
  lastUsed: number; // timestamp for LRU eviction
  width: number;
  height: number;
  sizeBytes: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create cover blob store
      if (!db.objectStoreNames.contains(COVER_STORE)) {
        db.createObjectStore(COVER_STORE, { keyPath: 'coverKey' });
      }

      // Create metadata store for LRU tracking and project references
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, {
          keyPath: 'projectId',
        });
        metadataStore.createIndex('lastUsed', 'lastUsed', { unique: false });
      }
    };
  });
}

/**
 * Save a cover photo as a blob
 * Updates lastUsed timestamp for LRU eviction
 */
export async function saveCover(
  projectId: string,
  blob: Blob,
  width: number = 120,
  height: number = 90,
): Promise<string> {
  const db = await initDB();
  const coverKey = `cover-${projectId}-${Date.now()}`;
  const sizeBytes = blob.size;

  // Store the blob
  const storeRequest = db
    .transaction([COVER_STORE], 'readwrite')
    .objectStore(COVER_STORE)
    .put({ coverKey, blob });

  await new Promise<void>((resolve, reject) => {
    storeRequest.onsuccess = () => resolve();
    storeRequest.onerror = () => reject(storeRequest.error);
  });

  // Update metadata for LRU tracking
  const metadata: CoverMetadata = {
    projectId,
    coverKey,
    lastUsed: Date.now(),
    width,
    height,
    sizeBytes,
  };

  const metaRequest = db
    .transaction([METADATA_STORE], 'readwrite')
    .objectStore(METADATA_STORE)
    .put(metadata);

  await new Promise<void>((resolve, reject) => {
    metaRequest.onsuccess = () => resolve();
    metaRequest.onerror = () => reject(metaRequest.error);
  });

  return coverKey;
}

/**
 * Retrieve a cover photo as a blob
 * Updates lastUsed timestamp for LRU tracking
 */
export async function getCover(projectId: string): Promise<Blob | null> {
  const db = await initDB();

  // Get metadata to find the cover key
  const metaRequest = db
    .transaction([METADATA_STORE], 'readonly')
    .objectStore(METADATA_STORE)
    .get(projectId);

  const metadata = await new Promise<CoverMetadata | undefined>((resolve, reject) => {
    metaRequest.onsuccess = () => resolve(metaRequest.result);
    metaRequest.onerror = () => reject(metaRequest.error);
  });

  if (!metadata) {
    return null;
  }

  // Update lastUsed timestamp
  const updateRequest = db
    .transaction([METADATA_STORE], 'readwrite')
    .objectStore(METADATA_STORE)
    .put({ ...metadata, lastUsed: Date.now() });

  await new Promise<void>((resolve, reject) => {
    updateRequest.onsuccess = () => resolve();
    updateRequest.onerror = () => reject(updateRequest.error);
  });

  // Get the blob
  const coverRequest = db
    .transaction([COVER_STORE], 'readonly')
    .objectStore(COVER_STORE)
    .get(metadata.coverKey);

  const coverData = await new Promise<any>((resolve, reject) => {
    coverRequest.onsuccess = () => resolve(coverRequest.result);
    coverRequest.onerror = () => reject(coverRequest.error);
  });

  return coverData?.blob || null;
}

/**
 * Get cover as object URL for rendering
 * Caller must revoke the URL when done
 */
export async function getCoverUrl(projectId: string): Promise<string | null> {
  const blob = await getCover(projectId);
  if (!blob) {
    return null;
  }
  return URL.createObjectURL(blob);
}

/**
 * Delete a specific cover
 */
export async function deleteCover(projectId: string): Promise<void> {
  const db = await initDB();

  // Get metadata to find the cover key
  const metaRequest = db
    .transaction([METADATA_STORE], 'readonly')
    .objectStore(METADATA_STORE)
    .get(projectId);

  const metadata = await new Promise<CoverMetadata | undefined>((resolve, reject) => {
    metaRequest.onsuccess = () => resolve(metaRequest.result);
    metaRequest.onerror = () => reject(metaRequest.error);
  });

  if (!metadata) {
    return;
  }

  // Delete blob
  const deleteRequest = db
    .transaction([COVER_STORE], 'readwrite')
    .objectStore(COVER_STORE)
    .delete(metadata.coverKey);

  await new Promise<void>((resolve, reject) => {
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
  });

  // Delete metadata
  const metaDeleteRequest = db
    .transaction([METADATA_STORE], 'readwrite')
    .objectStore(METADATA_STORE)
    .delete(projectId);

  await new Promise<void>((resolve, reject) => {
    metaDeleteRequest.onsuccess = () => resolve();
    metaDeleteRequest.onerror = () => reject(metaDeleteRequest.error);
  });
}

/**
 * Get all cover metadata sorted by lastUsed (oldest first)
 */
export async function getAllCoverMetadata(): Promise<CoverMetadata[]> {
  const db = await initDB();

  const index = db
    .transaction([METADATA_STORE], 'readonly')
    .objectStore(METADATA_STORE)
    .index('lastUsed');

  const results = await new Promise<CoverMetadata[]>((resolve, reject) => {
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return results;
}

/**
 * Evict least-recently-used covers to stay under max count
 * Returns list of evicted project IDs
 */
export async function evictOldCovers(maxCovers: number = 10): Promise<string[]> {
  const metadata = await getAllCoverMetadata();
  const evicted: string[] = [];

  if (metadata.length > maxCovers) {
    const toEvict = metadata.slice(0, metadata.length - maxCovers);
    for (const item of toEvict) {
      await deleteCover(item.projectId);
      evicted.push(item.projectId);
    }
  }

  return evicted;
}

/**
 * Clear all covers from database
 */
export async function clearAllCovers(): Promise<void> {
  const db = await initDB();

  const clearCover = db.transaction([COVER_STORE], 'readwrite').objectStore(COVER_STORE).clear();

  await new Promise<void>((resolve, reject) => {
    clearCover.onsuccess = () => resolve();
    clearCover.onerror = () => reject(clearCover.error);
  });

  const clearMeta = db
    .transaction([METADATA_STORE], 'readwrite')
    .objectStore(METADATA_STORE)
    .clear();

  await new Promise<void>((resolve, reject) => {
    clearMeta.onsuccess = () => resolve();
    clearMeta.onerror = () => reject(clearMeta.error);
  });
}

/**
 * Get total size of all stored covers in bytes
 */
export async function getCoverStorageSize(): Promise<number> {
  const metadata = await getAllCoverMetadata();
  return metadata.reduce((sum, m) => sum + m.sizeBytes, 0);
}

/**
 * Migrate covers from localStorage (base64) to IndexedDB (blobs)
 * Used during app upgrade
 */
export async function migrateFromLocalStorage(recentProjectsKey: string): Promise<{
  migrated: number;
  errors: Array<{ projectId: string; error: string }>;
}> {
  let migrated = 0;
  const errors: Array<{ projectId: string; error: string }> = [];

  try {
    const raw = localStorage.getItem(recentProjectsKey);
    if (!raw) {
      return { migrated, errors };
    }

    const projects = JSON.parse(raw) as Array<{
      projectId: string;
      coverUrl?: string;
    }>;

    for (const project of projects) {
      if (!project.coverUrl) {
        continue;
      }

      try {
        // Convert data URL to blob
        const response = await fetch(project.coverUrl);
        const blob = await response.blob();

        // Save to IDB
        await saveCover(project.projectId, blob);
        migrated++;

        // Clear from localStorage
        const updated = projects.map(p =>
          p.projectId === project.projectId ? { ...p, coverUrl: undefined } : p,
        );
        localStorage.setItem(recentProjectsKey, JSON.stringify(updated));
      } catch (err) {
        errors.push({
          projectId: project.projectId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    console.error('Failed to migrate covers from localStorage:', err);
  }

  return { migrated, errors };
}
