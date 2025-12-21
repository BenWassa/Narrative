import '@testing-library/jest-dom';

// Provide a fallback version for tests (Vite define runs only in build/dev).
globalThis.__APP_VERSION__ = '0.0.0';

// Mock IndexedDB for tests
class MockIDBStore {
  private data: Map<string, any> = new Map();
  private indexes: Map<string, any> = new Map();

  get(key: string) {
    return {
      onsuccess: null as ((this: IDBRequest) => any) | null,
      onerror: null as ((this: IDBRequest) => any) | null,
      result: this.data.get(key),
    };
  }

  put(value: any) {
    const key = value.keyPath || value.key || '';
    this.data.set(key, value);
    return {
      onsuccess: null as ((this: IDBRequest) => any) | null,
      onerror: null as ((this: IDBRequest) => any) | null,
    };
  }

  delete(key: string) {
    this.data.delete(key);
    return {
      onsuccess: null as ((this: IDBRequest) => any) | null,
      onerror: null as ((this: IDBRequest) => any) | null,
    };
  }

  clear() {
    this.data.clear();
    return {
      onsuccess: null as ((this: IDBRequest) => any) | null,
      onerror: null as ((this: IDBRequest) => any) | null,
    };
  }

  getAll() {
    return {
      onsuccess: null as ((this: IDBRequest) => any) | null,
      onerror: null as ((this: IDBRequest) => any) | null,
      result: Array.from(this.data.values()),
    };
  }

  index(name: string) {
    if (!this.indexes.has(name)) {
      this.indexes.set(name, new MockIDBIndex(this.data, name));
    }
    return this.indexes.get(name);
  }

  createIndex(name: string, keyPath: string) {
    this.indexes.set(name, new MockIDBIndex(this.data, name, keyPath));
  }
}

class MockIDBIndex {
  constructor(
    private data: Map<string, any>,
    private name: string,
    private keyPath?: string,
  ) {}

  getAll() {
    const values = Array.from(this.data.values());
    if (this.keyPath) {
      return values.sort((a, b) => (a[this.keyPath!] || 0) - (b[this.keyPath!] || 0));
    }
    return {
      onsuccess: null as ((this: IDBRequest) => any) | null,
      onerror: null as ((this: IDBRequest) => any) | null,
      result: values,
    };
  }
}

class MockIDBTransaction {
  private stores: Map<string, MockIDBStore> = new Map();

  constructor(
    private storeNames: string[],
    private mode: 'readonly' | 'readwrite' = 'readonly',
  ) {
    for (const name of storeNames) {
      this.stores.set(name, new MockIDBStore());
    }
  }

  objectStore(name: string) {
    return this.stores.get(name) || new MockIDBStore();
  }
}

class MockIDBDatabase {
  private stores: Map<string, MockIDBStore> = new Map();
  objectStoreNames = new (class {
    constructor(private storeNames: string[]) {}
    contains(name: string) {
      return this.storeNames.includes(name);
    }
  })([]);

  transaction(storeNames: string[], mode: 'readonly' | 'readwrite' = 'readonly') {
    return new MockIDBTransaction(storeNames, mode);
  }

  createObjectStore(name: string) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new MockIDBStore());
    }
    return this.stores.get(name);
  }
}

class MockIndexedDB {
  open(name: string, version: number) {
    const db = new MockIDBDatabase();
    return {
      onsuccess: null as ((this: IDBOpenDBRequest) => any) | null,
      onerror: null as ((this: IDBOpenDBRequest) => any) | null,
      onupgradeneeded: null as ((event: IDBVersionChangeEvent) => any) | null,
      result: db,
    };
  }
}

if (!globalThis.indexedDB) {
  globalThis.indexedDB = new MockIndexedDB() as any;
}

