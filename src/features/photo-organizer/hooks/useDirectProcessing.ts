import { useCallback, useState } from 'react';
import type { ProjectMode, ProjectPhoto, ProjectSettings } from '../services/projectService';
import {
  getExportDestinationHandle,
  getHandle,
  removeExportDestinationHandle,
  saveExportDestinationHandle,
} from '../services/projectService';
import type { ExportStructureMode } from './useExportScript';
import { buildOperationPlan, type OperationPlan } from '../utils/buildOperationPlan';
import { executePlan, type ExecutionProgress, type ExecutionResult } from '../utils/executePlan';
import {
  clearExportManifest,
  loadExportManifest,
  saveExportManifest,
} from '../utils/exportManifest';

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
  projectMode?: ProjectMode,
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
  const [deleteAfterVerify, setDeleteAfterVerify] = useState<boolean>(false);
  const [existingDestinationPaths, setExistingDestinationPaths] = useState<Set<string>>(new Set());

  const scanDestinationPaths = useCallback(
    async (handle: FileSystemDirectoryHandle, prefix = '') => {
      const paths = new Set<string>();
      // @ts-ignore entries() is supported in modern browsers
      for await (const [name, entry] of handle.entries()) {
        const relativePath = prefix ? `${prefix}/${name}` : name;
        if (entry.kind === 'directory') {
          const nested = await scanDestinationPaths(
            entry as FileSystemDirectoryHandle,
            relativePath,
          );
          nested.forEach(path => paths.add(path));
        } else {
          paths.add(relativePath);
        }
      }
      return paths;
    },
    [],
  );

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
      const existingPaths = await scanDestinationPaths(handle);
      setExistingDestinationPaths(existingPaths);

      // Build operation plan
      const newPlan = buildOperationPlan({
        photos,
        dayLabels,
        projectSettings,
        projectMode,
        ingested,
        sourceRoot,
        structureMode,
        existingDestinationPaths: existingPaths,
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
  }, [
    photos,
    dayLabels,
    projectSettings,
    ingested,
    sourceRoot,
    structureMode,
    scanDestinationPaths,
    projectMode,
  ]);

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
        deleteAfterVerify,
      });

      setResult(executionResult);

      // Save manifest to localStorage so "Undo Export" button appears
      if (projectId) {
        saveExportManifest(projectId, executionResult.manifest);
        await saveExportDestinationHandle(projectId, destinationHandle);
      }

      setState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [plan, destinationHandle, state, projectId, ingested, destinationLabel, deleteAfterVerify]);

  const closeDirectProcessing = useCallback(() => {
    setState('idle');
    setPlan(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setDestinationHandle(null);
    setDestinationLabel('');
    setExistingDestinationPaths(new Set());
    setStructureMode('auto');
    setDeleteAfterVerify(false);
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
          projectMode,
          ingested,
          sourceRoot,
          structureMode: mode,
          existingDestinationPaths,
        });
        setPlan(newPlan);
      }
    },
    [
      state,
      photos,
      dayLabels,
      projectSettings,
      ingested,
      sourceRoot,
      existingDestinationPaths,
      projectMode,
    ],
  );

  const toggleDeleteAfterVerify = useCallback((value: boolean) => {
    setDeleteAfterVerify(value);
  }, []);

  const canUndoDirectProcess = useCallback(() => {
    if (!projectId) return false;
    const manifest = loadExportManifest(projectId);
    return manifest?.source === 'direct';
  }, [projectId]);

  const removeEmptyDirectories = useCallback(
    async (rootHandle: FileSystemDirectoryHandle, relativePath: string) => {
      const segments = relativePath.split('/').filter(Boolean);
      segments.pop();

      while (segments.length > 0) {
        const pathSegments = [...segments];
        const dirName = pathSegments.pop()!;
        let parent = rootHandle;
        for (const segment of pathSegments) {
          parent = await parent.getDirectoryHandle(segment);
        }

        const dirHandle = await parent.getDirectoryHandle(dirName);
        let hasEntries = false;
        // @ts-ignore entries() is supported in modern browsers
        for await (const _entry of dirHandle.entries()) {
          hasEntries = true;
          break;
        }

        if (hasEntries) break;
        await parent.removeEntry(dirName);
        segments.pop();
      }
    },
    [],
  );

  const undoLastDirectProcess = useCallback(async () => {
    if (!projectId) {
      throw new Error('Project ID not available');
    }

    const manifest = loadExportManifest(projectId);
    if (!manifest || manifest.source !== 'direct') {
      throw new Error('No direct-processing undo information is available.');
    }

    const destination = await getExportDestinationHandle(projectId);
    if (!destination) {
      throw new Error('The last direct-processing destination is no longer available.');
    }

    const permission = await destination.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      throw new Error('Write permission denied for the last direct-processing destination.');
    }

    for (const operation of [...manifest.operations].reverse()) {
      const relativePath =
        operation.destinationRelativePath ||
        operation.destinationPath.replace(`${manifest.destinationRoot}/`, '');
      const parts = relativePath.split('/').filter(Boolean);
      const fileName = parts.pop();
      if (!fileName) continue;

      let current = destination;
      let missing = false;

      try {
        for (const segment of parts) {
          current = await current.getDirectoryHandle(segment);
        }
      } catch (error) {
        missing = true;
      }
      if (missing) continue;

      try {
        const fileHandle = await current.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        if (operation.fileSize > 0 && file.size !== operation.fileSize) {
          continue;
        }
        await current.removeEntry(fileName);
        await removeEmptyDirectories(destination, relativePath);
      } catch (error: any) {
        if (error?.name !== 'NotFoundError') {
          throw error;
        }
      }
    }

    clearExportManifest(projectId);
    await removeExportDestinationHandle(projectId);
  }, [projectId, removeEmptyDirectories]);

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
    toggleDeleteAfterVerify,
    deleteAfterVerify,
    canUndoDirectProcess,
    undoLastDirectProcess,
  };
}
