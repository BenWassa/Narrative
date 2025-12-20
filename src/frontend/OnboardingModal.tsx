import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';

export interface OnboardingState {
  projectName: string;
  rootPath: string;
}

export interface RecentProject {
  projectName: string;
  rootPath: string;
  coverUrl?: string;
  lastOpened: number;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (state: OnboardingState) => void;
  recentProjects?: RecentProject[];
  onSelectRecent?: (rootPath: string) => void;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  recentProjects = [],
  onSelectRecent,
}: OnboardingModalProps) {
  const [projectName, setProjectName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    if (!rootPath.trim()) {
      setError('Please enter the folder path');
      return;
    }
    setError(null);
    onComplete({ projectName: projectName.trim(), rootPath: rootPath.trim() });
    onClose();
  }, [onClose, onComplete, projectName, rootPath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-12">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-6 max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Create Project</h2>
            <p className="text-sm text-gray-500 mt-1">
              Add a project name and the folder path that contains your photos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 rounded-md px-2 py-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {recentProjects.length > 0 && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Recent Projects</p>
                <p className="text-xs text-gray-500">
                  Open a recent project instead of creating a new one.
                </p>
              </div>
              <div className="space-y-2">
                {recentProjects.map(project => (
                  <button
                    key={project.rootPath}
                    onClick={() => {
                      onSelectRecent?.(project.rootPath);
                      onClose();
                    }}
                    className="w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {project.projectName}
                    </div>
                    <div className="text-xs text-gray-600 truncate">{project.rootPath}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g., Mexico 2025"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Folder Path</label>
            <input
              type="text"
              value={rootPath}
              onChange={e => setRootPath(e.target.value)}
              placeholder="/Users/you/trips/mexico"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              Paste the full path to the folder that contains your photos.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!projectName.trim() || !rootPath.trim()}
            aria-disabled={!projectName.trim() || !rootPath.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
