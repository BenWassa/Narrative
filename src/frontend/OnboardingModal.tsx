import React, { useCallback, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { detectFolderStructure, FolderMapping } from '../services/folderDetectionService';

export interface OnboardingState {
  projectName: string;
  rootPath: string;
  dirHandle: FileSystemDirectoryHandle;
  mappings: Array<FolderMapping & { skip?: boolean }>;
}

export interface RecentProject {
  projectName: string;
  projectId: string;
  rootPath: string;
  coverUrl?: string;
  lastOpened: number;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (state: OnboardingState) => void;
  recentProjects?: RecentProject[];
  onSelectRecent?: (projectId: string) => void;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  recentProjects = [],
  onSelectRecent,
}: OnboardingModalProps) {
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [projectName, setProjectName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [mappings, setMappings] = useState<Array<FolderMapping & { skip?: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleDetect = useCallback(async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    if (!dirHandle) {
      setError('Please choose a folder');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const photoCountMap = new Map<string, number>();
      const folders: string[] = [];
      // @ts-ignore - entries() is supported in modern browsers
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'directory') continue;
        folders.push(name);
        let count = 0;
        // @ts-ignore
        for await (const [, nested] of handle.entries()) {
          if (nested.kind !== 'file') continue;
          const ext = nested.name.split('.').pop()?.toLowerCase() || '';
          if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) {
            count += 1;
          }
        }
        photoCountMap.set(name, count);
      }
      const detected = detectFolderStructure(folders, { photoCountMap, projectName });
      const withSkips = detected.map(m => ({
        ...m,
        skip: m.confidence === 'undetected' ? true : m.skip ?? false,
      }));
      setMappings(withSkips);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect folder structure');
    } finally {
      setLoading(false);
    }
  }, [dirHandle, projectName]);

  const handleMappingChange = useCallback(
    (index: number, field: keyof FolderMapping | 'skip', value: any) => {
      setMappings(prev => {
        const updated = [...prev];
        if (field === 'detectedDay') {
          updated[index].detectedDay = value === '' ? null : parseInt(value, 10);
          updated[index].manual = true;
        } else if (field === 'skip') {
          updated[index].skip = value;
        } else {
          (updated[index] as any)[field] = value;
        }
        return updated;
      });
    },
    [],
  );

  const handleCreate = useCallback(() => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    if (!dirHandle) {
      setError('Please choose a folder');
      return;
    }
    setError(null);
    onComplete({
      projectName: projectName.trim(),
      rootPath: rootPath.trim() || dirHandle.name,
      dirHandle,
      mappings,
    });
    onClose();
  }, [dirHandle, mappings, onClose, onComplete, projectName, rootPath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-12">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-6 max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              {step === 'select' ? 'Create Project' : 'Review Folder Structure'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'select'
                ? 'Add a project name and choose the folder that contains your photos.'
                : 'Confirm how your existing folders map to days.'}
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

          {step === 'select' && recentProjects.length > 0 && (
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
                    key={project.projectId}
                    onClick={() => {
                      onSelectRecent?.(project.projectId);
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

          {step === 'select' && (
            <>
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rootPath}
                    onChange={e => setRootPath(e.target.value)}
                    placeholder="/Users/you/trips/mexico"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    mozdirectory="true"
                    className="hidden"
                    onChange={e => {
                      const files = e.currentTarget.files;
                      if (!files || files.length === 0) return;
                      const first = files[0] as File & { webkitRelativePath?: string };
                      const rel = first.webkitRelativePath || first.name;
                      const folder = rel.split('/')[0];
                      setRootPath(folder);
                      setDirHandle(null);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    onClick={async () => {
                      if ('showDirectoryPicker' in window) {
                        // @ts-ignore
                        const handle = await (window as any).showDirectoryPicker();
                        setDirHandle(handle);
                        setRootPath(handle?.name || '');
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                  >
                    <FolderOpen size={18} />
                    Browse
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use the folder picker to grant access. If the picker is unavailable, paste the full
                  path (the app will ask again on first open).
                </p>
              </div>
            </>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review the detected folders and adjust the day numbers if needed.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Folder</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Day #</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Photos</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping, idx) => (
                      <tr
                        key={mapping.folder}
                        className={`border-b border-gray-200 ${
                          mapping.skip ? 'bg-gray-100 opacity-60' : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="px-3 py-3 text-gray-900">{mapping.folder}</td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={mapping.detectedDay ?? ''}
                            onChange={e => handleMappingChange(idx, 'detectedDay', e.target.value)}
                            disabled={mapping.skip}
                            className="w-12 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">
                          {mapping.photoCount}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleMappingChange(idx, 'skip', !mapping.skip)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              mapping.skip
                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {mapping.skip ? 'Skip' : 'Map'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {mappings.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-sm text-gray-600 text-center">
                          No subfolders detected. You can still continue and sort manually.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between gap-3">
          {step === 'select' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDetect}
                disabled={!projectName.trim() || !dirHandle || loading}
                aria-disabled={!projectName.trim() || !dirHandle || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {loading ? 'Detecting…' : 'Next'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Create Project
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
