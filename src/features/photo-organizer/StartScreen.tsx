import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Play, ChevronDown, ChevronRight } from 'lucide-react';
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
  recentProjects?: RecentProject[];
  canClose?: boolean;
  errorMessage?: string | null;
}

export default function StartScreen({
  isOpen,
  onClose,
  onCreateComplete,
  onOpenProject,
  recentProjects = [],
  canClose = false,
  errorMessage = null,
}: StartScreenProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(versionManager.getDisplayVersion());
  const stats = useDashboardStats(recentProjects);
  const currentYear = new Date().getFullYear();
  const groupedByYear = useMemo(() => {
    const groups: Record<number, RecentProject[]> = {};
    recentProjects.forEach(project => {
      const year = new Date(project.createdAt || project.lastOpened || Date.now()).getFullYear();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(project);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a)) as [string, RecentProject[]][];
  }, [recentProjects]);
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>(readCollapsedYears);
  const latestYear = groupedByYear.length > 0 ? Number(groupedByYear[0][0]) : currentYear;

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
          <div className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md text-xs font-medium tracking-wide">
            <span className="uppercase">{currentVersion}</span>
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
            <div className="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-4">
                  <div className="px-3 py-1 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300">
                    <span className="text-gray-500 mr-2">Total Photos:</span>
                    {stats.totalPhotos.toLocaleString()}
                  </div>
                  <div className="px-3 py-1 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300">
                    <span className="text-gray-500 mr-2">Videos:</span>
                    {stats.totalVideos.toLocaleString()}
                  </div>
                  <div className="px-3 py-1 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300">
                    <span className="text-gray-500 mr-2">Projects:</span>
                    {stats.totalProjects}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {stats.mostRecentProject && (
                    <button
                      onClick={() => onOpenProject(stats.mostRecentProject!.projectId)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Play size={16} /> Resume Last Project
                    </button>
                  )}
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg text-sm font-medium border border-gray-700 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Project
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${stats.assignedPercent}%` }}
                  />
                  <div
                    className="bg-gray-600 h-full transition-all"
                    style={{ width: `${stats.archivedPercent}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs font-medium text-gray-400">
                  <span className="text-blue-400">{stats.assignedPercent}% assigned</span>
                  <span>•</span>
                  <span>{stats.inboxCount.toLocaleString()} inbox</span>
                  <span>•</span>
                  <span>{stats.archivedCount.toLocaleString()} archived</span>
                </div>
              </div>
            </div>
          )}

          {groupedByYear.length > 0 ? (
            <div className="space-y-8">
              {groupedByYear.map(([year, projects]) => {
                const isCollapsed = collapsedYears[year] ?? Number(year) !== currentYear;
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

                        {projects.map(project => (
                          <ProjectTile key={project.projectId} project={project} onOpen={onOpenProject} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 space-y-4">
              <p className="text-sm">No recent projects. Add a folder to get started.</p>
              <button
                onClick={() => setShowOnboarding(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add Project
              </button>
            </div>
          )}
        </div>
      </div>

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
