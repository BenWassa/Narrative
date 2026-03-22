import type { ProjectPhoto, ProjectSettings } from '../services/projectService';
import type { ExportStructureMode } from '../hooks/useExportScript';
import { BUCKET_LABELS } from '../constants/meceBuckets';

export type PlanReason =
  | 'renamed'
  | 'bucket_assigned'
  | 'day_reassigned'
  | 'archived'
  | 'needs_move';

export type PlannedOperation = {
  type: 'copy';
  sourceRelativePath: string; // photo.filePath
  destinationRelativePath: string; // computed destination (relative to destination root)
  currentName: string;
  reason: PlanReason;
  photo: ProjectPhoto;
};

export type PlanWarning = {
  kind: 'missing_file_path';
  photoId: string;
  currentName: string;
};

export type PlanBlocker = {
  kind: 'duplicate_destination';
  destinationRelativePath: string;
  conflictingPhotos: ProjectPhoto[];
};

export type OperationPlan = {
  operations: PlannedOperation[];
  summary: {
    total: number;
    copyCount: number;
    skippedCount: number;
  };
  warnings: PlanWarning[];
  blockers: PlanBlocker[];
  resolvedStructureMode: 'single_day_flat' | 'multi_day_nested';
  conflictPolicy: 'skip_on_existing';
};

/**
 * Builds a structured operation plan from photos and project settings.
 * This is the single source of truth for which files move and where.
 *
 * Used by both the export script generator and the direct execution engine.
 */
export function buildOperationPlan(params: {
  photos: ProjectPhoto[];
  dayLabels: Record<number, string>;
  projectSettings: ProjectSettings;
  ingested?: boolean; // defaults true (backward compat)
  sourceRoot?: string;
  structureMode: ExportStructureMode;
}): OperationPlan {
  const { photos, dayLabels, projectSettings, ingested = true, structureMode } = params;

  const daysFolder = projectSettings.folderStructure.daysFolder;
  const archiveFolder = projectSettings.folderStructure.archiveFolder;
  const bucketNames: Record<string, string> = BUCKET_LABELS;

  const operations: PlannedOperation[] = [];
  const warnings: PlanWarning[] = [];
  const destinationPathMap = new Map<string, ProjectPhoto[]>();

  // Determine if each photo should be exported and compute its destination
  for (const photo of photos) {
    // Check if photo has been modified (5 conditions from useExportScript)
    const hasBeenRenamed = photo.originalName !== photo.currentName;
    const hasUserAssignedBucket = photo.bucket && !photo.isPreOrganized;
    const hasUserAssignedDay = photo.day !== null && photo.day !== photo.detectedDay;
    const wasArchived = photo.archived && !photo.filePath?.includes(archiveFolder);

    // Calculate target path for organized photos
    let needsToMove = false;
    if (photo.bucket && photo.day !== null) {
      const dayLabel = dayLabels[photo.day] || `Day ${String(photo.day).padStart(2, '0')}`;
      const bucketLabel = bucketNames[photo.bucket] || photo.bucket;
      const targetPath = `${daysFolder}/${dayLabel}/${photo.bucket}_${bucketLabel}/${photo.currentName}`;
      needsToMove = photo.filePath !== targetPath && !photo.filePath?.includes(targetPath);
    } else if (photo.archived) {
      const targetPath = `${archiveFolder}/${photo.currentName}`;
      needsToMove = photo.filePath !== targetPath && !photo.filePath?.includes(targetPath);
    }

    // Only include photos that have been modified or need to move
    const shouldExport =
      hasBeenRenamed || hasUserAssignedBucket || hasUserAssignedDay || wasArchived || needsToMove;

    if (!shouldExport) {
      continue;
    }

    // Check that photo has a file path
    if (!photo.filePath) {
      warnings.push({
        kind: 'missing_file_path',
        photoId: photo.id,
        currentName: photo.currentName,
      });
      continue;
    }

    // Determine reason (first match wins)
    let reason: PlanReason;
    if (hasBeenRenamed) reason = 'renamed';
    else if (hasUserAssignedBucket) reason = 'bucket_assigned';
    else if (hasUserAssignedDay) reason = 'day_reassigned';
    else if (wasArchived) reason = 'archived';
    else reason = 'needs_move';

    // Compute destination relative path
    let destinationRelativePath: string;

    if (photo.archived) {
      destinationRelativePath = `${archiveFolder}/${photo.currentName}`;
    } else if (photo.bucket && photo.day !== null) {
      const dayLabel = dayLabels[photo.day] || `Day ${String(photo.day).padStart(2, '0')}`;
      const bucketLabel = bucketNames[photo.bucket] || photo.bucket;

      if (structureMode === 'single_day_flat') {
        // Single-day flat: buckets at root level
        destinationRelativePath = `${photo.bucket}_${bucketLabel}/${photo.currentName}`;
      } else {
        // Multi-day nested: buckets inside day folders
        destinationRelativePath = `${daysFolder}/${dayLabel}/${photo.bucket}_${bucketLabel}/${photo.currentName}`;
      }
    } else {
      // Root photo (no bucket, no day)
      destinationRelativePath = photo.currentName;
    }

    // Track destination paths for duplicate detection
    if (!destinationPathMap.has(destinationRelativePath)) {
      destinationPathMap.set(destinationRelativePath, []);
    }
    destinationPathMap.get(destinationRelativePath)!.push(photo);

    operations.push({
      type: 'copy',
      sourceRelativePath: photo.filePath,
      destinationRelativePath,
      currentName: photo.currentName,
      reason,
      photo,
    });
  }

  // Detect duplicate destinations
  const blockers: PlanBlocker[] = [];
  for (const [destPath, conflictingPhotos] of destinationPathMap) {
    if (conflictingPhotos.length > 1) {
      blockers.push({
        kind: 'duplicate_destination',
        destinationRelativePath: destPath,
        conflictingPhotos,
      });
    }
  }

  // Resolve structure mode
  // Auto mode: if ≤1 active days, use flat; otherwise nested
  let resolvedStructureMode: 'single_day_flat' | 'multi_day_nested' =
    structureMode === 'auto'
      ? operations
          .filter(op => op.photo.day !== null)
          .every(op => op.photo.day === operations[0].photo.day) &&
        operations.filter(op => op.photo.day !== null).length <= 1
        ? 'single_day_flat'
        : 'multi_day_nested'
      : (structureMode as 'single_day_flat' | 'multi_day_nested');

  return {
    operations,
    summary: {
      total: operations.length,
      copyCount: operations.length,
      skippedCount: warnings.length,
    },
    warnings,
    blockers,
    resolvedStructureMode,
    conflictPolicy: 'skip_on_existing',
  };
}
