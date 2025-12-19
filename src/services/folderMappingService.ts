/**
 * Folder Mapping Service
 * Handles applying folder mappings to the filesystem with transaction log and undo support.
 */

import { FolderMapping } from '../frontend/OnboardingModal';

/**
 * Transaction log entry for undo/redo
 */
export interface FolderMapTransaction {
  id: string;
  timestamp: string; // ISO timestamp
  projectName: string;
  rootPath: string;
  mappings: FolderMapping[];
  changes: {
    renamed: { from: string; to: string }[];
    moved: { from: string; to: string }[];
    created: { folder: string; day: number }[];
    skipped: string[];
  };
  snapshot?: {
    // Pre-apply filesystem state for undo
    folders: string[];
    folderContents: { [key: string]: string[] };
  };
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate changes summary for a dry-run or actual apply
 */
export function generateChangesFromMappings(
  mappings: FolderMapping[],
): FolderMapTransaction['changes'] {
  const changes: FolderMapTransaction['changes'] = {
    renamed: [],
    moved: [],
    created: [],
    skipped: [],
  };

  mappings.forEach(mapping => {
    if (mapping.detectedDay !== null) {
      // Create day folder
      changes.created.push({
        folder: mapping.suggestedName,
        day: mapping.detectedDay,
      });

      // Rename/move folder if name doesn't match suggestion
      if (mapping.folder !== mapping.suggestedName) {
        changes.renamed.push({
          from: mapping.folder,
          to: mapping.suggestedName,
        });
      }
    } else {
      // Folder is skipped
      changes.skipped.push(mapping.folder);
    }
  });

  return changes;
}

/**
 * Create a transaction log entry
 */
export function createTransaction(
  projectName: string,
  rootPath: string,
  mappings: FolderMapping[],
  snapshot?: FolderMapTransaction['snapshot'],
): FolderMapTransaction {
  return {
    id: generateTransactionId(),
    timestamp: new Date().toISOString(),
    projectName,
    rootPath,
    mappings,
    changes: generateChangesFromMappings(mappings),
    snapshot,
  };
}

/**
 * Save transaction to persistent storage (localStorage or backend)
 * In a real implementation, this would POST to a backend service
 */
export function saveTransaction(transaction: FolderMapTransaction): void {
  // For now, store in localStorage under a key namespaced by project
  const storageKey = `narrative_transaction_${transaction.projectName}_${transaction.id}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(transaction));
  } catch (err) {
    console.warn('Failed to save transaction to localStorage:', err);
    // In production, would log to error tracking service
  }
}

/**
 * Retrieve transaction from persistent storage
 */
export function getTransaction(
  projectName: string,
  transactionId: string,
): FolderMapTransaction | null {
  const storageKey = `narrative_transaction_${projectName}_${transactionId}`;
  try {
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn('Failed to retrieve transaction from localStorage:', err);
    return null;
  }
}

/**
 * List all transactions for a project
 */
export function listTransactions(projectName: string): FolderMapTransaction[] {
  const prefix = `narrative_transaction_${projectName}_`;
  const transactions: FolderMapTransaction[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const data = localStorage.getItem(key);
        if (data) {
          transactions.push(JSON.parse(data));
        }
      }
    }
  } catch (err) {
    console.warn('Failed to list transactions from localStorage:', err);
  }

  // Sort by timestamp descending (most recent first)
  return transactions.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/**
 * Delete a transaction from storage (e.g., after confirming undo)
 */
export function deleteTransaction(projectName: string, transactionId: string): void {
  const storageKey = `narrative_transaction_${projectName}_${transactionId}`;
  try {
    localStorage.removeItem(storageKey);
  } catch (err) {
    console.warn('Failed to delete transaction from localStorage:', err);
  }
}

/**
 * Write folder map manifest to _meta/folder_map.json (backend only)
 * This would be called after successful apply
 */
export interface FolderMapManifest {
  version: '1.0';
  projectName: string;
  rootPath: string;
  createdAt: string;
  appliedAt: string;
  tripStart?: string;
  tripEnd?: string;
  mappings: FolderMapping[];
  changes: FolderMapTransaction['changes'];
}

export function createManifest(
  transaction: FolderMapTransaction,
  tripStart?: string,
  tripEnd?: string,
): FolderMapManifest {
  return {
    version: '1.0',
    projectName: transaction.projectName,
    rootPath: transaction.rootPath,
    createdAt: new Date().toISOString(),
    appliedAt: transaction.timestamp,
    tripStart,
    tripEnd,
    mappings: transaction.mappings,
    changes: transaction.changes,
  };
}

/**
 * Simulate applying folder mappings (in real implementation, calls backend)
 * This creates a transaction and returns the summary
 */
export async function applyFolderMappings(
  projectName: string,
  rootPath: string,
  mappings: FolderMapping[],
  tripStart?: string,
  tripEnd?: string,
  dryRun: boolean = false,
): Promise<{
  transactionId: string;
  summary: string;
  changes: FolderMapTransaction['changes'];
}> {
  return new Promise(resolve => {
    // Simulate async operation
    setTimeout(() => {
      const transaction = createTransaction(projectName, rootPath, mappings);

      if (!dryRun) {
        // Save transaction for undo support
        saveTransaction(transaction);
      }

      // Generate summary
      const movedPhotos = mappings
        .filter(m => m.detectedDay !== null)
        .reduce((sum, m) => sum + m.photoCount, 0);
      const created = mappings.filter(m => m.detectedDay !== null).length;

      let summary = `✓ Create ${created} folders:\n`;
      mappings
        .filter(m => m.detectedDay !== null)
        .forEach(m => {
          summary += `  • ${m.suggestedName}/\n`;
        });

      summary += `\n✓ Move ${movedPhotos} photos:\n`;
      mappings
        .filter(m => m.detectedDay !== null)
        .forEach(m => {
          summary += `  • ${m.photoCount} from "${m.folder}" → "${m.suggestedName}/"\n`;
        });

      const skippedPhotos = mappings
        .filter(m => m.detectedDay === null)
        .reduce((sum, m) => sum + m.photoCount, 0);
      if (skippedPhotos > 0) {
        summary += `\n○ Skip ${skippedPhotos} photos in undetected folders\n`;
      }

      resolve({
        transactionId: transaction.id,
        summary,
        changes: transaction.changes,
      });
    }, 100); // Simulate network delay
  });
}

/**
 * Simulate undoing a transaction (calls backend to restore filesystem)
 */
export async function undoFolderMapping(
  projectName: string,
  transactionId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const transaction = getTransaction(projectName, transactionId);
      if (!transaction) {
        reject(new Error('Transaction not found'));
        return;
      }

      // In real implementation, would restore filesystem from snapshot
      // For now, just return a summary
      const summary = `Undone: Reversed ${
        transaction.changes.renamed.length + transaction.changes.moved.length
      } changes`;

      // Delete transaction after successful undo
      deleteTransaction(projectName, transactionId);

      resolve(summary);
    }, 100);
  });
}
