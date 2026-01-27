import { MutableRefObject, useCallback, useEffect, useState, useRef } from 'react';
import safeLocalStorage from '../utils/safeLocalStorage';
import { detectDayNumberFromFolderName } from '../../services/folderDetectionService';
import {
  buildPhotosFromHandle,
  getHandle,
  getState,
  initProject,
  ProjectPhoto,
  ProjectSettings,
  ProjectState,
  saveHandle,
  saveState,
} from '../services/projectService';
import { OnboardingState, RecentProject } from '../OnboardingModal';
import { ACTIVE_PROJECT_KEY, RECENT_PROJECTS_KEY } from '../constants/projectKeys';

const DEFAULT_SETTINGS: ProjectSettings = {
  autoDay: true,
  folderStructure: {
    daysFolder: '01_DAYS',
    archiveFolder: '98_ARCHIVE',
    favoritesFolder: 'FAV',
    metaFolder: '_meta',
  },
};
const STATE_PREFIX = 'narrative:projectState:';

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
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [projectName, setProjectName] = useState('No Project');
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [projectFolderLabel, setProjectFolderLabel] = useState<string | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
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
  const [dayContainers, setDayContainers] = useState<string[]>([]);
  const initializeRef = useRef(false); // Track if we've already initialized

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
      setDayLabels((state as any).dayLabels || {});
      setDayContainers((state as any).dayContainers || []);
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
        const merged = { ...existing, ...project } as RecentProject;
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
        setPermissionRetryProjectId(null);
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
        const permission = await handle.requestPermission({ mode: 'read' });

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
          : applySuggestedDays(initResult.photos, initResult.suggestedDays);

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
            dayContainers: existingState.dayContainers || selectedDayContainers,
            dayLabels: existingState.dayLabels,
            lastModified: Date.now(),
          };
        } else {
          nextProjectId = initResult.projectId;
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
            if (handle) {
              setPermissionRetryProjectId(activeProjectId);
              setProjectError(
                'Project needs permission to access its folder. Click "Try Again" to grant access.',
              );
              setShowWelcome(true);
            } else {
              setShowWelcome(true);
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

  return {
    photos,
    setPhotos,
    projectName,
    setProjectName,
    projectRootPath,
    setProjectRootPath,
    projectFolderLabel,
    setProjectFolderLabel,
    projectSettings,
    setProjectSettings,
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
    dayContainers,
    setDayContainers,
    loadProject,
    retryProjectPermission,
    handleOnboardingComplete,
    updateRecentProjects,
    applySuggestedDays,
    applyFolderMappings,
    applyDayContainers,
  };
}
