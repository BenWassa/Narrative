import type { ProjectPhoto, ExportManifest, ExportOperation } from '../services/projectService';

/**
 * Generates an export manifest tracking all copy operations.
 * This manifest can be used to undo/redo exports safely.
 */
export async function generateExportManifest(
  photos: ProjectPhoto[],
  sourceRoot: string,
  destinationRoot: string,
  ingested: boolean,
  dayLabels: Record<number, string>,
  settings: any,
): Promise<ExportManifest> {
  const operations: ExportOperation[] = [];
  const daysFolder = settings.folderStructure.daysFolder;
  const archiveFolder = settings.folderStructure.archiveFolder;

  const bucketNames: Record<string, string> = {
    A: 'Establishing',
    B: 'People',
    C: 'Culture-Detail',
    D: 'Action-Moment',
    E: 'Transition',
    M: 'Mood-Food',
  };

  // Process each photo that will be exported
  for (const photo of photos) {
    if (!photo.filePath) continue;

    // Skip photos that don't need to be exported
    const shouldExport = determineIfShouldExport(photo, archiveFolder, dayLabels, daysFolder, bucketNames);
    if (!shouldExport) continue;

    let destinationPath = '';

    if (photo.archived) {
      destinationPath = ingested
        ? `${destinationRoot}/${archiveFolder}/${photo.currentName}`
        : `${destinationRoot}/${archiveFolder}/${photo.currentName}`;
    } else if (photo.bucket && photo.day !== null) {
      const dayLabel = dayLabels[photo.day] || `Day ${String(photo.day).padStart(2, '0')}`;
      const bucketLabel = bucketNames[photo.bucket] || photo.bucket;

      if (ingested) {
        destinationPath = `${destinationRoot}/${daysFolder}/${dayLabel}/${photo.bucket}_${bucketLabel}/${photo.currentName}`;
      } else {
        destinationPath = `${destinationRoot}/${photo.bucket}_${bucketLabel}/${photo.currentName}`;
      }
    } else {
      // Root photo
      destinationPath = `${destinationRoot}/${photo.currentName}`;
    }

    // Try to get file size (for validation during undo)
    let fileSize = 0;
    try {
      if (photo.fileHandle) {
        const file = await photo.fileHandle.getFile();
        fileSize = file.size;
      }
    } catch (e) {
      // File size unavailable
    }

    operations.push({
      sourcePath: photo.filePath,
      destinationPath,
      fileSize,
      operation: 'copy',
    });
  }

  return {
    timestamp: Date.now(),
    operations,
    sourceRoot,
    destinationRoot,
    ingested,
  };
}

/**
 * Generates an undo script that reverses the last export operation.
 */
export function generateUndoScript(manifest: ExportManifest): string {
  const lines: string[] = [];

  lines.push('#!/bin/bash');
  lines.push('# Narrative Export Undo Script');
  lines.push('# This script safely undoes the last export operation');
  lines.push('set -e');
  lines.push('');
  lines.push(`# Export timestamp: ${new Date(manifest.timestamp).toISOString()}`);
  lines.push(`# Source root: ${manifest.sourceRoot}`);
  lines.push(`# Destination root: ${manifest.destinationRoot}`);
  lines.push(`# Ingested: ${manifest.ingested}`);
  lines.push('');

  // Color codes
  lines.push("RED='\\033[0;31m'");
  lines.push("GREEN='\\033[0;32m'");
  lines.push("YELLOW='\\033[1;33m'");
  lines.push("NC='\\033[0m' # No Color");
  lines.push('');

  lines.push('echo "${YELLOW}═══════════════════════════════════════════════════════════${NC}"');
  lines.push('echo "${YELLOW}       UNDO EXPORT - DRY RUN${NC}"');
  lines.push('echo "${YELLOW}═══════════════════════════════════════════════════════════${NC}"');
  lines.push('echo');
  lines.push('echo "${YELLOW}This will delete ' + manifest.operations.length + ' files created by the export.${NC}"');
  lines.push('echo "${RED}WARNING: This operation cannot be undone!${NC}"');
  lines.push('echo');

  // Preview files to be deleted
  lines.push('echo "${YELLOW}Files to be deleted:${NC}"');
  manifest.operations.forEach((op, index) => {
    if (index < 10) {
      // Show first 10
      lines.push(`echo "  - ${op.destinationPath}"`);
    }
  });
  if (manifest.operations.length > 10) {
    lines.push(`echo "  ... and ${manifest.operations.length - 10} more files"`);
  }
  lines.push('echo');

  // Confirmation
  lines.push(
    'read -r -p "${YELLOW}Type \\"DELETE\\" to confirm deletion (or press Ctrl+C to abort):${NC} " confirm',
  );
  lines.push('if [ "$confirm" != "DELETE" ]; then');
  lines.push('  echo "${RED}Aborted - no files were deleted.${NC}"');
  lines.push('  exit 0');
  lines.push('fi');
  lines.push('');

  lines.push('echo "${GREEN}Starting undo operation...${NC}"');
  lines.push('');

  // Delete files with size validation
  let deleteCount = 0;
  manifest.operations.forEach(op => {
    lines.push('# Delete: ' + op.destinationPath);
    lines.push('if [ -f "' + op.destinationPath + '" ]; then');

    // Validate file size if available
    if (op.fileSize > 0) {
      lines.push('  FILE_SIZE=$(stat -f%z "' + op.destinationPath + '" 2>/dev/null || stat -c%s "' + op.destinationPath + '" 2>/dev/null || echo "0")');
      lines.push('  if [ "$FILE_SIZE" -eq "' + op.fileSize + '" ]; then');
      lines.push('    rm "' + op.destinationPath + '"');
      lines.push('    echo "${GREEN}✓ Deleted: ' + op.destinationPath + '${NC}"');
      lines.push('  else');
      lines.push('    echo "${RED}✗ Skipped (size mismatch): ' + op.destinationPath + '${NC}"');
      lines.push('  fi');
    } else {
      // No size validation available - delete anyway
      lines.push('  rm "' + op.destinationPath + '"');
      lines.push('  echo "${GREEN}✓ Deleted: ' + op.destinationPath + '${NC}"');
    }

    lines.push('else');
    lines.push('  echo "${YELLOW}⚠ File not found: ' + op.destinationPath + '${NC}"');
    lines.push('fi');
    lines.push('');

    deleteCount++;
  });

  // Clean up empty directories
  lines.push('echo');
  lines.push('echo "${YELLOW}Cleaning up empty directories...${NC}"');

  // Get unique directory paths
  const uniqueDirs = new Set<string>();
  manifest.operations.forEach(op => {
    const dirPath = op.destinationPath.substring(0, op.destinationPath.lastIndexOf('/'));
    uniqueDirs.add(dirPath);
  });

  Array.from(uniqueDirs)
    .sort()
    .reverse()
    .forEach(dir => {
      lines.push('if [ -d "' + dir + '" ] && [ -z "$(ls -A "' + dir + '")" ]; then');
      lines.push('  rmdir "' + dir + '"');
      lines.push('  echo "${GREEN}✓ Removed empty directory: ' + dir + '${NC}"');
      lines.push('fi');
    });

  lines.push('');
  lines.push('echo');
  lines.push('echo "${GREEN}═══════════════════════════════════════════════════════════${NC}"');
  lines.push('echo "${GREEN}✓ Undo operation complete!${NC}"');
  lines.push('echo "${GREEN}═══════════════════════════════════════════════════════════${NC}"');

  return lines.join('\n');
}

/**
 * Determines if a photo should be included in the export.
 * Same logic as in useExportScript.
 */
function determineIfShouldExport(
  photo: ProjectPhoto,
  archiveFolder: string,
  dayLabels: Record<number, string>,
  daysFolder: string,
  bucketNames: Record<string, string>,
): boolean {
  const hasBeenRenamed = photo.originalName !== photo.currentName;
  const hasUserAssignedBucket = photo.bucket && !photo.isPreOrganized;
  const hasUserAssignedDay = photo.day !== null && photo.day !== photo.detectedDay;
  const wasArchived = photo.archived && !photo.filePath?.includes(archiveFolder);

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

  return hasBeenRenamed || hasUserAssignedBucket || hasUserAssignedDay || wasArchived || needsToMove;
}

/**
 * Saves the export manifest to localStorage or project metadata.
 */
export function saveExportManifest(projectId: string, manifest: ExportManifest): void {
  try {
    const key = `narrative:exportManifest:${projectId}`;
    localStorage.setItem(key, JSON.stringify(manifest));
  } catch (e) {
    console.error('Failed to save export manifest:', e);
  }
}

/**
 * Loads the last export manifest for a project.
 */
export function loadExportManifest(projectId: string): ExportManifest | null {
  try {
    const key = `narrative:exportManifest:${projectId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ExportManifest;
  } catch (e) {
    console.error('Failed to load export manifest:', e);
    return null;
  }
}

/**
 * Clears the export manifest after undo.
 */
export function clearExportManifest(projectId: string): void {
  try {
    const key = `narrative:exportManifest:${projectId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to clear export manifest:', e);
  }
}
