import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  ChevronDown,
  Star,
  Calendar,
  Heart,
  Undo2,
  Redo2,
  X,
  FolderOpen,
  Download,
  Loader,
} from 'lucide-react';
import OnboardingModal, { FolderMapping, OnboardingState, RecentProject } from './OnboardingModal';
import StartScreen from './StartScreen';
import { detectFolderStructure, generateDryRunSummary } from '../services/folderDetectionService';
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
  const [currentView, setCurrentView] = useState('inbox');
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
  const [projectName, setProjectName] = useState('No Project');
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showOpenProject, setShowOpenProject] = useState(false);
  const [openProjectPath, setOpenProjectPath] = useState('');
  const [projectError, setProjectError] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

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
      return sourcePhotos.map(photo =>
        dayById.has(photo.id) ? { ...photo, day: dayById.get(photo.id) ?? null } : photo,
      );
    },
    [],
  );

  const persistState = useCallback(
    async (nextPhotos: ProjectPhoto[]) => {
      if (!projectRootPath) return;
      const state: ProjectState = {
        projectName,
        rootPath: projectRootPath,
        photos: nextPhotos,
        settings: projectSettings,
      };
      try {
        await saveState(projectRootPath, state);
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to save project state');
      }
    },
    [projectName, projectRootPath, projectSettings],
  );

  const updateRecentProjects = useCallback((nextProject: RecentProject) => {
    setRecentProjects(prev => {
      const filtered = prev.filter(project => project.rootPath !== nextProject.rootPath);
      const updated = [nextProject, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
      } catch (err) {
        // Don't let localStorage failures block the app
        // eslint-disable-next-line no-console
        console.warn('Failed to persist recent projects', err);
      }
      return updated;
    });
  }, []);

  const setProjectFromState = useCallback((state: ProjectState) => {
    setPhotos(state.photos || []);
    setProjectName(state.projectName || 'Untitled Project');
    setProjectRootPath(state.rootPath || null);
    setProjectSettings(state.settings || DEFAULT_SETTINGS);
    setHistory([]);
    setHistoryIndex(-1);
    setSelectedPhotos(new Set());
    setFocusedPhoto(null);
    setLastSelectedIndex(null);
    lastSelectedIndexRef.current = null;
    setSelectedDay(null);
  }, []);

  const loadProject = useCallback(
    async (rootPath: string, options?: { addRecent?: boolean }) => {
      setLoadingProject(true);
      setProjectError(null);
      try {
        const state = await getState(rootPath);
        setProjectFromState(state);
        setShowOnboarding(false);
        // Hide the welcome view when a project is successfully loaded
        setShowWelcome(false);
        setShowOpenProject(false);
        try {
          localStorage.setItem(ACTIVE_PROJECT_KEY, rootPath);
        } catch (err) {
          // Best-effort only — proceed even if persistence fails
          // eslint-disable-next-line no-console
          console.warn('Failed to persist active project', err);
        }
        if (options?.addRecent !== false) {
          updateRecentProjects({
            projectName: state.projectName || deriveProjectName(rootPath),
            rootPath,
            lastOpened: Date.now(),
          });
        }
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to load project');
        try {
          localStorage.removeItem(ACTIVE_PROJECT_KEY);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Failed to remove active project from storage', err);
        }
        // Show the welcome page so the user can try other options
        setShowWelcome(true);
      } finally {
        setLoadingProject(false);
      }
    },
    [deriveProjectName, setProjectFromState, updateRecentProjects],
  );

  useEffect(() => {
    try {
      const storedRecentsRaw = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (storedRecentsRaw) {
        try {
          const parsed = JSON.parse(storedRecentsRaw) as RecentProject[];
          setRecentProjects(Array.isArray(parsed) ? parsed : []);
        } catch (err) {
          // Bad JSON — reset recents
          // eslint-disable-next-line no-console
          console.warn('Failed to parse recent projects from storage', err);
          setRecentProjects([]);
        }
      }
    } catch (err) {
      // Accessing storage can throw in some environments (e.g. privacy modes)
      // eslint-disable-next-line no-console
      console.warn('Failed to read recent projects from storage', err);
      setRecentProjects([]);
    }

    // Show a friendly welcome page on first load
    setShowWelcome(true);
  }, [loadProject]);

  const setRecentProjectCover = useCallback((rootPath: string, coverUrl: string) => {
    setRecentProjects(prev => {
      const updated = prev.map(p => (p.rootPath === rootPath ? { ...p, coverUrl } : p));
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to persist recent project cover', err);
      }
      return updated;
    });
  }, []);

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

  // Filter photos based on current view
  const filteredPhotos = React.useMemo(() => {
    switch (currentView) {
      case 'inbox':
        return photos.filter(p => !p.bucket && !p.archived);
      case 'days':
        if (selectedDay !== null) {
          return photos.filter(p => p.day === selectedDay);
        }
        return photos.filter(p => p.day !== null && !p.archived);
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
          const day = dayNum || photo.day || Math.ceil(new Date(photo.timestamp).getDate() / 1);
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

  // Onboarding handlers
  const handleDetect = useCallback(async (rootPath: string): Promise<FolderMapping[]> => {
    // Simulate folder detection (in real implementation, this would call a backend service)
    // For now, return a sample detection result
    const sampleFolders = ['Day 1', 'Day 2', 'Day 3', 'unsorted'];
    const photoCountMap = new Map([
      ['Day 1', 42],
      ['Day 2', 56],
      ['Day 3', 38],
      ['unsorted', 12],
    ]);

    return detectFolderStructure(sampleFolders, { photoCountMap });
  }, []);

  const handleApply = useCallback(
    async (
      mappings: FolderMapping[],
      dryRun: boolean,
    ): Promise<{ summary: string; changes: object }> => {
      // Generate dry-run summary
      const summary = generateDryRunSummary(mappings);

      if (dryRun) {
        return { summary, changes: {} };
      }

      // In a real implementation, this would apply the mappings to the filesystem
      // For now, we'll just simulate the application
      // TODO: Integrate with backend service to actually move/rename files

      return { summary, changes: {} };
    },
    [],
  );

  const handleOnboardingComplete = useCallback(
    async (state: OnboardingState) => {
      setLoadingProject(true);
      setProjectError(null);
      try {
        const initResult = await initProject(state.rootPath);
        const hydratedPhotos = applySuggestedDays(initResult.photos, initResult.suggestedDays);
        const nextProjectName = state.projectName?.trim() || deriveProjectName(state.rootPath);
        const nextState: ProjectState = {
          projectName: nextProjectName,
          rootPath: state.rootPath,
          photos: hydratedPhotos,
          settings: DEFAULT_SETTINGS,
        };

        setPhotos(hydratedPhotos);
        setProjectName(nextProjectName);
        setProjectRootPath(state.rootPath);
        setProjectSettings(DEFAULT_SETTINGS);
        setHistory([]);
        setHistoryIndex(-1);
        setSelectedPhotos(new Set());
        setFocusedPhoto(null);
        setLastSelectedIndex(null);
        lastSelectedIndexRef.current = null;
        setSelectedDay(null);
        setShowOnboarding(false);
        setOpenProjectPath('');
        try {
          localStorage.setItem(ACTIVE_PROJECT_KEY, state.rootPath);
        } catch (err) {
          // Best-effort only
          // eslint-disable-next-line no-console
          console.warn('Failed to persist active project', err);
        }
        updateRecentProjects({
          projectName: nextProjectName,
          rootPath: state.rootPath,
          lastOpened: Date.now(),
        });

        await saveState(state.rootPath, nextState);
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
    [applySuggestedDays, deriveProjectName, updateRecentProjects],
  );

  // Create a small in-memory sample project for quick exploration (no backend calls)
  const createSampleProject = useCallback(() => {
    const now = Date.now();
    const samplePhotos: ProjectPhoto[] = Array.from({ length: 8 }).map((_, i) => ({
      id: `sample-${i}`,
      originalName: `IMG_${1000 + i}.jpg`,
      currentName: `IMG_${1000 + i}.jpg`,
      timestamp: now - i * 1000 * 60 * 60 * 24,
      day: i < 4 ? 1 : 2,
      bucket: null,
      sequence: null,
      favorite: false,
      rating: 0,
      archived: false,
      thumbnail: `https://picsum.photos/seed/sample-${i}/400/300`,
    }));

    const nextProjectName = 'Sample Trip';
    setPhotos(samplePhotos);
    setProjectName(nextProjectName);
    setProjectRootPath('sample://trip');
    setProjectSettings(DEFAULT_SETTINGS);
    setHistory([]);
    setHistoryIndex(-1);
    setSelectedPhotos(new Set());
    setFocusedPhoto(null);
    setLastSelectedIndex(null);
    lastSelectedIndexRef.current = null;
    setSelectedDay(null);
    setShowWelcome(false);
    updateRecentProjects({
      projectName: nextProjectName,
      rootPath: 'sample://trip',
      lastOpened: Date.now(),
    });
  }, [updateRecentProjects]);

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

      // MECE bucket assignment
      const bucket = MECE_BUCKETS.find(b => b.key.toLowerCase() === e.key.toLowerCase());
      if (bucket) {
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
      } else if (e.key === 'f') {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        toggleFavorite(targets);
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
                  {stats.sorted} sorted · {stats.unsorted} inbox · {stats.favorites} favorites
                </p>
              </div>
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
                            key={project.rootPath}
                            onClick={() => {
                              setShowProjectMenu(false);
                              loadProject(project.rootPath);
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
                          setShowOpenProject(true);
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

          {/* View Tabs */}
          <div className="flex gap-1 px-6 pb-2">
            {[
              { id: 'inbox', label: 'Inbox', count: stats.unsorted },
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
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedDay === day
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="font-medium">Day {String(day).padStart(2, '0')}</div>
                    <div className="text-xs opacity-70">{dayPhotos.length} photos</div>
                  </button>
                ))}
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
            ) : filteredPhotos.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No photos in this view</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {filteredPhotos.map((photo, idx) => (
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
                        : 'hover:ring-2 hover:ring-gray-600'
                    }`}
                  >
                    <img
                      src={photo.thumbnail}
                      alt={photo.currentName}
                      className="w-full aspect-[4/3] object-cover"
                    />

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
                        {photo.bucket}
                      </div>
                    )}

                    {/* Favorite star */}
                    {photo.favorite && (
                      <div className="absolute top-2 right-2">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
                    <p className="mt-2 text-xs text-gray-400 font-mono break-all">
                      {photos.find(p => p.id === Array.from(selectedPhotos)[0])?.currentName}
                    </p>
                  </>
                ) : (
                  <div className="text-sm text-gray-300">{selectedPhotos.size} selected</div>
                )}
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
                          {bucket.key}
                        </kbd>
                        <span>{bucket.label}</span>
                      </div>
                    ))}
                  </div>
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
        onSetCover={(rootPath, coverUrl) => setRecentProjectCover(rootPath, coverUrl)}
        onRunDemo={() => createSampleProject()}
        recentProjects={recentProjects}
      />
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
        onDetect={handleDetect}
        onApply={handleApply}
        recentProjects={recentProjects}
        onSelectRecent={rootPath => {
          setProjectError(null);
          loadProject(rootPath);
        }}
      />

      {showOpenProject && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-lg max-w-lg w-full overflow-hidden border border-gray-800">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Open Project</h2>
              <button
                onClick={() => setShowOpenProject(false)}
                className="p-2 hover:bg-gray-800 rounded"
                aria-label="Close open project dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="text-sm text-gray-400">Project root path</label>
              <input
                type="text"
                value={openProjectPath}
                onChange={e => setOpenProjectPath(e.target.value)}
                placeholder="/Users/you/trips/iceland"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setShowOpenProject(false)}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!openProjectPath.trim()) return;
                  loadProject(openProjectPath.trim());
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400"
                disabled={!openProjectPath.trim() || loadingProject}
              >
                {loadingProject ? 'Opening…' : 'Open'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
