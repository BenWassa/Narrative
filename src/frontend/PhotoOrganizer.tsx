import React, { useState, useEffect, useCallback, useRef } from 'react';
import safeLocalStorage from './utils/safeLocalStorage';
import * as coverStorage from './utils/coverStorageService';
import { resizeImageBlob } from './utils/imageProcessing';
import {
  ChevronDown,
  ChevronLeft,
  Calendar,
  Heart,
  X,
  FolderOpen,
  Download,
  Loader,
} from 'lucide-react';
import { Pencil, Save, X as XIcon } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';
import StartScreen from './StartScreen';
import LoadingModal from './ui/LoadingModal';
import { PhotoViewer } from './ui/PhotoViewer';
import { versionManager } from '../utils/versionManager';
import { detectDayNumberFromFolderName } from '../services/folderDetectionService';
import {
  initProject,
  getState,
  saveState,
  deleteProject as deleteProjectService,
  ProjectPhoto,
  ProjectSettings,
  ProjectState,
  buildPhotosFromHandle,
  saveHandle,
  getHandle,
} from './services/projectService';

const MECE_BUCKETS = [
  { key: 'A', label: 'Establishing', color: 'bg-blue-500', description: 'Wide shots, landscapes' },
  { key: 'B', label: 'People', color: 'bg-purple-500', description: 'Portraits, groups' },
  {
    key: 'C',
    label: 'Culture/Detail',
    color: 'bg-green-500',
    description: 'Local life, close-ups',
  },
  { key: 'D', label: 'Action/Moment', color: 'bg-orange-500', description: 'Events, activities' },
  { key: 'E', label: 'Transition', color: 'bg-yellow-500', description: 'Travel, movement' },
  { key: 'M', label: 'Mood/Food', color: 'bg-indigo-500', description: 'Food, mood' },
  { key: 'X', label: 'Archive', color: 'bg-gray-500', description: 'Unwanted shots' },
];
const MECE_BUCKET_KEYS = new Set(MECE_BUCKETS.map(bucket => bucket.key));
const isMeceBucketLabel = (label: string) => {
  const trimmed = label.trim();
  const firstToken = trimmed.split(/[\s_-]+/)[0] || '';
  return MECE_BUCKET_KEYS.has(firstToken.toUpperCase());
};

const RECENT_PROJECTS_KEY = 'narrative:recentProjects';
const ACTIVE_PROJECT_KEY = 'narrative:activeProject';

const DEFAULT_SETTINGS: ProjectSettings = {
  autoDay: true,
  folderStructure: {
    daysFolder: '01_DAYS',
    archiveFolder: '98_ARCHIVE',
    favoritesFolder: 'FAV',
    metaFolder: '_meta',
  },
};

export default function PhotoOrganizer() {
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  // Default to 'folders' to encourage folder-first workflow
  const [currentView, setCurrentView] = useState('folders');
  // Support multi-selection: set of IDs, and a focused photo for keyboard actions
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [focusedPhoto, setFocusedPhoto] = useState<string | null>(null);
  // Gallery view photo - when user clicks a photo, open PhotoViewer
  const [galleryViewPhoto, setGalleryViewPhoto] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  // Removed viewMode - gallery is now the only view mode
  // Clicking a photo opens PhotoViewer directly
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [history, setHistory] = useState<ProjectPhoto[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Track thumbnails created with URL.createObjectURL so we can revoke them
  const prevThumbnailsRef = useRef<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !safeLocalStorage.get(ACTIVE_PROJECT_KEY));
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [projectName, setProjectName] = useState('No Project');
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [projectFolderLabel, setProjectFolderLabel] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(versionManager.getDisplayVersion());
  const debugEnabled = import.meta.env.DEV && safeLocalStorage.get('narrative:debug') === '1';
  const [dayLabels, setDayLabels] = useState<Record<number, string>>({});
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingDayName, setEditingDayName] = useState('');
  const [dayContainers, setDayContainers] = useState<string[]>([]);
  const [selectedRootFolder, setSelectedRootFolder] = useState<string | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [permissionRetryProjectId, setPermissionRetryProjectId] = useState<string | null>(null);
  const [projectNeedingReselection, setProjectNeedingReselection] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading project...');
  const [showExportScript, setShowExportScript] = useState(false);
  const [exportScriptText, setExportScriptText] = useState('');
  const [exportCopyStatus, setExportCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'info' | 'error';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [coverSelectionMode, setCoverSelectionMode] = useState(false);
  // Removed viewMode - gallery is now the only view mode. Clicking a photo opens PhotoViewer.
  const [hideAssigned, setHideAssigned] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const foldersViewStateRef = useRef<{
    selectedRootFolder: string | null;
    selectedDay: number | null;
  }>({ selectedRootFolder: null, selectedDay: null });

  const deriveProjectName = useCallback((rootPath: string) => {
    const parts = rootPath.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || 'Untitled Project';
  }, []);

  // Resize/compress a blob to a reasonably small data URL for storage
  const toResizedDataUrl = useCallback(
    async (blob: Blob, maxWidth = 800, maxHeight = 600, quality = 0.65): Promise<string> => {
      try {
        const bitmap = await (global as any).createImageBitmap?.(blob);
        if (bitmap) {
          let { width, height } = bitmap as any;
          const aspect = width / height;
          if (width > maxWidth) {
            width = maxWidth;
            height = Math.round(width / aspect);
          }
          if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height * aspect);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas is not supported');
          ctx.drawImage(bitmap, 0, 0, width, height);
          return canvas.toDataURL('image/jpeg', quality);
        }
      } catch (err) {
        // fallthrough to FileReader fallback
      }

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to read image'));
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
        reader.readAsDataURL(blob);
      });
    },
    [],
  );

  const applySuggestedDays = useCallback(
    (sourcePhotos: ProjectPhoto[], suggestedDays?: Record<string, string[]>) => {
      if (!suggestedDays) return sourcePhotos;
      const dayById = new Map<string, number>();
      Object.entries(suggestedDays).forEach(([day, ids]) => {
        const dayNum = Number.parseInt(day, 10);
        if (!Number.isNaN(dayNum)) {
          ids.forEach(id => dayById.set(id, dayNum));
        }
      });
      return sourcePhotos.map(p => ({ ...p, day: dayById.get(p.id) ?? p.day }));
    },
    [],
  );

  const setProjectFromState = useCallback((state: ProjectState) => {
    // Revoke thumbnails that are no longer present to free memory
    try {
      const newThumbs = (state.photos || []).map(p => p.thumbnail).filter(Boolean) as string[];
      prevThumbnailsRef.current.forEach(url => {
        if (url && !newThumbs.includes(url) && url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            // ignore
          }
        }
      });
      prevThumbnailsRef.current = newThumbs;
    } catch (e) {
      // ignore
    }

    setPhotos(state.photos || []);
    setProjectName(state.projectName || 'No Project');
    setProjectFolderLabel(state.rootPath || null);
    setProjectSettings(state.settings || DEFAULT_SETTINGS);
    setDayLabels((state as any).dayLabels || {});
    setDayContainers((state as any).dayContainers || []);
  }, []);

  const updateRecentProjects = useCallback((project: RecentProject) => {
    try {
      const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];

      // Normalize all projects first to handle legacy data
      const normalized = parsed.map(p => ({
        ...p,
        projectId: p.projectId || p.rootPath,
      }));

      // Find existing project by ID or rootPath
      let existingIndex = normalized.findIndex(p => p.projectId === project.projectId);
      if (existingIndex === -1) {
        existingIndex = normalized.findIndex(p => p.rootPath === project.rootPath);
      }

      const existing = existingIndex !== -1 ? normalized[existingIndex] : {};
      const merged = { ...existing, ...project } as RecentProject;

      // Filter out the existing one (using index is safest)
      const filtered = normalized.filter((_, index) => index !== existingIndex);

      const next = [merged, ...filtered].slice(0, 20);
      safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(next));
      setRecentProjects(next);
    } catch (err) {
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        // Storage full - try progressively more aggressive cleanup strategies
        try {
          // Strategy 1: Remove cover photos from all but the 3 most recent projects
          const withLimitedCovers = [merged, ...filtered]
            .map((p, idx) => {
              if (idx >= 3 && p.coverUrl) {
                const { coverUrl, ...rest } = p;
                return rest;
              }
              return p;
            })
            .slice(0, 20);
          safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(withLimitedCovers));
          setRecentProjects(withLimitedCovers);
          showToast('Storage limit reached. Kept covers for 3 most recent projects.', 'info');
        } catch (retryErr) {
          // Strategy 2: Keep only 10 projects with no cover photos except current
          try {
            const minimalProjects = [merged, ...filtered.slice(0, 9)].map((p, idx) => {
              if (idx > 0 && p.coverUrl) {
                const { coverUrl, ...rest } = p;
                return rest;
              }
              return p;
            });
            safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(minimalProjects));
            setRecentProjects(minimalProjects);
            showToast('Storage critically low. Removed older project covers.', 'error');
          } catch (finalErr) {
            // Strategy 3: Clear all and start fresh with just current project
            try {
              const currentOnly = [{ ...merged, coverUrl: undefined }];
              safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(currentOnly));
              setRecentProjects(currentOnly);
              showToast('Storage full. Reset to current project only.', 'error');
            } catch (clearErr) {
              // Last resort: clear everything
              safeLocalStorage.remove(RECENT_PROJECTS_KEY);
              setRecentProjects([]);
              showToast('Storage exhausted. Unable to save projects.', 'error');
            }
          }
        }
      } else {
        // Notify user — storage may be full or unavailable and cover won't persist
        showToast('Failed to persist recent project updates. Changes may not be saved.', 'error');
      }
    }
  }, []);

  const updateRecentProject = useCallback((projectId: string, updates: Partial<RecentProject>) => {
    try {
      const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
      // Normalize projectId for all projects in case they have undefined projectId
      const normalized = parsed.map(p => ({
        ...p,
        projectId: p.projectId || p.rootPath,
      }));
      // Try to find by the provided projectId (could be rootPath if that's what was passed)
      let projectIndex = normalized.findIndex(p => p.projectId === projectId);
      // Also try matching by rootPath in case projectId is different
      if (projectIndex === -1) {
        projectIndex = normalized.findIndex(p => p.rootPath === projectId);
      }
      if (projectIndex !== -1) {
        const next = [...normalized];
        next[projectIndex] = { ...next[projectIndex], ...updates };
        safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(next));
        setRecentProjects(next);
      } else {
        console.warn('Project not found for update:', projectId);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        // Try removing cover photos from older projects to make room
        try {
          const cleaned = normalized.map((p, idx) => {
            // Keep cover for current project and 2 most recent
            if (idx > 2 && p.coverUrl) {
              const { coverUrl, ...rest } = p;
              return rest;
            }
            return p;
          });
          if (projectIndex !== -1) {
            cleaned[projectIndex] = { ...cleaned[projectIndex], ...updates };
          }
          safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(cleaned));
          setRecentProjects(cleaned);
          showToast('Storage limit reached. Removed older covers.', 'info');
        } catch (retryErr) {
          showToast('Storage full. Cover photo could not be saved.', 'error');
          throw retryErr; // Re-throw so caller can handle progressive sizing
        }
      } else {
        // Notify user — storage may be full or unavailable and cover won't persist
        showToast('Failed to persist recent project updates. Changes may not be saved.', 'error');
      }
    }
  }, []);

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

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (
      message: string,
      tone: 'info' | 'error' = 'info',
      options?: { durationMs?: number; actionLabel?: string; onAction?: () => void },
    ) => {
      setToast({ message, tone, actionLabel: options?.actionLabel, onAction: options?.onAction });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const durationMs = options?.durationMs ?? 2500;
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  const setCoverFromSelection = useCallback(async () => {
    // Use the selected photo if one is selected
    if (!projectRootPath) return;
    if (selectedPhotos.size === 0) {
      showToast('Select a photo to set as cover.');
      return;
    }
    if (selectedPhotos.size > 1) {
      showToast('Select a single photo to set as cover.');
      return;
    }

    const selectedId = Array.from(selectedPhotos)[0];
    await setCoverForPhotoId(selectedId);
  }, [photos, projectRootPath, selectedPhotos, showToast]);

  const setCoverForPhotoId = useCallback(
    async (photoId: string) => {
      if (!projectRootPath) return;
      const selectedPhoto = photos.find(p => p.id === photoId);
      if (!selectedPhoto) {
        showToast('Selected photo is no longer available.', 'error');
        return;
      }

      try {
        // Store original photo without any resizing or conversion
        let sourceBlob: Blob;
        if (selectedPhoto.fileHandle) {
          sourceBlob = await selectedPhoto.fileHandle.getFile();
        } else if (selectedPhoto.thumbnail) {
          const response = await fetch(selectedPhoto.thumbnail);
          sourceBlob = await response.blob();
        } else {
          showToast('Cannot create cover from this photo.', 'error');
          return;
        }

        const coverBlob = sourceBlob;
        const usedSize = `original (${(coverBlob.size / 1024).toFixed(1)}KB)`;

        // Evict old covers if needed (keep max 10)
        await coverStorage.evictOldCovers(10);

        // Save to IndexedDB
        const coverKey = await coverStorage.saveCover(projectRootPath, coverBlob, 0, 0);

        // Update recent projects list (remove coverUrl field since it's now in IDB)
        const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
        const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
        const normalized = parsed.map(p => ({
          ...p,
          projectId: p.projectId || p.rootPath,
        }));

        let existingIndex = normalized.findIndex(p => p.projectId === projectRootPath);
        if (existingIndex === -1) {
          existingIndex = normalized.findIndex(p => p.rootPath === projectRootPath);
        }

        const updated = normalized.map((p, idx) =>
          idx === existingIndex
            ? {
                ...p,
                coverKey, // Reference to IDB, not base64 data
                lastOpened: Date.now(),
              }
            : p,
        );

        // If not found, add it
        if (existingIndex === -1) {
          updated.unshift({
            projectName: projectName || 'Untitled Project',
            projectId: projectRootPath,
            rootPath: projectFolderLabel || projectRootPath,
            lastOpened: Date.now(),
            totalPhotos: photos.length,
            coverKey,
          });
        }

        safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(updated.slice(0, 20)));
        setRecentProjects(updated.slice(0, 20));

        console.log(`Cover saved to IndexedDB (${usedSize}):`, projectRootPath);
        showToast('Cover photo updated.');
      } catch (err) {
        console.error('Failed to set cover photo:', err);
        showToast('Failed to set cover photo.', 'error');
      }
    },
    [photos, projectRootPath, projectName, projectFolderLabel, showToast],
  );

  const applyFolderMappings = useCallback((sourcePhotos: ProjectPhoto[], mappings: any[]) => {
    // Apply mappings from onboarding: assign detected day numbers to photos
    // Only assign days to folders that were NOT skipped during onboarding
    // Also detect day numbers from Dnn subfolders (e.g., 01_DAYS/D01/...)
    // Reset day to null for folders that are not mapped
    const folderByName = new Map<string, any>();
    mappings.forEach(m => folderByName.set(m.folderPath || m.folder, m));

    return sourcePhotos.map(p => {
      if (!p.filePath) return p;
      if (p.isPreOrganized && p.day != null && p.bucket != null) return p;
      const parts = p.filePath.split(/[\\/]/);
      const filePathNormalized = parts.join('/');

      // If it's in a Dnn subfolder, set day from that
      if (parts.length > 1) {
        const sub = parts[1];
        const match = sub.match(/^D(\d{1,2})/i);
        if (match) {
          const d = parseInt(match[1], 10);
          if (!Number.isNaN(d)) return { ...p, day: d };
        }
      }

      // Otherwise check top-level mapping - ONLY if folder was not skipped
      for (const [key, mapping] of folderByName.entries()) {
        if (!mapping || mapping.skip || mapping.detectedDay == null) continue;
        const normalizedKey = key.split(/[\\/]/).join('/');
        if (
          filePathNormalized === normalizedKey ||
          filePathNormalized.startsWith(`${normalizedKey}/`)
        ) {
          return { ...p, day: mapping.detectedDay };
        }
      }

      // Reset day to null for unmapped folders unless already assigned
      if (p.day != null) return p;
      return { ...p, day: null };
    });
  }, []);

  const applyDayContainers = useCallback(
    (sourcePhotos: ProjectPhoto[], dayContainers: string[]) => {
      // Reapply day assignments based on stored day containers
      const containerDayMap = new Map<string, number>();
      dayContainers.forEach((container, index) => {
        const detectedDay = detectDayNumberFromFolderName(container);
        if (detectedDay != null) {
          containerDayMap.set(container, detectedDay);
        }
      });

      return sourcePhotos.map(p => {
        if (!p.filePath) return p;
        if (p.isPreOrganized && p.day != null) return p;
        const parts = p.filePath.split(/[\\/]/);
        const filePathNormalized = parts.join('/');
        const top = parts[0];

        // Check if it's in a day container
        const assignedDay = containerDayMap.get(top);
        if (assignedDay != null) {
          return { ...p, day: assignedDay };
        }

        for (const [key, mappedDay] of containerDayMap.entries()) {
          const normalizedKey = key.split(/[\\/]/).join('/');
          if (
            filePathNormalized === normalizedKey ||
            filePathNormalized.startsWith(`${normalizedKey}/`)
          ) {
            return { ...p, day: mappedDay };
          }
        }

        // Also check for Dnn subfolders
        if (parts.length > 1) {
          const sub = parts[1];
          const match = sub.match(/^D(\d{1,2})/i);
          if (match) {
            const d = parseInt(match[1], 10);
            if (!Number.isNaN(d)) return { ...p, day: d };
          }
        }

        return p;
      });
    },
    [],
  );
  const loadProject = useCallback(
    async (projectId: string, options?: { addRecent?: boolean }) => {
      setLoadingProject(true);
      setLoadingProgress(0);
      setLoadingMessage('Loading project...');
      setProjectError(null);
      try {
        setLoadingProgress(25);
        setLoadingMessage('Reading project data...');
        const state = await getState(projectId);

        setLoadingProgress(50);
        setLoadingMessage('Processing photos...');
        // Reapply day assignments based on stored day containers
        const photosWithDays = applyDayContainers(state.photos, state.dayContainers || []);
        const stateWithDays = { ...state, photos: photosWithDays };

        setLoadingProgress(75);
        setLoadingMessage('Initializing view...');
        setProjectFromState(stateWithDays);
        setProjectRootPath(projectId);
        setShowOnboarding(false);
        // Hide the welcome view when a project is successfully loaded
        setShowWelcome(false);
        safeLocalStorage.set(ACTIVE_PROJECT_KEY, projectId);

        setLoadingProgress(90);
        if (options?.addRecent !== false) {
          // Preserve existing coverUrl when updating recent projects
          // Read directly from localStorage to avoid stale state during initial page load
          const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
          const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
          // Normalize projectId for all projects in case they have undefined projectId
          const normalized = parsed.map(p => ({
            ...p,
            projectId: p.projectId || p.rootPath,
          }));
          // Try to find by the provided projectId
          let existingProject = normalized.find(p => p.projectId === projectId);
          // Also try matching by rootPath in case projectId is different
          if (!existingProject) {
            existingProject = normalized.find(p => p.rootPath === projectId);
          }
          const existingCoverUrl = existingProject?.coverUrl;

          updateRecentProjects({
            projectName: state.projectName || 'Untitled Project',
            projectId,
            rootPath: state.rootPath || 'Unknown location',
            lastOpened: Date.now(),
            totalPhotos: state.photos?.length || 0,
            ...(existingCoverUrl && { coverUrl: existingCoverUrl }),
          });
        }
        setLoadingProgress(100);
        setPermissionRetryProjectId(null); // Clear any pending permission retry
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load project';
        console.error('Failed to load project:', err);
        setProjectError(message);

        // Check if this is a permission error that can be retried
        if (
          (message.includes('access') && !message.includes('no longer available')) ||
          message.includes('permission') ||
          message.includes('granted')
        ) {
          setPermissionRetryProjectId(projectId);
        }

        showToast(message, 'error');
        safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
        // Show the welcome page so the user can try other options
        setShowWelcome(true);
      } finally {
        setLoadingProject(false);
        setLoadingProgress(0);
      }
    },
    [getState, applyDayContainers, setProjectFromState, showToast, updateRecentProjects],
  );

  const retryProjectPermission = useCallback(async () => {
    if (!permissionRetryProjectId) return;

    setLoadingProject(true);
    setLoadingProgress(0);
    setLoadingMessage('Requesting folder access...');
    setProjectError(null);

    try {
      // Try to get the handle again and request permission
      const handle = await getHandle(permissionRetryProjectId);
      if (handle) {
        setLoadingProgress(25);
        setLoadingMessage('Re-requesting permissions...');
        const permission = await handle.requestPermission({ mode: 'read' });

        if (permission === 'granted') {
          // Permission granted, try loading the project again
          setLoadingProgress(50);
          setLoadingMessage('Loading project...');
          await loadProject(permissionRetryProjectId, { addRecent: false });
          setPermissionRetryProjectId(null);
          return;
        }
      } else {
        // Handle not found - project data was lost
        throw new Error(
          'Project folder access is no longer available. Please reselect the folder from the start screen.',
        );
      }

      // If we get here, permission was not granted
      throw new Error('Folder access was not granted.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry permission';
      console.error('Failed to retry permission:', err);
      setProjectError(message);
      showToast(message, 'error');
      setShowWelcome(true);
      setPermissionRetryProjectId(null); // Clear retry state
    } finally {
      setLoadingProject(false);
      setLoadingProgress(0);
    }
  }, [permissionRetryProjectId, loadProject, showToast]);

  // Fetch current version on mount for robustness
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await versionManager.getCurrentVersion();
        setCurrentVersion(`v${version}`);
      } catch (error) {
        // Keep build-time version as fallback
        if (debugEnabled) {
          console.warn('Failed to fetch runtime version:', error);
        }
      }
    };

    fetchVersion();
  }, [debugEnabled]);

  useEffect(() => {
    try {
      const storedRecentsRaw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
      if (storedRecentsRaw) {
        try {
          const parsed = JSON.parse(storedRecentsRaw) as RecentProject[];
          const normalized = Array.isArray(parsed)
            ? parsed.map(project => ({
                ...project,
                projectId: project.projectId || project.rootPath,
              }))
            : [];

          // Deduplicate by projectId to clean up any legacy duplicates
          const uniqueProjects = new Map();
          normalized.forEach(p => {
            if (p.projectId && !uniqueProjects.has(p.projectId)) {
              uniqueProjects.set(p.projectId, p);
            }
          });
          const deduped = Array.from(uniqueProjects.values());

          // Write back cleaned data if we found duplicates or normalized anything
          if (JSON.stringify(deduped) !== JSON.stringify(parsed)) {
            safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(deduped));
          }

          console.log(
            'Loaded recent projects:',
            deduped.map(p => ({ id: p.projectId, cover: p.coverUrl ? 'has cover' : 'no cover' })),
          );
          setRecentProjects(deduped);
        } catch (err) {
          // Bad JSON — reset recents
          // eslint-disable-next-line no-console
          console.warn('Failed to parse recent projects from storage', err);
          setRecentProjects([]);
        }
      }
    } catch (err) {
      // fallback — ensure recents is empty
      setRecentProjects([]);
    }

    const activeProjectId = safeLocalStorage.get(ACTIVE_PROJECT_KEY);
    const isTest =
      typeof globalThis !== 'undefined' &&
      (globalThis.vitest || globalThis.__APP_VERSION__ === '0.0.0');

    if (activeProjectId && (isTest || 'showDirectoryPicker' in window)) {
      if (isTest) {
        // In tests, proceed to load directly
        loadProject(activeProjectId, { addRecent: false });
        setShowWelcome(false);
      } else {
        // In real browsers, avoid requesting permissions during mount (no user activation).
        // Instead check if we have a stored handle and prompt the user to re-authorize via a
        // user gesture (Try Again button) which will call requestPermission.
        (async () => {
          try {
            const handle = await getHandle(activeProjectId);
            if (handle) {
              // Do not call requestPermission here (will throw SecurityError without user gesture)
              setPermissionRetryProjectId(activeProjectId);
              setProjectError(
                'Project needs permission to access its folder. Click "Try Again" to grant access.',
              );
              setShowWelcome(true);
            } else {
              // No stored handle — show welcome so user can reselect
              setShowWelcome(true);
            }
          } catch (err) {
            // Any error while checking handle shouldn't crash startup — show welcome
            console.warn('Error checking stored handle on startup:', err);
            setShowWelcome(true);
          }
        })();
      }
    } else {
      // Show the main menu when there is no active project or File System API is not available
      setShowWelcome(true);
    }
  }, [loadProject]);

  // Get days from photos
  const days = React.useMemo(() => {
    const dayMap = new Map();
    photos.forEach(photo => {
      if (photo.day) {
        if (!dayMap.has(photo.day)) {
          dayMap.set(photo.day, []);
        }
        dayMap.get(photo.day).push(photo);
      }
    });
    return Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [photos]);

  // Visible days are only those that have been explicitly configured (i.e. labels exist).
  // Inferred day numbers (from heuristics) are intentionally hidden from the UI until the
  // user confirms them by adding a label. We still compute days normally for diagnostics
  // and internal inference, but UI lists use `visibleDays`.
  const visibleDays = React.useMemo(
    () => days.filter(([d]) => dayLabels[d] != null),
    [days, dayLabels],
  );

  // Consolidated folder categorization logic - single source of truth
  const DAY_PREFIX_RE = /^(?:day|d)[\s_-]?(\d{1,2})/i;
  const categorizeFolder = useCallback(
    (
      folder: string,
      items: ProjectPhoto[],
    ): {
      isSelected: boolean;
      isDayLike: boolean;
      dayNumber: number | null;
      displayName: string;
    } => {
      const isSelected = (dayContainers || []).includes(folder);

      // Check for day-like characteristics
      const hasDayAssigned = items.some(p => p.day !== null);
      const detectedDnn = items.some(p => {
        const parts = (p.filePath || p.originalName || '').split('/');
        return parts.length > 1 && /^D\d{1,2}/i.test(parts[1]);
      });
      const isDayName = days.some(
        ([d]) => (dayLabels[d] || `Day ${String(d).padStart(2, '0')}`) === folder,
      );
      const isDaysContainer = folder === projectSettings?.folderStructure?.daysFolder;
      const hasDayPrefix = DAY_PREFIX_RE.test(folder) || folder.toLowerCase().startsWith('day');

      const isDayLike =
        hasDayAssigned || detectedDnn || isDayName || isDaysContainer || hasDayPrefix;

      // Infer day number from most common assigned day or from folder name
      let dayNumber: number | null = null;
      if (hasDayAssigned) {
        const dayCounts: Record<number, number> = {};
        items.forEach(p => {
          if (p.day != null) dayCounts[p.day] = (dayCounts[p.day] || 0) + 1;
        });
        if (Object.keys(dayCounts).length) {
          dayNumber = Number(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]);
        }
      }

      if (dayNumber == null) {
        const m = folder.match(DAY_PREFIX_RE);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n)) dayNumber = n;
        }
      }

      const displayName =
        dayNumber != null
          ? dayLabels[dayNumber] || `Day ${String(dayNumber).padStart(2, '0')}`
          : folder;

      return { isSelected, isDayLike, dayNumber, displayName };
    },
    [dayContainers, dayLabels, days, projectSettings],
  );

  // Sort and categorize folders for display
  const sortFolders = useCallback(
    (folders: [string, ProjectPhoto[]][]) => {
      const categorized = folders.map(([folder, items]) => {
        const cat = categorizeFolder(folder, items);
        return { folder, items, ...cat };
      });

      // Sort: selected day containers first (by day number), then non-day, then detected day-like
      const selected = categorized.filter(f => f.isSelected);
      const nonDay = categorized.filter(f => !f.isSelected && !f.isDayLike);
      const dayLike = categorized.filter(f => !f.isSelected && f.isDayLike);

      selected.sort((a, b) => (a.dayNumber ?? 999) - (b.dayNumber ?? 999));
      nonDay.sort((a, b) => a.folder.localeCompare(b.folder));
      dayLike.sort((a, b) => a.folder.localeCompare(b.folder));

      return { selected, nonDay, dayLike };
    },
    [categorizeFolder],
  );

  const normalizePath = useCallback((value: string) => {
    return value.split(/[\\/]/).filter(Boolean).join('/');
  }, []);

  const isVideoPhoto = useCallback((photo: ProjectPhoto) => {
    if (photo.mimeType?.startsWith('video/')) return true;
    const ext = photo.originalName.split('.').pop()?.toLowerCase() || '';
    return ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
  }, []);

  const getDerivedSubfolderGroup = useCallback(
    (photo: ProjectPhoto, dayNumber: number | null) => {
      if (dayNumber == null) return 'Day Root';
      const filePath = normalizePath(photo.filePath || photo.originalName || '');
      const folderSegments = filePath.split('/').slice(0, -1);
      const daysFolder = projectSettings?.folderStructure?.daysFolder;
      let dayIndex = -1;

      if (daysFolder) {
        const normalizedDaysFolder = normalizePath(daysFolder);
        const daysIndex = folderSegments.findIndex(
          segment => segment.toLowerCase() === normalizedDaysFolder.toLowerCase(),
        );
        if (daysIndex !== -1 && daysIndex + 1 < folderSegments.length) {
          const dayFolder = folderSegments[daysIndex + 1];
          if (detectDayNumberFromFolderName(dayFolder) === dayNumber) {
            dayIndex = daysIndex + 1;
          }
        }
      }

      if (dayIndex === -1) {
        dayIndex = folderSegments.findIndex(segment => {
          if (daysFolder && segment.toLowerCase() === daysFolder.toLowerCase()) return false;
          return detectDayNumberFromFolderName(segment) === dayNumber;
        });
      }

      if (dayIndex !== -1 && dayIndex + 1 < folderSegments.length) {
        return folderSegments[dayIndex + 1];
      }
      return 'Day Root';
    },
    [normalizePath, projectSettings],
  );

  const getSubfolderGroup = useCallback(
    (photo: ProjectPhoto, dayNumber: number | null) => {
      if (photo.subfolderOverride !== undefined) {
        return photo.subfolderOverride ?? 'Day Root';
      }
      return getDerivedSubfolderGroup(photo, dayNumber);
    },
    [getDerivedSubfolderGroup],
  );

  // Root-level groups (top-level folders under the project root)
  const rootGroups = React.useMemo(() => {
    const map = new Map<string, ProjectPhoto[]>();
    for (const p of photos) {
      if (p.archived) continue;
      const parts = (p.filePath || p.originalName || '').split(/[\\/]/);
      const folder = parts.length > 1 ? parts[0] : '(root)';
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [photos]);

  // Filtered root groups for display in the Folders sidebar.
  // Show only folders that are relevant day folders: either they contain photos with a day assigned,
  // they match the configured days container, or they match an explicit day label (custom names).
  const displayRootGroups = React.useMemo(() => {
    const dayNames = new Set(
      days.map(([d]) => dayLabels[d] || `Day ${String(d).padStart(2, '0')}`),
    );
    const daysContainer = projectSettings?.folderStructure?.daysFolder;

    // Detect day-like subfolders (e.g., 01_DAYS/D01) even when photos inside are unassigned.
    const detectedDaysContainers = new Set<string>();
    for (const p of photos) {
      const parts = (p.filePath || p.originalName || '').split(/[\\/]/);
      if (parts.length > 1 && /^D\d{2}/i.test(parts[1])) {
        detectedDaysContainers.add(parts[0]);
      }
    }

    // Ensure any explicitly selected day containers are present (even if empty)
    const combined = new Map(rootGroups);
    (dayContainers || []).forEach(dc => {
      const top = normalizePath(dc).split('/')[0];
      if (!combined.has(top)) combined.set(top, []);
    });

    // Return all top-level folders (plus any explicitly selected containers) — we'll decide which
    // ones are shown as 'selected day containers' vs 'other' when rendering the sidebar.
    return Array.from(combined.entries());
  }, [rootGroups, days, dayLabels, projectSettings, normalizePath]);

  // Debug: log the current folder groupings for troubleshooting
  React.useEffect(() => {
    if (!debugEnabled) return;
    try {
      console.group('[PhotoOrganizer] Folder & Day Diagnostics');
      console.debug(
        '[PhotoOrganizer] Days:',
        days.map(([d]) => ({ day: d, label: dayLabels[d] || `Day ${String(d).padStart(2, '0')}` })),
      );

      // Day sources breakdown
      const daySources: Record<number, { count: number; sources: Set<string> }> = {};
      photos.forEach(p => {
        if (p.day == null) return;
        const d = p.day as number;
        if (!daySources[d]) daySources[d] = { count: 0, sources: new Set() };
        daySources[d].count += 1;
        const parts = (p.filePath || p.originalName || '').split('/');
        if (parts.length > 1 && /^D\d{1,2}/i.test(parts[1])) {
          daySources[d].sources.add('DnnSubfolder');
        } else if ((dayContainers || []).includes(parts[0])) {
          daySources[d].sources.add('SelectedContainer');
        } else if (parts[0] === projectSettings?.folderStructure?.daysFolder) {
          daySources[d].sources.add('DaysFolder');
        } else {
          daySources[d].sources.add('Inferred');
        }
      });
      const configuredDays = Object.keys(dayLabels).map(k => Number(k));
      console.debug(
        '[PhotoOrganizer] Day breakdown (count + sources):',
        Object.entries(daySources).map(([k, v]) => ({
          day: Number(k),
          count: v.count,
          sources: Array.from(v.sources),
        })),
      );
      console.debug('[PhotoOrganizer] Configured day labels:', configuredDays);
      const extraneous = Object.keys(daySources)
        .map(Number)
        .filter(d => !configuredDays.includes(d));
      if (extraneous.length) {
        console.debug('[PhotoOrganizer] Extraneous/unexpected day numbers:', extraneous);
      }

      // Root folder breakdown
      console.group('Root folders (all top-level folders)');
      rootGroups.forEach(([folder, items]) => {
        const reason = categorizeFolder(folder, items);
        console.groupCollapsed(`${folder} → ${reason.displayName}`);
        console.table(items.map(i => ({ id: i.id, filePath: i.filePath, day: i.day })));
        console.groupEnd();
      });
      console.groupEnd();

      console.groupEnd();
    } catch (err) {
      console.debug('[PhotoOrganizer] debug logging failed', err);
    }
  }, [
    debugEnabled,
    days,
    rootGroups,
    dayContainers,
    projectSettings,
    dayLabels,
    photos,
    categorizeFolder,
  ]);

  // Filter photos based on current view
  const filteredPhotos = React.useMemo(() => {
    const isAssigned = (photo: ProjectPhoto) =>
      Boolean(photo.bucket) || (photo.isPreOrganized && Boolean(photo.detectedBucket));
    const baseFilter = (photo: ProjectPhoto) =>
      !hideAssigned || (!isAssigned(photo) && !photo.archived);
    switch (currentView) {
      case 'days':
        if (selectedDay !== null) {
          return photos.filter(p => !p.archived && p.day === selectedDay).filter(baseFilter);
        }
        return photos.filter(p => p.day !== null && !p.archived).filter(baseFilter);
      case 'folders':
        if (selectedRootFolder !== null) {
          return photos.filter(p => {
            if (p.archived) return false;
            const filePath = normalizePath(p.filePath || p.originalName || '');
            const selectedPath = normalizePath(selectedRootFolder);
            const folder = filePath.split('/')[0] || '(root)';
            const matches = selectedPath.includes('/')
              ? filePath === selectedPath || filePath.startsWith(`${selectedPath}/`)
              : folder === selectedPath;
            return matches && baseFilter(p);
          });
        }
        if (selectedDay !== null) {
          return photos.filter(p => !p.archived && p.day === selectedDay).filter(baseFilter);
        }
        return [];
      case 'root':
        if (selectedRootFolder !== null) {
          return photos.filter(
            p =>
              !p.archived &&
              (normalizePath(p.filePath || p.originalName || '').split('/')[0] || '(root)') ===
                normalizePath(selectedRootFolder) &&
              baseFilter(p),
          );
        }
        return [];
      case 'favorites':
        return photos.filter(p => p.favorite && !p.archived).filter(baseFilter);
      case 'archive':
        return photos.filter(p => p.archived).filter(baseFilter);
      case 'review':
        return photos.filter(p => p.bucket && !p.archived).filter(baseFilter);
      default:
        return photos.filter(baseFilter);
    }
  }, [
    photos,
    currentView,
    selectedDay,
    selectedRootFolder,
    dayContainers,
    projectSettings,
    normalizePath,
    hideAssigned,
  ]);

  // Auto-select first folder when project is newly loaded and no folder is selected
  useEffect(() => {
    if (
      projectRootPath &&
      photos.length > 0 &&
      selectedRootFolder === null &&
      selectedDay === null &&
      currentView === 'folders'
    ) {
      // Prefer the first available day when present
      const firstDay = days[0]?.[0] ?? null;
      if (firstDay !== null) {
        setSelectedDay(firstDay);
        return;
      }

      // Fallback to the first available root folder
      const firstFolder = rootGroups[0]?.[0];
      if (firstFolder) {
        setSelectedRootFolder(firstFolder);
      }
    }
  }, [
    projectRootPath,
    photos.length,
    selectedRootFolder,
    selectedDay,
    currentView,
    rootGroups,
    days,
  ]);

  // Save state to history
  const persistState = useCallback(
    (newPhotos?: ProjectPhoto[]) => {
      if (!projectRootPath) return;
      const nextState: ProjectState = {
        projectName,
        rootPath: projectFolderLabel || projectRootPath,
        photos: newPhotos ?? photos,
        settings: projectSettings,
        // include dayLabels so renames persist
        dayLabels: dayLabels as any,
      };
      // best-effort save
      saveState(projectRootPath, nextState).catch(() => {});
    },
    [projectRootPath, projectName, projectFolderLabel, photos, projectSettings, dayLabels],
  );

  const saveToHistory = useCallback(
    (newPhotos: ProjectPhoto[]) => {
      // Snapshot only editable fields (no thumbnails/fileHandles) to keep history small
      const snapshot = photos.map(p => ({
        id: p.id,
        filePath: p.filePath,
        day: p.day,
        bucket: p.bucket,
        sequence: p.sequence,
        favorite: p.favorite,
        rating: p.rating,
        archived: p.archived,
        currentName: p.currentName,
        originalName: p.originalName,
        timestamp: p.timestamp,
        subfolderOverride: p.subfolderOverride,
      }));

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(snapshot as any);
      // Cap history to 30 entries to avoid unbounded memory growth
      const capped = newHistory.slice(-30);
      setHistory(capped as any);
      setHistoryIndex(capped.length - 1);

      // When applying the new photos, revoke thumbnails that are no longer used
      try {
        const newThumbs = newPhotos.map(p => p.thumbnail).filter(Boolean) as string[];
        prevThumbnailsRef.current.forEach(url => {
          if (url && !newThumbs.includes(url) && url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(url);
            } catch (e) {
              // ignore
            }
          }
        });
        prevThumbnailsRef.current = newThumbs;
      } catch (e) {
        // ignore
      }

      setPhotos(newPhotos);
      persistState(newPhotos);
    },
    [history, historyIndex, photos, persistState],
  );

  // Assign bucket to one or many photos (accepts id or array of ids)
  const assignBucket = useCallback(
    (photoIds, bucket, dayNum = null) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      // Keep counters per day+bucket to create sequences for bulk operations
      const counters = {};
      const newPhotos = photos.map(photo => {
        if (ids.includes(photo.id)) {
          // Prefer an explicit dayNum, then the photo's existing day, then the currently selected day in the UI,
          // then fall back to a date-derived day.
          const day =
            dayNum ||
            photo.day ||
            selectedDay ||
            Math.ceil(new Date(photo.timestamp).getDate() / 1);
          const key = `${day}_${bucket}`;
          const existing = photos.filter(p => p.day === day && p.bucket === bucket).length;
          const next = (counters[key] || existing) + 1;
          counters[key] = next;
          const newName =
            bucket === 'X'
              ? photo.originalName
              : `D${String(day).padStart(2, '0')}_${bucket}_${String(next).padStart(3, '0')}__${
                  photo.originalName
                }`;

          return {
            ...photo,
            bucket,
            day,
            sequence: next,
            currentName: newName,
            archived: bucket === 'X',
          };
        }
        return photo;
      });
      saveToHistory(newPhotos);
    },
    [photos, saveToHistory, selectedDay],
  );

  // Remove day assignment from selected photos
  const removeDayAssignment = useCallback(
    photoIds => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      const newPhotos = photos.map(photo =>
        ids.includes(photo.id) ? { ...photo, day: null } : photo,
      );
      saveToHistory(newPhotos);
    },
    [photos, saveToHistory],
  );

  // Toggle favorite for a single or multiple photos
  const toggleFavorite = useCallback(
    photoIds => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      const newPhotos = photos.map(photo =>
        ids.includes(photo.id) ? { ...photo, favorite: !photo.favorite } : photo,
      );
      saveToHistory(newPhotos);
    },
    [photos, saveToHistory],
  );

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const snapshot = history[historyIndex - 1] as Array<any>;
      // Apply snapshot fields to current photos (preserve thumbnails/fileHandles)
      const nextPhotos = photos.map(photo => {
        const snap = snapshot.find((s: any) => s.id === photo.id);
        return snap ? { ...photo, ...snap } : photo;
      });
      setHistoryIndex(historyIndex - 1);
      setPhotos(nextPhotos);
      persistState(nextPhotos);
    }
  }, [history, historyIndex, persistState]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const snapshot = history[historyIndex + 1] as Array<any>;
      const nextPhotos = photos.map(photo => {
        const snap = snapshot.find((s: any) => s.id === photo.id);
        return snap ? { ...photo, ...snap } : photo;
      });
      setHistoryIndex(historyIndex + 1);
      setPhotos(nextPhotos);
      persistState(nextPhotos);
    }
  }, [history, historyIndex, persistState]);

  // Folder quick actions (defined after saveToHistory to avoid TDZ)
  // folder-level quick actions removed: selection and bulk assign are handled via contextual selection

  const handleOnboardingComplete = useCallback(
    async (state: OnboardingState, reselectionProjectId?: string | null) => {
      setLoadingProject(true);
      setLoadingProgress(0);
      setLoadingMessage('Initializing project...');
      setProjectError(null);
      try {
        if (reselectionProjectId) {
          // For reselection, just save the new handle
          setLoadingProgress(25);
          setLoadingMessage('Saving folder access...');
          await saveHandle(reselectionProjectId, state.dirHandle);

          setLoadingProgress(50);
          setLoadingMessage('Loading project...');
          loadProject(reselectionProjectId);
          return;
        }

        // For new project creation
        setLoadingProgress(5);
        setLoadingMessage('Requesting folder access...');
        const initResult = await initProject({
          dirHandle: state.dirHandle,
          projectName: state.projectName,
          rootLabel: state.rootPath,
          onProgress: (progress, message) => {
            // Map initProject progress (0-95) to 5-80 range in overall progress
            const mappedProgress = 5 + progress * 0.789; // 0.789 = 80/95 approximately
            setLoadingProgress(mappedProgress);
            setLoadingMessage(message);
          },
        });

        setLoadingProgress(80);
        setLoadingMessage('Processing photo organization...');
        const hydratedPhotos = state.mappings?.length
          ? applyFolderMappings(initResult.photos, state.mappings)
          : applySuggestedDays(initResult.photos, initResult.suggestedDays);

        if (debugEnabled) {
          // Log final folder organization for debugging
          console.group('🎯 FINAL PHOTO ORGANIZATION');
          const folderGroups = new Map<string, ProjectPhoto[]>();
          hydratedPhotos.forEach(photo => {
            const parts = (photo.filePath || photo.originalName || '').split('/');
            const topFolder = parts.length > 1 ? parts[0] : '(root)';
            if (!folderGroups.has(topFolder)) {
              folderGroups.set(topFolder, []);
            }
            folderGroups.get(topFolder)!.push(photo);
          });

          console.log('📁 Photos by folder:');
          folderGroups.forEach((photos, folder) => {
            const dayCounts = new Map<number | null, number>();
            photos.forEach(p => {
              const day = p.day;
              dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
            });

            console.group(`📂 ${folder} (${photos.length} photos)`);
            dayCounts.forEach((count, day) => {
              console.log(`  Day ${day || 'null'}: ${count} photos`);
            });
            console.table(
              photos.map(p => ({
                id: p.id,
                fileName: p.originalName,
                day: p.day,
                filePath: p.filePath,
              })),
            );
            console.groupEnd();
          });

          // Also log by day
          console.log('📅 Photos by day:');
          const dayGroups = new Map<number | null, ProjectPhoto[]>();
          hydratedPhotos.forEach(photo => {
            const day = photo.day;
            if (!dayGroups.has(day)) {
              dayGroups.set(day, []);
            }
            dayGroups.get(day)!.push(photo);
          });

          dayGroups.forEach((photos, day) => {
            const folderCounts = new Map<string, number>();
            photos.forEach(p => {
              const parts = (p.filePath || p.originalName || '').split('/');
              const folder = parts.length > 1 ? parts[0] : '(root)';
              folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
            });

            console.group(`📆 Day ${day || 'null'} (${photos.length} photos)`);
            folderCounts.forEach((count, folder) => {
              console.log(`  ${folder}: ${count} photos`);
            });
            console.groupEnd();
          });

          console.groupEnd();
        }

        const selectedDayContainers = (state.mappings || [])
          .filter((m: any) => !m.skip)
          .map((m: any) => m.folderPath || m.folder);
        const nextProjectName = state.projectName?.trim() || deriveProjectName(state.rootPath);

        let nextProjectId: string;
        let nextState: ProjectState;

        if (reselectionProjectId) {
          // For reselection, use existing project ID and load existing state
          nextProjectId = reselectionProjectId;
          setLoadingProgress(80);
          setLoadingMessage('Loading existing project data...');

          // Load existing project state
          const raw = safeLocalStorage.get(`${STATE_PREFIX}${reselectionProjectId}`);
          const existingState = raw ? JSON.parse(raw) : {};

          // Rebuild photos from new handle
          const freshPhotos = await buildPhotosFromHandle(state.dirHandle);

          // Apply existing edits to fresh photos
          let photos = freshPhotos;
          if (existingState.edits) {
            const cachedEdits = new Map<string, any>();
            existingState.edits.forEach((edit: any) => {
              if (edit?.filePath) cachedEdits.set(edit.filePath, edit);
            });

            photos = freshPhotos.map(photo => {
              const cached = photo.filePath ? cachedEdits.get(photo.filePath) : null;
              if (cached) {
                return {
                  ...photo,
                  day: cached.day,
                  bucket: cached.bucket,
                  sequence: cached.sequence,
                  favorite: cached.favorite,
                  rating: cached.rating,
                  archived: cached.archived,
                  currentName: cached.currentName,
                };
              }
              return photo;
            });
          }

          nextState = {
            projectName: existingState.projectName || nextProjectName,
            rootPath: state.rootPath || state.dirHandle.name,
            photos,
            settings: existingState.settings || DEFAULT_SETTINGS,
            dayContainers: existingState.dayContainers || selectedDayContainers,
            dayLabels: existingState.dayLabels,
            lastModified: Date.now(),
          };
        } else {
          // For new project, use initProject result
          nextProjectId = initResult.projectId;
          const hydratedPhotos = state.mappings?.length
            ? applyFolderMappings(initResult.photos, state.mappings)
            : applySuggestedDays(initResult.photos, initResult.suggestedDays);

          nextState = {
            projectName: nextProjectName,
            rootPath: state.rootPath || state.dirHandle.name,
            photos: hydratedPhotos,
            settings: DEFAULT_SETTINGS,
            dayContainers: selectedDayContainers,
          };
        }

        setLoadingProgress(90);
        setLoadingMessage('Saving project state...');
        setPhotos(hydratedPhotos);
        setProjectName(nextProjectName);
        setProjectRootPath(nextProjectId);
        setProjectFolderLabel(state.rootPath || state.dirHandle.name);
        setProjectSettings(DEFAULT_SETTINGS);
        setHistory([]);
        setHistoryIndex(-1);
        setSelectedPhotos(new Set());
        setFocusedPhoto(null);
        setLastSelectedIndex(null);
        lastSelectedIndexRef.current = null;
        setSelectedDay(null);
        setSelectedRootFolder(null); // Reset folder selection
        setCurrentView('folders'); // Ensure we're in folders view
        setShowOnboarding(false);
        setShowWelcome(false);
        safeLocalStorage.set(ACTIVE_PROJECT_KEY, nextProjectId);

        setLoadingProgress(95);
        setLoadingMessage('Updating recent projects...');
        updateRecentProjects({
          projectName: nextProjectName,
          projectId: nextProjectId,
          rootPath: state.rootPath || state.dirHandle.name,
          lastOpened: Date.now(),
          totalPhotos: hydratedPhotos.length,
        });

        setLoadingProgress(98);
        setLoadingMessage('Finalizing project...');
        await saveState(nextProjectId, nextState);
        // Hide the welcome view after successfully creating a project
        setShowWelcome(false);
        setLoadingProgress(100);
        setPermissionRetryProjectId(null); // Clear any pending permission retry
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to initialize project');
        setShowOnboarding(true);
        // If onboarding fails, show the welcome page so users can try other paths
        setShowWelcome(true);
      } finally {
        setLoadingProject(false);
        setLoadingProgress(0);
      }
    },
    [
      applyFolderMappings,
      applySuggestedDays,
      deriveProjectName,
      updateRecentProjects,
      debugEnabled,
    ],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = e => {
      const target = e.target as HTMLElement | null;
      if (
        showWelcome ||
        showOnboarding ||
        showExportScript ||
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable))
      ) {
        return;
      }

      if (showHelp) {
        if (e.key === 'Escape' || e.key === '?') {
          setShowHelp(false);
        }
        return;
      }

      if (coverSelectionMode && e.key === 'Escape') {
        setCoverSelectionMode(false);
        showToast('Cover selection cancelled.');
        return;
      }

      if (e.key === '?') {
        setShowHelp(true);
        return;
      }

      // Determine primary target (focused photo or if a single selection exists)
      const primaryId =
        focusedPhoto || (selectedPhotos.size === 1 ? Array.from(selectedPhotos)[0] : null);
      if (!primaryId) return;

      if (e.key.toLowerCase() === 'f' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        toggleFavorite(targets);
        return;
      }

      // MECE bucket assignment
      let bucketKey = e.key.toUpperCase();
      const bucket = MECE_BUCKETS.find(b => b.key === bucketKey);
      if (bucket && bucket.key !== 'F') {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        assignBucket(targets, bucket.key);
        // Move focus to next photo in filteredPhotos
        const currentIndex = filteredPhotos.findIndex(p => p.id === primaryId);
        if (currentIndex < filteredPhotos.length - 1) {
          const nextId = filteredPhotos[currentIndex + 1].id;
          setFocusedPhoto(nextId);
          setSelectedPhotos(new Set([nextId]));
          setLastSelectedIndex(currentIndex + 1);
          lastSelectedIndexRef.current = currentIndex + 1;
        }
        return;
      }

      // (No special-case mapping needed for M — Mood uses key 'M' directly)

      // Navigation
      if (e.key === 'ArrowRight') {
        const currentIndex = filteredPhotos.findIndex(p => p.id === primaryId);
        if (currentIndex < filteredPhotos.length - 1) {
          const nextId = filteredPhotos[currentIndex + 1].id;
          setFocusedPhoto(nextId);
          setSelectedPhotos(new Set([nextId]));
          setLastSelectedIndex(currentIndex + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        const currentIndex = filteredPhotos.findIndex(p => p.id === primaryId);
        if (currentIndex > 0) {
          const prevId = filteredPhotos[currentIndex - 1].id;
          setFocusedPhoto(prevId);
          setSelectedPhotos(new Set([prevId]));
          setLastSelectedIndex(currentIndex - 1);
          lastSelectedIndexRef.current = currentIndex - 1;
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setFullscreenPhoto(primaryId);
      } else if (e.key === 'Escape') {
        if (fullscreenPhoto) {
          setFullscreenPhoto(null);
        } else {
          setSelectedPhotos(new Set());
          setFocusedPhoto(null);
          setLastSelectedIndex(null);
          lastSelectedIndexRef.current = null;
        }
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
    assignBucket,
    removeDayAssignment,
    toggleFavorite,
    undo,
    redo,
    showHelp,
    fullscreenPhoto,
    showWelcome,
    showOnboarding,
    showExportScript,
    coverSelectionMode,
  ]);

  // Stats
  const stats = React.useMemo(
    () => ({
      total: photos.length,
      sorted: photos.filter(p => p.bucket && !p.archived).length,
      unsorted: photos.filter(p => !p.bucket && !p.archived).length,
      archived: photos.filter(p => p.archived).length,
      favorites: photos.filter(p => p.favorite).length,
      root: photos.filter(p => p.day === null && !p.archived).length,
    }),
    [photos],
  );

  // Selection helpers
  const handleSelectPhoto = useCallback(
    async (e, photoId, index, orderedList = filteredPhotos) => {
      // Shift-range selection (use ref for synchronous access)
      if (
        e.shiftKey &&
        lastSelectedIndexRef.current !== null &&
        lastSelectedIndexRef.current !== undefined
      ) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = orderedList.slice(start, end + 1).map(p => p.id);
        setSelectedPhotos(new Set(rangeIds));
        setFocusedPhoto(photoId);
        setLastSelectedIndex(index);
        lastSelectedIndexRef.current = index;
        return;
      }

      // Cmd/Ctrl to toggle
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedPhotos);
        if (next.has(photoId)) next.delete(photoId);
        else next.add(photoId);
        setSelectedPhotos(next);
        setFocusedPhoto(photoId);
        setLastSelectedIndex(index);
        lastSelectedIndexRef.current = index;
        return;
      }

      // Regular click: single-select
      setSelectedPhotos(new Set([photoId]));
      setFocusedPhoto(photoId);
      setLastSelectedIndex(index);
      lastSelectedIndexRef.current = index;

      // If we're in cover selection mode, use this click to set the cover and exit mode
      if (coverSelectionMode) {
        await setCoverForPhotoId(photoId);
        setCoverSelectionMode(false);
      }
    },
    [selectedPhotos, lastSelectedIndex, filteredPhotos, coverSelectionMode, setCoverForPhotoId],
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header - hidden while StartScreen is visible */}
      {!showWelcome && (
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <img
                src="/Narrative/assets/Narrative_icon.png"
                alt="Narrative"
                className="w-8 h-8 rounded"
              />
              <div>
                {/* Ensure the project name has high contrast against the header */}
                <h1 className="text-lg font-semibold text-gray-100">{projectName}</h1>
                <p className="text-xs text-gray-400">
                  {stats.sorted} sorted · {stats.root} root · {stats.favorites} favorites
                </p>
              </div>

              {/* Assign Day moved into the contextual right panel (appears when photos selected) */}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{currentVersion}</span>

              {/* Main Menu button - always available */}
              <button
                onClick={() => {
                  setShowProjectMenu(false);
                  setShowOnboarding(false);
                  setProjectError(null);
                  setShowWelcome(true);
                  safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium"
                title="Back to the main menu"
              >
                Main Menu
              </button>

              {/* Set Cover button - only show when project is open */}
              {projectRootPath && (
                <button
                  onClick={() => {
                    setCoverSelectionMode(true);
                    showToast(
                      'Select a photo to set as cover. Click a photo to set, or press Esc to cancel.',
                      'info',
                    );
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    coverSelectionMode
                      ? 'bg-yellow-200 text-yellow-900'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-100'
                  }`}
                  title="Set cover from selected photo"
                >
                  {coverSelectionMode ? 'Selecting…' : 'Set Cover'}
                </button>
              )}

              {/* Cover selection feedback - shows when in selection mode */}
              {coverSelectionMode && (
                <div className="px-3 py-1 bg-yellow-50 text-yellow-900 rounded text-sm flex items-center gap-3">
                  <span>Select a photo to set as cover</span>
                  {selectedPhotos.size === 1 && (
                    <button
                      onClick={async () => {
                        await setCoverFromSelection();
                        setCoverSelectionMode(false);
                      }}
                      className="underline"
                    >
                      Use selection
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCoverSelectionMode(false);
                      showToast('Cover selection cancelled.');
                    }}
                    className="underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Project management buttons */}
              <div className="relative">
                <button
                  onClick={() => setShowProjectMenu(prev => !prev)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium flex items-center gap-1"
                  title="Open recent projects"
                  aria-expanded={showProjectMenu}
                >
                  Projects
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showProjectMenu && (
                  <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-800 bg-gray-900 shadow-xl z-20">
                    <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400 border-b border-gray-800">
                      Recent Projects
                    </div>
                    {recentProjects.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-400">No recent projects yet.</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        {recentProjects.map(project => (
                          <button
                            key={project.projectId}
                            onClick={() => {
                              setShowProjectMenu(false);
                              loadProject(project.projectId);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-800"
                          >
                            <div className="text-sm text-gray-100">{project.projectName}</div>
                            <div className="text-xs text-gray-500 truncate">{project.rootPath}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-gray-800">
                      <button
                        onClick={() => {
                          setShowProjectMenu(false);
                          setShowOnboarding(true);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-blue-300 hover:bg-gray-800"
                      >
                        Open Project…
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete project button - separate from Projects dropdown */}
              {projectRootPath && (
                <button
                  onClick={async () => {
                    if (!projectRootPath) return;
                    const confirmed = window.confirm(
                      `Delete project '${projectName}'? This will remove local state and stored folder access. This cannot be undone.`,
                    );
                    if (!confirmed) return;
                    try {
                      await deleteProjectService(projectRootPath);
                    } catch (err) {
                      showToast('Failed to delete project.', 'error');
                      return;
                    }

                    // Remove from recent projects and clear active project
                    try {
                      const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
                      const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
                      const filtered = parsed.filter(p => p.projectId !== projectRootPath);
                      safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
                      setRecentProjects(filtered);
                    } catch (e) {
                      // ignore
                    }

                    safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
                    setPhotos([]);
                    setProjectRootPath(null);
                    setProjectName('No Project');
                    setShowWelcome(true);
                    showToast('Project deleted.');
                  }}
                  className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-sm font-medium"
                  title="Delete project"
                >
                  Delete
                </button>
              )}

              <button
                onClick={() => {
                  setProjectError(null);
                  setShowOnboarding(true);
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium flex items-center gap-1"
                title="Import existing trip folder"
                disabled={loadingProject}
              >
                {loadingProject ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Import Trip
              </button>
              <button
                onClick={() => {
                  setExportScriptText(buildExportScript());
                  setExportCopyStatus('idle');
                  setShowExportScript(true);
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium"
                title="Export rename script"
                disabled={photos.length === 0}
              >
                Export Script
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 hover:bg-gray-800 rounded"
                title="Show shortcuts (?)"
              >
                ?
              </button>
            </div>
          </div>
          {/* View Tabs */}
          <div className="flex gap-1 px-6 pb-2">
            {[
              { id: 'folders', label: 'Folders', count: stats.root },
              { id: 'favorites', label: 'Favorites', count: stats.favorites },
              { id: 'archive', label: 'Archive', count: stats.archived },
              { id: 'review', label: 'Review', count: stats.sorted },
            ].map(view => (
              <button
                key={view.id}
                onClick={() => {
                  if (currentView === 'folders') {
                    foldersViewStateRef.current = { selectedRootFolder, selectedDay };
                  }
                  setCurrentView(view.id);
                  if (view.id === 'folders') {
                    setSelectedRootFolder(foldersViewStateRef.current.selectedRootFolder);
                    setSelectedDay(foldersViewStateRef.current.selectedDay);
                  } else {
                    setSelectedDay(null);
                  }
                }}
                className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
                  currentView === view.id
                    ? 'bg-gray-950 text-blue-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {view.label}{' '}
                {view.count > 0 && <span className="text-xs opacity-60">({view.count})</span>}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
            <button
              onClick={() => setHideAssigned(prev => !prev)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                hideAssigned
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {hideAssigned ? 'Show All' : 'Hide Assigned'}
            </button>
          </div>

          {projectError && (
            <div className="mx-6 mb-3 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-200">{projectError}</span>
                {permissionRetryProjectId && (
                  <button
                    onClick={retryProjectPermission}
                    className="ml-3 px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}
        </header>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Days list when in days view */}
        {currentView === 'days' && !sidebarCollapsed && (
          <aside className="w-48 border-r border-gray-800 bg-gray-900 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase">Days</h3>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 hover:bg-gray-800 rounded"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-1">
                {visibleDays.map(([day, dayPhotos], idx) => (
                  <div
                    key={day}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      // Selecting a day should clear any selected root folder so the day
                      // filter is applied consistently.
                      setSelectedRootFolder(null);
                      setSelectedDay(day);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setSelectedRootFolder(null);
                        setSelectedDay(day);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedDay === day
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {editingDay === day ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            value={editingDayName}
                            onChange={e => setEditingDayName(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-gray-800 text-sm text-gray-100"
                          />
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setDayLabels(prev => ({ ...prev, [day]: editingDayName }));
                              persistState(photos);
                              setEditingDay(null);
                            }}
                            className="p-1 bg-green-600 rounded"
                            aria-label="Save day name"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingDay(null);
                            }}
                            className="p-1 bg-gray-800 rounded"
                            aria-label="Cancel"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium">
                            {dayLabels[day] || `Day ${String(day).padStart(2, '0')}`}
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedDay === day && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  clearSelectedDay();
                                }}
                                className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300 hover:text-white"
                                aria-label="Clear day selection"
                                title="Clear day selection"
                              >
                                Clear
                              </button>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setEditingDay(day);
                                setEditingDayName(
                                  dayLabels[day] || `Day ${String(day).padStart(2, '0')}`,
                                );
                              }}
                              className="p-1"
                              aria-label={`Edit day ${day}`}
                            >
                              <Pencil className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs opacity-70">{dayPhotos.length} photos</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
        {currentView === 'folders' && (
          <aside className="w-48 border-r border-gray-800 bg-gray-900 overflow-y-auto">
            <div className="p-4">
              {/* Days grouping at top when viewing folders */}
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Days</h3>
              <div className="space-y-1 mb-4">
                {(() => {
                  // Show explicitly configured days + auto-detected day-like folders
                  const daysByNumber = new Map<
                    number,
                    { dayNumber: number; photos: ProjectPhoto[]; folderName: string | null }
                  >();
                  const selectedContainers = dayContainers || [];
                  const selectedTopLevelContainers: string[] = [];
                  const selectedPathContainers: string[] = [];
                  selectedContainers.forEach(container => {
                    const normalized = normalizePath(container);
                    if (normalized.includes('/')) {
                      selectedPathContainers.push(normalized);
                    } else {
                      selectedTopLevelContainers.push(normalized);
                    }
                  });

                  const getPhotosForPath = (path: string) => {
                    const normalized = normalizePath(path);
                    return photos.filter(p => {
                      const filePath = normalizePath(p.filePath || p.originalName || '');
                      return filePath === normalized || filePath.startsWith(`${normalized}/`);
                    });
                  };

                  // First add explicitly labeled days (if any)
                  days.forEach(([d, photosForDay]) => {
                    if (!daysByNumber.has(d)) {
                      daysByNumber.set(d, { dayNumber: d, photos: photosForDay, folderName: null });
                    }
                  });

                  // Then add inferred days from selected day containers (full paths)
                  selectedPathContainers.forEach(containerPath => {
                    const lastSegment = containerPath.split('/').slice(-1)[0];
                    const dayNumber = detectDayNumberFromFolderName(lastSegment);
                    if (dayNumber == null || daysByNumber.has(dayNumber)) return;
                    daysByNumber.set(dayNumber, {
                      dayNumber,
                      photos: getPhotosForPath(containerPath),
                      folderName: containerPath,
                    });
                  });

                  // If there's a days container, infer day folders beneath it
                  const daysContainer = projectSettings?.folderStructure?.daysFolder;
                  if (daysContainer) {
                    const normalizedDaysContainer = normalizePath(daysContainer);
                    const dayFolderMap = new Map<number, ProjectPhoto[]>();
                    photos.forEach(p => {
                      const filePath = normalizePath(p.filePath || p.originalName || '');
                      const parts = filePath.split('/');
                      if (parts.length < 2) return;
                      if (parts[0] !== normalizedDaysContainer) return;
                      const dayNumber = detectDayNumberFromFolderName(parts[1]);
                      if (dayNumber == null) return;
                      if (!dayFolderMap.has(dayNumber)) dayFolderMap.set(dayNumber, []);
                      dayFolderMap.get(dayNumber)!.push(p);
                    });
                    dayFolderMap.forEach((dayPhotos, dayNumber) => {
                      if (!daysByNumber.has(dayNumber)) {
                        daysByNumber.set(dayNumber, {
                          dayNumber,
                          photos: dayPhotos,
                          folderName: `${normalizedDaysContainer}/${
                            dayLabels[dayNumber] || `Day ${String(dayNumber).padStart(2, '0')}`
                          }`,
                        });
                      }
                    });
                  }

                  // Also auto-detect day-like folders and add them to the Days section
                  // Filter photos to only include those actually assigned to this day (or unassigned)
                  rootGroups.forEach(([folderName, folderPhotos]) => {
                    const cat = categorizeFolder(folderName, folderPhotos);
                    if (
                      cat.isDayLike &&
                      cat.dayNumber !== null &&
                      !daysByNumber.has(cat.dayNumber)
                    ) {
                      const photosForDay = folderPhotos.filter(
                        p => p.day === cat.dayNumber || p.day === null,
                      );
                      daysByNumber.set(cat.dayNumber, {
                        dayNumber: cat.dayNumber,
                        photos: photosForDay,
                        folderName,
                      });
                    }
                  });

                  const displayDays = Array.from(daysByNumber.values()).sort(
                    (a, b) => a.dayNumber - b.dayNumber,
                  );

                  // Show selected top-level containers that don't map to a day number
                  const selectedWithoutDay = selectedTopLevelContainers.filter(containerName => {
                    const containerPhotos =
                      rootGroups.find(([name]) => name === containerName)?.[1] || [];
                    const cat = categorizeFolder(containerName, containerPhotos);
                    return cat.dayNumber === null;
                  });

                  return (
                    <>
                      {displayDays.map(entry => (
                        <div
                          key={`day-${entry.dayNumber}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedRootFolder(null);
                            setSelectedDay(entry.dayNumber);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              setSelectedRootFolder(null);
                              setSelectedDay(entry.dayNumber);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedDay === entry.dayNumber
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            {editingDay === entry.dayNumber ? (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  value={editingDayName}
                                  onChange={e => setEditingDayName(e.target.value)}
                                  className="w-full px-2 py-1 rounded bg-gray-800 text-sm text-gray-100"
                                />
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setDayLabels(prev => ({
                                      ...prev,
                                      [entry.dayNumber]: editingDayName,
                                    }));
                                    persistState(photos);
                                    setEditingDay(null);
                                  }}
                                  className="p-1 bg-green-600 rounded"
                                  aria-label={`Save day name`}
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingDay(null);
                                  }}
                                  className="p-1 bg-gray-800 rounded"
                                  aria-label={`Cancel`}
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium">
                                  {dayLabels[entry.dayNumber] ||
                                    `Day ${String(entry.dayNumber).padStart(2, '0')}`}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEditingDay(entry.dayNumber);
                                      setEditingDayName(
                                        dayLabels[entry.dayNumber] ||
                                          `Day ${String(entry.dayNumber).padStart(2, '0')}`,
                                      );
                                    }}
                                    className="p-1"
                                    aria-label={`Edit day ${entry.dayNumber}`}
                                  >
                                    <Pencil className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="text-xs opacity-70">{entry.photos.length} photos</div>
                        </div>
                      ))}

                      {selectedWithoutDay.map(containerName => (
                        <div
                          key={`container-${containerName}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedRootFolder(containerName);
                            setSelectedDay(null); // Clear day selection when selecting a folder
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedRootFolder === containerName
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{containerName}</div>
                            <div className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                              Container
                            </div>
                          </div>
                          <div className="text-xs opacity-70">
                            {rootGroups.find(([name]) => name === containerName)?.[1].length || 0}{' '}
                            photos
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>

              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Other</h3>
              <div className="space-y-1">
                {(() => {
                  const { selected, nonDay, dayLike } = sortFolders(displayRootGroups);
                  if (debugEnabled) {
                    console.debug('[PhotoOrganizer] Folder categorization:', {
                      selected: selected.map(f => f.folder),
                      nonDay: nonDay.map(f => f.folder),
                      dayLike: dayLike.map(f => f.folder),
                    });
                  }

                  // Show only non-day folders in Other section
                  // All day-like folders (dayLike) are now shown in the Days section
                  const nonSelectedFolders = nonDay;
                  const daysContainer = projectSettings?.folderStructure?.daysFolder;
                  const nestedOtherFolders: Array<{
                    key: string;
                    label: string;
                    items: ProjectPhoto[];
                  }> = [];

                  if (daysContainer) {
                    const normalizedDaysContainer = normalizePath(daysContainer);
                    const nestedMap = new Map<string, ProjectPhoto[]>();
                    photos.forEach(p => {
                      if (p.archived) return;
                      const filePath = normalizePath(p.filePath || p.originalName || '');
                      const parts = filePath.split('/');
                      if (parts.length < 3) return;
                      if (parts[0] !== normalizedDaysContainer) return;
                      const dayNumber = detectDayNumberFromFolderName(parts[1]);
                      if (dayNumber != null) return;
                      const childFolder = parts[1];
                      const key = `${normalizedDaysContainer}/${childFolder}`;
                      if (!nestedMap.has(key)) nestedMap.set(key, []);
                      nestedMap.get(key)!.push(p);
                    });

                    nestedMap.forEach((items, key) => {
                      nestedOtherFolders.push({
                        key,
                        label: key,
                        items,
                      });
                    });
                  }

                  const combinedOtherFolders = [
                    ...nonSelectedFolders.map(f => ({
                      key: f.folder,
                      label: f.folder,
                      items: f.items,
                    })),
                    ...nestedOtherFolders,
                  ];

                  return (
                    <>
                      {combinedOtherFolders.map(f => (
                        <div
                          key={f.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedRootFolder(f.key);
                            setSelectedDay(null); // Clear day selection when selecting a folder
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedRootFolder === f.key
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{f.label}</div>
                            <div className="flex gap-2" />
                          </div>
                          <div className="text-xs opacity-70">
                            {f.items.length} photos ({f.items.filter(p => p.day === null).length}{' '}
                            unsorted)
                          </div>
                        </div>
                      ))}

                      {combinedOtherFolders.length === 0 && (
                        <div className="text-xs text-gray-400">No other folders</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </aside>
        )}

        {/* Sidebar Expand Button */}
        {currentView === 'days' && sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="w-12 border-r border-gray-800 bg-gray-900 flex items-center justify-center hover:bg-gray-800 transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
          </button>
        )}

        {/* Photo Grid */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {loadingProject ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Loader className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-400" />
                  <p className="text-gray-400">Loading project...</p>
                </div>
              </div>
            ) : currentView === 'days' && selectedDay === null ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a day to view photos</p>
                </div>
              </div>
            ) : currentView === 'folders' && selectedRootFolder === null && selectedDay === null ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a folder to view photos</p>
                </div>
              </div>
            ) : (
              (() => {
                const rootPhotos =
                  currentView === 'folders' && selectedRootFolder
                    ? (rootGroups.find(r => r[0] === selectedRootFolder)?.[1] || []).filter(
                        p => !p.archived,
                      )
                    : null;
                const displayPhotos = rootPhotos !== null ? rootPhotos : filteredPhotos;
                if (displayPhotos.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-96 text-gray-500">
                      <div className="text-center">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No photos in this view</p>
                      </div>
                    </div>
                  );
                }

                // Gallery mode - show photo grid
                // When user clicks a photo, open PhotoViewer
                if (galleryViewPhoto) {
                  const photoData = displayPhotos.find(p => p.id === galleryViewPhoto);
                  if (photoData) {
                    return (
                      <PhotoViewer
                        photo={photoData}
                        filteredPhotos={displayPhotos}
                        onClose={() => {
                          setGalleryViewPhoto(null);
                        }}
                        onNavigate={photoId => {
                          setGalleryViewPhoto(photoId);
                        }}
                        onToggleFavorite={photoId => {
                          setPhotos(prev =>
                            prev.map(p => (p.id === photoId ? { ...p, favorite: !p.favorite } : p)),
                          );
                          persistState(
                            photos.map(p =>
                              p.id === photoId ? { ...p, favorite: !p.favorite } : p,
                            ),
                          );
                        }}
                        onAssignBucket={(photoId, bucket) => {
                          assignBucket(photoId, bucket);
                          // If archiving, stay in viewer and navigate to next
                          if (bucket === 'X') {
                            const currentIndex = displayPhotos.findIndex(p => p.id === photoId);
                            if (currentIndex !== -1) {
                              // Try next photo first
                              if (currentIndex < displayPhotos.length - 1) {
                                setGalleryViewPhoto(displayPhotos[currentIndex + 1].id);
                              }
                              // If no next photo, try previous
                              else if (currentIndex > 0) {
                                setGalleryViewPhoto(displayPhotos[currentIndex - 1].id);
                              }
                              // If no photos remain, exit viewer
                              else {
                                setGalleryViewPhoto(null);
                              }
                            }
                          }
                        }}
                        onAssignDay={(photoId, day) => {
                          setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, day } : p)));
                          persistState(photos.map(p => (p.id === photoId ? { ...p, day } : p)));
                        }}
                        selectedBucket={photoData.bucket}
                        selectedDay={photoData.day}
                        buckets={MECE_BUCKETS}
                        dayLabels={dayLabels}
                      />
                    );
                  }
                }

                const renderPhotoGrid = (
                  photosList: ProjectPhoto[],
                  orderedList: ProjectPhoto[],
                  indexMap?: Map<string, number>,
                ) => (
                  <div className="grid grid-cols-5 gap-3">
                    {photosList.map((photo, idx) => (
                      <div
                        key={photo.id}
                        onClick={e => {
                          // Single click to select for bucket assignment
                          e.stopPropagation();
                          setSelectedPhotos(new Set([photo.id]));
                        }}
                        onDoubleClick={e => {
                          // Double-click to open PhotoViewer
                          e.stopPropagation();
                          setGalleryViewPhoto(photo.id);
                        }}
                        data-testid={`photo-${photo.id}`}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all shadow-lg hover:shadow-xl ${
                          photo.bucket || photo.archived
                            ? 'opacity-70 saturate-75'
                            : 'hover:scale-105'
                        } ${selectedPhotos.has(photo.id) ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        {photo.thumbnail ? (
                          photo.mimeType?.startsWith('video/') ? (
                            <video
                              src={photo.thumbnail}
                              className="w-full aspect-square object-cover"
                              muted
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={photo.thumbnail}
                              alt={photo.currentName}
                              className="w-full aspect-square object-cover"
                            />
                          )
                        ) : (
                          <div className="w-full aspect-square bg-gray-900 flex items-center justify-center text-xs text-gray-400 px-2 text-center">
                            {photo.currentName}
                          </div>
                        )}

                        {/* Video indicator */}
                        {photo.mimeType?.startsWith('video/') && (
                          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-full p-1.5">
                            <svg
                              className="w-4 h-4 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
                            </svg>
                          </div>
                        )}

                        {/* Overlay info on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs font-medium text-white truncate">
                              {photo.currentName}
                            </p>
                          </div>
                        </div>

                        {/* Organized badge */}
                        {photo.isPreOrganized && (
                          <div className="absolute top-2 right-2 z-10">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white shadow-lg"
                              title={`Auto-assigned: Day ${photo.detectedDay ?? '—'}, Bucket ${
                                photo.detectedBucket ?? '—'
                              }`}
                            >
                              Organized
                            </span>
                          </div>
                        )}

                        {/* Bucket badge */}
                        {photo.bucket && (
                          <div
                            className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                              MECE_BUCKETS.find(b => b.key === photo.bucket)?.color
                            } text-white shadow-lg`}
                          >
                            <div className="flex items-center gap-1">
                              <span>{photo.bucket}</span>
                              {photo.favorite && <Heart className="w-3 h-3 fill-current" />}
                            </div>
                          </div>
                        )}

                        {/* Favorite-only badge (when no bucket) */}
                        {!photo.bucket && photo.favorite && (
                          <div className="absolute bottom-2 left-2 bg-yellow-500 text-white rounded-full p-1.5 shadow-lg">
                            <Heart className="w-3.5 h-3.5 fill-current" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );

                if (selectedDay !== null) {
                  const groups = new Map<string, { label: string; photos: ProjectPhoto[] }>();
                  displayPhotos.forEach(photo => {
                    const groupLabel = getSubfolderGroup(photo, selectedDay);
                    if (!groups.has(groupLabel)) {
                      groups.set(groupLabel, { label: groupLabel, photos: [] });
                    }
                    groups.get(groupLabel)!.photos.push(photo);
                  });

                  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
                    if (a.label === 'Day Root') return -1;
                    if (b.label === 'Day Root') return 1;
                    return a.label.localeCompare(b.label);
                  });

                  const orderedPhotos: ProjectPhoto[] = [];
                  sortedGroups.forEach(group => {
                    const videos = group.photos.filter(isVideoPhoto);
                    const stills = group.photos.filter(p => !isVideoPhoto(p));
                    if (videos.length > 0 && stills.length > 0) {
                      orderedPhotos.push(...stills, ...videos);
                    } else {
                      orderedPhotos.push(...group.photos);
                    }
                  });
                  const orderedIndex = new Map<string, number>();
                  orderedPhotos.forEach((photo, idx) => orderedIndex.set(photo.id, idx));

                  return (
                    <div className="space-y-8">
                      {sortedGroups.map(group => {
                        const videos = group.photos.filter(isVideoPhoto);
                        const stills = group.photos.filter(p => !isVideoPhoto(p));
                        const hasSplit = videos.length > 0 && stills.length > 0;
                        const derivedGroupPhotos = group.photos.filter(p => {
                          if (p.day !== selectedDay) return false;
                          return getDerivedSubfolderGroup(p, selectedDay) === group.label;
                        });
                        const hasExplicitOverride = derivedGroupPhotos.some(
                          p => p.subfolderOverride !== undefined,
                        );
                        const isDayRootGroup = group.label === 'Day Root';
                        const isMeceGroup = isMeceBucketLabel(group.label);
                        const showIngestActions = !isDayRootGroup && !isMeceGroup;

                        return (
                          <div key={group.label}>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-semibold text-gray-200">{group.label}</h3>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>{group.photos.length} items</span>
                                {showIngestActions && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="text-xs text-blue-300 hover:text-blue-200"
                                      title="Move photos in this subfolder to the day root"
                                      onClick={() => {
                                        const previousPhotos = photos;
                                        const updated = photos.map(p => {
                                          if (p.day !== selectedDay) return p;
                                          const derived = getDerivedSubfolderGroup(p, selectedDay);
                                          if (derived !== group.label) return p;
                                          return { ...p, subfolderOverride: null };
                                        });
                                        saveToHistory(updated);
                                        const dayLabel =
                                          dayLabels[selectedDay] ||
                                          `Day ${String(selectedDay).padStart(2, '0')}`;
                                        showToast(`Photos moved to ${dayLabel}.`, 'info', {
                                          durationMs: 5000,
                                          actionLabel: 'Undo',
                                          onAction: () => {
                                            saveToHistory(previousPhotos);
                                          },
                                        });
                                      }}
                                    >
                                      Ingest to Day
                                    </button>
                                    <button
                                      className="text-xs text-gray-300 hover:text-gray-100"
                                      onClick={() => {
                                        const updated = photos.map(p => {
                                          if (p.day !== selectedDay) return p;
                                          const derived = getDerivedSubfolderGroup(p, selectedDay);
                                          if (derived !== group.label) return p;
                                          return { ...p, subfolderOverride: derived };
                                        });
                                        saveToHistory(updated);
                                      }}
                                    >
                                      Keep Subfolder
                                    </button>
                                    {hasExplicitOverride && (
                                      <button
                                        className="text-xs text-red-300 hover:text-red-200"
                                        onClick={() => {
                                          const updated = photos.map(p => {
                                            if (p.day !== selectedDay) return p;
                                            if (derivedGroupPhotos.find(dp => dp.id === p.id)) {
                                              return { ...p, subfolderOverride: undefined };
                                            }
                                            return p;
                                          });
                                          saveToHistory(updated);
                                        }}
                                      >
                                        Undo Ingest
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {hasSplit && (
                              <>
                                <div className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                                  Photos
                                </div>
                                {renderPhotoGrid(stills, orderedPhotos, orderedIndex)}
                                <div className="mt-6 mb-2 text-xs uppercase tracking-wider text-gray-500">
                                  Videos
                                </div>
                                {renderPhotoGrid(videos, orderedPhotos, orderedIndex)}
                              </>
                            )}

                            {!hasSplit &&
                              renderPhotoGrid(group.photos, orderedPhotos, orderedIndex)}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Gallery Mode
                return renderPhotoGrid(displayPhotos, displayPhotos);
              })()
            )}
          </div>
        </main>

        {/* Right Panel - MECE Controls */}
        {selectedPhotos.size > 0 && !fullscreenPhoto && (
          <aside className="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                {selectedPhotos.size === 1 ? (
                  <>
                    {(() => {
                      const photo = photos.find(p => p.id === Array.from(selectedPhotos)[0]);
                      if (!photo) return null;

                      return photo.mimeType?.startsWith('video/') ? (
                        <video src={photo.thumbnail} className="w-full rounded-lg" controls />
                      ) : (
                        <img src={photo.thumbnail} alt="Selected" className="w-full rounded-lg" />
                      );
                    })()}
                    <div className="mt-2 text-xs text-gray-400 font-mono break-all">
                      {!editingName ? (
                        <div className="flex items-center justify-between">
                          <div>
                            {photos.find(p => p.id === Array.from(selectedPhotos)[0])?.currentName}
                          </div>
                          <button
                            onClick={() => {
                              const id = Array.from(selectedPhotos)[0];
                              const p = photos.find(x => x.id === id);
                              setNameInput(p?.currentName || p?.originalName || '');
                              setEditingName(true);
                            }}
                            className="p-1 ml-2"
                            aria-label="Edit name"
                          >
                            <Pencil className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-gray-800 text-sm text-gray-100"
                          />
                          <button
                            onClick={() => {
                              const id = Array.from(selectedPhotos)[0];
                              const newPhotos = photos.map(ph =>
                                ph.id === id ? { ...ph, currentName: nameInput } : ph,
                              );
                              saveToHistory(newPhotos);
                              setEditingName(false);
                            }}
                            className="p-1 bg-green-600 rounded"
                            aria-label="Save name"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingName(false)}
                            className="p-1 bg-gray-800 rounded"
                            aria-label="Cancel edit name"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-300">{selectedPhotos.size} selected</div>
                )}
              </div>

              {/* Contextual Assign Day (only when photos are selected) */}
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign Day</h3>
                <div className="flex gap-2 items-center">
                  <select
                    aria-label="Assign to..."
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      const dayNum =
                        val === 'new' ? Math.max(0, ...days.map(d => d[0])) + 1 : Number(val);
                      const targets = Array.from(selectedPhotos);
                      const newPhotos = photos.map(ph =>
                        targets.includes(ph.id) ? { ...ph, day: dayNum } : ph,
                      );
                      saveToHistory(newPhotos);
                      // If creating a new day via the Assign control, treat that as an
                      // explicit confirmation and create a default day label so it
                      // appears in the Days list (visibleDays filters by labels).
                      if (val === 'new') {
                        setDayLabels(prev => ({
                          ...prev,
                          [dayNum]: `Day ${String(dayNum).padStart(2, '0')}`,
                        }));
                        persistState(newPhotos);
                      }
                      setSelectedDay(dayNum);
                      setCurrentView('days');
                      // clear selection after assign
                      setSelectedPhotos(new Set());
                    }}
                    className="px-3 py-2 rounded bg-gray-800"
                    defaultValue=""
                  >
                    <option value="">Assign to...</option>
                    {days.map(([d]) => (
                      <option key={d} value={d}>{`Day ${String(d).padStart(2, '0')}`}</option>
                    ))}
                    <option value="new">Create new day</option>
                  </select>
                  <div className="text-xs text-gray-400">
                    Assign selected photos to a day folder
                  </div>
                </div>
                <button
                  onClick={() => {
                    removeDayAssignment(Array.from(selectedPhotos));
                    setSelectedPhotos(new Set());
                  }}
                  className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
                >
                  Remove Day Assignment
                </button>
              </div>

              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign Category</h3>
                {MECE_BUCKETS.map(bucket => (
                  <button
                    key={bucket.key}
                    onClick={() => assignBucket(Array.from(selectedPhotos), bucket.key)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${bucket.color} hover:brightness-110 text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-lg">{bucket.key}</span>
                        <span className="ml-3 font-medium">{bucket.label}</span>
                      </div>
                    </div>
                    <p className="text-xs mt-1 opacity-80">{bucket.description}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-800">
                <button
                  onClick={() => toggleFavorite(Array.from(selectedPhotos))}
                  className={`w-full px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    // when single selection, reflect actual favorite state; otherwise neutral
                    selectedPhotos.size === 1 &&
                    photos.find(p => p.id === Array.from(selectedPhotos)[0])?.favorite
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      selectedPhotos.size === 1 &&
                      photos.find(p => p.id === Array.from(selectedPhotos)[0])?.favorite
                        ? 'fill-current'
                        : ''
                    }`}
                  />
                  Toggle Favorite (F)
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Fullscreen View */}
      {fullscreenPhoto && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {(() => {
            const photo = photos.find(p => p.id === fullscreenPhoto);
            if (!photo) return null;

            return photo.mimeType?.startsWith('video/') ? (
              <video
                src={photo.thumbnail}
                controls
                className="max-w-full max-h-full object-contain"
                autoPlay={false}
              />
            ) : (
              <img
                src={photo.thumbnail}
                alt="Fullscreen"
                className="max-w-full max-h-full object-contain"
              />
            );
          })()}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
            <p className="text-center text-sm font-mono">
              {photos.find(p => p.id === fullscreenPhoto)?.currentName}
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              Press ESC to close · Arrow keys to navigate
            </p>
          </div>
        </div>
      )}

      {showExportScript && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full overflow-hidden border border-gray-800">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Export Script</h2>
              <button
                onClick={() => setShowExportScript(false)}
                className="p-2 hover:bg-gray-800 rounded"
                aria-label="Close export script dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-400">
                Copy these commands and run them in your terminal from the project root directory.
                They create organized day folders and copy your photos with the current bucket
                naming. Originals are preserved.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(exportScriptText);
                      setExportCopyStatus('copied');
                    } catch {
                      setExportCopyStatus('failed');
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 hover:bg-gray-700 text-sm"
                >
                  Copy Script
                </button>
                {exportCopyStatus === 'copied' && (
                  <span className="text-xs text-green-400">Copied.</span>
                )}
                {exportCopyStatus === 'failed' && (
                  <span className="text-xs text-red-400">Copy failed. Select and copy below.</span>
                )}
              </div>
              <textarea
                readOnly
                value={exportScriptText}
                className="w-full h-64 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-100 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 hover:bg-gray-800 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-blue-400 mb-3">MECE Categories</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {MECE_BUCKETS.map(bucket => (
                      <div key={bucket.key} className="flex items-center gap-3 text-sm">
                        <kbd className={`px-2 py-1 rounded ${bucket.color} text-white font-bold`}>
                          {bucket.key === 'F' ? 'M' : bucket.key}
                        </kbd>
                        <span>{bucket.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Keyboard shortcuts: A–E, X, M (Mood/Food). F is reserved for Favorite.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-400 mb-3">Navigation</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">←→</kbd>
                      <span>Previous / Next photo</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">Enter</kbd>
                      <span>Fullscreen view</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd>
                      <span>Close / Deselect</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-400 mb-3">Actions</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">F</kbd>
                      <span>Toggle favorite</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">⌘Z</kbd>
                      <span>Undo (keyboard)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">⌘⇧Z</kbd>
                      <span>Redo (keyboard)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">?</kbd>
                      <span>Show this help</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm shadow-lg ${
              toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-100'
            }`}
            role="status"
            aria-live="polite"
          >
            <span>{toast.message}</span>
            <div className="flex items-center gap-2">
              {toast.actionLabel && (
                <button
                  onClick={() => {
                    toast.onAction?.();
                    clearToast();
                  }}
                  className="px-2 py-0.5 rounded bg-white/10 text-xs text-white hover:bg-white/20"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                onClick={clearToast}
                className="p-1 rounded hover:bg-white/10"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* StartScreen - only show when welcome screen is active */}
      {showWelcome && (
        <StartScreen
          isOpen={showWelcome}
          onClose={() => {
            if (!projectRootPath) return;
            setShowWelcome(false);
            safeLocalStorage.set(ACTIVE_PROJECT_KEY, projectRootPath);
          }}
          onCreateComplete={handleOnboardingComplete}
          onOpenProject={async rootPath => {
            setProjectError(null);
            // Check if File System API is available before attempting to load (skip in test environment)
            const isTest =
              typeof globalThis !== 'undefined' &&
              (globalThis.vitest || globalThis.__APP_VERSION__ === '0.0.0');
            if (!isTest && !('showDirectoryPicker' in window)) {
              setProjectError(
                'This app requires the File System Access API, which is not available in this browser environment. Please use a compatible browser like Chrome or Edge.',
              );
              return;
            }

            // In test environment, always try to load directly
            if (isTest) {
              loadProject(rootPath);
              return;
            }

            // Check if project has a valid handle
            try {
              const handle = await getHandle(rootPath);
              if (!handle) {
                // No stored handle — try to reselect immediately (this click is a user gesture)
                try {
                  const picked = await (window as any).showDirectoryPicker();
                  await saveHandle(rootPath, picked);
                  // Now load using the newly saved handle
                  loadProject(rootPath);
                  return;
                } catch (pickErr) {
                  // User cancelled or an error occurred — fall back to onboarding modal to guide reselection
                  console.warn('Folder re-selection cancelled or failed:', pickErr);
                  setProjectNeedingReselection(rootPath);
                  setShowOnboarding(true);
                  return;
                }
              }

              // Handle exists, try to load the project
              loadProject(rootPath);
            } catch (err) {
              // Error checking handle, fall back to onboarding modal
              console.warn('Error checking stored handle on project open:', err);
              setProjectNeedingReselection(rootPath);
              setShowOnboarding(true);
            }
          }}
          recentProjects={recentProjects}
          canClose={Boolean(projectRootPath)}
          errorMessage={projectError}
        />
      )}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setProjectNeedingReselection(null);
        }}
        onComplete={state => handleOnboardingComplete(state, projectNeedingReselection)}
        recentProjects={recentProjects}
        onSelectRecent={rootPath => {
          setProjectError(null);
          setProjectNeedingReselection(null);
          setShowOnboarding(false);
          loadProject(rootPath);
        }}
      />

      {/* Loading Modal */}
      <LoadingModal
        isOpen={loadingProject}
        title="Loading Project"
        message={loadingMessage}
        progress={loadingProgress}
        showProgressBar={true}
      />
    </div>
  );
}
