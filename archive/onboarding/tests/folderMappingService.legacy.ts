import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateChangesFromMappings,
  createTransaction,
  saveTransaction,
  getTransaction,
  listTransactions,
  deleteTransaction,
  createManifest,
  applyFolderMappings,
  undoFolderMapping,
} from '../folderMappingService';
import { FolderMapping } from '../../frontend/OnboardingModal';

const mockMappings: FolderMapping[] = [
  {
    folder: 'Day 1',
    folderPath: '/path/Day 1',
    detectedDay: 1,
    confidence: 'high',
    patternMatched: 'day_prefix',
    suggestedName: 'Day 01',
    manual: false,
    photoCount: 42,
  },
  {
    folder: 'Day 2',
    folderPath: '/path/Day 2',
    detectedDay: 2,
    confidence: 'high',
    patternMatched: 'day_prefix',
    suggestedName: 'Day 02',
    manual: false,
    photoCount: 56,
  },
  {
    folder: 'unsorted',
    folderPath: '/path/unsorted',
    detectedDay: null,
    confidence: 'undetected',
    patternMatched: 'none',
    suggestedName: 'Unsorted',
    manual: false,
    photoCount: 12,
  },
];

describe('folderMappingService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('generateChangesFromMappings', () => {
    it('generates changes for detected mappings', () => {
      const changes = generateChangesFromMappings(mockMappings);

      expect(changes.created).toHaveLength(2);
      expect(changes.created[0]).toEqual({ folder: 'Day 01', day: 1 });
      expect(changes.created[1]).toEqual({ folder: 'Day 02', day: 2 });

      // Renames occur because original folder names need padding (Day 1 → Day 01)
      expect(changes.renamed).toHaveLength(2);
      expect(changes.renamed[0]).toEqual({ from: 'Day 1', to: 'Day 01' });
      expect(changes.renamed[1]).toEqual({ from: 'Day 2', to: 'Day 02' });

      // Unsorted folder is skipped
      expect(changes.skipped).toContain('unsorted');
    });

    it('detects renames when folder names differ from suggestions', () => {
      const mappingsWithDifferentNames: FolderMapping[] = [
        { ...mockMappings[0], folder: 'day_1', suggestedName: 'Day 01' },
      ];

      const changes = generateChangesFromMappings(mappingsWithDifferentNames);

      expect(changes.renamed).toHaveLength(1);
      expect(changes.renamed[0]).toEqual({ from: 'day_1', to: 'Day 01' });
    });

    it('handles empty mappings', () => {
      const changes = generateChangesFromMappings([]);

      expect(changes.created).toHaveLength(0);
      expect(changes.renamed).toHaveLength(0);
      expect(changes.moved).toHaveLength(0);
      expect(changes.skipped).toHaveLength(0);
    });
  });

  describe('createTransaction', () => {
    it('creates a transaction with correct structure', () => {
      const txn = createTransaction('Test Trip', '/path/to/trip', mockMappings);

      expect(txn.id).toMatch(/^txn_/);
      expect(txn.projectName).toBe('Test Trip');
      expect(txn.rootPath).toBe('/path/to/trip');
      expect(txn.mappings).toHaveLength(3);
      expect(txn.timestamp).toBeTruthy();
      expect(new Date(txn.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('includes snapshot if provided', () => {
      const snapshot = {
        folders: ['Day 1', 'Day 2'],
        folderContents: { 'Day 1': ['IMG_1.jpg', 'IMG_2.jpg'] },
      };

      const txn = createTransaction('Test Trip', '/path/to/trip', mockMappings, snapshot);

      expect(txn.snapshot).toEqual(snapshot);
    });
  });

  describe('saveTransaction & getTransaction', () => {
    it('saves and retrieves a transaction', () => {
      const txn = createTransaction('Test Trip', '/path/to/trip', mockMappings);
      saveTransaction(txn);

      const retrieved = getTransaction('Test Trip', txn.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(txn.id);
      expect(retrieved?.projectName).toBe('Test Trip');
    });

    it('returns null for non-existent transaction', () => {
      const retrieved = getTransaction('Test Trip', 'non_existent_id');
      expect(retrieved).toBeNull();
    });
  });

  describe('listTransactions', () => {
    it('lists all transactions for a project', () => {
      const txn1 = createTransaction('Test Trip', '/path1', mockMappings);
      const txn2 = createTransaction('Test Trip', '/path2', mockMappings);

      saveTransaction(txn1);
      saveTransaction(txn2);

      const transactions = listTransactions('Test Trip');
      expect(transactions).toHaveLength(2);
    });

    it('sorts transactions by timestamp descending', () => {
      const txn1 = createTransaction('Test Trip', '/path1', mockMappings);
      saveTransaction(txn1);

      // Create second transaction with slight delay to ensure different timestamp
      const txn2 = createTransaction('Test Trip', '/path2', mockMappings);
      saveTransaction(txn2);

      const transactions = listTransactions('Test Trip');
      const time1 = new Date(transactions[0].timestamp).getTime();
      const time2 = new Date(transactions[1].timestamp).getTime();
      expect(time1).toBeGreaterThanOrEqual(time2);
    });

    it('returns empty list for project with no transactions', () => {
      const transactions = listTransactions('Non-Existent Project');
      expect(transactions).toHaveLength(0);
    });

    it('filters transactions by project name', () => {
      const txn1 = createTransaction('Trip A', '/path', mockMappings);
      const txn2 = createTransaction('Trip B', '/path', mockMappings);

      saveTransaction(txn1);
      saveTransaction(txn2);

      const transitionsA = listTransactions('Trip A');
      const transitionsB = listTransactions('Trip B');

      expect(transitionsA).toHaveLength(1);
      expect(transitionsB).toHaveLength(1);
      expect(transitionsA[0].projectName).toBe('Trip A');
      expect(transitionsB[0].projectName).toBe('Trip B');
    });
  });

  describe('deleteTransaction', () => {
    it('deletes a transaction from storage', () => {
      const txn = createTransaction('Test Trip', '/path', mockMappings);
      saveTransaction(txn);

      expect(getTransaction('Test Trip', txn.id)).not.toBeNull();

      deleteTransaction('Test Trip', txn.id);

      expect(getTransaction('Test Trip', txn.id)).toBeNull();
    });
  });

  describe('createManifest', () => {
    it('creates a manifest from transaction', () => {
      const txn = createTransaction('Test Trip', '/path', mockMappings);
      const manifest = createManifest(txn, '2024-03-15', '2024-03-17');

      expect(manifest.version).toBe('1.0');
      expect(manifest.projectName).toBe('Test Trip');
      expect(manifest.rootPath).toBe('/path');
      expect(manifest.tripStart).toBe('2024-03-15');
      expect(manifest.tripEnd).toBe('2024-03-17');
      expect(manifest.mappings).toHaveLength(3);
      expect(manifest.createdAt).toBeTruthy();
      expect(manifest.appliedAt).toBe(txn.timestamp);
    });
  });

  describe('applyFolderMappings', () => {
    it('returns transaction ID and summary for apply', async () => {
      const result = await applyFolderMappings(
        'Test Trip',
        '/path',
        mockMappings,
        undefined,
        undefined,
        false,
      );

      expect(result.transactionId).toMatch(/^txn_/);
      expect(result.summary).toContain('Create 2 folders');
      expect(result.summary).toContain('Move 98 photos');
      expect(result.summary).toContain('Skip 12 photos');
      expect(result.changes).toBeTruthy();

      // Verify transaction was saved
      const txn = getTransaction('Test Trip', result.transactionId);
      expect(txn).not.toBeNull();
    });

    it('does not save transaction for dry-run', async () => {
      const result = await applyFolderMappings(
        'Test Trip',
        '/path',
        mockMappings,
        undefined,
        undefined,
        true, // dryRun
      );

      expect(result.transactionId).toMatch(/^txn_/);

      // Transaction should not be persisted for dry-run
      const txn = getTransaction('Test Trip', result.transactionId);
      expect(txn).toBeNull(); // Not saved in dry-run mode
    });
  });

  describe('undoFolderMapping', () => {
    it('undoes a transaction', async () => {
      const txn = createTransaction('Test Trip', '/path', mockMappings);
      saveTransaction(txn);

      const summary = await undoFolderMapping('Test Trip', txn.id);

      expect(summary).toContain('Undone');
      expect(getTransaction('Test Trip', txn.id)).toBeNull();
    });

    it('rejects if transaction not found', async () => {
      await expect(undoFolderMapping('Test Trip', 'non_existent')).rejects.toThrow(
        'Transaction not found',
      );
    });
  });
});
