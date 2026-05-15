import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings, Loader } from 'lucide-react';
import type { RecentProject } from '../OnboardingModal';
import type { ProjectSettings } from '../services/projectService';

const APP_ICON_SRC = `${import.meta.env.BASE_URL}assets/Narrative_icon.png`;

interface ProjectStats {
  total: number;
  folders: number;
  sorted: number;
  root: number;
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
  hideAssigned: boolean;
  recentProjects: RecentProject[];
  projectError: string | null;
  permissionRetryProjectId: string | null;
  loadingProject: boolean;
  projectSettings: ProjectSettings;
  hasExportManifest?: boolean;
  hasDirectProcessingUndo?: boolean;
  onMainMenu: () => void;
  onStartCoverSelection: () => void;
  onCancelCoverSelection: () => void;
  onSelectRecentProject: (projectId: string) => void;
  onOpenProject: () => void;
  onDeleteProject: () => void;
  onExportScript: () => void;
  onExportVideoTimeline?: () => void;
  onDirectProcess?: () => void;
  onUndoExport?: () => void;
  onShowHelp: () => void;
  onRetryPermission: () => void;
  onToggleHideAssigned: () => void;
  onUpdateProjectName: (name: string) => void;
  onUpdateProjectSettings: (settings: ProjectSettings) => void;
}

export default function ProjectHeader({
  showWelcome,
  projectName,
  stats,
  currentVersion,
  coverSelectionMode,
  selectedPhotosCount,
  projectRootPath,
  hideAssigned,
  recentProjects,
  projectError,
  permissionRetryProjectId,
  loadingProject,
  projectSettings,
  hasExportManifest,
  hasDirectProcessingUndo,
  onMainMenu,
  onStartCoverSelection,
  onCancelCoverSelection,
  onSelectRecentProject,
  onOpenProject,
  onDeleteProject,
  onExportScript,
  onExportVideoTimeline,
  onDirectProcess,
  onUndoExport,
  onShowHelp,
  onRetryPermission,
  onToggleHideAssigned,
  onUpdateProjectName,
  onUpdateProjectSettings,
}: ProjectHeaderProps) {
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);
  const [folderInputs, setFolderInputs] = useState(projectSettings.folderStructure);

  const settingsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(projectName);
  }, [projectName]);

  useEffect(() => {
    setFolderInputs(projectSettings.folderStructure);
  }, [projectSettings.folderStructure]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (!showSettingsMenu) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettingsMenu]);

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== projectName) onUpdateProjectName(trimmed);
    else setNameInput(projectName);
    setEditingName(false);
  };

  const commitFolders = () => {
    onUpdateProjectSettings({
      ...projectSettings,
      folderStructure: folderInputs,
    });
  };

  if (showWelcome) return null;

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: identity */}
        <div className="flex items-center gap-4">
          <img src={APP_ICON_SRC} alt="Narrative" className="w-8 h-8 rounded" />
          <div>
            <h1 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              Narrative <span className="text-gray-600 font-light">/</span>{' '}
              <span className="text-gray-400 font-normal">{projectName}</span>
            </h1>
            <p className="text-xs text-gray-400">
              {stats.sorted} sorted · {stats.root} root media · {stats.archived} archived
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">{currentVersion}</span>

          {/* Projects switcher */}
          <div className="relative">
            <button
              onClick={() => setShowProjectMenu(prev => !prev)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium flex items-center gap-1 text-gray-300 hover:text-gray-100 transition-colors"
              title="Switch project"
              aria-expanded={showProjectMenu}
            >
              Projects
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>
            {showProjectMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-800 bg-gray-900 shadow-xl z-30">
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
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
                        className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        <div className="text-sm text-gray-100">{project.projectName}</div>
                        <div className="text-xs text-gray-500 truncate font-mono">{project.rootPath}</div>
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
                    className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-gray-800 transition-colors"
                  >
                    Open Project…
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Set Cover */}
          {projectRootPath && (
            <button
              onClick={onStartCoverSelection}
              className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase transition-colors ${
                coverSelectionMode
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 cursor-default'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 border border-transparent'
              }`}
              title={
                selectedPhotosCount === 1
                  ? 'Set selected photo as cover'
                  : 'Enter cover selection mode: click a photo to set it as cover'
              }
            >
              {coverSelectionMode ? 'Picking Cover…' : 'Set Cover'}
            </button>
          )}

          {/* Cover selection banner */}
          {coverSelectionMode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <span className="text-xs text-amber-300/80">Click a photo to set as cover</span>
              <button
                onClick={onCancelCoverSelection}
                className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Project Settings */}
          {projectRootPath && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettingsMenu(prev => !prev)}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-100 transition-colors flex items-center gap-1"
                title="Project settings"
                aria-expanded={showSettingsMenu}
              >
                <Settings className="w-4 h-4" />
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-800 bg-gray-900 shadow-xl z-30">

                  {/* Project name */}
                  <div className="px-4 pt-4 pb-3 border-b border-gray-800">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                      Project Name
                    </label>
                    {editingName ? (
                      <div className="flex gap-2">
                        <input
                          ref={nameInputRef}
                          value={nameInput}
                          onChange={e => setNameInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitName();
                            if (e.key === 'Escape') {
                              setNameInput(projectName);
                              setEditingName(false);
                            }
                          }}
                          className="flex-1 px-2 py-1 bg-gray-950 border border-gray-700 focus:border-blue-500 rounded text-sm text-gray-100 outline-none"
                        />
                        <button
                          onClick={commitName}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setNameInput(projectName); setEditingName(false); }}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingName(true)}
                        className="w-full text-left px-2 py-1 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded text-sm text-gray-200 transition-colors group flex items-center justify-between"
                      >
                        <span>{projectName}</span>
                        <span className="text-xs text-gray-600 group-hover:text-gray-400">Edit</span>
                      </button>
                    )}
                  </div>

                  {/* Folder structure */}
                  <div className="px-4 py-3 border-b border-gray-800 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Folder Structure</div>
                    {(
                      [
                        { key: 'inboxFolder', label: 'Inbox' },
                        { key: 'daysFolder', label: 'Days' },
                        { key: 'archiveFolder', label: 'Archive' },
                      ] as { key: keyof typeof folderInputs; label: string }[]
                    ).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
                        <input
                          value={folderInputs[key]}
                          onChange={e =>
                            setFolderInputs(prev => ({ ...prev, [key]: e.target.value }))
                          }
                          onBlur={commitFolders}
                          onKeyDown={e => { if (e.key === 'Enter') { commitFolders(); (e.target as HTMLInputElement).blur(); } }}
                          className="flex-1 px-2 py-0.5 bg-gray-950 border border-gray-800 focus:border-blue-500 rounded text-xs text-gray-300 font-mono outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Export actions */}
                  <div className="px-2 py-2 border-b border-gray-800">
                    <div className="px-2 pb-1 text-xs uppercase tracking-wide text-gray-500">Export</div>
                    <button
                      onClick={() => { setShowSettingsMenu(false); onExportScript(); }}
                      disabled={stats.total === 0}
                      className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Export Script
                    </button>
                    {onExportVideoTimeline && (
                      <button
                        onClick={() => { setShowSettingsMenu(false); onExportVideoTimeline!(); }}
                        disabled={stats.total === 0}
                        className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Export Video Timeline
                      </button>
                    )}
                    {onDirectProcess && (
                      <button
                        onClick={() => { setShowSettingsMenu(false); onDirectProcess!(); }}
                        disabled={stats.total === 0}
                        className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Process Directly
                      </button>
                    )}
                    {(hasExportManifest || hasDirectProcessingUndo) && onUndoExport && (
                      <button
                        onClick={() => { setShowSettingsMenu(false); onUndoExport!(); }}
                        className="w-full text-left px-2 py-1.5 rounded text-sm text-amber-400 hover:bg-gray-800 transition-colors"
                      >
                        {hasDirectProcessingUndo ? 'Undo Direct Process' : 'Undo Export'}
                      </button>
                    )}
                  </div>

                  {/* Danger zone */}
                  <div className="px-2 py-2">
                    <button
                      onClick={() => { setShowSettingsMenu(false); onDeleteProject(); }}
                      className="w-full text-left px-2 py-1.5 rounded text-sm text-red-400 hover:bg-red-950/50 transition-colors"
                    >
                      Delete Project…
                    </button>
                    <button
                      onClick={() => { setShowSettingsMenu(false); onMainMenu(); }}
                      className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-400 hover:bg-gray-800 transition-colors"
                    >
                      Back to Main Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {loadingProject && (
            <Loader className="w-4 h-4 animate-spin text-gray-500" />
          )}

          {/* Help */}
          <button
            onClick={onShowHelp}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
            title="Show shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

      {/* Hide Assigned chip */}
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
        {hideAssigned && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg">
            <span className="text-xs text-blue-300">Skip Assigned: ON</span>
            <kbd className="text-xs text-blue-200">Shift+H to toggle</kbd>
          </div>
        )}
        <button
          onClick={onToggleHideAssigned}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            hideAssigned ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {hideAssigned ? 'Show All' : 'Hide Assigned'}
        </button>
      </div>

      {/* Project error */}
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
