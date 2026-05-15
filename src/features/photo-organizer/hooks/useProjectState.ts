import {
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useReducer,
  useState,
  useRef,
} from 'react';
import safeLocalStorage from '../utils/safeLocalStorage';
import { detectDayNumberFromFolderName } from '../../../lib/folderDetectionService';
import {
  buildPhotosFromHandle,
  getHandle,
  getState,
  initProject,
  inspectProjectFolder,
  readProjectStatsFromManifest,
  type ProjectMode,
  ProjectPhoto,
  ProjectSettings,
  ProjectState,
  saveHandle,
  saveState,
} from '../services/projectService';
import { OnboardingState, RecentProject } from '../OnboardingModal';
import { ACTIVE_PROJECT_KEY, RECENT_PROJECTS_KEY } from '../constants/projectKeys';
import { useOptionalPhotoContext } from '../store/PhotoContext';
import { initialPhotoEngineState, photoReducer } from '../store/photoReducer';

const DEFAULT_SETTINGS: ProjectSettings = {
  autoDay: true,
  folderStructure: {
    inboxFolder: 'Inbox',
    daysFolder: '01_DAYS',
    archiveFolder: 'X_Archive',
  },
};
const STATE_PREFIX = 'narrative:projectState:';

const VIDEO_EXTENSION_REGEX = /\.(mp4|mov|webm|avi|mkv)$/i;
export const calculateProjectStats = (
  photos: ProjectPhoto[],
  settings?: { inboxFolder?: string; archiveFolder?: string },
) => {
  const archiveFolder = (settings?.archiveFolder || 'X_Archive').toLowerCase();
  let inboxCount = 0;
  let assignedCount = 0;
  let archivedCount = 0;
  let videoCount = 0;

  photos.forEach(p => {
    const topFolder = (p.filePath?.split(/[\\/]/)[0] || '').toLowerCase();
    if (topFolder === archiveFolder || p.archived) {
      archivedCount++;
    } else if (p.day != null) {
      assignedCount++;
    } else {
      inboxCount++;
    }

    if (
      p.mimeType?.startsWith('video/') ||
      (p.originalName && VIDEO_EXTENSION_REGEX.test(p.originalName))
    ) {
      videoCount++;
    }
  });

  return { totalPhotos: photos.length, inboxCount, assignedCount, archivedCount, videoCount };
};

interface UseProjectStateOptions {
  debugEnabled: boolean;
  showToast: (message: string, tone?: 'info' | 'error') => void;
  prevThumbnailsRef: MutableRefObject<string[]>;
}

export function useProjectState({
  debugEnabled,
  showToast,
  prevThumbnailsRef,
}: UseProjectStateOptions) {
  const sharedPhotoContext = useOptionalPhotoContext();
  const [localPhotoState, localPhotoDispatch] = useReducer(photoReducer, initialPhotoEngineState);
  const photoState = sharedPhotoContext?.state ?? localPhotoState;
  const photoDispatch = sharedPhotoContext?.dispatch ?? localPhotoDispatch;
  const photos = photoState.photos;
  const [projectName, setProjectName] = useState('No Project');
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [projectFolderLabel, setProjectFolderLabel] = useState<string | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [projectMode, setProjectMode] = useState<ProjectMode>('single_day');
  const [ingested, setIngested] = useState<boolean>(true);
  const [sourceRoot, setSourceRoot] = useState<string | undefined>(undefined);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !safeLocalStorage.get(ACTIVE_PROJECT_KEY));
  const [projectError, setProjectError] = useState<string | null>(null);
  const [permissionRetryProjectId, setPermissionRetryProjectId] = useState<string | null>(null);
  const [projectNeedingReselection, setProjectNeedingReselection] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading project...');
  const [dayLabels, setDayLabels] = useState<Record<number, string>>({});
  const [dayNotes, setDayNotes] = useState<Record<number, string>>({});
  const [dayContainers, setDayContainers] = useState<string[]>([]);
  const [coverPhotoPath, setCoverPhotoPath] = useState<string | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [createdAt, setCreatedAt] = useState<number | undefined>(undefined);
  const initializeRef = useRef(false); // Track if we've already initialized
  const autosaveTimerRef = useRef<number | null>(null);

  const setPhotos = useCallback(
    (value: SetStateAction<ProjectPhoto[]>, options?: { resetHistory?: boolean }) => {
      const nextPhotos =
        typeof value === 'function'
          ? (value as (prev: ProjectPhoto[]) => ProjectPhoto[])(photos)
          : value;
      photoDispatch({
        type: 'SET_PHOTOS',
        payload: nextPhotos,
        resetHistory: options?.resetHistory ?? true,
      });
    },
    [photoDispatch, photos],
  );

  const commitPhotos = useCallback(
    (nextPhotos: ProjectPhoto[]) => {
      photoDispatch({ type: 'COMMIT_PHOTOS', payload: nextPhotos });
    },
    [photoDispatch],
  );

  const undo = useCallback(() => {
    photoDispatch({ type: 'UNDO' });
  }, [photoDispatch]);

  const redo = useCallback(() => {
    photoDispatch({ type: 'REDO' });
  }, [photoDispatch]);

  const clearPhotoHistory = useCallback(() => {
    photoDispatch({ type: 'CLEAR_HISTORY' });
  }, [photoDispatch]);

  const deriveProjectName = useCallback((rootPath: string) => {
    const parts = rootPath.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || 'Untitled Project';
  }, []);

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

  const setProjectFromState = useCallback(
    (state: ProjectState) => {
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
      setProjectMode(state.projectMode || 'single_day');
      setIngested(state.ingested ?? true);
      setSourceRoot(state.sourceRoot);
      setDayLabels(state.dayLabels || {});
      setDayNotes(state.dayNotes || {});
      setDayContainers(state.dayContainers || []);
      setCoverPhotoPath(state.coverPhotoPath);
      setDisplayName(state.displayName);
      setDescription(state.description);
      setCreatedAt(state.createdAt);
    },
    [prevThumbnailsRef],
  );

  const updateRecentProjects = useCallback(
    (project: RecentProject) => {
      try {
        const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
        const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
        const normalized = parsed.map(p => ({
          ...p,
          projectId: p.projectId || p.rootPath,
        }));

        let existingIndex = normalized.findIndex(p => p.projectId === project.projectId);
        if (existingIndex === -1) {
          existingIndex = normalized.findIndex(p => p.rootPath === project.rootPath);
        }

        const existing = existingIndex !== -1 ? normalized[existingIndex] : {};
        const merged = {
          ...existing,
          ...project,
          createdAt: (existing as RecentProject).createdAt || project.createdAt || Date.now(),
        } as RecentProject;
        const filtered = normalized.filter((_, index) => index !== existingIndex);

        const next = [merged, ...filtered].slice(0, 20);
        safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(next));
        setRecentProjects(next);
      } catch (err) {
        if (err instanceof Error && err.name === 'QuotaExceededError') {
          try {
            const withLimitedCovers = [project, ...recentProjects]
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
            try {
              const minimalProjects = [project, ...recentProjects.slice(0, 9)].map((p, idx) => {
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
              try {
                const currentOnly = [{ ...project, coverUrl: undefined }];
                safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(currentOnly));
                setRecentProjects(currentOnly);
                showToast('Storage full. Reset to current project only.', 'error');
              } catch (clearErr) {
                safeLocalStorage.remove(RECENT_PROJECTS_KEY);
                setRecentProjects([]);
                showToast('Storage exhausted. Unable to save projects.', 'error');
              }
            }
          }
        } else {
          showToast('Failed to persist recent project updates. Changes may not be saved.', 'error');
        }
      }
    },
    [recentProjects, showToast],
  );

  const applyFolderMappings = useCallback((sourcePhotos: ProjectPhoto[], mappings: any[]) => {
    const folderByName = new Map<string, any>();
    mappings.forEach(m => folderByName.set(m.folderPath || m.folder, m));

    return sourcePhotos.map(p => {
      if (!p.filePath) return p;
      if (p.isPreOrganized && p.day != null && p.bucket != null) return p;
      const parts = p.filePath.split(/[\\/]/);
      const filePathNormalized = parts.join('/');

      if (parts.length > 1) {
        const sub = parts[1];
        const match = sub.match(/^D(\d{1,2})/i);
        if (match) {
          const d = parseInt(match[1], 10);
          if (!Number.isNaN(d)) return { ...p, day: d };
        }
      }

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

      if (p.day != null) return p;
      return { ...p, day: null };
    });
  }, []);

  const applyDayContainers = useCallback((sourcePhotos: ProjectPhoto[], containers: string[]) => {
    const containerDayMap = new Map<string, number>();
    containers.forEach((container, index) => {
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
  }, []);

  const loadProject = useCallback(
    async (projectId: string, options?: { addRecent?: boolean }) => {
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.log('[Performance] Starting project load:', projectId);
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
        const photosWithDays = applyDayContainers(state.photos, state.dayContainers || []);
        const stateWithDays = { ...state, photos: photosWithDays };

        setLoadingProgress(75);
        setLoadingMessage('Initializing view...');
        setProjectFromState(stateWithDays);
        setProjectRootPath(projectId);
        setShowOnboarding(false);
        setShowWelcome(false);
        safeLocalStorage.set(ACTIVE_PROJECT_KEY, projectId);

        setLoadingProgress(90);
        if (options?.addRecent !== false) {
          const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
          const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
          const normalized = parsed.map(p => ({
            ...p,
            projectId: p.projectId || p.rootPath,
          }));
          let existingProject = normalized.find(p => p.projectId === projectId);
          if (!existingProject) {
            existingProject = normalized.find(p => p.rootPath === projectId);
          }
          const existingCoverUrl = existingProject?.coverUrl;
          const projectStats = calculateProjectStats(
            photosWithDays,
            state.settings?.folderStructure,
          );

          updateRecentProjects({
            projectName: state.projectName || 'Untitled Project',
            projectId,
            rootPath: state.rootPath || 'Unknown location',
            lastOpened: Date.now(),
            ...(existingCoverUrl && { coverUrl: existingCoverUrl }),
            ...projectStats,
          });
        }
        setLoadingProgress(100);
        setPermissionRetryProjectId(null);

        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const duration = endTime - startTime;
        const photoCount = photosWithDays.length;
        console.log('[Performance] Project loaded in:', duration.toFixed(2), 'ms');
        console.log('[Performance] Photo count:', photoCount);
        if (photoCount > 0) {
          console.log('[Performance] Time per photo:', (duration / photoCount).toFixed(2), 'ms');
        }
        if (duration > 5000) {
          showToast('Large project loaded. Performance may be slower.', 'info');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load project';
        console.error('Failed to load project:', err);
        setProjectError(message);

        if (
          (message.includes('access') && !message.includes('no longer available')) ||
          message.includes('permission') ||
          message.includes('granted')
        ) {
          setPermissionRetryProjectId(projectId);
        }

        showToast(message, 'error');
        safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
        setShowWelcome(true);
      } finally {
        setLoadingProject(false);
        setLoadingProgress(0);
      }
    },
    [applyDayContainers, setProjectFromState, showToast, updateRecentProjects],
  );

  const retryProjectPermission = useCallback(async () => {
    if (!permissionRetryProjectId) return;

    setLoadingProject(true);
    setLoadingProgress(0);
    setLoadingMessage('Requesting folder access...');
    setProjectError(null);

    try {
      const handle = await getHandle(permissionRetryProjectId);
      if (handle) {
        setLoadingProgress(25);
        setLoadingMessage('Re-requesting permissions...');
        const permission = await (handle as any).requestPermission({ mode: 'read' });

        if (permission === 'granted') {
          setLoadingProgress(50);
          setLoadingMessage('Loading project...');
          await loadProject(permissionRetryProjectId, { addRecent: false });
          setPermissionRetryProjectId(null);
          return;
        }
      } else {
        throw new Error(
          'Project folder access is no longer available. Please reselect the folder from the start screen.',
        );
      }

      throw new Error('Folder access was not granted.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry permission';
      console.error('Failed to retry permission:', err);
      setProjectError(message);
      showToast(message, 'error');
      setShowWelcome(true);
      setPermissionRetryProjectId(null);
    } finally {
      setLoadingProject(false);
      setLoadingProgress(0);
    }
  }, [permissionRetryProjectId, loadProject, showToast]);

  const bulkImportProjects = useCallback(
    async (parentHandle: FileSystemDirectoryHandle) => {
      setLoadingProject(true);
      setLoadingProgress(0);
      setLoadingMessage('Scanning project folders...');
      setProjectError(null);

      const importedProjects: RecentProject[] = [];
      const failures: string[] = [];

      try {
        const childFolders: Array<{ name: string; handle: FileSystemDirectoryHandle }> = [];
        // @ts-ignore - entries() is supported by Chromium's File System Access API.
        for await (const [name, handle] of parentHandle.entries()) {
          if (handle.kind === 'directory') {
            childFolders.push({ name, handle: handle as FileSystemDirectoryHandle });
          }
        }

        childFolders.sort((a, b) => a.name.localeCompare(b.name));

        if (childFolders.length === 0) {
          showToast('No project folders found in the selected folder.', 'info');
          return { imported: 0, failed: 0 };
        }

        const existingRootPaths = new Set(
          recentProjects.map(project => project.rootPath.toLowerCase()),
        );

        for (let index = 0; index < childFolders.length; index += 1) {
          const child = childFolders[index];
          const rootLabel = `${parentHandle.name}/${child.name}`;
          const baseProgress = (index / childFolders.length) * 100;
          const progressSpan = 100 / childFolders.length;

          if (existingRootPaths.has(rootLabel.toLowerCase())) {
            setLoadingProgress(baseProgress + progressSpan);
            continue;
          }

          setLoadingMessage(`Importing ${child.name} (${index + 1} of ${childFolders.length})...`);

          try {
            const inspection = await inspectProjectFolder(child.handle);
            const projectMode = inspection.inferredProjectMode || 'single_day';
            const initResult = await initProject({
              dirHandle: child.handle,
              projectName: child.name,
              rootLabel,
              projectMode,
              onProgress: progress => {
                setLoadingProgress(baseProgress + (progress / 100) * progressSpan);
              },
            });

            const projectStats = calculateProjectStats(
              initResult.photos,
              DEFAULT_SETTINGS.folderStructure,
            );
            importedProjects.push({
              projectName: child.name,
              projectId: initResult.projectId,
              rootPath: rootLabel,
              lastOpened: Date.now(),
              ...projectStats,
            });
          } catch (err) {
            console.warn(`Failed to import ${child.name}:`, err);
            failures.push(child.name);
          }
        }

        if (importedProjects.length > 0) {
          const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
          const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
          const normalized = parsed.map(project => ({
            ...project,
            projectId: project.projectId || project.rootPath,
          }));
          const importedIds = new Set(importedProjects.map(project => project.projectId));
          const next = [
            ...importedProjects.reverse(),
            ...normalized.filter(project => !importedIds.has(project.projectId)),
          ].slice(0, 20);
          safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(next));
          setRecentProjects(next);
        }

        setLoadingProgress(100);

        if (importedProjects.length > 0 && failures.length > 0) {
          showToast(
            `Imported ${importedProjects.length} projects. ${failures.length} could not be imported.`,
            'info',
          );
        } else if (importedProjects.length > 0) {
          showToast(`Imported ${importedProjects.length} projects.`, 'info');
        } else if (failures.length > 0) {
          showToast('No projects were imported. Check folder permissions and try again.', 'error');
        } else {
          showToast('Those project folders are already on the dashboard.', 'info');
        }

        return { imported: importedProjects.length, failed: failures.length };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to bulk import projects';
        setProjectError(message);
        showToast(message, 'error');
        return { imported: importedProjects.length, failed: failures.length || 1 };
      } finally {
        setLoadingProject(false);
        setLoadingProgress(0);
      }
    },
    [recentProjects, showToast],
  );

  const handleOnboardingComplete = useCallback(
    async (state: OnboardingState, reselectionProjectId?: string | null) => {
      setLoadingProject(true);
      setLoadingProgress(0);
      setLoadingMessage('Initializing project...');
      setProjectError(null);
      try {
        if (reselectionProjectId) {
          setLoadingProgress(25);
          setLoadingMessage('Saving folder access...');
          await saveHandle(reselectionProjectId, state.dirHandle);

          setLoadingProgress(50);
          setLoadingMessage('Loading project...');
          loadProject(reselectionProjectId);
          return true;
        }

        setLoadingProgress(5);
        setLoadingMessage('Requesting folder access...');
        const initResult = await initProject({
          dirHandle: state.dirHandle,
          projectName: state.projectName,
          rootLabel: state.rootPath,
          projectMode: state.projectMode,
          onProgress: (progress, message) => {
            const mappedProgress = 5 + progress * 0.789;
            setLoadingProgress(mappedProgress);
            setLoadingMessage(message);
          },
        });

        setLoadingProgress(80);
        setLoadingMessage('Processing photo organization...');
        const hydratedPhotos = state.mappings?.length
          ? applyFolderMappings(initResult.photos, state.mappings)
          : state.projectMode === 'multi_day'
          ? applySuggestedDays(initResult.photos, initResult.suggestedDays)
          : initResult.photos;

        if (debugEnabled) {
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
          folderGroups.forEach((groupPhotos, folder) => {
            const dayCounts = new Map<number | null, number>();
            groupPhotos.forEach(p => {
              const day = p.day;
              dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
            });

            console.group(`📂 ${folder} (${groupPhotos.length} photos)`);
            dayCounts.forEach((count, day) => {
              console.log(`  Day ${day || 'null'}: ${count} photos`);
            });
            console.table(
              groupPhotos.map(p => ({
                id: p.id,
                fileName: p.originalName,
                day: p.day,
                filePath: p.filePath,
              })),
            );
            console.groupEnd();
          });

          console.log('📅 Photos by day:');
          const dayGroups = new Map<number | null, ProjectPhoto[]>();
          hydratedPhotos.forEach(photo => {
            const day = photo.day;
            if (!dayGroups.has(day)) {
              dayGroups.set(day, []);
            }
            dayGroups.get(day)!.push(photo);
          });

          dayGroups.forEach((groupPhotos, day) => {
            const folderCounts = new Map<string, number>();
            groupPhotos.forEach(p => {
              const parts = (p.filePath || p.originalName || '').split('/');
              const folder = parts.length > 1 ? parts[0] : '(root)';
              folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
            });

            console.group(`📆 Day ${day || 'null'} (${groupPhotos.length} photos)`);
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
          nextProjectId = reselectionProjectId;
          setLoadingProgress(80);
          setLoadingMessage('Loading existing project data...');

          const raw = safeLocalStorage.get(`${STATE_PREFIX}${reselectionProjectId}`);
          const existingState = raw ? JSON.parse(raw) : {};

          const freshPhotos = await buildPhotosFromHandle(state.dirHandle);

          let freshWithEdits = freshPhotos;
          if (existingState.edits) {
            const cachedEdits = new Map<string, any>();
            existingState.edits.forEach((edit: any) => {
              if (edit?.filePath) cachedEdits.set(edit.filePath, edit);
            });

            freshWithEdits = freshPhotos.map(photo => {
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
            photos: freshWithEdits,
            settings: existingState.settings || DEFAULT_SETTINGS,
            projectMode: existingState.projectMode || state.projectMode || 'single_day',
            dayContainers: existingState.dayContainers || selectedDayContainers,
            dayLabels: existingState.dayLabels,
            lastModified: Date.now(),
            ingested: existingState.ingested ?? true,
            sourceRoot: existingState.sourceRoot,
          };
        } else {
          nextProjectId = initResult.projectId;
          nextState = {
            projectName: nextProjectName,
            rootPath: state.rootPath || state.dirHandle.name,
            photos: hydratedPhotos,
            settings: DEFAULT_SETTINGS,
            projectMode: state.projectMode,
            dayContainers: selectedDayContainers,
            ingested: true,
          };
        }

        setLoadingProgress(90);
        setLoadingMessage('Saving project state...');
        setPhotos(nextState.photos);
        setProjectName(nextProjectName);
        setProjectRootPath(nextProjectId);
        setProjectFolderLabel(state.rootPath || state.dirHandle.name);
        setProjectSettings(nextState.settings || DEFAULT_SETTINGS);
        setProjectMode(nextState.projectMode || 'single_day');
        setIngested(nextState.ingested ?? true);
        setSourceRoot(nextState.sourceRoot);
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
          ...calculateProjectStats(hydratedPhotos, nextState.settings?.folderStructure),
        });

        setLoadingProgress(98);
        setLoadingMessage('Finalizing project...');
        await saveState(nextProjectId, nextState);
        setShowWelcome(false);
        setLoadingProgress(100);
        setPermissionRetryProjectId(null);
        return true;
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to initialize project');
        setShowOnboarding(true);
        setShowWelcome(true);
        return false;
      } finally {
        setLoadingProject(false);
        setLoadingProgress(0);
      }
    },
    [
      applyFolderMappings,
      applySuggestedDays,
      debugEnabled,
      deriveProjectName,
      loadProject,
      updateRecentProjects,
    ],
  );

  useEffect(() => {
    // Only run initialization once
    if (initializeRef.current) return;
    initializeRef.current = true;

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

          const uniqueProjects = new Map();
          normalized.forEach(p => {
            if (p.projectId && !uniqueProjects.has(p.projectId)) {
              uniqueProjects.set(p.projectId, p);
            }
          });
          const deduped = Array.from(uniqueProjects.values());

          if (JSON.stringify(deduped) !== JSON.stringify(parsed)) {
            safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(deduped));
          }

          console.log(
            'Loaded recent projects:',
            deduped.map(p => ({ id: p.projectId, cover: p.coverUrl ? 'has cover' : 'no cover' })),
          );
          setRecentProjects(deduped);

          // Recompute stats for all projects from their .narrative.json manifests
          // in the background so the dashboard shows accurate assigned/unassigned
          // counts without requiring the user to open each project first.
          Promise.all(
            deduped.map(async project => {
              const stats = await readProjectStatsFromManifest(project.projectId);
              return stats ? { ...project, ...stats } : project;
            }),
          ).then(refreshed => {
            setRecentProjects(refreshed);
            safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(refreshed));
          }).catch(() => {
            // keep deduped on failure
          });
        } catch (err) {
          console.warn('Failed to parse recent projects from storage', err);
          setRecentProjects([]);
        }
      }
    } catch (err) {
      setRecentProjects([]);
    }

    const activeProjectId = safeLocalStorage.get(ACTIVE_PROJECT_KEY);
    const isTest =
      typeof globalThis !== 'undefined' &&
      (globalThis.vitest || (globalThis as any).__APP_VERSION__ === '0.0.0');

    if (activeProjectId && (isTest || 'showDirectoryPicker' in window)) {
      if (isTest) {
        // In test environment, don't auto-load - let the test control loading
        setShowWelcome(false);
      } else {
        (async () => {
          try {
            const handle = await getHandle(activeProjectId);
            if (!handle) {
              // No stored handle - show welcome screen
              setShowWelcome(true);
            } else {
              // Handle exists - try to load the project
              loadProject(activeProjectId);
            }
          } catch (err) {
            console.warn('Error checking stored handle on startup:', err);
            setShowWelcome(true);
          }
        })();
      }
    } else {
      setShowWelcome(true);
    }
  }, []); // Empty array - run only once on mount

  useEffect(() => {
    if (!projectRootPath || loadingProject || showWelcome) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      const state: ProjectState = {
        projectName: projectName || 'Untitled Project',
        rootPath: projectFolderLabel || projectName || 'Unknown location',
        photos,
        settings: projectSettings,
        projectMode,
        dayLabels,
        dayNotes,
        dayContainers: dayContainers || [],
        lastModified: Date.now(),
        ingested,
        sourceRoot,
        coverPhotoPath,
        displayName,
        description,
        createdAt,
      };

      saveState(projectRootPath, state).catch(err => {
        console.warn('Autosave failed:', err);
      });
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    projectRootPath,
    projectName,
    projectFolderLabel,
    projectSettings,
    photos,
    dayLabels,
    dayNotes,
    dayContainers,
    ingested,
    sourceRoot,
    projectMode,
    loadingProject,
    showWelcome,
    coverPhotoPath,
    displayName,
    description,
    createdAt,
  ]);

  const persistState = useCallback(
    (newPhotos?: ProjectPhoto[]) => {
      if (!projectRootPath) return;
      const nextState: ProjectState = {
        projectName,
        rootPath: projectFolderLabel || projectRootPath,
        photos: newPhotos ?? photos,
        settings: projectSettings,
        projectMode,
        dayLabels,
        dayNotes,
        dayContainers: dayContainers || [],
        lastModified: Date.now(),
        ingested,
        sourceRoot,
        coverPhotoPath,
        displayName,
        description,
        createdAt,
      };
      saveState(projectRootPath, nextState).catch(() => {});
    },
    [
      projectRootPath,
      projectName,
      projectFolderLabel,
      photos,
      projectSettings,
      dayLabels,
      dayNotes,
      dayContainers,
      ingested,
      sourceRoot,
      projectMode,
      coverPhotoPath,
      displayName,
      description,
      createdAt,
    ],
  );

  return {
    photos,
    setPhotos,
    commitPhotos,
    photoDispatch,
    undo,
    redo,
    clearPhotoHistory,
    canUndo: photoState.past.length > 0,
    canRedo: photoState.future.length > 0,
    persistState,
    projectName,
    setProjectName,
    projectRootPath,
    setProjectRootPath,
    projectFolderLabel,
    setProjectFolderLabel,
    projectSettings,
    setProjectSettings,
    projectMode,
    setProjectMode,
    ingested,
    setIngested,
    sourceRoot,
    setSourceRoot,
    recentProjects,
    setRecentProjects,
    showOnboarding,
    setShowOnboarding,
    showWelcome,
    setShowWelcome,
    projectError,
    setProjectError,
    permissionRetryProjectId,
    setPermissionRetryProjectId,
    projectNeedingReselection,
    setProjectNeedingReselection,
    loadingProject,
    loadingProgress,
    loadingMessage,
    dayLabels,
    setDayLabels,
    dayNotes,
    setDayNotes,
    dayContainers,
    setDayContainers,
    coverPhotoPath,
    setCoverPhotoPath,
    displayName,
    setDisplayName,
    description,
    setDescription,
    createdAt,
    setCreatedAt,
    loadProject,
    retryProjectPermission,
    bulkImportProjects,
    handleOnboardingComplete,
    updateRecentProjects,
    applySuggestedDays,
    applyFolderMappings,
    applyDayContainers,
  };
}
