import { useCallback, useState, useEffect } from 'react';

import type {
  ProjectPhoto,
  ProjectSettings,
  ProjectState,
  ExportManifest,
} from '../services/projectService';
import {
  resolveSourceRoot,
  resolveDestinationRoot,
  resolveMeceBucketPath,
} from '../utils/pathResolver';
import { BUCKET_LABELS } from '../constants/meceBuckets';
import {
  generateExportManifest,
  generateUndoScript,
  saveExportManifest,
  loadExportManifest,
  clearExportManifest,
} from '../utils/exportManifest';
import { buildOperationPlan, type OperationPlan } from '../utils/buildOperationPlan';

export type ExportCopyStatus = 'idle' | 'copied' | 'failed';
export type ExportStructureMode = 'auto' | 'single_day_flat' | 'multi_day_nested';

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
  const [exportStructureMode, setExportStructureMode] = useState<ExportStructureMode>('auto');
  const [lastExportManifest, setLastExportManifest] = useState<ExportManifest | null>(null);
  const [showUndoScript, setShowUndoScript] = useState(false);
  const [undoScriptText, setUndoScriptText] = useState('');

  // Initialize manifest from localStorage on mount
  useEffect(() => {
    if (projectRootPath) {
      const manifest = loadExportManifest(projectRootPath);
      setLastExportManifest(manifest);
    }
  }, [projectRootPath]);

  const buildExportScript = useCallback(
    (options?: { overrideProjectPath?: string; overrideStructureMode?: ExportStructureMode }) => {
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
      const overrideProjectPath = options?.overrideProjectPath;
      const overrideStructureMode = options?.overrideStructureMode;
      const selectedStructureMode = overrideStructureMode || exportStructureMode;
      let detectedProjectRoot = overrideProjectPath || customProjectPath || computedSourceRoot;

      // Bucket name mapping for folder naming (from centralized definitions)
      const bucketNames: Record<string, string> = BUCKET_LABELS;

      // Build operation plan (single source of truth for file operations)
      const plan: OperationPlan = buildOperationPlan({
        photos,
        dayLabels,
        projectSettings,
        ingested: isIngested,
        sourceRoot: sourceRoot,
        structureMode: selectedStructureMode,
      });

      const resolvedStructureMode = plan.resolvedStructureMode;
      const useSingleDayFlat = resolvedStructureMode === 'single_day_flat';
      const flatArchiveFolder = 'Z_ARCHIVE';

      // Group operations by day and bucket for script generation
      const photosByDay: Record<number, Record<string, ProjectPhoto[]>> = {};
      const archivePhotos: ProjectPhoto[] = [];
      const rootPhotos: ProjectPhoto[] = [];

      for (const operation of plan.operations) {
        const p = operation.photo;
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
      }

      const activeDayKeys = Object.keys(photosByDay)
        .map(Number)
        .filter(day => !Number.isNaN(day));

      const photosByBucket: Record<string, ProjectPhoto[]> = {};
      Object.values(photosByDay).forEach(dayBuckets => {
        Object.entries(dayBuckets).forEach(([bucket, bucketPhotos]) => {
          if (!photosByBucket[bucket]) {
            photosByBucket[bucket] = [];
          }
          photosByBucket[bucket].push(...bucketPhotos);
        });
      });

      // Header: show a preview and require confirmation before executing
      lines.push('#!/bin/bash');
      lines.push('# Narrative Export Script - Ingest-Aware Export');
      lines.push('# This script organizes your photos based on ingest state');
      lines.push('set -e');
      lines.push('');
      lines.push(
        `# Ingest mode: ${
          isIngested ? 'INGESTED (photos in project)' : 'NOT INGESTED (organize in-place)'
        }`,
      );
      lines.push(
        `# Structure mode: ${
          resolvedStructureMode === 'single_day_flat'
            ? 'SINGLE DAY FLAT (root bucket folders)'
            : 'MULTI DAY NESTED (day folders + bucket subfolders)'
        }`,
      );
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
      lines.push(`ARCHIVE_FOLDER="${useSingleDayFlat ? flatArchiveFolder : archiveFolder}"`);

      // For ingested projects, days go inside PROJECT_ROOT
      // For non-ingested, MECE folders go directly in source folders
      if (useSingleDayFlat) {
        lines.push('# Single-day flat mode: bucket folders created directly at project root');
        lines.push('TARGET_ARCHIVE_DIR="${PROJECT_ROOT}/${ARCHIVE_FOLDER}"');
      } else if (isIngested) {
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
      lines.push("CYAN='\\033[0;36m'");
      lines.push("BOLD='\\033[1m'");
      lines.push("NC='\\033[0m' # No Color");
      lines.push('');
      lines.push('# Print section header');
      lines.push('print_section() {');
      lines.push('  local title="$1"');
      lines.push(
        '  local line="${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"',
      );
      lines.push('  echo -e ""; echo -e "$line"; echo -e "$title"; echo -e "$line"');
      lines.push('}');
      lines.push('');
      lines.push('print_section "${CYAN}${BOLD}📋 EXPORT PREVIEW${NC}"');
      lines.push('');
      lines.push('echo -e "${YELLOW}Project root:${NC}"');
      lines.push('echo -e "  ${CYAN}${PROJECT_ROOT}${NC}"');
      lines.push('echo ""');
      lines.push('echo -e "${YELLOW}Destination folders:${NC}"');
      if (useSingleDayFlat) {
        lines.push('echo -e "  Bucket folders: ${CYAN}${PROJECT_ROOT}/{A..E,M}_*${NC}"');
      } else {
        lines.push('echo -e "  Days folder:  ${CYAN}${TARGET_DAYS_DIR}${NC}"');
      }
      if (archivePhotos.length > 0) {
        lines.push('echo -e "  Archive:      ${CYAN}${TARGET_ARCHIVE_DIR}${NC}"');
      }
      lines.push('echo ""');
      lines.push(
        'echo -e "${GREEN}${BOLD}ℹ️  This is a DRY RUN${NC} - no files will be copied yet."',
      );
      lines.push('echo -e "${GREEN}You will be asked to confirm before any files are moved.${NC}"');
      lines.push('');

      // Preview: root files
      if (rootPhotos.length > 0) {
        lines.push('echo -e "${YELLOW}${BOLD}📁 Root Files${NC} (' + rootPhotos.length + ')"');
        lines.push('echo ""');
        rootPhotos.forEach(p => {
          if (p.filePath) {
            lines.push('echo -e "  ${CYAN}→${NC} ' + p.currentName + '"');
          }
        });
        lines.push('echo ""');
      }

      // Count total files for summary
      let totalFiles = rootPhotos.length + archivePhotos.length;
      Object.keys(photosByDay).forEach(day => {
        Object.keys(photosByDay[parseInt(day)]).forEach(bucket => {
          totalFiles += photosByDay[parseInt(day)][bucket].length;
        });
      });

      if (useSingleDayFlat) {
        lines.push('echo -e "${YELLOW}${BOLD}🗂️ Organized Photos by Bucket${NC}"');
        lines.push('echo ""');
        Object.keys(photosByBucket)
          .sort()
          .forEach(bucket => {
            const bucketLabel = bucketNames[bucket] || bucket;
            const bucketFolderName = `${bucket}_${bucketLabel}`;
            lines.push(
              'echo -e "  ${CYAN}' +
                bucketFolderName +
                '${NC} (${BOLD}' +
                photosByBucket[bucket].length +
                '${NC})"',
            );
          });
        lines.push('echo ""');
      } else {
        lines.push('echo -e "${YELLOW}${BOLD}📅 Organized Photos by Day${NC}"');
        lines.push('echo ""');
        // Preview: days with bucket subfolders and folder structure
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

            // Show day folder
            if (isIngested) {
              lines.push(
                'echo -e "  ${CYAN}' +
                  daysFolder +
                  '/' +
                  label +
                  '${NC} — ${BOLD}' +
                  dayPhotosCount +
                  '${NC} photos"',
              );
            } else {
              lines.push(
                'echo -e "  ${CYAN}' + label + '${NC} — ${BOLD}' + dayPhotosCount + '${NC} photos"',
              );
            }

            // Group buckets by subfolder if present
            const photosBySubfolder: Record<string, Record<string, ProjectPhoto[]>> = {};
            Object.entries(buckets).forEach(([bucket, photos]) => {
              photos.forEach(p => {
                // Extract subfolder from filePath
                // filePath format: 01_DAYS/Day 02/[subfolder]/A_Establishing/filename.jpg
                let subfolder = 'root';
                if (p.filePath) {
                  const pathParts = p.filePath.split(/[\\/]/).filter(Boolean);
                  // Find the index of the day label in the path
                  const dayIdx = pathParts.findIndex(part => part === label);
                  // If there's a folder between the day and bucket, it's a subfolder
                  if (dayIdx !== -1 && dayIdx < pathParts.length - 1) {
                    const nextPart = pathParts[dayIdx + 1];
                    // Check if next part is NOT a bucket folder
                    if (nextPart && !nextPart.match(/^[A-E]_|^M_/)) {
                      subfolder = nextPart;
                    }
                  }
                }
                if (!photosBySubfolder[subfolder]) {
                  photosBySubfolder[subfolder] = {};
                }
                if (!photosBySubfolder[subfolder][bucket]) {
                  photosBySubfolder[subfolder][bucket] = [];
                }
                photosBySubfolder[subfolder][bucket].push(p);
              });
            });

            // Display subfolders and their buckets
            const subfolderEntries = Object.keys(photosBySubfolder).sort();
            subfolderEntries.forEach((subfolder, subfolderIdx) => {
              const isLastSubfolder = subfolderIdx === subfolderEntries.length - 1;
              const subfolderPrefix = isLastSubfolder ? '    └─' : '    ├─';

              // Only show subfolder name if it's not root
              if (subfolder !== 'root') {
                lines.push('echo -e "  ' + subfolderPrefix + ' ${CYAN}' + subfolder + '${NC}"');
              }

              const subfolderBuckets = photosBySubfolder[subfolder];
              const bucketEntries = Object.keys(subfolderBuckets).sort();
              bucketEntries.forEach((bucket, bucketIdx) => {
                const bucketLabel = bucketNames[bucket] || bucket;
                const bucketPhotos = subfolderBuckets[bucket];
                const isLastBucket = bucketIdx === bucketEntries.length - 1;

                // Adjust prefix based on subfolder level
                let bucketPrefix: string;
                if (subfolder !== 'root') {
                  bucketPrefix = isLastBucket ? '      └─' : '      ├─';
                } else {
                  bucketPrefix = isLastBucket ? '    └─' : '    ├─';
                }

                const bucketFolderName = bucket + '_' + bucketLabel;

                lines.push(
                  'echo -e "  ' +
                    bucketPrefix +
                    ' ${CYAN}' +
                    bucketFolderName +
                    '${NC} (${BOLD}' +
                    bucketPhotos.length +
                    '${NC})"',
                );
              });
            });
            lines.push('echo ""');
          });
      }

      // Preview: archive
      if (archivePhotos.length > 0) {
        lines.push('echo -e "${YELLOW}${BOLD}🗑️  Archive${NC} (' + archivePhotos.length + ')"');
        lines.push('echo ""');
      }

      lines.push('');
      lines.push('echo -e "${YELLOW}${BOLD}📊 Summary${NC}"');
      lines.push('echo -e "  Total files to copy: ${CYAN}${BOLD}' + totalFiles + '${NC}"');
      lines.push('echo ""');
      lines.push('echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"');
      lines.push('echo ""');
      lines.push(
        'echo -e "${RED}${BOLD}⚠️  WARNING:${NC} This will copy files to your project directory."',
      );
      lines.push('echo ""');
      lines.push(
        'echo -e "${YELLOW}${BOLD}Type ${NC}\\"${GREEN}yes${NC}\\"${YELLOW} to confirm (or press Ctrl+C to abort)${NC}"',
      );
      lines.push('read -r -p "Confirm: " confirm');
      lines.push('if [ "$confirm" != "yes" ]; then');
      lines.push('  echo ""');
      lines.push('  echo -e "${YELLOW}✗ Aborted${NC} - no files were copied."');
      lines.push('  echo ""');
      lines.push('  exit 0');
      lines.push('fi');
      lines.push('');
      lines.push('echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"');
      lines.push('echo -e "${GREEN}${BOLD}✓ Copying files...${NC}"');
      lines.push('echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"');
      lines.push('echo ""');

      if (rootPhotos.length > 0) {
        rootPhotos.forEach(p => {
          if (p.filePath) {
            lines.push(
              'if [ -e "${PROJECT_ROOT}/' +
                p.currentName +
                '" ]; then echo "Skipping existing: ' +
                p.currentName +
                '"; else cp "${PROJECT_ROOT}/' +
                p.filePath +
                '" "${PROJECT_ROOT}/' +
                p.currentName +
                '"; fi',
            );
          }
        });
        lines.push('');
      }

      if (useSingleDayFlat) {
        Object.keys(photosByBucket)
          .sort()
          .forEach(bucket => {
            const bucketLabel = bucketNames[bucket] || bucket;
            const bucketFolder = `${bucket}_${bucketLabel}`;
            lines.push('mkdir -p "${PROJECT_ROOT}/' + bucketFolder + '"');
            photosByBucket[bucket].forEach(p => {
              if (p.filePath) {
                lines.push(
                  'if [ -e "${PROJECT_ROOT}/' +
                    bucketFolder +
                    '/' +
                    p.currentName +
                    '" ]; then echo "Skipping existing: ' +
                    bucketFolder +
                    '/' +
                    p.currentName +
                    '"; else cp "${PROJECT_ROOT}/' +
                    p.filePath +
                    '" "${PROJECT_ROOT}/' +
                    bucketFolder +
                    '/' +
                    p.currentName +
                    '"; fi',
                );
              }
            });
          });
      } else {
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

            // For non-ingested mode, group by subfolder first
            if (!isIngested) {
              const photosBySubfolder: Record<string, Record<string, ProjectPhoto[]>> = {};
              Object.entries(buckets).forEach(([bucket, photos]) => {
                photos.forEach(p => {
                  // Extract subfolder from filePath
                  let subfolder = '';
                  if (p.filePath) {
                    const pathParts = p.filePath.split(/[\\/]/).filter(Boolean);
                    const dayIdx = pathParts.findIndex(part => part === label);
                    if (dayIdx !== -1 && dayIdx < pathParts.length - 1) {
                      const nextPart = pathParts[dayIdx + 1];
                      if (nextPart && !nextPart.match(/^[A-E]_|^M_/)) {
                        subfolder = nextPart;
                      }
                    }
                  }
                  if (!photosBySubfolder[subfolder]) {
                    photosBySubfolder[subfolder] = {};
                  }
                  if (!photosBySubfolder[subfolder][bucket]) {
                    photosBySubfolder[subfolder][bucket] = [];
                  }
                  photosBySubfolder[subfolder][bucket].push(p);
                });
              });

              // Create buckets within each subfolder
              Object.entries(photosBySubfolder).forEach(([subfolder, subfolderBuckets]) => {
                Object.entries(subfolderBuckets).forEach(([bucket, photos]) => {
                  const bucketLabel = bucketNames[bucket] || bucket;
                  let bucketFolder: string;
                  if (subfolder) {
                    bucketFolder = `${label}/${subfolder}/${bucket}_${bucketLabel}`;
                  } else {
                    bucketFolder = `${label}/${bucket}_${bucketLabel}`;
                  }

                  // Create folder and copy files
                  lines.push('mkdir -p "${PROJECT_ROOT}/' + bucketFolder + '"');
                  photos.forEach(p => {
                    if (p.filePath) {
                      lines.push(
                        'if [ -e "${PROJECT_ROOT}/' +
                          bucketFolder +
                          '/' +
                          p.currentName +
                          '" ]; then echo "Skipping existing: ' +
                          bucketFolder +
                          '/' +
                          p.currentName +
                          '"; else cp "${PROJECT_ROOT}/' +
                          p.filePath +
                          '" "${PROJECT_ROOT}/' +
                          bucketFolder +
                          '/' +
                          p.currentName +
                          '"; fi',
                      );
                    }
                  });
                });
              });
            } else {
              // Ingested mode: original logic
              Object.keys(buckets)
                .sort()
                .forEach(bucket => {
                  const bucketLabel = bucketNames[bucket] || bucket;
                  const bucketFolder = `${daysFolder}/${label}/${bucket}_${bucketLabel}`;
                  const photos = buckets[bucket];

                  lines.push('mkdir -p "${PROJECT_ROOT}/' + bucketFolder + '"');
                  photos.forEach(p => {
                    if (p.filePath) {
                      lines.push(
                        'if [ -e "${PROJECT_ROOT}/' +
                          bucketFolder +
                          '/' +
                          p.currentName +
                          '" ]; then echo "Skipping existing: ' +
                          bucketFolder +
                          '/' +
                          p.currentName +
                          '"; else mkdir -p "${PROJECT_ROOT}/' +
                          bucketFolder +
                          '" && cp "${PROJECT_ROOT}/' +
                          p.filePath +
                          '" "${PROJECT_ROOT}/' +
                          bucketFolder +
                          '/' +
                          p.currentName +
                          '"; fi',
                      );
                    }
                  });
                });
            }
          });
      }

      // Execution: archive
      if (archivePhotos.length > 0) {
        lines.push('mkdir -p "${TARGET_ARCHIVE_DIR}"');
        archivePhotos.forEach(p => {
          if (p.filePath) {
            lines.push(
              'if [ -e "${TARGET_ARCHIVE_DIR}/' +
                p.currentName +
                '" ]; then echo "Skipping existing: ${TARGET_ARCHIVE_DIR}/' +
                p.currentName +
                '"; else cp "${PROJECT_ROOT}/' +
                p.filePath +
                '" "${TARGET_ARCHIVE_DIR}/' +
                p.currentName +
                '" && echo "Copied: ' +
                p.currentName +
                '"; fi',
            );
          }
        });
      }

      lines.push('');
      lines.push('echo ""');
      lines.push('echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"');
      lines.push('echo -e "${GREEN}${BOLD}✨ Copy operation complete!${NC}"');
      lines.push('echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"');
      lines.push('echo ""');

      return lines.join('\n');
    },
    [
      photos,
      dayLabels,
      projectSettings,
      projectRootPath,
      customProjectPath,
      ingested,
      sourceRoot,
      exportStructureMode,
    ],
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
    (newProjectPath: string, newStructureMode?: ExportStructureMode) => {
      setCustomProjectPath(newProjectPath);
      if (newStructureMode) {
        setExportStructureMode(newStructureMode);
      }
      const scriptText = buildExportScript({
        overrideProjectPath: newProjectPath,
        overrideStructureMode: newStructureMode,
      });
      setExportScriptText(scriptText);
    },
    [buildExportScript],
  );

  const updateStructureMode = useCallback(
    (mode: ExportStructureMode) => {
      setExportStructureMode(mode);
      const scriptText = buildExportScript({
        overrideProjectPath: customProjectPath || undefined,
        overrideStructureMode: mode,
      });
      setExportScriptText(scriptText);
    },
    [buildExportScript, customProjectPath],
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
    return lastExportManifest !== null;
  }, [lastExportManifest]);

  // Refresh manifest from localStorage (called after direct processing completes)
  const refreshManifest = useCallback(() => {
    if (projectRootPath) {
      const manifest = loadExportManifest(projectRootPath);
      setLastExportManifest(manifest);
    }
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
    exportStructureMode,
    updateStructureMode,
    getDetectedProjectPath,
    // NEW: Undo functionality
    showUndoScript,
    undoScriptText,
    openUndoScriptModal,
    closeUndoScriptModal,
    downloadUndoScript,
    generateManifest,
    hasExportManifest,
    refreshManifest,
  };
}
