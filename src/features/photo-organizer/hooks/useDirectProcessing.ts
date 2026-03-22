import { useCallback, useState } from 'react';
import type { ProjectPhoto, ProjectSettings } from '../services/projectService';
import { getHandle } from '../services/projectService';
import type { ExportStructureMode } from './useExportScript';
import { buildOperationPlan, type OperationPlan } from '../utils/buildOperationPlan';
import { executePlan, type ExecutionProgress, type ExecutionResult } from '../utils/executePlan';
import { saveExportManifest } from '../utils/exportManifest';

export type DirectProcessingState =
  | 'idle'
  | 'planning'
  | 'ready'
  | 'executing'
  | 'complete'
  | 'error';

export function useDirectProcessing(
  photos: ProjectPhoto[],
  dayLabels: Record<number, string>,
  projectSettings: ProjectSettings,
  projectId: string | null,
  ingested?: boolean,
  sourceRoot?: string,
) {
  const [state, setState] = useState<DirectProcessingState>('idle');
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destinationHandle, setDestinationHandle] = useState<FileSystemDirectoryHandle | null>(
    null,
  );
  const [destinationLabel, setDestinationLabel] = useState<string>('');
  const [structureMode, setStructureMode] = useState<ExportStructureMode>('auto');

  const openDirectProcessing = useCallback(async () => {
    setState('planning');
    setError(null);
    setPlan(null);
    setProgress(null);
    setResult(null);

    try {
      // Show directory picker
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });

      if (!handle) {
        setState('idle');
        return;
      }

      setDestinationHandle(handle);
      setDestinationLabel(handle.name);

      // Build operation plan
      const newPlan = buildOperationPlan({
        photos,
        dayLabels,
        projectSettings,
        ingested,
        sourceRoot,
        structureMode,
      });

      setPlan(newPlan);
      setState('ready');
    } catch (err) {
      // User cancelled or error occurred
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — stay idle
        setState('idle');
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    }
  }, [photos, dayLabels, projectSettings, ingested, sourceRoot, structureMode]);

  const confirmExecution = useCallback(async () => {
    if (!plan || !destinationHandle || state !== 'ready') {
      return;
    }

    setState('executing');
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      // Get source directory handle
      if (!projectId) {
        throw new Error('Project ID not available');
      }

      const sourceHandle = await getHandle(projectId);
      if (!sourceHandle) {
        throw new Error('Project folder no longer accessible. Please re-select it.');
      }

      // Request readwrite permission on destination if needed
      const permission = await destinationHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        throw new Error('Write permission denied for destination folder');
      }

      // Execute the plan
      const executionResult = await executePlan(plan, {
        sourceDirectoryHandle: sourceHandle,
        destinationDirectoryHandle: destinationHandle,
        sourceRootLabel: projectId,
        destinationRootLabel: destinationLabel,
        ingested: ingested ?? true,
        onProgress: setProgress,
      });

      setResult(executionResult);

      // Save manifest to localStorage so "Undo Export" button appears
      if (projectId) {
        saveExportManifest(projectId, executionResult.manifest);
      }

      setState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [plan, destinationHandle, state, projectId, ingested, destinationLabel]);

  const closeDirectProcessing = useCallback(() => {
    setState('idle');
    setPlan(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setDestinationHandle(null);
    setDestinationLabel('');
    setStructureMode('auto');
  }, []);

  const updateStructureMode = useCallback(
    (mode: ExportStructureMode) => {
      setStructureMode(mode);
      if (state === 'ready') {
        // Rebuild plan with new structure mode
        const newPlan = buildOperationPlan({
          photos,
          dayLabels,
          projectSettings,
          ingested,
          sourceRoot,
          structureMode: mode,
        });
        setPlan(newPlan);
      }
    },
    [state, photos, dayLabels, projectSettings, ingested, sourceRoot],
  );

  return {
    showDirectProcessing: state !== 'idle',
    directProcessingState: state,
    plan,
    progress,
    result,
    error,
    destinationLabel,
    structureMode,
    openDirectProcessing,
    confirmExecution,
    closeDirectProcessing,
    updateStructureMode,
  };
}
