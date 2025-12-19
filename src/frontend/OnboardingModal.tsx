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
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  onDetect,
  onApply,
}: OnboardingModalProps) {
  const [step, setStep] = useState<'folder-select' | 'preview' | 'dry-run' | 'apply' | 'complete'>(
    'folder-select',
  );
  const [projectName, setProjectName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [mappings, setMappings] = useState<FolderMapping[]>([]);
  const [dryRunMode, setDryRunMode] = useState(false);
  const [applyInProgress, setApplyInProgress] = useState(false);
  const [dryRunSummary, setDryRunSummary] = useState<{
    summary: string;
    changes: object;
  } | null>(null);
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (onDetect) {
        const detected = await onDetect(rootPath);
        setMappings(detected);
      } else {
        // Fallback: return empty mappings (will be handled in preview)
        setMappings([]);
      }
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect folder structure');
    } finally {
      setLoading(false);
    }
  }, [rootPath, projectName, onDetect]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {step === 'folder-select' && 'Import Trip'}
            {step === 'preview' && 'Review Folder Structure'}
            {step === 'dry-run' && 'Dry-Run Preview'}
            {step === 'apply' && 'Applying Changes...'}
            {step === 'complete' && 'Import Complete'}
          </h2>
          {step !== 'apply' && (
            <button
              onClick={onClose}
              // Increase contrast for the close control so it is readable on white
              className="text-gray-600 hover:text-gray-800"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-red-800">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Folder Selection */}
          {step === 'folder-select' && (
            <div className="space-y-4">
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
                  <button
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
              <p className="text-sm text-gray-600">
                Detected folder structure for {projectName}. You can edit the day numbers, skip
                folders, or make other adjustments below.
              </p>

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

              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle size={18} className="text-yellow-700 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-yellow-800">
                  ⚠ All changes are REVERSIBLE (undo available with Cmd+Z)
                </span>
              </div>
            </div>
          )}

          {/* Step 4: Apply Progress */}
          {step === 'apply' && (
            <div className="space-y-4 text-center">
              <Loader className="inline-block animate-spin text-blue-600" size={32} />
              <p className="text-gray-700 font-medium">Applying changes...</p>
              <p className="text-sm text-gray-600">Please wait, this may take a moment.</p>
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
