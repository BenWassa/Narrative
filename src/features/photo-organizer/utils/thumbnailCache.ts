import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface ThumbnailDB extends DBSchema {
  thumbnails: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      timestamp: number;
    };
  };
}

class ThumbnailCache {
  private db: IDBPDatabase<ThumbnailDB> | null = null;
  private objectUrls = new Map<string, string>();

  private async init() {
    if (this.db) return;
    this.db = await openDB<ThumbnailDB>('narrative-thumbnails', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'id' });
        }
      },
    });
  }

  async get(photoId: string): Promise<string | null> {
    if (this.objectUrls.has(photoId)) {
      return this.objectUrls.get(photoId)!;
    }

    await this.init();
    const entry = await this.db!.get('thumbnails', photoId);
    if (!entry?.blob) return null;

    const url = URL.createObjectURL(entry.blob);
    this.objectUrls.set(photoId, url);
    return url;
  }

  async set(photoId: string, blob: Blob) {
    await this.init();

    const existingUrl = this.objectUrls.get(photoId);
    if (existingUrl) {
      try {
        URL.revokeObjectURL(existingUrl);
      } catch (error) {
        // Ignore revoke errors.
      }
      this.objectUrls.delete(photoId);
    }

    await this.db!.put('thumbnails', {
      id: photoId,
      blob,
      timestamp: Date.now(),
    });
  }

  async clear() {
    await this.init();
    await this.db!.clear('thumbnails');

    this.objectUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        // Ignore revoke errors.
      }
    });
    this.objectUrls.clear();
  }
}

export const thumbnailCache = new ThumbnailCache();
