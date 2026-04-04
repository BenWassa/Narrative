import React, { useCallback, useRef, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import {
  inspectProjectFolder,
  planProjectScaffoldingPreview,
  type ProjectScaffoldingPlan,
  type ProjectFolderInspection,
  type ProjectMode,
} from './services/projectService';
import {
  detectBucketsInFolder,
  detectFolderStructure,
  FolderMapping,
} from '../../lib/folderDetectionService';

export interface OnboardingState {
  projectName: string;
  rootPath: string;
  dirHandle: FileSystemDirectoryHandle;
  projectMode: ProjectMode;
  mappings: Array<FolderMapping & { skip?: boolean }>;
}

export interface RecentProject {
  projectName: string;
  projectId: string;
  rootPath: string;
  coverUrl?: string; // Legacy: base64 cover (for backward compatibility)
  coverKey?: string; // New: IndexedDB cover reference
  totalPhotos?: number;
  lastOpened: number;
  inboxCount?: number;
  assignedCount?: number;
  archivedCount?: number;
  videoCount?: number;
  createdAt?: number;
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
  const deriveProjectName = useCallback((path: string) => {
    const parts = path.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || '';
  }, []);

  const [step, setStep] = useState<'folder' | 'details' | 'preview'>('folder');
  const [projectName, setProjectName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [mappings, setMappings] = useState<Array<FolderMapping & { skip?: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [projectMode, setProjectMode] = useState<ProjectMode>('single_day');
  const [folderInspection, setFolderInspection] = useState<ProjectFolderInspection | null>(null);
  const [scaffoldingPlan, setScaffoldingPlan] = useState<ProjectScaffoldingPlan | null>(null);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoProjectNameRef = useRef('');

  const primaryActionLabel =
    folderInspection?.recommendedAction === 'import' ? 'Import Existing Project' : 'Create Project';
  const hasPlannedChanges =
    (scaffoldingPlan?.createPaths.length || 0) > 0 ||
    (scaffoldingPlan?.renamePaths.length || 0) > 0;
  const stepTitle =
    step === 'folder'
      ? 'Choose Project Folder'
      : step === 'details'
      ? 'Review Project Details'
      : 'Review Folder Structure';
  const stepDescription =
    step === 'folder'
      ? 'Choose the project folder first. Narrative will inspect it and suggest the safest next step.'
      : step === 'details'
      ? folderInspection?.recommendedAction === 'import'
        ? 'This folder already looks like a project. Narrative will import it and only add missing support folders when needed.'
        : 'Review the inferred details before creating a new project from this folder.'
      : 'Confirm how your existing folders map to days.';

  const syncProjectNameFromPath = useCallback(
    (nextPath: string) => {
      const guessedName = deriveProjectName(nextPath.trim());
      setRootPath(nextPath);
      setProjectName(currentName => {
        const trimmedCurrent = currentName.trim();
        const lastAuto = lastAutoProjectNameRef.current;
        if (!trimmedCurrent || trimmedCurrent === lastAuto) {
          lastAutoProjectNameRef.current = guessedName;
          return guessedName;
        }
        return currentName;
      });
      return guessedName;
    },
    [deriveProjectName],
  );

  const inspectSelectedFolder = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const inspection = await inspectProjectFolder(handle);
    setFolderInspection(inspection);
    if (inspection.inferredProjectMode) {
      setProjectMode(inspection.inferredProjectMode);
    }
    return inspection;
  }, []);

  const refreshScaffoldingPlan = useCallback(
    async (handle: FileSystemDirectoryHandle, nextProjectMode: ProjectMode) => {
      const plan = await planProjectScaffoldingPreview(handle, nextProjectMode);
      setScaffoldingPlan(plan);
      setPlanConfirmed(false);
      return plan;
    },
    [],
  );

  const handleFolderNext = useCallback(async () => {
    if (!dirHandle) {
      setError('Please choose a folder');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const inspection = await inspectSelectedFolder(dirHandle);
      await refreshScaffoldingPlan(dirHandle, inspection.inferredProjectMode || projectMode);
      setStep('details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect selected folder');
    } finally {
      setLoading(false);
    }
  }, [dirHandle, inspectSelectedFolder, projectMode, refreshScaffoldingPlan]);

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
      if (projectMode === 'single_day' && folderInspection?.inferredProjectMode !== 'multi_day') {
        const folderPath = rootPath.trim() || dirHandle.name;
        const duplicateProject = recentProjects.find(
          p => p.rootPath.toLowerCase() === folderPath.toLowerCase(),
        );

        if (duplicateProject) {
          setError(
            `This folder is already being used by project "${duplicateProject.projectName}". Opening the same folder twice could cause conflicts. Open the existing project instead or choose a different folder.`,
          );
          return;
        }

        onComplete({
          projectName: projectName.trim(),
          rootPath: folderPath,
          dirHandle,
          projectMode,
          mappings: [],
        });
        onClose();
        return;
      }
      const supportedExt = [
        'jpg',
        'jpeg',
        'png',
        'heic',
        'webp',
        'mp4',
        'mov',
        'webm',
        'avi',
        'mkv',
      ];
      const isDaysContainer = (name: string) => {
        const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
        return normalized === '01days' || normalized === 'days';
      };
      const countFilesRecursive = async (handle: FileSystemDirectoryHandle): Promise<number> => {
        let count = 0;
        // @ts-ignore - entries() is supported in modern browsers
        for await (const [, nested] of handle.entries()) {
          if (nested.kind === 'directory') {
            count += await countFilesRecursive(nested as FileSystemDirectoryHandle);
          } else if (nested.kind === 'file') {
            const ext = nested.name.split('.').pop()?.toLowerCase() || '';
            if (supportedExt.includes(ext)) {
              count += 1;
            }
          }
        }
        return count;
      };

      const photoCountMap = new Map<string, number>();
      const folders: string[] = [];
      const folderHandles = new Map<string, FileSystemDirectoryHandle>();
      // @ts-ignore - entries() is supported in modern browsers
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'directory') continue;
        folders.push(name);
        folderHandles.set(name, handle as FileSystemDirectoryHandle);
        let count = 0;
        // @ts-ignore
        for await (const [, nested] of handle.entries()) {
          if (nested.kind !== 'file') continue;
          const ext = nested.name.split('.').pop()?.toLowerCase() || '';
          if (supportedExt.includes(ext)) {
            count += 1;
          }
        }
        photoCountMap.set(name, count);
      }

      const daysContainerName = folders.find(folder => isDaysContainer(folder)) || null;
      if (daysContainerName) {
        const daysHandle = folderHandles.get(daysContainerName);
        if (daysHandle) {
          const dayFolderNames: string[] = [];
          const dayFolderHandles = new Map<string, FileSystemDirectoryHandle>();
          const dayPhotoCountMap = new Map<string, number>();

          // @ts-ignore
          for await (const [name, handle] of daysHandle.entries()) {
            if (handle.kind !== 'directory') continue;
            dayFolderNames.push(name);
            dayFolderHandles.set(name, handle as FileSystemDirectoryHandle);
            const count = await countFilesRecursive(handle as FileSystemDirectoryHandle);
            dayPhotoCountMap.set(name, count);
          }

          const detectedDays = detectFolderStructure(dayFolderNames, {
            photoCountMap: dayPhotoCountMap,
            projectName,
          }).map(mapping => ({
            ...mapping,
            folderPath: `${daysContainerName}/${mapping.folder}`,
          }));

          const enhancedMappings = await Promise.all(
            detectedDays.map(async mapping => {
              const dayHandle = dayFolderHandles.get(mapping.folder);
              if (!dayHandle || mapping.confidence === 'undetected') {
                return mapping;
              }

              const buckets = await detectBucketsInFolder(dayHandle);
              return {
                ...mapping,
                detectedBuckets: buckets,
                isOrganizedStructure: buckets.length > 0,
                bucketConfidence:
                  buckets.length > 0
                    ? buckets.every(b => b.confidence === 'high')
                      ? 'high'
                      : 'medium'
                    : 'none',
              };
            }),
          );

          const withSkips = enhancedMappings.map(m => ({
            ...m,
            skip: m.confidence === 'undetected' ? true : (m as any).skip ?? false,
          }));
          setMappings(withSkips as any);
          setStep('preview');
          return;
        }
      }

      const detected = detectFolderStructure(folders, { photoCountMap, projectName });
      const enhancedMappings = await Promise.all(
        detected.map(async mapping => {
          const folderHandle = folderHandles.get(mapping.folder);
          if (!folderHandle || mapping.confidence === 'undetected') {
            return mapping;
          }

          const buckets = await detectBucketsInFolder(folderHandle);
          return {
            ...mapping,
            detectedBuckets: buckets,
            isOrganizedStructure: buckets.length > 0,
            bucketConfidence:
              buckets.length > 0
                ? buckets.every(b => b.confidence === 'high')
                  ? 'high'
                  : 'medium'
                : 'none',
          };
        }),
      );

      const withSkips = enhancedMappings.map(m => ({
        ...m,
        skip: m.confidence === 'undetected' ? true : (m as any).skip ?? false,
      }));
      setMappings(withSkips as any);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect folder structure');
    } finally {
      setLoading(false);
    }
  }, [
    dirHandle,
    folderInspection?.inferredProjectMode,
    onClose,
    onComplete,
    projectMode,
    projectName,
    recentProjects,
    refreshScaffoldingPlan,
    rootPath,
  ]);

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

    // Check if this folder is already in recent projects
    const folderPath = rootPath.trim() || dirHandle.name;
    const duplicateProject = recentProjects.find(
      p => p.rootPath.toLowerCase() === folderPath.toLowerCase(),
    );

    if (duplicateProject) {
      setError(
        `This folder is already being used by project "${duplicateProject.projectName}". Opening the same folder twice could cause conflicts. Open the existing project instead or choose a different folder.`,
      );
      return;
    }

    setError(null);
    onComplete({
      projectName: projectName.trim(),
      rootPath: folderPath,
      dirHandle,
      projectMode,
      mappings,
    });
    onClose();
  }, [
    dirHandle,
    mappings,
    onClose,
    onComplete,
    projectMode,
    projectName,
    rootPath,
    recentProjects,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-12">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-6 max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">{stepTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">{stepDescription}</p>
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

          {step === 'folder' && recentProjects.length > 0 && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Recent Projects</p>
                <p className="text-xs text-gray-500">
                  Open a recent project instead of adding the same folder twice.
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
                    <div className="text-sm font-medium text-gray-900">{project.projectName}</div>
                    <div className="text-xs text-gray-600 truncate">{project.rootPath}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'folder' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Folder Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rootPath}
                    onChange={e => syncProjectNameFromPath(e.target.value)}
                    placeholder="/Users/you/trips/mexico"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    {...({ webkitdirectory: '', directory: '', mozdirectory: '' } as any)}
                    className="hidden"
                    onChange={e => {
                      const files = e.currentTarget.files;
                      if (!files || files.length === 0) return;
                      const first = files[0] as File & { webkitRelativePath?: string };
                      const rel = first.webkitRelativePath || first.name;
                      const folder = rel.split('/')[0];
                      syncProjectNameFromPath(folder);
                      setDirHandle(null);
                      setFolderInspection(null);
                      setScaffoldingPlan(null);
                      setPlanConfirmed(false);
                      setStep('folder');
                      requestAnimationFrame(() => projectNameInputRef.current?.select());
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    onClick={async () => {
                      if ('showDirectoryPicker' in window) {
                        // @ts-ignore
                        const handle = await (window as any).showDirectoryPicker();
                        setDirHandle(handle);
                        syncProjectNameFromPath(handle?.name || '');
                        setFolderInspection(null);
                        setScaffoldingPlan(null);
                        setPlanConfirmed(false);
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
                  Use the folder picker to grant access. If the picker is unavailable, paste the
                  full path (the app will ask again on first open).
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Existing folders are recognized as-is. Missing support folders like `Inbox` or
                  `X_Archive` may be added, and known folder variants like `X_ARCHIVE` may be
                  normalized to the canonical name.
                </p>
                {folderInspection?.inferredProjectMode && (
                  <p className="text-xs text-blue-700 mt-1">
                    Detected existing{' '}
                    {folderInspection.inferredProjectMode === 'multi_day'
                      ? 'multi-day'
                      : 'single-day'}{' '}
                    structure.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 'details' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                <input
                  ref={projectNameInputRef}
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  onFocus={e => e.currentTarget.select()}
                  placeholder="Suggested from the final folder name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-sm font-medium text-gray-900">Selected Folder</div>
                <div className="mt-1 text-sm text-gray-600 break-all">
                  {rootPath || dirHandle?.name || 'No folder selected'}
                </div>
                {folderInspection?.inferredProjectMode && (
                  <div className="mt-2 text-xs text-blue-700">
                    Inferred structure:{' '}
                    {folderInspection.inferredProjectMode === 'multi_day'
                      ? 'Multi Day'
                      : 'Single Day'}
                  </div>
                )}
                {!folderInspection?.hasCanonicalStructure &&
                  folderInspection?.hasExistingContent && (
                    <div className="mt-2 text-xs text-gray-600">
                      This folder has content but does not yet look like a Narrative project.
                    </div>
                  )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
                <div>
                  <div className="text-sm font-medium text-amber-900">Planned Folder Changes</div>
                  <div className="text-xs text-amber-800 mt-1">
                    Narrative will only apply these root-level changes during setup.
                  </div>
                </div>

                {!scaffoldingPlan ? (
                  <div className="text-xs text-amber-800">
                    Preview will be generated before continuing.
                  </div>
                ) : (
                  <>
                    {scaffoldingPlan.renamePaths.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-amber-900">Rename</div>
                        <div className="mt-1 space-y-1">
                          {scaffoldingPlan.renamePaths.map(rename => (
                            <div
                              key={`${rename.from}->${rename.to}`}
                              className="text-xs text-amber-900 font-mono"
                            >
                              {rename.from} {'->'} {rename.to}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {scaffoldingPlan.createPaths.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-amber-900">Add</div>
                        <div className="mt-1 space-y-1">
                          {scaffoldingPlan.createPaths.map(path => (
                            <div key={path} className="text-xs text-amber-900 font-mono">
                              {path}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasPlannedChanges && (
                      <div className="text-xs text-amber-800">
                        No root-level folder changes are planned.
                      </div>
                    )}
                  </>
                )}

                {hasPlannedChanges && (
                  <label className="flex items-start gap-2 text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={planConfirmed}
                      onChange={e => setPlanConfirmed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>I reviewed these planned changes and want to continue.</span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Topology
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setProjectMode('single_day');
                      if (dirHandle) {
                        await refreshScaffoldingPlan(dirHandle, 'single_day');
                      }
                    }}
                    className={`rounded-lg border px-4 py-3 text-left ${
                      projectMode === 'single_day'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">Single Day</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Use root bucket folders only. This project will not create day folders unless
                      you explicitly convert it later.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setProjectMode('multi_day');
                      if (dirHandle) {
                        await refreshScaffoldingPlan(dirHandle, 'multi_day');
                      }
                    }}
                    className={`rounded-lg border px-4 py-3 text-left ${
                      projectMode === 'multi_day'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">Multi Day</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Use a day-based structure with bucket folders nested under day folders.
                    </div>
                  </button>
                </div>
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
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Buckets</th>
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
                        <td className="px-3 py-3">
                          {mapping.detectedBuckets && mapping.detectedBuckets.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {mapping.detectedBuckets.map(bucket => (
                                <span
                                  key={bucket.bucketLetter}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                                  title={`${bucket.folderName} (${bucket.photoCount} photos)`}
                                >
                                  {bucket.bucketLetter}
                                  <span className="ml-1 text-green-600">({bucket.photoCount})</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">None detected</span>
                          )}
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
                        <td colSpan={5} className="px-3 py-4 text-sm text-gray-600 text-center">
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
          {step === 'folder' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleFolderNext}
                disabled={!dirHandle || loading}
                aria-disabled={!dirHandle || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {loading ? 'Inspecting…' : 'Next'}
              </button>
            </>
          ) : step === 'details' ? (
            <>
              <button
                onClick={() => setStep('folder')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleDetect}
                disabled={
                  !projectName.trim() ||
                  !dirHandle ||
                  loading ||
                  (hasPlannedChanges && !planConfirmed)
                }
                aria-disabled={
                  !projectName.trim() ||
                  !dirHandle ||
                  loading ||
                  (hasPlannedChanges && !planConfirmed)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Preparing…'
                  : projectMode === 'single_day' &&
                    folderInspection?.inferredProjectMode !== 'multi_day'
                  ? primaryActionLabel
                  : 'Next'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('details')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {primaryActionLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
