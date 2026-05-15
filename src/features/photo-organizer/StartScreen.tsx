import React, { useMemo, useState, useEffect } from 'react';
import { FolderPlus, Plus, Play, ChevronDown, ChevronRight } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';
import ProjectTile from './ui/ProjectTile';
import { versionManager } from '../../lib/versionManager';
import { useDashboardStats } from './hooks/useDashboardStats';

const APP_ICON_SRC = `${import.meta.env.BASE_URL}assets/Narrative_icon.png`;
const DASHBOARD_COLLAPSE_KEY = 'narrative:dashboard:collapsedYears';

const readCollapsedYears = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(DASHBOARD_COLLAPSE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

interface StartScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: (state: OnboardingState) => void;
  onOpenProject: (projectId: string) => void;
  onBulkImportProjects?: (parentHandle: FileSystemDirectoryHandle) => Promise<unknown>;
  recentProjects?: RecentProject[];
  canClose?: boolean;
  errorMessage?: string | null;
}

export default function StartScreen({
  isOpen,
  onClose,
  onCreateComplete,
  onOpenProject,
  onBulkImportProjects,
  recentProjects = [],
  canClose = false,
  errorMessage = null,
}: StartScreenProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(versionManager.getDisplayVersion());
  const stats = useDashboardStats(recentProjects);
  const handleBulkImport = async () => {
    if (!onBulkImportProjects) return;
    try {
      const handle = await (window as any).showDirectoryPicker();
      await onBulkImportProjects(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('Bulk import cancelled or failed:', err);
    }
  };
  const currentYear = new Date().getFullYear();
  const groupedByYear = useMemo(() => {
    const groups: Record<number, RecentProject[]> = {};
    recentProjects.forEach(project => {
      // Prefer year embedded in the project name (e.g. "Mexico 2025", "Diving_Mexico_2025")
      // since app-side timestamps reflect when the project was opened, not when the trip happened
      const nameMatch = (project.projectName + ' ' + project.rootPath).match(/\b(20\d{2})\b/);
      const year = nameMatch
        ? parseInt(nameMatch[1], 10)
        : new Date(project.lastOpened || Date.now()).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(project);
    });
    // Sort projects within each group by lastOpened descending (most recent first)
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(
        ([year, projects]) =>
          [
            year,
            [...projects].sort(
              (a, b) => (b.createdAt || b.lastOpened || 0) - (a.createdAt || a.lastOpened || 0),
            ),
          ] as [string, RecentProject[]],
      );
  }, [recentProjects]);
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await versionManager.getCurrentVersion();
        setCurrentVersion(`v${version}`);
      } catch (error) {
        console.warn('Failed to fetch runtime version:', error);
      }
    };

    fetchVersion();
  }, []);

  const toggleYear = (year: string) => {
    setCollapsedYears(prev => {
      const next = { ...prev, [year]: !prev[year] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DASHBOARD_COLLAPSE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const isTestEnvironment =
    typeof globalThis !== 'undefined' &&
    ((globalThis as any).vitest || (globalThis as any).__APP_VERSION__ === '0.0.0');
  const hasFileSystemAPI = 'showDirectoryPicker' in window;
  const hasIndexedDB = 'indexedDB' in window;

  if (!isTestEnvironment && (!hasFileSystemAPI || !hasIndexedDB)) {
    return (
      <div className="h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Browser Not Supported</h1>
          <p className="text-gray-400 mb-4">
            This app requires a modern browser with support for the File System Access API and
            IndexedDB.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            {!hasFileSystemAPI && <div>• File System Access API not available</div>}
            {!hasIndexedDB && <div>• IndexedDB not available</div>}
          </div>
          <p className="text-gray-400 text-sm mt-4">
            Please use a recent version of Chrome, Edge, or another supported browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={APP_ICON_SRC} alt="Narrative" className="w-8 h-8 rounded" />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Narrative
                <span className="text-gray-600 text-lg font-light">/</span>
                <span className="text-gray-400">Dashboard</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md text-xs font-medium tracking-wide">
              <span className="uppercase">{currentVersion}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto scrollbar-thin">
        <div className="w-full max-w-7xl space-y-6">
          {errorMessage && (
            <div className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {stats.totalProjects > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                {/* Stat chips */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-gray-100 leading-none">
                      {stats.totalPhotos.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                      photos
                    </span>
                  </div>
                  {stats.totalVideos > 0 && (
                    <div className="flex flex-col pl-4 border-l border-gray-700">
                      <span className="text-2xl font-bold text-gray-100 leading-none">
                        {stats.totalVideos.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                        videos
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col pl-4 border-l border-gray-700">
                    <span className="text-2xl font-bold text-gray-100 leading-none">
                      {stats.totalProjects}
                    </span>
                    <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                      projects
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {onBulkImportProjects && hasFileSystemAPI && (
                    <button
                      onClick={handleBulkImport}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-950 hover:bg-gray-800 text-gray-200 text-sm font-semibold rounded-lg border border-gray-700 transition-all active:scale-95"
                    >
                      <FolderPlus size={15} />
                      Bulk Import
                    </button>
                  )}
                  {stats.mostRecentProject && (
                    <button
                      onClick={() => onOpenProject(stats.mostRecentProject!.projectId)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg border border-gray-700 transition-all active:scale-95"
                    >
                      <Play size={14} className="fill-current" />
                      Resume Last
                    </button>
                  )}
                </div>
              </div>
              {/* Progress bar — only show if we have breakdown data */}
              {stats.inboxCount + stats.assignedCount + stats.archivedCount > 0 ? (
                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${stats.assignedPercent}%` }}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${stats.inboxPercent}%` }}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all duration-300"
                      style={{ width: `${stats.archivedPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      <span className="text-gray-200 font-medium">{stats.assignedPercent}%</span>
                      <span>assigned ({stats.assignedCount.toLocaleString()})</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      <span className="text-gray-200 font-medium">{stats.inboxPercent}%</span>
                      <span>inbox ({stats.inboxCount.toLocaleString()})</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      <span className="text-gray-200 font-medium">{stats.archivedPercent}%</span>
                      <span>archived ({stats.archivedCount.toLocaleString()})</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600">
                  Open a project to track assignment progress.
                </p>
              )}
            </div>
          )}

          {groupedByYear.length > 0 ? (
            <div className="space-y-8">
              {groupedByYear.map(([year, projects]) => {
                const isCollapsed = collapsedYears[year] ?? false;
                return (
                  <div key={year}>
                    <button
                      onClick={() => toggleYear(year)}
                      className="flex items-center gap-2 w-full text-left mb-4 group"
                    >
                      {isCollapsed ? (
                        <ChevronRight size={18} className="text-gray-500" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-500" />
                      )}
                      <h3 className="text-lg font-bold text-gray-200 group-hover:text-blue-400 transition-colors">
                        {year}
                      </h3>
                      <div className="h-px flex-1 bg-gray-800 ml-4 group-hover:bg-gray-700 transition-colors" />
                    </button>

                    {!isCollapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
                        {/* ARCHIVED: inline "Add Project" tile — replaced by floating FAB
                        {Number(year) === latestYear && (
                          <div className="relative rounded-lg overflow-hidden border-2 border-dashed border-gray-700 bg-gray-950 hover:border-blue-500 transition-colors group cursor-pointer pb-1">
                            <button
                              onClick={() => setShowOnboarding(true)}
                              className="w-full block text-left"
                              aria-label="Add project"
                            >
                              <div className="aspect-video overflow-hidden bg-gray-900 relative">
                                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                  <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
                                    <Plus className="w-7 h-7 text-blue-400" />
                                  </div>
                                </div>
                              </div>
                              <div className="p-3 space-y-1">
                                <div className="text-sm font-semibold text-gray-200">Add Project</div>
                                <div className="text-xs text-gray-500">Import an existing folder</div>
                              </div>
                            </button>
                          </div>
                        )}
                        END ARCHIVED */}

                        {projects.map(project => (
                          <ProjectTile
                            key={project.projectId}
                            project={project}
                            onOpen={onOpenProject}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 space-y-4">
              <p className="text-sm">No recent projects. Use the + button to get started.</p>
              {onBulkImportProjects && hasFileSystemAPI && (
                <button
                  onClick={handleBulkImport}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 active:scale-95"
                >
                  <FolderPlus size={15} />
                  Bulk Import Projects
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Floating action button — bottom right */}
      <button
        onClick={() => setShowOnboarding(true)}
        aria-label="Add project"
        className="fixed bottom-8 right-8 h-14 px-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/40 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group"
      >
        <Plus size={24} className="transition-transform group-hover:rotate-90" />
        <span className="font-bold tracking-wide">New Project</span>
      </button>
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={state => {
          setShowOnboarding(false);
          onCreateComplete(state);
        }}
        recentProjects={recentProjects}
        onSelectRecent={onOpenProject}
      />
    </div>
  );
}
