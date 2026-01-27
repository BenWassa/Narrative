import { useCallback, useState } from 'react';

import type { ProjectPhoto, ProjectSettings } from '../services/projectService';

export type ExportCopyStatus = 'idle' | 'copied' | 'failed';

export function useExportScript(
  photos: ProjectPhoto[],
  dayLabels: Record<number, string>,
  projectSettings: ProjectSettings,
) {
  const [showExportScript, setShowExportScript] = useState(false);
  const [exportScriptText, setExportScriptText] = useState('');
  const [exportCopyStatus, setExportCopyStatus] = useState<ExportCopyStatus>('idle');

  const buildExportScript = useCallback(() => {
    const lines: string[] = [];

    // Bucket name mapping for folder naming
    const bucketNames: Record<string, string> = {
      A: 'Establishing',
      B: 'People',
      C: 'Culture-Detail',
      D: 'Action-Moment',
      E: 'Transition',
      M: 'Mood-Food',
    };

    // Group photos by day and bucket
    const photosByDay: Record<number, Record<string, ProjectPhoto[]>> = {};
    const archivePhotos: ProjectPhoto[] = [];
    const rootPhotos: ProjectPhoto[] = [];

    photos.forEach(p => {
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

    const daysFolder = projectSettings.folderStructure.daysFolder;
    const archiveFolder = projectSettings.folderStructure.archiveFolder;

    // Header: show a preview and require confirmation before executing
    lines.push('#!/usr/bin/env bash');
    lines.push('set -e');
    lines.push('');
    lines.push(
      `# Export script with dry-run first, then safe execution with preview and confirmation.`,
    );
    lines.push(`# Usage: Paste this script into terminal (after cd\'ing to your project root)`);
    lines.push(
      `# It will show a preview first, then ask for confirmation before copying any files.`,
    );
    lines.push('');
    lines.push(`DAYS_FOLDER="${daysFolder}"`);
    lines.push(`ARCHIVE_FOLDER="${archiveFolder}"`);
    lines.push('CURRENT_DIR="$(pwd)"');
    lines.push('TARGET_DAYS_DIR="${CURRENT_DIR}/${DAYS_FOLDER}"');
    lines.push('TARGET_ARCHIVE_DIR="${CURRENT_DIR}/${ARCHIVE_FOLDER}"');
    lines.push('');
    lines.push('# Color codes for output');
    lines.push("RED='\\033[0;31m'");
    lines.push("GREEN='\\033[0;32m'");
    lines.push("YELLOW='\\033[1;33m'");
    lines.push("BLUE='\\033[0;34m'");
    lines.push("NC='\\033[0m' # No Color");
    lines.push('');
    lines.push(
      'echo "\\${BLUE}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo "\\${BLUE}       EXPORT SCRIPT - DRY RUN PREVIEW\\${NC}"');
    lines.push(
      'echo "\\${BLUE}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo');
    lines.push('echo "\\${YELLOW}Current directory:\\${NC} \\${CURRENT_DIR}"');
    lines.push('echo "\\${YELLOW}Target days folder:\\${NC} \\${TARGET_DAYS_DIR}"');
    lines.push('echo "\\${YELLOW}Target archive folder:\\${NC} \\${TARGET_ARCHIVE_DIR}"');
    lines.push('echo');
    lines.push('echo "\\${GREEN}This is a DRY RUN - no files will be copied yet.\\${NC}"');
    lines.push('echo "\\${GREEN}You will be asked to confirm before any files are moved.\\${NC}"');
    lines.push('echo');

    // Preview: root files
    if (rootPhotos.length > 0) {
      lines.push('echo "\\${YELLOW}Root files (\\${NC}' + rootPhotos.length + '):\\${NC}"');
      rootPhotos.forEach(p => {
        if (p.filePath) {
          lines.push(`echo "  cp \\"${p.filePath}\\" → \\"${p.currentName}\\""`);
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

    lines.push('echo "\\${YELLOW}Days with organized photos:\\${NC}"');
    // Preview: days with bucket subfolders
    Object.keys(photosByDay)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(day => {
        const label = dayLabels[day] || `Day ${String(day).padStart(2, '0')}`;
        const dayFolder = `${daysFolder}/${label}`;
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
            const bucketFolder = `${dayFolder}/${bucket}_${bucketLabel}`;
            const bucketPhotos = buckets[bucket];

            lines.push(`echo "    ├─ ${bucket}_${bucketLabel} (${bucketPhotos.length})"`);
          });
      });

    // Preview: archive
    if (archivePhotos.length > 0) {
      lines.push('echo "  \\${YELLOW}Archive (' + archivePhotos.length + ')\\${NC}"');
    }

    lines.push('');
    lines.push('echo "\\${YELLOW}Total files to copy:\\${NC} ' + totalFiles + '"');
    lines.push('echo');
    lines.push(
      'echo "\\${YELLOW}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo "\\${YELLOW}Ready to proceed?\\${NC}"');
    lines.push('echo "\\${RED}WARNING: This will copy files to your project directory.\\${NC}"');
    lines.push(
      'echo "\\${YELLOW}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo');
    lines.push(
      'read -r -p "\\${YELLOW}Type \\"yes\\" to confirm and copy files (or press Ctrl+C to abort):\\${NC} " confirm',
    );
    lines.push('if [ "$confirm" != "yes" ]; then');
    lines.push('  echo "\\${RED}Aborted - no files were copied.\\${NC}"');
    lines.push('  exit 0');
    lines.push('fi');
    lines.push('');
    lines.push(
      'echo "\\${GREEN}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo "\\${GREEN}Starting file copy operation...\\${NC}"');
    lines.push(
      'echo "\\${GREEN}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo');

    if (rootPhotos.length > 0) {
      rootPhotos.forEach(p => {
        if (p.filePath) {
          lines.push(
            `if [ -e "${p.currentName}" ]; then echo "Skipping existing: ${p.currentName}"; else cp "${p.filePath}" "${p.currentName}"; fi`,
          );
        }
      });
      lines.push('');
    }

    // Execution: create day folders with bucket subfolders and copy files
    lines.push('mkdir -p "${DAYS_FOLDER}"');
    Object.keys(photosByDay)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(day => {
        const label = dayLabels[day] || `Day ${String(day).padStart(2, '0')}`;
        const dayFolder = `${daysFolder}/${label}`;
        const buckets = photosByDay[day];

        Object.keys(buckets)
          .sort()
          .forEach(bucket => {
            const bucketLabel = bucketNames[bucket] || bucket;
            const bucketFolder = `${dayFolder}/${bucket}_${bucketLabel}`;
            const photos = buckets[bucket];

            lines.push(`mkdir -p "${bucketFolder}"`);

            photos.forEach(p => {
              if (p.filePath) {
                lines.push(
                  `if [ -e "${bucketFolder}/${p.currentName}" ]; then echo "Skipping existing: ${bucketFolder}/${p.currentName}"; else cp "${p.filePath}" "${bucketFolder}/${p.currentName}"; fi`,
                );
              }
            });
          });
      });

    // Execution: archive
    if (archivePhotos.length > 0) {
      lines.push('mkdir -p "${ARCHIVE_FOLDER}"');
      archivePhotos.forEach(p => {
        if (p.filePath) {
          lines.push(
            `if [ -e "${archiveFolder}/${p.currentName}" ]; then echo "Skipping existing: ${archiveFolder}/${p.currentName}"; else cp "${p.filePath}" "${archiveFolder}/${p.currentName}"; fi`,
          );
        }
      });
    }

    lines.push('');
    lines.push(
      'echo "\\${GREEN}═══════════════════════════════════════════════════════════\\${NC}"',
    );
    lines.push('echo "\\${GREEN}✓ Copy operation complete!\\${NC}"');
    lines.push(
      'echo "\\${GREEN}═══════════════════════════════════════════════════════════\\${NC}"',
    );

    return lines.join('\n');
  }, [photos, dayLabels, projectSettings]);

  const openExportScriptModal = useCallback(() => {
    const scriptText = buildExportScript();
    setExportScriptText(scriptText);
    setExportCopyStatus('idle');
    setShowExportScript(true);
  }, [buildExportScript]);

  const closeExportScriptModal = useCallback(() => {
    setShowExportScript(false);
  }, []);

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

  return {
    showExportScript,
    exportScriptText,
    exportCopyStatus,
    buildExportScript,
    openExportScriptModal,
    closeExportScriptModal,
    copyExportScript,
    resetExportCopyStatus,
  };
}
