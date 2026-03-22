import type { ExportManifest } from '../services/projectService';
import type { OperationPlan, PlannedOperation } from './buildOperationPlan';
import { generateExportManifestFromPlan } from './exportManifest';

export interface ExecutionContext {
  sourceDirectoryHandle: FileSystemDirectoryHandle;
  destinationDirectoryHandle: FileSystemDirectoryHandle;
  sourceRootLabel: string; // for manifest (projectRootPath string)
  destinationRootLabel: string; // for manifest (picked folder name)
  ingested: boolean;
  onProgress: (progress: ExecutionProgress) => void;
}

export interface ExecutionProgress {
  phase: 'preparing' | 'copying' | 'complete';
  processed: number;
  total: number;
  currentFile?: string;
  currentStatus?: 'copied' | 'skipped' | 'failed';
}

export interface ExecutionResult {
  completed: boolean;
  copiedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: Array<{ operation: PlannedOperation; error: string }>;
  conflicts: Array<{ operation: PlannedOperation; reason: string }>;
  manifest: ExportManifest;
  executionLog: ExecutionLog;
}

export interface ExecutionLog {
  timestamp: number;
  operations: Array<{
    sourcePath: string;
    destinationPath: string;
    status: 'copied' | 'skipped' | 'failed';
    reason?: string;
    error?: string;
  }>;
  summary: { copied: number; skipped: number; failed: number };
}

/**
 * Navigate source dir handle to file using relative path.
 * Splits path by '/', traverses directory handles, returns File object.
 */
async function getFileAtPath(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop()!;
  let current = dirHandle;
  for (const segment of parts) {
    current = await current.getDirectoryHandle(segment);
  }
  const fileHandle = await current.getFileHandle(fileName);
  return fileHandle.getFile();
}

/**
 * Create destination directory tree recursively.
 * Returns the handle to the final directory.
 */
async function createDirectoryPath(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle> {
  const parts = relativePath.split('/').filter(Boolean);
  let current = dirHandle;
  for (const segment of parts) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * Execute a validated operation plan, copying files using File System Access API.
 * Does not overwrite existing files; skips with conflict record instead.
 * Continues after per-file failures; only stops on setup-level failures.
 */
export async function executePlan(
  plan: OperationPlan,
  context: ExecutionContext,
): Promise<ExecutionResult> {
  // Validate plan has no blockers
  if (plan.blockers.length > 0) {
    throw new Error(
      `Plan has ${plan.blockers.length} blocker(s). Resolve duplicate destinations before executing.`,
    );
  }

  const {
    sourceDirectoryHandle,
    destinationDirectoryHandle,
    sourceRootLabel,
    destinationRootLabel,
    ingested,
    onProgress,
  } = context;

  const copiedCount = { count: 0 };
  const skippedCount = { count: 0 };
  const failedCount = { count: 0 };
  const failures: Array<{ operation: PlannedOperation; error: string }> = [];
  const conflicts: Array<{ operation: PlannedOperation; reason: string }> = [];
  const executionLogOps: ExecutionLog['operations'] = [];

  const total = plan.operations.length;

  // Pre-flight permission check: test creating a directory in destination
  onProgress({ phase: 'preparing', processed: 0, total });
  try {
    const testDir = await destinationDirectoryHandle.getDirectoryHandle('.test-write-permission', {
      create: true,
    });
    // Delete test directory immediately
    await destinationDirectoryHandle.removeEntry('.test-write-permission', { recursive: true });
  } catch (e) {
    throw new Error(
      `No write permission on destination folder. Please check permissions and try again.`,
    );
  }

  // Main copy loop
  onProgress({ phase: 'copying', processed: 0, total });

  for (let i = 0; i < plan.operations.length; i++) {
    const operation = plan.operations[i];
    const operationDestPath = `${destinationRootLabel}/${operation.destinationRelativePath}`;

    onProgress({
      phase: 'copying',
      processed: i,
      total,
      currentFile: operation.currentName,
      currentStatus: undefined,
    });

    try {
      // Get source file
      const sourceFile = await getFileAtPath(sourceDirectoryHandle, operation.sourceRelativePath);

      // Split destination path into directory + filename
      const destPathParts = operation.destinationRelativePath.split('/');
      const destFileName = destPathParts.pop()!;
      const destDirPath = destPathParts.join('/');

      // Create destination directory tree
      const destDir = await createDirectoryPath(destinationDirectoryHandle, destDirPath);

      // Check if destination file already exists
      let destFileExists = false;
      try {
        await destDir.getFileHandle(destFileName);
        destFileExists = true;
      } catch (e) {
        // File does not exist, which is what we want
      }

      if (destFileExists) {
        // File already exists: skip + record conflict
        skippedCount.count++;
        conflicts.push({
          operation,
          reason: 'File already exists at destination',
        });
        executionLogOps.push({
          sourcePath: operation.sourceRelativePath,
          destinationPath: operationDestPath,
          status: 'skipped',
          reason: 'File already exists at destination',
        });
        onProgress({
          phase: 'copying',
          processed: i,
          total,
          currentFile: operation.currentName,
          currentStatus: 'skipped',
        });
      } else {
        // File does not exist: proceed with copy using stream (not arrayBuffer, to avoid OOM)
        const writable = await destDir.getFileHandle(destFileName, { create: true });
        const ws = await writable.createWritable();

        // Use pipeTo for streaming large files without loading entire content into memory
        await sourceFile.stream().pipeTo(ws);

        copiedCount.count++;
        executionLogOps.push({
          sourcePath: operation.sourceRelativePath,
          destinationPath: operationDestPath,
          status: 'copied',
        });
        onProgress({
          phase: 'copying',
          processed: i,
          total,
          currentFile: operation.currentName,
          currentStatus: 'copied',
        });
      }
    } catch (error) {
      // Per-file failure: record and continue
      failedCount.count++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      failures.push({
        operation,
        error: errorMsg,
      });
      executionLogOps.push({
        sourcePath: operation.sourceRelativePath,
        destinationPath: operationDestPath,
        status: 'failed',
        error: errorMsg,
      });
      onProgress({
        phase: 'copying',
        processed: i,
        total,
        currentFile: operation.currentName,
        currentStatus: 'failed',
      });
    }
  }

  // Build execution log
  const executionLog: ExecutionLog = {
    timestamp: Date.now(),
    operations: executionLogOps,
    summary: {
      copied: copiedCount.count,
      skipped: skippedCount.count,
      failed: failedCount.count,
    },
  };

  // Generate manifest using the plan
  const manifest = await generateExportManifestFromPlan(
    plan,
    sourceRootLabel,
    destinationRootLabel,
    ingested,
  );

  onProgress({ phase: 'complete', processed: total, total });

  return {
    completed: failedCount.count === 0,
    copiedCount: copiedCount.count,
    skippedCount: skippedCount.count,
    failedCount: failedCount.count,
    failures,
    conflicts,
    manifest,
    executionLog,
  };
}
