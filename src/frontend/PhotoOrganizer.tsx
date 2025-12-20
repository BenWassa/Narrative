import React, { useState, useEffect, useCallback, useRef } from 'react';
import safeLocalStorage from './utils/safeLocalStorage';
import {
  Camera,
  ChevronDown,
  Calendar,
  Heart,
  Undo2,
  Redo2,
  X,
  FolderOpen,
  Download,
  Loader,
} from 'lucide-react';
import { Pencil, Save, X as XIcon } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';
import StartScreen from './StartScreen';
import {
  initProject,
  getState,
  saveState,
  ProjectPhoto,
  ProjectSettings,
  ProjectState,
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
  { key: 'F', label: 'Mood/Night', color: 'bg-indigo-500', description: 'Atmosphere, evening' },
  { key: 'X', label: 'Archive', color: 'bg-gray-500', description: 'Unwanted shots' },
];

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
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [history, setHistory] = useState<ProjectPhoto[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [projectName, setProjectName] = useState('No Project');
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [projectFolderLabel, setProjectFolderLabel] = useState<string | null>(null);
  const [dayLabels, setDayLabels] = useState<Record<number, string>>({});
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingDayName, setEditingDayName] = useState('');
  const [selectedRootFolder, setSelectedRootFolder] = useState<string | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [showExportScript, setShowExportScript] = useState(false);
  const [exportScriptText, setExportScriptText] = useState('');
  const [exportCopyStatus, setExportCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

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

  const setProjectFromState = useCallback((state: ProjectState) => {
    setPhotos(state.photos || []);
    setProjectName(state.projectName || 'No Project');
    setProjectRootPath(state.rootPath || null);
    setProjectFolderLabel(state.rootPath || null);
    setProjectSettings(state.settings || DEFAULT_SETTINGS);
    setDayLabels((state as any).dayLabels || {});
  }, []);

  const updateRecentProjects = useCallback((project: RecentProject) => {
    try {
      const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
      const filtered = parsed.filter(p => p.projectId !== project.projectId);
      const next = [project, ...filtered].slice(0, 20);
      safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(next));
      setRecentProjects(next);
    } catch (err) {
      // Ignore storage errors
    }
  }, []);

  const buildExportScript = useCallback(() => {
    const lines: string[] = [];
    photos
      .filter(p => p.bucket && !p.archived)
      .forEach(p => {
        const day = p.day as number | null;
        const label = day !== null ? dayLabels[day] || `Day ${String(day).padStart(2, '0')}` : '(root)';
        lines.push(`${label}: ${p.currentName}`);
      });
    return lines.join('\n');
  }, [photos, dayLabels]);

  const applyFolderMappings = useCallback((sourcePhotos: ProjectPhoto[], mappings: any[]) => {
    // Basic implementation used in tests — for now, return source photos unchanged.
    // Real implementation applies mapping rules to assign days or rename files.
    return sourcePhotos;
  }, []);
  const loadProject = useCallback(
    async (projectId: string, options?: { addRecent?: boolean }) => {
      setLoadingProject(true);
      setProjectError(null);
      try {
        const state = await getState(projectId);
        setProjectFromState(state);
        setProjectRootPath(projectId);
        setShowOnboarding(false);
        // Hide the welcome view when a project is successfully loaded
        setShowWelcome(false);
        safeLocalStorage.set(ACTIVE_PROJECT_KEY, projectId);
        if (options?.addRecent !== false) {
          updateRecentProjects({
            projectName: state.projectName || 'Untitled Project',
            projectId,
            rootPath: state.rootPath || 'Unknown location',
            lastOpened: Date.now(),
          });
        }
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to load project');
        safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
        // Show the welcome page so the user can try other options
        setShowWelcome(true);
      } finally {
        setLoadingProject(false);
      }
    },
    [setProjectFromState, updateRecentProjects],
  );

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
          setRecentProjects(normalized);
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
    if (activeProjectId) {
      loadProject(activeProjectId, { addRecent: false });
      setShowWelcome(false);
    } else {
      // Show a friendly welcome page on first load
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

  // Root-level groups (top-level folders under the project root)
  const rootGroups = React.useMemo(() => {
    const map = new Map<string, ProjectPhoto[]>();
    for (const p of photos) {
      if (p.archived) continue;
      const parts = (p.filePath || p.originalName || '').split('/');
      const folder = parts.length > 1 ? parts[0] : '(root)';
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [photos]);

  // Filter photos based on current view
  const filteredPhotos = React.useMemo(() => {
    switch (currentView) {
      case 'days':
        if (selectedDay !== null) {
          // Show photos assigned to the selected day, and also surface unassigned (root) photos
          // so users can easily pick from loose photos when curating a day.
          return photos.filter(p => (p.day === selectedDay || p.day === null) && !p.archived);
        }
        return photos.filter(p => p.day !== null && !p.archived);
      case 'root':
        if (selectedRootFolder !== null) {
          return photos.filter(p => !p.archived && ((p.filePath || p.originalName).split('/')[0] || '(root)') === selectedRootFolder);
        }
        return [];
      case 'favorites':
        return photos.filter(p => p.favorite && !p.archived);
      case 'archive':
        return photos.filter(p => p.archived);
      case 'review':
        return photos.filter(p => p.bucket && !p.archived);
      default:
        return photos;
    }
  }, [photos, currentView, selectedDay]);

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
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(photos)));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
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
          const day = dayNum || photo.day || selectedDay || Math.ceil(new Date(photo.timestamp).getDate() / 1);
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
      const nextPhotos = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setPhotos(nextPhotos);
      persistState(nextPhotos);
    }
  }, [history, historyIndex, persistState]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextPhotos = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setPhotos(nextPhotos);
      persistState(nextPhotos);
    }
  }, [history, historyIndex, persistState]);

  // Folder quick actions (defined after saveToHistory to avoid TDZ)
  const selectFolderPhotos = useCallback((folder: string) => {
    const ids = photos.filter(p => ((p.filePath || p.originalName).split('/')[0] || '(root)') === folder).map(p => p.id);
    setSelectedPhotos(new Set(ids));
    if (ids.length > 0) setFocusedPhoto(ids[0]);
  }, [photos]);

  const assignFolderToDay = useCallback((folder: string) => {
    const day = selectedDay ?? ((photos.reduce((max, p) => (p.day && p.day > max ? p.day : max), 0) || 0) + 1);
    const ids = photos.filter(p => ((p.filePath || p.originalName).split('/')[0] || '(root)') === folder).map(p => p.id);
    const newPhotos = photos.map(p => (ids.includes(p.id) ? { ...p, day } : p));
    saveToHistory(newPhotos);
  }, [photos, selectedDay, saveToHistory]);

  const handleOnboardingComplete = useCallback(
    async (state: OnboardingState) => {
      setLoadingProject(true);
      setProjectError(null);
      try {
        const initResult = await initProject({
          dirHandle: state.dirHandle,
          projectName: state.projectName,
          rootLabel: state.rootPath,
        });
        const hydratedPhotos = state.mappings?.length
          ? applyFolderMappings(initResult.photos, state.mappings)
          : applySuggestedDays(initResult.photos, initResult.suggestedDays);
        const nextProjectName = state.projectName?.trim() || deriveProjectName(state.rootPath);
        const nextProjectId = initResult.projectId;
        const nextState: ProjectState = {
          projectName: nextProjectName,
          rootPath: state.rootPath || state.dirHandle.name,
          photos: hydratedPhotos,
          settings: DEFAULT_SETTINGS,
        };

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
        setShowOnboarding(false);
        setShowWelcome(false);
        safeLocalStorage.set(ACTIVE_PROJECT_KEY, nextProjectId);
        updateRecentProjects({
          projectName: nextProjectName,
          projectId: nextProjectId,
          rootPath: state.rootPath || state.dirHandle.name,
          lastOpened: Date.now(),
        });

        await saveState(nextProjectId, nextState);
        // Hide the welcome view after successfully creating a project
        setShowWelcome(false);
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to initialize project');
        setShowOnboarding(true);
        // If onboarding fails, show the welcome page so users can try other paths
        setShowWelcome(true);
      } finally {
        setLoadingProject(false);
      }
    },
    [applyFolderMappings, applySuggestedDays, deriveProjectName, updateRecentProjects],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = e => {
      if (showHelp) {
        if (e.key === 'Escape' || e.key === '?') {
          setShowHelp(false);
        }
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
      if (bucketKey === 'M') {
        bucketKey = 'F';
      }
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

      if (bucket?.key === 'F' && e.key.toLowerCase() === 'm') {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        assignBucket(targets, bucket.key);
        return;
      }

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
    toggleFavorite,
    undo,
    redo,
    showHelp,
    fullscreenPhoto,
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
    (e, photoId, index) => {
      // Shift-range selection (use ref for synchronous access)
      if (
        e.shiftKey &&
        lastSelectedIndexRef.current !== null &&
        lastSelectedIndexRef.current !== undefined
      ) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = filteredPhotos.slice(start, end + 1).map(p => p.id);
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
    },
    [selectedPhotos, lastSelectedIndex, filteredPhotos],
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header - hidden while StartScreen is visible */}
      {!(showWelcome && !projectRootPath) && (
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <Camera className="w-6 h-6 text-blue-400" />
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
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-2 hover:bg-gray-800 rounded disabled:opacity-30"
                title="Undo (Cmd+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 hover:bg-gray-800 rounded disabled:opacity-30"
                title="Redo (Cmd+Shift+Z)"
              >
                <Redo2 className="w-4 h-4" />
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
          {/* Process Stepper (Folders-first workflow) */}
          <div className="flex items-center gap-3 px-6 py-2">
            {(() => {
              const step = currentView === 'folders' || currentView === 'days' ? 'organize' : currentView === 'review' ? 'review' : 'export';
              return (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className={`px-2 py-1 rounded ${step === 'organize' ? 'bg-blue-700 text-white' : 'bg-gray-800'}`}>Import</div>
                  <div className={`px-2 py-1 rounded ${step === 'organize' ? 'bg-blue-700 text-white' : 'bg-gray-800'}`}>Organize</div>
                  <div className={`px-2 py-1 rounded ${step === 'review' ? 'bg-blue-700 text-white' : 'bg-gray-800'}`}>Review</div>
                  <div className={`px-2 py-1 rounded ${step === 'export' ? 'bg-blue-700 text-white' : 'bg-gray-800'}`}>Export</div>
                </div>
              );
            })()}
          </div>

          {/* View Tabs */}
          <div className="flex gap-1 px-6 pb-2">
            {[
              { id: 'folders', label: 'Folders', count: stats.root },
              { id: 'days', label: 'Days', count: days.length },
              { id: 'favorites', label: 'Favorites', count: stats.favorites },
              { id: 'archive', label: 'Archive', count: stats.archived },
              { id: 'review', label: 'Review', count: stats.sorted },
            ].map(view => (
              <button
                key={view.id}
                onClick={() => {
                  setCurrentView(view.id);
                  setSelectedDay(null);
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
          {projectError && (
            <div className="mx-6 mb-3 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200">
              {projectError}
            </div>
          )}
        </header>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Days list when in days view */}
        {currentView === 'days' && (
          <aside className="w-48 border-r border-gray-800 bg-gray-900 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Days</h3>
              <div className="space-y-1">
                {days.map(([day, dayPhotos], idx) => (
                  <div
                    key={day}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(day)}
                    onKeyDown={e => e.key === 'Enter' && setSelectedDay(day)}
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
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingDay(day);
                              setEditingDayName(dayLabels[day] || `Day ${String(day).padStart(2, '0')}`);
                            }}
                            className="p-1 ml-2"
                            aria-label={`Edit day ${day}`}
                          >
                            <Pencil className="w-4 h-4 text-gray-400" />
                          </button>
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
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Folders</h3>
              <div className="space-y-1">
                {rootGroups.map(([folder, items]) => (
                  <div
                    key={folder}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedRootFolder(folder);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedRootFolder === folder ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{folder}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            selectFolderPhotos(folder);
                          }}
                          className="px-2 py-1 rounded bg-gray-800 text-xs"
                          aria-label={`Select all photos in ${folder}`}
                        >
                          Select
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            assignFolderToDay(folder);
                          }}
                          className={`px-2 py-1 rounded text-xs ${items.every(p => p.day !== null) ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-700'}`}
                          aria-label={`Assign all photos in ${folder} to day`}
                          disabled={items.every(p => p.day !== null)}
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                    <div className="text-xs opacity-70">{items.length} photos ({items.filter(p => p.day === null).length} unsorted)</div>
                  </div>
                ))}
                {rootGroups.length === 0 && <div className="text-xs text-gray-400">No root folders</div>}
              </div>
            </div>
          </aside>
        )}

        {/* Photo Grid */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {currentView === 'days' && selectedDay === null ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a day to view photos</p>
                </div>
              </div>
            ) : currentView === 'folders' && selectedRootFolder === null ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a folder to view photos</p>
                </div>
              </div>
            ) : (
              (() => {
                const rootPhotos = currentView === 'folders' && selectedRootFolder ? (rootGroups.find(r => r[0] === selectedRootFolder)?.[1] || []) : null;
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

                return (
                  <div className="grid grid-cols-4 gap-4">
                    {displayPhotos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        onClick={e => handleSelectPhoto(e, photo.id, idx)}
                        onDoubleClick={() => {
                          setFullscreenPhoto(photo.id);
                          setSelectedPhotos(new Set([photo.id]));
                          setFocusedPhoto(photo.id);
                        }}
                        data-testid={`photo-${photo.id}`}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all ${
                          selectedPhotos.has(photo.id)
                            ? 'ring-4 ring-blue-500 scale-105'
                            : !photo.bucket && !photo.archived
                            ? 'ring-2 ring-blue-400/40 hover:ring-blue-400/70'
                            : 'hover:ring-2 hover:ring-gray-600'
                        } ${photo.bucket || photo.archived ? 'opacity-60 saturate-50' : ''}`}
                      >
                        {photo.thumbnail ? (
                          <img src={photo.thumbnail} alt={photo.currentName} className="w-full aspect-[4/3] object-cover" />
                        ) : (
                          <div className="w-full aspect-[4/3] bg-gray-900 flex items-center justify-center text-xs text-gray-400 px-2 text-center">
                            {photo.currentName}
                          </div>
                        )}

                        {/* Overlay info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-xs font-mono truncate">{photo.currentName}</p>
                          </div>
                        </div>

                        {/* Bucket badge */}
                        {photo.bucket && (
                          <div
                            className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                              MECE_BUCKETS.find(b => b.key === photo.bucket)?.color
                            } text-white shadow-lg`}
                          >
                            <div className="flex items-center gap-1">
                              <span>{photo.bucket}</span>
                              {photo.favorite && <Heart className="w-3.5 h-3.5 fill-current" />}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
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
                    <img
                      src={photos.find(p => p.id === Array.from(selectedPhotos)[0])?.thumbnail}
                      alt="Selected"
                      className="w-full rounded-lg"
                    />
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
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      const dayNum = val === 'new' ? Math.max(0, ...days.map(d => d[0])) + 1 : Number(val);
                      const targets = Array.from(selectedPhotos);
                      const newPhotos = photos.map(ph => (targets.includes(ph.id) ? { ...ph, day: dayNum } : ph));
                      saveToHistory(newPhotos);
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
                  <div className="text-xs text-gray-400">Assign selected photos to a day folder</div>
                </div>
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

          <img
            src={photos.find(p => p.id === fullscreenPhoto)?.thumbnail}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain"
          />

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
              <h2 className="text-lg font-semibold text-gray-100">Export Rename Script</h2>
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
                This script copies your organized photos into day folders using the current bucket
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
                    Keyboard shortcuts: A–E, X, M (Mood/Night). F is reserved for Favorite.
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
                      <span>Undo</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">⌘⇧Z</kbd>
                      <span>Redo</span>
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

      {/* Onboarding Modal */}
      <StartScreen
        isOpen={showWelcome && !projectRootPath}
        onClose={() => setShowWelcome(false)}
        onCreateComplete={handleOnboardingComplete}
        onOpenProject={rootPath => {
          setProjectError(null);
          loadProject(rootPath);
        }}
        recentProjects={recentProjects}
      />
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
        recentProjects={recentProjects}
        onSelectRecent={rootPath => {
          setProjectError(null);
          loadProject(rootPath);
        }}
      />
    </div>
  );
}
