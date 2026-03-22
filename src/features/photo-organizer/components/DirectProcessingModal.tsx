import React from 'react';
import { X, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { DirectProcessingState } from '../hooks/useDirectProcessing';
import type { OperationPlan, PlanBlocker } from '../utils/buildOperationPlan';
import type { ExecutionProgress, ExecutionResult } from '../utils/executePlan';
import type { ExportStructureMode } from '../hooks/useExportScript';

interface DirectProcessingModalProps {
  isOpen: boolean;
  state: DirectProcessingState;
  plan: OperationPlan | null;
  progress: ExecutionProgress | null;
  result: ExecutionResult | null;
  error: string | null;
  destinationLabel: string;
  structureMode: ExportStructureMode;
  onClose: () => void;
  onConfirm: () => void;
  onStructureModeChange: (mode: ExportStructureMode) => void;
  canUndoDirectProcess?: boolean;
  onUndoDirectProcess?: () => void;
}

function DirectProcessingModal({
  isOpen,
  state,
  plan,
  progress,
  result,
  error,
  destinationLabel,
  structureMode,
  onClose,
  onConfirm,
  onStructureModeChange,
  canUndoDirectProcess,
  onUndoDirectProcess,
}: DirectProcessingModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const hasBlockers = plan && plan.blockers.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {state === 'ready' && 'Preview'}
            {state === 'executing' && 'Processing'}
            {state === 'complete' && 'Complete'}
            {state === 'error' && 'Error'}
            {state === 'planning' && 'Preparing'}
          </h2>
          {state !== 'executing' && (
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded" aria-label="Close">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* READY phase */}
          {state === 'ready' && plan && (
            <>
              {/* Destination info */}
              <div className="mb-6 p-4 bg-gray-800 rounded">
                <div className="text-sm text-gray-400 mb-1">Destination</div>
                <div className="text-white font-medium flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  {destinationLabel}
                </div>
              </div>

              {/* Structure mode selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Export Structure
                </label>
                <select
                  value={structureMode}
                  onChange={e => onStructureModeChange(e.target.value as ExportStructureMode)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto (detect from photos)</option>
                  <option value="single_day_flat">Single Day Flat (buckets at root)</option>
                  <option value="multi_day_nested">
                    Multi Day Nested (buckets in day folders)
                  </option>
                </select>
              </div>

              {/* Summary */}
              <div className="mb-6 p-4 bg-blue-900 bg-opacity-50 rounded border border-blue-700">
                <div className="text-sm text-blue-200">
                  {plan.summary.copyCount > 0 && (
                    <div>
                      <strong>{plan.summary.copyCount}</strong> files to copy
                    </div>
                  )}
                  {plan.summary.skippedCount > 0 && (
                    <div className="text-blue-300 mt-1">
                      <strong>{plan.summary.skippedCount}</strong> files with missing paths
                    </div>
                  )}
                  {plan.summary.preexistingSkipCount > 0 && (
                    <div className="text-blue-300 mt-1">
                      <strong>{plan.summary.preexistingSkipCount}</strong> files already organized
                      at the destination
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {plan.warnings.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-900 bg-opacity-50 rounded border border-yellow-700">
                  <div className="text-sm font-medium text-yellow-200 mb-2">Warnings</div>
                  <div className="text-sm text-yellow-300 space-y-1">
                    {plan.warnings.map(warning => (
                      <div key={warning.photoId}>{warning.currentName}: missing file path</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blockers */}
              {plan.blockers.length > 0 && (
                <div className="mb-6 p-4 bg-red-900 bg-opacity-50 rounded border border-red-700">
                  <div className="text-sm font-medium text-red-200 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Duplicate Destinations (cannot proceed)
                  </div>
                  <div className="space-y-3 text-sm text-red-300">
                    {plan.blockers.map((blocker, idx) => (
                      <div key={idx} className="bg-red-900 bg-opacity-50 p-2 rounded">
                        <div className="font-medium mb-1">{blocker.destinationRelativePath}</div>
                        <div className="text-xs text-red-400 space-y-1">
                          {blocker.conflictingPhotos.map(photo => (
                            <div key={photo.id}>
                              • {photo.currentName} (source: {photo.filePath})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-6 text-sm text-gray-400">
                <p>
                  Files that already exist at the destination will be skipped. No files will be
                  overwritten.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={hasBlockers}
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    hasBlockers
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {hasBlockers ? 'Resolve Duplicates First' : 'Confirm & Process'}
                </button>
              </div>
            </>
          )}

          {/* EXECUTING phase */}
          {state === 'executing' && progress && (
            <>
              <div className="space-y-6">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">
                      {progress.phase === 'preparing' && 'Preparing...'}
                      {progress.phase === 'copying' && 'Copying files...'}
                      {progress.phase === 'complete' && 'Complete!'}
                    </span>
                    <span className="text-gray-400">
                      {progress.processed} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          progress.total > 0 ? (progress.processed / progress.total) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Current file */}
                {progress.currentFile && (
                  <div className="p-3 bg-gray-800 rounded">
                    <div className="text-sm text-gray-400 mb-1">Current file</div>
                    <div className="text-sm text-white flex items-center gap-2">
                      {progress.currentStatus === 'copied' && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      {progress.currentStatus === 'skipped' && (
                        <Clock className="w-4 h-4 text-yellow-400" />
                      )}
                      {progress.currentStatus === 'failed' && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      {!progress.currentStatus && (
                        <Clock className="w-4 h-4 text-gray-400 animate-spin" />
                      )}
                      <span className="break-all">{progress.currentFile}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* COMPLETE phase */}
          {state === 'complete' && result && (
            <>
              <div className="space-y-4">
                {/* Summary boxes */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-900 bg-opacity-50 rounded border border-green-700">
                    <div className="text-2xl font-bold text-green-300">{result.copiedCount}</div>
                    <div className="text-xs text-green-200">Copied</div>
                  </div>
                  <div className="p-3 bg-yellow-900 bg-opacity-50 rounded border border-yellow-700">
                    <div className="text-2xl font-bold text-yellow-300">{result.skippedCount}</div>
                    <div className="text-xs text-yellow-200">Skipped</div>
                  </div>
                  <div
                    className={`p-3 ${
                      result.failedCount > 0
                        ? 'bg-red-900 bg-opacity-50 border border-red-700'
                        : 'bg-gray-800 border border-gray-700'
                    } rounded`}
                  >
                    <div
                      className={`text-2xl font-bold ${
                        result.failedCount > 0 ? 'text-red-300' : 'text-gray-300'
                      }`}
                    >
                      {result.failedCount}
                    </div>
                    <div
                      className={`text-xs ${
                        result.failedCount > 0 ? 'text-red-200' : 'text-gray-200'
                      }`}
                    >
                      Failed
                    </div>
                  </div>
                </div>

                {/* Failures list */}
                {result.failures.length > 0 && (
                  <div className="p-4 bg-red-900 bg-opacity-30 rounded border border-red-700">
                    <div className="text-sm font-medium text-red-200 mb-2">Failures</div>
                    <div className="space-y-1 text-xs text-red-300 max-h-40 overflow-y-auto">
                      {result.failures.map((failure, idx) => (
                        <div key={idx}>
                          <div className="font-medium">{failure.operation.currentName}</div>
                          <div className="text-red-400 ml-4">{failure.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts note */}
                {result.conflicts.length > 0 && (
                  <div className="p-4 bg-yellow-900 bg-opacity-30 rounded border border-yellow-700">
                    <div className="text-sm text-yellow-200">
                      {result.conflicts.length} file(s) already existed at the destination and were
                      skipped.
                    </div>
                  </div>
                )}

                {/* Undo note */}
                <div className="p-4 bg-blue-900 bg-opacity-30 rounded border border-blue-700 text-sm text-blue-200">
                  ✓ You can now undo this direct process from the header or below.
                </div>
              </div>

              {/* Close button */}
              <div className="mt-6 flex justify-end gap-3">
                {canUndoDirectProcess && onUndoDirectProcess && (
                  <button
                    onClick={onUndoDirectProcess}
                    className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-sm font-medium text-white"
                  >
                    Undo Direct Process
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            </>
          )}

          {/* ERROR phase */}
          {state === 'error' && (
            <>
              <div className="p-4 bg-red-900 bg-opacity-50 rounded border border-red-700 mb-6">
                <div className="text-sm font-medium text-red-200 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </div>
                <div className="text-sm text-red-300">{error}</div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-medium text-gray-300"
                >
                  Close
                </button>
              </div>
            </>
          )}

          {/* PLANNING phase */}
          {state === 'planning' && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Clock className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-300">Preparing plan...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DirectProcessingModal;
