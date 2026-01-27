import React, { useState, useEffect, useCallback, useRef } from 'react';
import safeLocalStorage from './utils/safeLocalStorage';
import * as coverStorage from './utils/coverStorageService';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';
import StartScreen from './StartScreen';
import LoadingModal from './ui/LoadingModal';
import { versionManager } from '../../lib/versionManager';
import { detectDayNumberFromFolderName } from '../../lib/folderDetectionService';
import {
  deleteProject as deleteProjectService,
  ProjectPhoto,
  saveHandle,
  getHandle,
} from './services/projectService';
import { ACTIVE_PROJECT_KEY, RECENT_PROJECTS_KEY } from './constants/projectKeys';
import { useHistory } from './hooks/useHistory';
import { usePhotoSelection } from './hooks/usePhotoSelection';
import { useProjectState } from './hooks/useProjectState';
import { useViewOptions } from './hooks/useViewOptions';
import { useToast } from './hooks/useToast';
import { useExportScript } from './hooks/useExportScript';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import ProjectHeader from './components/ProjectHeader';
import LeftSidebar from './components/LeftSidebar';
import PhotoGrid from './components/PhotoGrid';
import RightSidebar from './components/RightSidebar';
import HelpModal from './components/HelpModal';
import ExportScriptModal from './components/ExportScriptModal';
import Toast from './components/Toast';
import FullscreenOverlay from './components/FullscreenOverlay';

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

export default function PhotoOrganizer() {
  const prevThumbnailsRef = useRef<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState(versionManager.getDisplayVersion());
  const debugEnabled = import.meta.env.DEV && safeLocalStorage.get('narrative:debug') === '1';
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingDayName, setEditingDayName] = useState('');
  const [exportCopyStatus, setExportCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [exportScriptText, setExportScriptText] = useState('');
  const [coverSelectionMode, setCoverSelectionMode] = useState(false);

  // Hooks for state management
  const { toast, showToast, clearToast } = useToast();
  const {
    currentView,
    setCurrentView,
    sidebarCollapsed,
    setSidebarCollapsed,
    hideAssigned,
    setHideAssigned,
    showHelp,
    setShowHelp,
    showExportScript,
    setShowExportScript,
    galleryViewPhoto,
    setGalleryViewPhoto,
    fullscreenPhoto,
    setFullscreenPhoto,
    selectedDay,
    setSelectedDay,
    selectedRootFolder,
    setSelectedRootFolder,
    foldersViewStateRef,
  } = useViewOptions();

  const {
    photos,
    setPhotos,
    projectName,
    setProjectName,
    projectRootPath,
    setProjectRootPath,
    projectFolderLabel,
    projectSettings,
    recentProjects,
    setRecentProjects,
    showOnboarding,
    setShowOnboarding,
    showWelcome,
    setShowWelcome,
    projectError,
    setProjectError,
    permissionRetryProjectId,
    projectNeedingReselection,
    setProjectNeedingReselection,
    loadingProject,
    loadingProgress,
    loadingMessage,
    dayLabels,
    setDayLabels,
    dayContainers,
    loadProject,
    retryProjectPermission,
    handleOnboardingComplete: handleOnboardingCompleteInternal,
  } = useProjectState({
    debugEnabled,
    showToast,
    prevThumbnailsRef,
  });

  const { setHistory, setHistoryIndex, persistState, saveToHistory, undo, redo } = useHistory({
    photos,
    setPhotos,
    projectRootPath,
    projectName,
    projectFolderLabel,
    projectSettings,
    dayLabels,
    prevThumbnailsRef,
  });

  // Export script generation
  const { buildExportScript } = useExportScript(photos, dayLabels, projectSettings);

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

  const {
    selectedPhotos,
    setSelectedPhotos,
    focusedPhoto,
    setFocusedPhoto,
    setLastSelectedIndex,
    lastSelectedIndexRef,
    resetSelection,
  } = usePhotoSelection({
    filteredPhotos,
    coverSelectionMode,
    setCoverForPhotoId,
    setCoverSelectionMode,
  });

  const setCoverFromSelection = useCallback(async () => {
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
  }, [projectRootPath, selectedPhotos, showToast, setCoverForPhotoId]);

  const handleOnboardingComplete = useCallback(
    async (state: OnboardingState, reselectionProjectId?: string | null) => {
      const success = await handleOnboardingCompleteInternal(state, reselectionProjectId);
      if (success) {
        setHistory([]);
        setHistoryIndex(-1);
        resetSelection();
        setSelectedDay(null);
        setSelectedRootFolder(null);
        setCurrentView('folders');
      }
    },
    [
      handleOnboardingCompleteInternal,
      resetSelection,
      setCurrentView,
      setHistory,
      setHistoryIndex,
      setSelectedDay,
      setSelectedRootFolder,
    ],
  );

  const clearSelectedDay = useCallback(() => {
    setSelectedDay(null);
    setSelectedRootFolder(null);
  }, [setSelectedDay, setSelectedRootFolder]);

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

  // Assign bucket to one or many photos (accepts id or array of ids)
  const assignBucket = useCallback(
    (photoIds: string | string[], bucket: string, dayNum: number | null = null) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      // Keep counters per day+bucket to create sequences for bulk operations
      const counters: Record<string, number> = {};
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
    (photoIds: string | string[]) => {
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
    (photoIds: string | string[]) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      const newPhotos = photos.map(photo =>
        ids.includes(photo.id) ? { ...photo, favorite: !photo.favorite } : photo,
      );
      saveToHistory(newPhotos);
    },
    [photos, saveToHistory],
  );

  // Keyboard shortcuts
  // Keyboard shortcuts handler
  useKeyboardShortcuts({
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
    fullscreenPhoto,
    showHelp,
    showExportScript,
    showWelcome,
    showOnboarding,
    coverSelectionMode,
    MECE_BUCKETS,
    onAssignBucket: assignBucket,
    onToggleFavorite: toggleFavorite,
    onUndo: undo,
    onRedo: redo,
    onSetFocusedPhoto: setFocusedPhoto,
    onSetSelectedPhotos: setSelectedPhotos,
    onSetLastSelectedIndex: setLastSelectedIndex,
    onSetFullscreenPhoto: setFullscreenPhoto,
    onSetShowHelp: setShowHelp,
    onSetCoverSelectionMode: setCoverSelectionMode,
    onShowToast: showToast,
    lastSelectedIndexRef,
  });

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

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <ProjectHeader
        showWelcome={showWelcome}
        projectName={projectName}
        stats={stats}
        currentVersion={currentVersion}
        coverSelectionMode={coverSelectionMode}
        selectedPhotosCount={selectedPhotos.size}
        projectRootPath={projectRootPath}
        currentView={currentView}
        hideAssigned={hideAssigned}
        recentProjects={recentProjects}
        projectError={projectError}
        permissionRetryProjectId={permissionRetryProjectId}
        loadingProject={loadingProject}
        onMainMenu={() => {
          setShowOnboarding(false);
          setProjectError(null);
          setShowWelcome(true);
          safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
        }}
        onStartCoverSelection={() => {
          setCoverSelectionMode(true);
          showToast(
            'Select a photo to set as cover. Click a photo to set, or press Esc to cancel.',
            'info',
          );
        }}
        onUseCoverSelection={async () => {
          await setCoverFromSelection();
          setCoverSelectionMode(false);
        }}
        onCancelCoverSelection={() => {
          setCoverSelectionMode(false);
          showToast('Cover selection cancelled.');
        }}
        onSelectRecentProject={projectId => {
          loadProject(projectId);
        }}
        onOpenProject={() => {
          setShowOnboarding(true);
        }}
        onDeleteProject={async () => {
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
        onImportTrip={() => {
          setProjectError(null);
          setShowOnboarding(true);
        }}
        onExportScript={() => {
          setExportScriptText(buildExportScript());
          setExportCopyStatus('idle');
          setShowExportScript(true);
        }}
        onShowHelp={() => setShowHelp(true)}
        onRetryPermission={retryProjectPermission}
        onChangeView={viewId => setCurrentView(viewId)}
        onToggleHideAssigned={() => setHideAssigned(prev => !prev)}
        onRememberFoldersViewState={() => {
          foldersViewStateRef.current = { selectedRootFolder, selectedDay };
        }}
        onRestoreFoldersViewState={() => {
          setSelectedRootFolder(foldersViewStateRef.current.selectedRootFolder);
          setSelectedDay(foldersViewStateRef.current.selectedDay);
        }}
        onClearDaySelection={() => {
          setSelectedDay(null);
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar
          currentView={currentView}
          sidebarCollapsed={sidebarCollapsed}
          onCollapseSidebar={() => setSidebarCollapsed(true)}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          visibleDays={visibleDays}
          selectedDay={selectedDay}
          selectedRootFolder={selectedRootFolder}
          onSelectDay={setSelectedDay}
          onSelectRootFolder={setSelectedRootFolder}
          editingDay={editingDay}
          editingDayName={editingDayName}
          onChangeEditingDayName={setEditingDayName}
          onStartEditingDay={(day, name) => {
            setEditingDay(day);
            setEditingDayName(name);
          }}
          onSaveDayName={day => {
            setDayLabels(prev => ({ ...prev, [day]: editingDayName }));
            persistState(photos);
            setEditingDay(null);
          }}
          onCancelEditingDay={() => setEditingDay(null)}
          onClearSelectedDay={clearSelectedDay}
          days={days}
          dayLabels={dayLabels}
          dayContainers={dayContainers}
          photos={photos}
          normalizePath={normalizePath}
          rootGroups={rootGroups}
          displayRootGroups={displayRootGroups}
          sortFolders={sortFolders}
          projectSettings={projectSettings}
          debugEnabled={debugEnabled}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <PhotoGrid
              loadingProject={loadingProject}
              currentView={currentView}
              selectedDay={selectedDay}
              selectedRootFolder={selectedRootFolder}
              photos={photos}
              rootGroups={rootGroups}
              filteredPhotos={filteredPhotos}
              selectedPhotos={selectedPhotos}
              galleryViewPhoto={galleryViewPhoto}
              dayLabels={dayLabels}
              buckets={MECE_BUCKETS}
              onSelectPhoto={photoId => setSelectedPhotos(new Set([photoId]))}
              onOpenViewer={photoId => setGalleryViewPhoto(photoId)}
              onCloseViewer={() => setGalleryViewPhoto(null)}
              onNavigateViewer={photoId => setGalleryViewPhoto(photoId)}
              onToggleFavorite={photoId => {
                setPhotos(prev =>
                  prev.map(p => (p.id === photoId ? { ...p, favorite: !p.favorite } : p)),
                );
                persistState(
                  photos.map(p => (p.id === photoId ? { ...p, favorite: !p.favorite } : p)),
                );
              }}
              onAssignBucket={(photoId, bucket) => assignBucket(photoId, bucket)}
              onAssignDay={(photoId, day) => {
                setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, day } : p)));
                persistState(photos.map(p => (p.id === photoId ? { ...p, day } : p)));
              }}
              onSaveToHistory={saveToHistory}
              onShowToast={showToast}
              getSubfolderGroup={getSubfolderGroup}
              getDerivedSubfolderGroup={getDerivedSubfolderGroup}
              isVideoPhoto={isVideoPhoto}
              isMeceBucketLabel={isMeceBucketLabel}
            />
          </div>
        </main>

        {selectedPhotos.size > 0 && !fullscreenPhoto && (
          <RightSidebar
            selectedPhotos={selectedPhotos}
            photos={photos}
            days={days}
            buckets={MECE_BUCKETS}
            onSaveToHistory={saveToHistory}
            onPersistState={persistState}
            onSetDayLabels={setDayLabels}
            onSetSelectedDay={setSelectedDay}
            onSetCurrentView={setCurrentView}
            onSetSelectedPhotos={setSelectedPhotos}
            onRemoveDayAssignment={removeDayAssignment}
            onAssignBucket={assignBucket}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>

      {/* Fullscreen View */}
      <FullscreenOverlay
        photoId={fullscreenPhoto}
        photos={photos}
        onClose={() => setFullscreenPhoto(null)}
      />

      {/* Export Script Modal */}
      <ExportScriptModal
        isOpen={showExportScript}
        scriptText={exportScriptText}
        copyStatus={exportCopyStatus}
        onClose={() => setShowExportScript(false)}
        onCopyScript={async () => {
          try {
            await navigator.clipboard.writeText(exportScriptText);
            setExportCopyStatus('copied');
          } catch {
            setExportCopyStatus('failed');
          }
        }}
      />

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} buckets={MECE_BUCKETS} onClose={() => setShowHelp(false)} />

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={clearToast} />

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
              ((globalThis as any).vitest || (globalThis as any).__APP_VERSION__ === '0.0.0');
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
