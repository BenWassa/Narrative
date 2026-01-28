import { useCallback, useState } from 'react';

import type { ProjectPhoto, ProjectSettings, ProjectState, ExportManifest } from '../services/projectService';
import {
  resolveSourceRoot,
  resolveDestinationRoot,
  resolveMeceBucketPath,
} from '../utils/pathResolver';
import {
  generateExportManifest,
  generateUndoScript,
  saveExportManifest,
  loadExportManifest,
  clearExportManifest,
} from '../utils/exportManifest';

export type ExportCopyStatus = 'idle' | 'copied' | 'failed';

interface UseExportScriptOptions {
  photos: ProjectPhoto[];
  dayLabels: Record<number, string>;
  projectSettings: ProjectSettings;
  projectRootPath?: string;
  // NEW: Optional ingest state for enhanced path resolution
  ingested?: boolean;
  sourceRoot?: string;
}

export function useExportScript(
  photos: ProjectPhoto[],
  dayLabels: Record<number, string>,
  projectSettings: ProjectSettings,
  projectRootPath?: string,
  ingested?: boolean,
  sourceRoot?: string,
) {
  const [showExportScript, setShowExportScript] = useState(false);
  const [exportScriptText, setExportScriptText] = useState('');
  const [exportCopyStatus, setExportCopyStatus] = useState<ExportCopyStatus>('idle');
  const [customProjectPath, setCustomProjectPath] = useState<string>('');
  const [lastExportManifest, setLastExportManifest] = useState<ExportManifest | null>(null);
  const [showUndoScript, setShowUndoScript] = useState(false);
  const [undoScriptText, setUndoScriptText] = useState('');

  const buildExportScript = useCallback(
    (overrideProjectPath?: string) => {
      const lines: string[] = [];

      const daysFolder = projectSettings.folderStructure.daysFolder;
      const archiveFolder = projectSettings.folderStructure.archiveFolder;

      // Build a minimal ProjectState for path resolution
      const projectState: Partial<ProjectState> = {
        rootPath: projectRootPath || '',
        settings: projectSettings,
        dayLabels: dayLabels,
        ingested: ingested,
        sourceRoot: sourceRoot,
      };

      // Resolve source and destination using path resolver
      const computedSourceRoot = resolveSourceRoot(projectState as ProjectState, photos);
      const isIngested = ingested !== false; // Default to true for backward compatibility

      // Use override or custom path if provided
      let detectedProjectRoot = overrideProjectPath || customProjectPath || computedSourceRoot;

      // Bucket name mapping for folder naming
      const bucketNames: Record<string, string> = {
        A: 'Establishing',
        B: 'People',
        C: 'Culture-Detail',
        D: 'Action-Moment',
        E: 'Transition',
        M: 'Mood-Food',
      };

      // Group photos by day and bucket - ONLY INCLUDE MODIFIED PHOTOS
      // This ensures we only touch files that have been changed, not existing organized photos
      const photosByDay: Record<number, Record<string, ProjectPhoto[]>> = {};
      const archivePhotos: ProjectPhoto[] = [];
      const rootPhotos: ProjectPhoto[] = [];

      photos.forEach(p => {
        // Determine if this photo has been modified/needs to be moved
        const hasBeenRenamed = p.originalName !== p.currentName;
        const hasUserAssignedBucket = p.bucket && !p.isPreOrganized;
        const hasUserAssignedDay = p.day !== null && p.day !== p.detectedDay;
        const wasArchived = p.archived && !p.filePath?.includes(archiveFolder);

        // Calculate target path for organized photos
        let needsToMove = false;
        if (p.bucket && p.day !== null) {
          const dayLabel = dayLabels[p.day] || `Day ${String(p.day).padStart(2, '0')}`;
          const bucketLabel = bucketNames[p.bucket] || p.bucket;
          const targetPath = `${daysFolder}/${dayLabel}/${p.bucket}_${bucketLabel}/${p.currentName}`;
          needsToMove = p.filePath !== targetPath && !p.filePath?.includes(targetPath);
        } else if (p.archived) {
          const targetPath = `${archiveFolder}/${p.currentName}`;
          needsToMove = p.filePath !== targetPath && !p.filePath?.includes(targetPath);
        }

        // Only include photos that have been modified or need to move
        const shouldExport =
          hasBeenRenamed ||
          hasUserAssignedBucket ||
          hasUserAssignedDay ||
          wasArchived ||
          needsToMove;

        if (!shouldExport) {
          return; // Skip this photo - it's already in the right place
        }

        if (p.archived) {
          archivePhotos.push(p);
        } else if (p.bucket) {
          const day = p.day as number;
          if (!photosByDay[day]) {
            photosByDay[day] = {};
          }
          if (!photosByDay[day][p.bucket]) {
            photosByDay[day][p.bucket] = [];
          }
          photosByDay[day][p.bucket].push(p);
        } else {
          rootPhotos.push(p);
        }
      });

      // Header: show a preview and require confirmation before executing
      lines.push('#!/bin/bash');
      lines.push('# Narrative Export Script - Ingest-Aware Export');
      lines.push('# This script organizes your photos based on ingest state');
      lines.push('set -e');
      lines.push('');
      lines.push(`# Ingest mode: ${isIngested ? 'INGESTED (photos in project)' : 'NOT INGESTED (organize in-place)'}`);
      lines.push('');
      lines.push(
        `# Export script with dry-run first, then safe execution with preview and confirmation.`,
      );
      lines.push(
        `# NOTE: Only modified/newly organized photos are included - existing organized files are left untouched.`,
      );
      lines.push('');

      // Prompt for project path first if not provided
      if (detectedProjectRoot) {
        lines.push(`# Where should organized photos be saved?`);
        lines.push(`read -r -p "Destination folder [${detectedProjectRoot}]: " USER_PROJECT_ROOT`);
        lines.push(`PROJECT_ROOT="\${USER_PROJECT_ROOT:-${detectedProjectRoot}}"`);
      } else {
        lines.push(`# Where should organized photos be saved?`);
        lines.push(`read -r -p "Destination folder: " PROJECT_ROOT`);
        lines.push('if [ -z "$PROJECT_ROOT" ]; then');
        lines.push('  echo "Error: Destination folder is required"');
        lines.push('  exit 1');
        lines.push('fi');
      }
      lines.push('');

      // Strip quotes if user included them
      lines.push('# Remove quotes if present');
      lines.push('PROJECT_ROOT="${PROJECT_ROOT//\\\'/}"');
      lines.push('PROJECT_ROOT="${PROJECT_ROOT//\\"/}"');
      lines.push('');

      // Create destination if it doesn't exist
      lines.push('# Create destination folder if needed');
      lines.push('mkdir -p "$PROJECT_ROOT"');
      lines.push('');
      lines.push(`DAYS_FOLDER="${daysFolder}"`);
      lines.push(`ARCHIVE_FOLDER="${archiveFolder}"`);
      
      // For ingested projects, days go inside PROJECT_ROOT
      // For non-ingested, MECE folders go directly in source folders
      if (isIngested) {
        lines.push('TARGET_DAYS_DIR="${PROJECT_ROOT}/${DAYS_FOLDER}"');
        lines.push('TARGET_ARCHIVE_DIR="${PROJECT_ROOT}/${ARCHIVE_FOLDER}"');
      } else {
        lines.push('# Non-ingested mode: MECE folders created in source location');
        lines.push('TARGET_DAYS_DIR="${PROJECT_ROOT}"');
        lines.push('TARGET_ARCHIVE_DIR="${PROJECT_ROOT}/${ARCHIVE_FOLDER}"');
      }
      
      lines.push('');
      lines.push('# Color codes for output');
      lines.push("RED='\\033[0;31m'");
      lines.push("GREEN='\\033[0;32m'");
      lines.push("YELLOW='\\033[1;33m'");
      lines.push("BLUE='\\033[0;34m'");
      lines.push("NC='\\033[0m' # No Color");
      lines.push('');
      lines.push('echo "${BLUE}═══════════════════════════════════════════════════════════${NC}"');
      lines.push('echo "${BLUE}       EXPORT SCRIPT - DRY RUN PREVIEW${NC}"');
      lines.push('echo "${BLUE}═══════════════════════════════════════════════════════════${NC}"');
      lines.push('echo');
      lines.push('echo "${YELLOW}Project root:${NC} ${PROJECT_ROOT}"');
      lines.push('echo "${YELLOW}Target days folder:${NC} ${TARGET_DAYS_DIR}"');
      lines.push('echo "${YELLOW}Target archive folder:${NC} ${TARGET_ARCHIVE_DIR}"');
      lines.push('echo');
      lines.push('echo "${GREEN}This is a DRY RUN - no files will be copied yet.${NC}"');
      lines.push('echo "${GREEN}You will be asked to confirm before any files are moved.${NC}"');
      lines.push('echo');

      // Preview: root files
      if (rootPhotos.length > 0) {
        lines.push('echo "${YELLOW}Root files (${NC}' + rootPhotos.length + '):${NC}"');
        rootPhotos.forEach(p => {
          if (p.filePath) {
            lines.push(`echo "  cp \"\${PROJECT_ROOT}/${p.filePath}\" → \"${p.currentName}\""`);
          }
        });
        lines.push('');
      }

      // Count total files for summary
      let totalFiles = rootPhotos.length + archivePhotos.length;
      Object.keys(photosByDay).forEach(day => {
        Object.keys(photosByDay[parseInt(day)]).forEach(bucket => {
          totalFiles += photosByDay[parseInt(day)][bucket].length;
        });
      });

      lines.push('echo "${YELLOW}Days with organized photos:${NC}"');
      // Preview: days with bucket subfolders
      Object.keys(photosByDay)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(day => {
          const label = dayLabels[day] || `Day ${String(day).padStart(2, '0')}`;
          const buckets = photosByDay[day];
          const dayPhotosCount = Object.values(buckets).reduce(
            (sum, bucket) => sum + bucket.length,
            0,
          );

          lines.push(`echo "  ${label} (${dayPhotosCount} photos)"`);

          Object.keys(buckets)
            .sort()
            .forEach(bucket => {
              const bucketLabel = bucketNames[bucket] || bucket;
              const bucketPhotos = buckets[bucket];

              lines.push(`echo "    ├─ ${bucket}_${bucketLabel} (${bucketPhotos.length})"`);
            });
        });

      // Preview: archive
      if (archivePhotos.length > 0) {
        lines.push('echo "  ${YELLOW}Archive (' + archivePhotos.length + ')${NC}"');
      }

      lines.push('');
      lines.push('echo "${YELLOW}Total files to copy:${NC} ' + totalFiles + '"');
      lines.push('echo');
      lines.push(
        'echo "${YELLOW}═══════════════════════════════════════════════════════════${NC}"',
      );
      lines.push('echo "${YELLOW}Ready to proceed?${NC}"');
      lines.push('echo "${RED}WARNING: This will copy files to your project directory.${NC}"');
      lines.push(
        'echo "${YELLOW}═══════════════════════════════════════════════════════════${NC}"',
      );
      lines.push('echo');
      lines.push(
        'read -r -p "${YELLOW}Type \\"yes\\" to confirm and copy files (or press Ctrl+C to abort):${NC} " confirm',
      );
      lines.push('if [ "$confirm" != "yes" ]; then');
      lines.push('  echo "${RED}Aborted - no files were copied.${NC}"');
      lines.push('  exit 0');
      lines.push('fi');
      lines.push('');
      lines.push('echo "${GREEN}═══════════════════════════════════════════════════════════${NC}"');
      lines.push('echo "${GREEN}Starting file copy operation...${NC}"');
      lines.push('echo "${GREEN}═══════════════════════════════════════════════════════════${NC}"');
      lines.push('echo');

      if (rootPhotos.length > 0) {
        rootPhotos.forEach(p => {
          if (p.filePath) {
            lines.push(
              `if [ -e "${p.currentName}" ]; then echo "Skipping existing: ${p.currentName}"; else cp "\${PROJECT_ROOT}/${p.filePath}" "${p.currentName}"; fi`,
            );
          }
        });
        lines.push('');
      }

      // Execution: create day folders with bucket subfolders and copy files
      if (isIngested) {
        lines.push('# Ingested mode: create day folders with MECE buckets inside');
        lines.push('mkdir -p "${TARGET_DAYS_DIR}"');
      }
      
      Object.keys(photosByDay)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(day => {
          const label = dayLabels[day] || `Day ${String(day).padStart(2, '0')}`;
          const buckets = photosByDay[day];

          Object.keys(buckets)
            .sort()
            .forEach(bucket => {
              const bucketLabel = bucketNames[bucket] || bucket;
              let bucketFolder: string;
              
              if (isIngested) {
                // Ingested: buckets inside day folder
                bucketFolder = `${daysFolder}/${label}/${bucket}_${bucketLabel}`;
              } else {
                // Non-ingested: buckets in source location
                bucketFolder = `${bucket}_${bucketLabel}`;
              }
              
              const photos = buckets[bucket];

              lines.push(`mkdir -p "${bucketFolder}"`);

              photos.forEach(p => {
                if (p.filePath) {
                  lines.push(
                    `if [ -e "${bucketFolder}/${p.currentName}" ]; then echo "Skipping existing: ${bucketFolder}/${p.currentName}"; else cp "\${PROJECT_ROOT}/${p.filePath}" "${bucketFolder}/${p.currentName}"; fi`,
                  );
                }
              });
            });
        });

      // Execution: archive
      if (archivePhotos.length > 0) {
        lines.push('mkdir -p "${TARGET_ARCHIVE_DIR}"');
        archivePhotos.forEach(p => {
          if (p.filePath) {
            lines.push(
              `if [ -e "${TARGET_ARCHIVE_DIR}/${p.currentName}" ]; then echo "Skipping existing: ${TARGET_ARCHIVE_DIR}/${p.currentName}"; else cp "\${PROJECT_ROOT}/${p.filePath}" "${TARGET_ARCHIVE_DIR}/${p.currentName}"; fi`,
            );
          }
        });
      }

      lines.push('');
      lines.push('echo "${GREEN}═══════════════════════════════════════════════════════════${NC}"');
      lines.push('echo "${GREEN}✓ Copy operation complete!${NC}"');
      lines.push('echo "${GREEN}═══════════════════════════════════════════════════════════${NC}"');

      return lines.join('\n');
    },
    [photos, dayLabels, projectSettings, projectRootPath, customProjectPath, ingested, sourceRoot],
  );

  const openExportScriptModal = useCallback(() => {
    const scriptText = buildExportScript();
    setExportScriptText(scriptText);
    setExportCopyStatus('idle');
    setShowExportScript(true);
  }, [buildExportScript]);

  const closeExportScriptModal = useCallback(() => {
    setShowExportScript(false);
  }, []);

  const downloadExportScript = useCallback(() => {
    const scriptText = exportScriptText || buildExportScript();

    // Create a blob with the script content
    const blob = new Blob([scriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'narrative-export.sh';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportScriptText, buildExportScript]);

  const copyExportScript = useCallback(async () => {
    const scriptText = exportScriptText || buildExportScript();
    if (!exportScriptText) {
      setExportScriptText(scriptText);
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(scriptText);
      setExportCopyStatus('copied');
    } catch {
      setExportCopyStatus('failed');
    }
  }, [exportScriptText, buildExportScript]);

  const resetExportCopyStatus = useCallback(() => {
    setExportCopyStatus('idle');
  }, []);

  const regenerateScript = useCallback(
    (newProjectPath: string) => {
      setCustomProjectPath(newProjectPath);
      const scriptText = buildExportScript(newProjectPath);
      setExportScriptText(scriptText);
    },
    [buildExportScript],
  );

  const getDetectedProjectPath = useCallback(() => {
    if (customProjectPath) return customProjectPath;

    const samplePhoto = photos.find(p => p.filePath);
    if (samplePhoto?.filePath && samplePhoto.folderHierarchy) {
      const relativePath = samplePhoto.folderHierarchy.join('/');
      const fullPath = samplePhoto.filePath;

      if (relativePath && fullPath.includes(relativePath)) {
        const relativeIndex = fullPath.lastIndexOf(relativePath);
        if (relativeIndex > 0) {
          return fullPath.substring(0, relativeIndex - 1);
        }
      }
    }

    if (samplePhoto?.filePath) {
      const parts = samplePhoto.filePath.split('/');
      if (parts.length > 3) {
        return parts.slice(0, -2).join('/');
      }
    }

    return '';
  }, [photos, customProjectPath]);

  // Generate and save export manifest
  const generateManifest = useCallback(async () => {
    if (!projectRootPath) return;

    const projectState: Partial<ProjectState> = {
      rootPath: projectRootPath,
      settings: projectSettings,
      dayLabels: dayLabels,
      ingested: ingested,
      sourceRoot: sourceRoot,
    };

    const computedSourceRoot = resolveSourceRoot(projectState as ProjectState, photos);
    const computedDestRoot = resolveDestinationRoot(projectState as ProjectState, photos);

    const manifest = await generateExportManifest(
      photos,
      computedSourceRoot,
      computedDestRoot,
      ingested !== false,
      dayLabels,
      projectSettings,
    );

    setLastExportManifest(manifest);
    saveExportManifest(projectRootPath, manifest);
    return manifest;
  }, [photos, dayLabels, projectSettings, projectRootPath, ingested, sourceRoot]);

  // Open undo script modal
  const openUndoScriptModal = useCallback(() => {
    if (!projectRootPath) return;

    // Try to load existing manifest
    const manifest = loadExportManifest(projectRootPath);
    if (!manifest) {
      console.warn('No export manifest found for this project');
      return;
    }

    const script = generateUndoScript(manifest);
    setUndoScriptText(script);
    setShowUndoScript(true);
  }, [projectRootPath]);

  const closeUndoScriptModal = useCallback(() => {
    setShowUndoScript(false);
  }, []);

  const downloadUndoScript = useCallback(() => {
    if (!undoScriptText) return;

    const blob = new Blob([undoScriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'narrative-undo-export.sh';
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [undoScriptText]);

  const hasExportManifest = useCallback(() => {
    if (!projectRootPath) return false;
    const manifest = loadExportManifest(projectRootPath);
    return manifest !== null;
  }, [projectRootPath]);

  return {
    showExportScript,
    exportScriptText,
    exportCopyStatus,
    buildExportScript,
    openExportScriptModal,
    closeExportScriptModal,
    copyExportScript,
    downloadExportScript,
    resetExportCopyStatus,
    regenerateScript,
    getDetectedProjectPath,
    // NEW: Undo functionality
    showUndoScript,
    undoScriptText,
    openUndoScriptModal,
    closeUndoScriptModal,
    downloadUndoScript,
    generateManifest,
    hasExportManifest,
  };
}
