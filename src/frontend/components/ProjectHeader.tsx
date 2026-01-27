import { useState } from 'react';
import { ChevronDown, Download, Loader } from 'lucide-react';
import type { RecentProject } from '../OnboardingModal';

interface ProjectStats {
  total: number;
  sorted: number;
  root: number;
  favorites: number;
  archived: number;
}

interface ProjectHeaderProps {
  showWelcome: boolean;
  projectName: string;
  stats: ProjectStats;
  currentVersion: string;
  coverSelectionMode: boolean;
  selectedPhotosCount: number;
  projectRootPath: string | null;
  currentView: string;
  hideAssigned: boolean;
  recentProjects: RecentProject[];
  projectError: string | null;
  permissionRetryProjectId: string | null;
  loadingProject: boolean;
  onMainMenu: () => void;
  onStartCoverSelection: () => void;
  onUseCoverSelection: () => void;
  onCancelCoverSelection: () => void;
  onSelectRecentProject: (projectId: string) => void;
  onOpenProject: () => void;
  onDeleteProject: () => void;
  onImportTrip: () => void;
  onExportScript: () => void;
  onShowHelp: () => void;
  onRetryPermission: () => void;
  onChangeView: (viewId: string) => void;
  onToggleHideAssigned: () => void;
  onRememberFoldersViewState: () => void;
  onRestoreFoldersViewState: () => void;
  onClearDaySelection: () => void;
}

export default function ProjectHeader({
  showWelcome,
  projectName,
  stats,
  currentVersion,
  coverSelectionMode,
  selectedPhotosCount,
  projectRootPath,
  currentView,
  hideAssigned,
  recentProjects,
  projectError,
  permissionRetryProjectId,
  loadingProject,
  onMainMenu,
  onStartCoverSelection,
  onUseCoverSelection,
  onCancelCoverSelection,
  onSelectRecentProject,
  onOpenProject,
  onDeleteProject,
  onImportTrip,
  onExportScript,
  onShowHelp,
  onRetryPermission,
  onChangeView,
  onToggleHideAssigned,
  onRememberFoldersViewState,
  onRestoreFoldersViewState,
  onClearDaySelection,
}: ProjectHeaderProps) {
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  if (showWelcome) return null;

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <img
            src="/Narrative/assets/Narrative_icon.png"
            alt="Narrative"
            className="w-8 h-8 rounded"
          />
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{projectName}</h1>
            <p className="text-xs text-gray-400">
              {stats.sorted} sorted · {stats.root} root · {stats.favorites} favorites
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{currentVersion}</span>

          <button
            onClick={() => {
              setShowProjectMenu(false);
              onMainMenu();
            }}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium"
            title="Back to the main menu"
          >
            Main Menu
          </button>

          {projectRootPath && (
            <button
              onClick={onStartCoverSelection}
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

          {coverSelectionMode && (
            <div className="px-3 py-1 bg-yellow-50 text-yellow-900 rounded text-sm flex items-center gap-3">
              <span>Select a photo to set as cover</span>
              {selectedPhotosCount === 1 && (
                <button onClick={onUseCoverSelection} className="underline">
                  Use selection
                </button>
              )}
              <button onClick={onCancelCoverSelection} className="underline">
                Cancel
              </button>
            </div>
          )}

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
                          onSelectRecentProject(project.projectId);
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
                      onOpenProject();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-300 hover:bg-gray-800"
                  >
                    Open Project…
                  </button>
                </div>
              </div>
            )}
          </div>

          {projectRootPath && (
            <button
              onClick={onDeleteProject}
              className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-sm font-medium"
              title="Delete project"
            >
              Delete
            </button>
          )}

          <button
            onClick={onImportTrip}
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
            onClick={onExportScript}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium"
            title="Export rename script"
            disabled={stats.total === 0}
          >
            Export Script
          </button>
          <button
            onClick={onShowHelp}
            className="p-2 hover:bg-gray-800 rounded"
            title="Show shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

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
                onRememberFoldersViewState();
              }
              onChangeView(view.id);
              if (view.id === 'folders') {
                onRestoreFoldersViewState();
              } else {
                onClearDaySelection();
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

      <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
        <button
          onClick={onToggleHideAssigned}
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
                onClick={onRetryPermission}
                className="ml-3 px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
