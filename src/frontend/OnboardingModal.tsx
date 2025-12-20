import React, { useState, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader,
  AlertCircle,
  CheckCircle,
  FolderOpen,
} from 'lucide-react';
import StepIndicator from './ui/StepIndicator';
import { detectFolderStructure, generateDryRunSummary } from '../services/folderDetectionService';

// Data structure for folder mapping
export interface FolderMapping {
  folder: string;
  folderPath: string;
  detectedDay: number | null;
  confidence: 'high' | 'medium' | 'low' | 'undetected';
  patternMatched: string;
  suggestedName: string;
  manual: boolean;
  photoCount: number;
  dateRange?: {
    start: string;
    end: string;
  };
  skip?: boolean; // User-selected skip flag
}

export interface OnboardingState {
  projectName: string;
  rootPath: string;
  mappings: FolderMapping[];
  tripStart?: string;
  tripEnd?: string;
  dryRunMode: boolean;
  applyInProgress: boolean;
  error?: string;
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
  onDetect?: (rootPath: string) => Promise<FolderMapping[]>;
  onApply?: (
    mappings: FolderMapping[],
    dryRun: boolean,
  ) => Promise<{
    summary: string;
    changes: object;
  }>;
  recentProjects?: RecentProject[];
  onSelectRecent?: (rootPath: string) => void;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  onDetect,
  onApply,
  recentProjects = [],
  onSelectRecent,
}: OnboardingModalProps) {
  const [step, setStep] = useState<'folder-select' | 'preview' | 'dry-run' | 'apply' | 'complete'>(
    'folder-select',
  );
  const [projectName, setProjectName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [mappings, setMappings] = useState<FolderMapping[]>([]);
  const [dryRunMode, setDryRunMode] = useState(false);
  const [applyInProgress, setApplyInProgress] = useState(false);
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const [applyMode, setApplyMode] = useState<'copy' | 'move'>('copy');
  const [dryRunSummary, setDryRunSummary] = useState<{
    summary: string;
    changes: object;
  } | null>(null);
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const selectedFilesRef = React.useRef<FileList | null>(null);
  const derivedSelectionRef = React.useRef<{
    photoCountMap: Map<string, number>;
    folders: string[];
  } | null>(null);
  const [detectionDebug, setDetectionDebug] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const pushDebug = useCallback((...parts: any[]) => {
    const msg = parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    // eslint-disable-next-line no-console
    console.debug('[Onboarding][detect]', msg);
    setDetectionDebug(prev => [...prev.slice(-20), `${new Date().toISOString()} ${msg}`]);
  }, []);

  // Step 1: Handle folder selection
  const handleFolderSelect = useCallback(async () => {
    if (!rootPath.trim()) {
      setError('Please select a folder');
      return;
    }
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      pushDebug('handleFolderSelect called', { rootPath, projectName, selectedFiles: selectedFilesRef.current?.length ?? 0 });
      // If the user selected a folder via the hidden directory input, we can derive folder names
      // and photo counts directly from the FileList (webkitRelativePath). This helps the preview
      // work without needing an external detection service.
      // Prefer an already-derived selection (persisted at file selection time) instead of relying on FileList
      const derived = derivedSelectionRef.current;
      if (derived && derived.folders.length > 0) {
        pushDebug('Using derived selection for detection', { rootPath, derivedFolders: derived.folders, photoCounts: Array.from(derived.photoCountMap.entries()) });
        const detected = detectFolderStructure(derived.folders, { photoCountMap: derived.photoCountMap, projectName });
        // default to skipping undetected folders unless user includes them
        const withSkips = detected.map(m => ({ ...m, skip: m.confidence === 'undetected' ? true : m.skip ?? false }));
        pushDebug('detectFolderStructure returned', detected.length, detected.map(d => ({ folder: d.folder, detectedDay: d.detectedDay })));
        setMappings(withSkips);
      } else {
        const files = selectedFilesRef.current;
        if (files && files.length > 0) {
          const photoCountMap = new Map<string, number>();
          for (let i = 0; i < files.length; i++) {
            const f = files[i] as File & { webkitRelativePath?: string };
            const rel = f.webkitRelativePath || f.name;
            const parts = rel.split('/');
            const folder = parts.length > 1 ? parts[0] : rel;
            const ext = f.name.split('.').pop()?.toLowerCase() || '';
            if (!['jpg', 'jpeg', 'png', 'heic'].includes(ext)) continue;
            photoCountMap.set(folder, (photoCountMap.get(folder) || 0) + 1);
          }
          const folders = Array.from(photoCountMap.keys());
          pushDebug('Derived folders from directory input for', rootPath, folders.length, folders, 'photoCounts', Array.from(photoCountMap.entries()));
          const detected = detectFolderStructure(folders, { photoCountMap, projectName: projectName });
          // default to skipping undetected folders unless user includes them
          const withSkips = detected.map(m => ({ ...m, skip: m.confidence === 'undetected' ? true : m.skip ?? false }));
          pushDebug('detectFolderStructure returned', detected.length, detected.map(d => ({ folder: d.folder, detectedDay: d.detectedDay })));
          setMappings(withSkips);
        } else if (onDetect) {
          const detected = await onDetect(rootPath);
          // helpful debug for developers when detection yields nothing
          pushDebug('onDetect result for', rootPath, detected?.length ?? 0, detected?.slice(0, 6));
          const withSkips = detected.map(m => ({ ...m, skip: m.confidence === 'undetected' ? true : m.skip ?? false }));
          setMappings(withSkips);
        } else {
          // Fallback: return empty mappings (will be handled in preview)
          setMappings([]);
        }
      }
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect folder structure');
    } finally {
      setLoading(false);
    }
  }, [rootPath, projectName, onDetect]);

  const stepList = [
    { key: 'folder-select', label: 'Select folder' },
    { key: 'preview', label: 'Preview' },
    { key: 'dry-run', label: 'Dry run' },
    { key: 'apply', label: 'Apply' },
    { key: 'complete', label: 'Complete' },
  ];

  // Step 2: Handle mapping edits
  const handleMappingChange = useCallback(
    (index: number, field: keyof FolderMapping, value: any) => {
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

  // Step 2: Handle dry-run
  const handleDryRun = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (onApply) {
        const result = await onApply(
          mappings.filter(m => !m.skip),
          true, // dryRun = true
        );
        setDryRunSummary(result);
      } else {
        // Generate a client-side dry-run summary so the feature is always available
        const summary = generateDryRunSummary(mappings.filter(m => !m.skip));
        setDryRunSummary({ summary, changes: {} });
      }
      setStep('dry-run');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run dry-run preview');
    } finally {
      setLoading(false);
    }
  }, [mappings, onApply]);

  // Step 3: Handle apply
  const handleApply = useCallback(async () => {
    setApplyInProgress(true);
    setError(null);

    try {
      if (onApply) {
        await onApply(
          mappings.filter(m => !m.skip),
          false, // dryRun = false
        );
      }
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply mappings');
    } finally {
      setApplyInProgress(false);
    }
  }, [mappings, onApply]);

  // New: Apply with file system support or zip fallback
  const handleApplyWithFS = useCallback(
    async (dirHandle?: any) => {
      setApplyInProgress(true);
      setError(null);
      try {
        const items = mappings.filter(m => !m.skip).map(m => ({
          originalName: m.folderPath.split('/').pop() || m.folder,
          newName: m.suggestedName || m.folder,
          day: m.detectedDay || 0,
        }));

        if (dirHandle) {
          // in-place
            await import('./services/fileSystemService').then(svc =>
              svc.applyOrganizationInPlace(
                dirHandle,
                items,
                (done, total) => {
                  setApplyProgress({ done, total });
                },
                { move: applyMode === 'move' },
              ),
            );
        } else {
          // fallback to zip
          const { exportAsZip } = await import('./services/fileSystemService');
          const blob = await exportAsZip(items as any);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName || 'project'}-organized.zip`;
          a.click();
        }

        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply organization');
      } finally {
        setApplyInProgress(false);
      }
    },
    [mappings, projectName],
  );

  // Handle completion
  const handleComplete = useCallback(() => {
    onComplete({
      projectName,
      rootPath,
      mappings: mappings.filter(m => !m.skip),
      tripStart,
      tripEnd,
      dryRunMode,
      applyInProgress: false,
    });
    onClose();
  }, [projectName, rootPath, mappings, tripStart, tripEnd, dryRunMode, onClose, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-12">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-6 max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                {step === 'folder-select' && 'Import Trip'}
                {step === 'preview' && 'Review Folder Structure'}
                {step === 'dry-run' && 'Dry-Run Preview'}
                {step === 'apply' && 'Applying Changes...'}
                {step === 'complete' && 'Import Complete'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Quickly map folders into days and preview changes before applying.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {step !== 'apply' && (
                <button
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-800 rounded-md px-2 py-1"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              )}

              {step === 'apply' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Mode:</label>
                    <select
                      value={applyMode}
                      onChange={e => setApplyMode(e.target.value as any)}
                      className="px-2 py-1 rounded-md border-gray-200"
                    >
                      <option value="copy">Copy (keep originals)</option>
                      <option value="move">Move (remove originals)</option>
                    </select>
                  </div>

                  <div className="flex flex-col items-end">
                    <button
                      onClick={async () => {
                        if ('showDirectoryPicker' in window) {
                          // @ts-ignore
                          const dirHandle = await (window as any).showDirectoryPicker();
                          await handleApplyWithFS(dirHandle);
                        } else {
                          await handleApplyWithFS(undefined);
                        }
                      }}
                      className="px-3 py-1 bg-sky-600 text-white rounded-md text-sm"
                    >
                      Apply and Organize
                    </button>
                    <div className="text-xs text-gray-500 mt-2">Default mode: Copy — originals are kept. Change mode in the header before applying.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="mt-2">
            <StepIndicator steps={stepList} currentKey={step} />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-red-800">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Folder Selection */}
          {step === 'folder-select' && (
            <div className="space-y-6">
              {recentProjects.length > 0 && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Recent Projects</p>
                    <p className="text-xs text-gray-500">
                      Pick a recent project or start a new one below.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {recentProjects.map(project => (
                      <button
                        key={project.rootPath}
                        onClick={() => onSelectRecent?.(project.rootPath)}
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
                  placeholder="e.g., Iceland Trip 2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Folder Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rootPath}
                    onChange={e => setRootPath(e.target.value)}
                    placeholder="/Users/you/trips/iceland"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 text-gray-900"
                    disabled={loading}
                  />
                  <input
                    ref={el => (fileInputRef.current = el)}
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    mozdirectory="true"
                    className="hidden"
                    onChange={e => {
                      const files = e.currentTarget.files;
                      if (!files || files.length === 0) return;
                      selectedFilesRef.current = files;
                      // log small sample of selected files for debugging
                      const sample: string[] = [];
                      const photoCountMap = new Map<string, number>();
                      for (let i = 0; i < files.length; i++) {
                        const f = files[i] as File & { webkitRelativePath?: string };
                        const rel = f.webkitRelativePath || f.name;
                        sample.push(rel);
                        const parts = rel.split('/');
                        // use the immediate child under the root (e.g., 'Day1' from 'Root/Day1/file.jpg')
                        // Use the immediate child under the selected root (parts[1]) when present
                        const folder = parts.length > 1 ? parts[1] : rel;
                        const ext = f.name.split('.').pop()?.toLowerCase() || '';
                        if (!['jpg', 'jpeg', 'png', 'heic'].includes(ext)) continue;
                        photoCountMap.set(folder, (photoCountMap.get(folder) || 0) + 1);
                      }
                      derivedSelectionRef.current = { photoCountMap, folders: Array.from(photoCountMap.keys()) };
                      pushDebug('Directory input selected', files.length, 'files; sample:', sample.slice(0, 5), 'derivedFolders', Array.from(photoCountMap.entries()));

                      // Derive selected folder name for the text field if available
                      const first = files[0] as File & { webkitRelativePath?: string };
                      const rel = first.webkitRelativePath || first.name;
                      const folder = rel.split('/')[0];
                      setRootPath(folder);
                      // reset file input so same folder can be reselected — but keep derivedSelectionRef
                      e.currentTarget.value = '';
                    }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                    disabled={loading}
                    aria-disabled={loading}
                  >
                    <FolderOpen size={18} />
                    Browse
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={tripStart}
                    onChange={e => setTripStart(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 text-gray-900 shadow-sm"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={tripEnd}
                    onChange={e => setTripEnd(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Select the root folder containing your existing day-based subfolders. Narrative will
                detect the folder structure and show you a preview before making any changes.
              </p>
            </div>
          )}

          {/* Step 2: Preview & Edit */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700 font-medium">Review suggested mappings</p>
                <p className="text-sm text-gray-600 mt-1">
                  The preview shows how folders will be organized into days and the filenames that will be created.
                  Please review each mapping and optionally edit the day number, skip folders you don't want to include,
                  or rename suggested filenames.
                </p>
                {rootPath && (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-gray-500">Detected folder structure for <strong>{rootPath}</strong></p>
                    {mappings.length > 0 ? (
                      <p className="text-sm text-gray-500">{mappings.length} folders detected: {mappings.map(m => m.folder).join(', ')}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500">No folders detected yet.</p>
                        <button
                          onClick={() => {
                            // Load an example detection locally so users can see the preview
                            const exampleFolders = ['Day 1', 'Day 2', 'Day 3', 'MiscFolder'];
                            const photoCountMap = new Map([
                              ['Day 1', 2],
                              ['Day 2', 3],
                              ['Day 3', 2],
                              ['MiscFolder', 1],
                            ]);
                            const example = detectFolderStructure(exampleFolders, { photoCountMap });
                            pushDebug('Loaded example mappings', example.map(e => e.folder));
                            setMappings(example);
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                        >
                          Load example mappings
                        </button>
                        <button
                          onClick={() => setShowDebug(prev => !prev)}
                          className="px-3 py-1 bg-white text-gray-700 border rounded-md text-sm hover:bg-gray-50"
                        >
                          {showDebug ? 'Hide detection debug' : 'Show detection debug'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {showDebug && detectionDebug.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-100 rounded text-xs text-gray-700 font-mono">
                    {detectionDebug.map((d, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={i}>{d}</div>
                    ))}
                  </div>
                )}

                <ul className="mt-3 text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li><strong>Step 1:</strong> Inspect the detected folder names and counts.</li>
                  <li><strong>Step 2:</strong> Edit day numbers or mark folders to <em>skip</em> if needed.</li>
                  <li><strong>Step 3:</strong> Use <em>Export script</em> or <em>Export ZIP</em> to test locally, or click <em>Apply</em> to perform the reorganization.</li>
                </ul>
              </div>


              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Folder Name</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Day #</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Photos</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">
                        Confidence
                      </th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-gray-200 ${
                          mapping.skip ? 'bg-gray-100 opacity-50' : 'hover:bg-blue-50'
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
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded ${
                              mapping.confidence === 'high'
                                ? 'bg-green-100 text-green-700'
                                : mapping.confidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {mapping.confidence.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {mapping.confidence === 'undetected' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-gray-500">-</span>
                              <button
                                onClick={() => handleMappingChange(idx, 'skip', false)}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                              >
                                Include
                              </button>
                            </div>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* If detection returned no mappings, show a friendly hint */}
                    {mappings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-sm text-gray-600 text-center">
                          No subfolders detected in the selected folder. Ensure the folder contains
                          subfolders with photos (or use the Browse button to select a directory),
                          then click Next again.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="dry-run"
                  checked={dryRunMode}
                  onChange={e => setDryRunMode(e.target.checked)}
                  className="rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="dry-run" className="text-sm text-gray-700">
                  Dry-run (preview without making changes)
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Dry-Run Preview */}
          {step === 'dry-run' && dryRunSummary && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This preview shows what WILL happen if you apply these changes:
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <pre className="text-xs whitespace-pre-wrap text-gray-700 font-mono">
                    {dryRunSummary.summary}
                  </pre>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-medium text-gray-700">Predicted folder structure</p>
                  <ul className="mt-2 text-sm text-gray-700 list-inside space-y-1">
                    {mappings
                      .filter(m => !m.skip)
                      .map((m, idx) => (
                        <li key={idx}>
                          <strong>{m.suggestedName}</strong>: {m.photoCount} photo{m.photoCount !== 1 ? 's' : ''} — from <em>{m.folder}</em>
                        </li>
                      ))}
                  </ul>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const items = mappings.filter(m => !m.skip).map(m => ({
                          originalName: m.folderPath.split('/').pop() || m.folder,
                          newName: m.suggestedName || m.folder,
                          day: m.detectedDay || 0,
                        }));
                        const { generateShellScript } = await import('./services/fileSystemService');
                        const script = generateShellScript(items as any, { move: false });
                        const blob = new Blob([script], { type: 'text/x-shellscript' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${projectName || 'project'}-organize.sh`;
                        a.click();
                      }}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                    >
                      Export organize script
                    </button>

                    <button
                      onClick={async () => {
                        const items = mappings.filter(m => !m.skip).map(m => ({
                          originalName: m.folderPath.split('/').pop() || m.folder,
                          newName: m.suggestedName || m.folder,
                          day: m.detectedDay || 0,
                        }));
                        const { exportAsZip } = await import('./services/fileSystemService');
                        const blob = await exportAsZip(items as any);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${projectName || 'project'}-organized.zip`;
                        a.click();
                      }}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                    >
                      Export ZIP (dry-run)
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle size={18} className="text-yellow-700 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-yellow-800">
                    ⚠ This dry-run summary is generated locally; run the Export script or ZIP to test changes on your machine or click Apply to perform these changes.
                  </span>
                </div>
              </div>
            )}

          {/* Step 4: Apply Progress */}
          {step === 'apply' && (
            <div className="space-y-4">
              <div className="text-center">
                <Loader className="inline-block animate-spin text-blue-600" size={32} />
                <p className="text-gray-700 font-medium">Applying changes...</p>
                <p className="text-sm text-gray-600">Please wait, this may take a moment.</p>
              </div>

              <div className="w-full">
                <div className="w-full bg-gray-100 h-3 rounded overflow-hidden">
                  <div
                    className="h-3 bg-sky-500"
                    style={{ width: applyProgress.total ? `${(applyProgress.done / applyProgress.total) * 100}%` : '0%' }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2">{applyProgress.done} / {applyProgress.total} files processed</div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="inline-block text-green-600" size={48} />
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">✓ Import Complete</h3>
                <p className="text-sm text-gray-600">
                  Successfully imported your photos into day-based folders. You can now organize
                  them by story role.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
                <p className="text-sm font-medium text-gray-900">Summary:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {mappings
                    .filter(m => !m.skip)
                    .map((m, idx) => (
                      <li key={idx}>
                        • Day {m.detectedDay}: {m.photoCount} photos
                      </li>
                    ))}
                </ul>
              </div>

              <p className="text-xs text-gray-500">
                💡 Tip: Use Cmd+Z to undo all changes if needed.
              </p>
            </div>
          )}
        </div>

        {/* Footer: Navigation Buttons */}
        {step !== 'apply' && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between gap-3">
            {step === 'folder-select' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFolderSelect}
                  disabled={loading || !rootPath.trim() || !projectName.trim()}
                  aria-disabled={loading || !rootPath.trim() || !projectName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader size={18} className="animate-spin" />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                  Next
                </button>
              </>
            )}

            {step === 'preview' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500 mr-4 hidden sm:block">Default mode: Copy — originals are kept.</div>
                  <button
                    onClick={() => {
                      if (dryRunMode) {
                        handleDryRun();
                      } else {
                        setStep('apply');
                        handleApply();
                      }
                    }}
                  disabled={loading || mappings.every(m => m.skip)}
                  aria-disabled={loading || mappings.every(m => m.skip)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader size={18} className="animate-spin" />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                  {dryRunMode ? 'Preview' : 'Apply'}
                </button>
                  <button
                    onClick={async () => {
                      const items = mappings.filter(m => !m.skip).map(m => ({
                        originalName: m.folderPath.split('/').pop() || m.folder,
                        newName: m.suggestedName || m.folder,
                        day: m.detectedDay || 0,
                      }));
                      const { generateShellScript } = await import('./services/fileSystemService');
                      const script = generateShellScript(items as any, { move: false });
                      const blob = new Blob([script], { type: 'text/x-shellscript' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${projectName || 'project'}-organize.sh`;
                      a.click();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Export organize script
                  </button>
                  <button
                    onClick={async () => {
                      const items = mappings.filter(m => !m.skip).map(m => ({
                        originalName: m.folderPath.split('/').pop() || m.folder,
                        newName: m.suggestedName || m.folder,
                        day: m.detectedDay || 0,
                      }));
                      const { exportAsZip } = await import('./services/fileSystemService');
                      const blob = await exportAsZip(items as any);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${projectName || 'project'}-organized.zip`;
                      a.click();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Export ZIP (dry-run)
                  </button>
                </div>
              </>
            )}

            {step === 'dry-run' && (
              <>
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2"
                  disabled={loading}
                >
                  <ChevronLeft size={18} />
                  Back to Edit
                </button>
                <button
                  onClick={() => {
                    setStep('apply');
                    handleApply();
                  }}
                  disabled={loading}
                  aria-disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader size={18} className="animate-spin" />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                  Apply for Real
                </button>
              </>
            )}

            {step === 'complete' && (
              <button
                onClick={handleComplete}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
