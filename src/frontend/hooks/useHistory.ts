import { Dispatch, MutableRefObject, SetStateAction, useCallback, useState } from 'react';
import { ProjectPhoto, ProjectSettings, ProjectState, saveState } from '../services/projectService';

interface UseHistoryOptions {
  photos: ProjectPhoto[];
  setPhotos: Dispatch<SetStateAction<ProjectPhoto[]>>;
  projectRootPath: string | null;
  projectName: string;
  projectFolderLabel: string | null;
  projectSettings: ProjectSettings;
  dayLabels: Record<number, string>;
  prevThumbnailsRef: MutableRefObject<string[]>;
}

export function useHistory({
  photos,
  setPhotos,
  projectRootPath,
  projectName,
  projectFolderLabel,
  projectSettings,
  dayLabels,
  prevThumbnailsRef,
}: UseHistoryOptions) {
  const [history, setHistory] = useState<ProjectPhoto[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const persistState = useCallback(
    (newPhotos?: ProjectPhoto[]) => {
      if (!projectRootPath) return;
      const nextState: ProjectState = {
        projectName,
        rootPath: projectFolderLabel || projectRootPath,
        photos: newPhotos ?? photos,
        settings: projectSettings,
        dayLabels: dayLabels as any,
      };
      saveState(projectRootPath, nextState).catch(() => {});
    },
    [projectRootPath, projectName, projectFolderLabel, photos, projectSettings, dayLabels],
  );

  const saveToHistory = useCallback(
    (newPhotos: ProjectPhoto[]) => {
      const snapshot = photos.map(p => ({
        id: p.id,
        filePath: p.filePath,
        day: p.day,
        bucket: p.bucket,
        sequence: p.sequence,
        favorite: p.favorite,
        rating: p.rating,
        archived: p.archived,
        currentName: p.currentName,
        originalName: p.originalName,
        timestamp: p.timestamp,
        subfolderOverride: p.subfolderOverride,
      }));

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(snapshot as any);
      const capped = newHistory.slice(-30);
      setHistory(capped as any);
      setHistoryIndex(capped.length - 1);

      try {
        const newThumbs = newPhotos.map(p => p.thumbnail).filter(Boolean) as string[];
        prevThumbnailsRef.current.forEach(url => {
          if (url && !newThumbs.includes(url) && url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(url);
            } catch (e) {
              // ignore
            }
          }
        });
        prevThumbnailsRef.current = newThumbs;
      } catch (e) {
        // ignore
      }

      setPhotos(newPhotos);
      persistState(newPhotos);
    },
    [history, historyIndex, photos, persistState, prevThumbnailsRef, setPhotos],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const snapshot = history[historyIndex - 1] as Array<any>;
      const nextPhotos = photos.map(photo => {
        const snap = snapshot.find((s: any) => s.id === photo.id);
        return snap ? { ...photo, ...snap } : photo;
      });
      setHistoryIndex(historyIndex - 1);
      setPhotos(nextPhotos);
      persistState(nextPhotos);
    }
  }, [history, historyIndex, persistState, photos, setPhotos]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const snapshot = history[historyIndex + 1] as Array<any>;
      const nextPhotos = photos.map(photo => {
        const snap = snapshot.find((s: any) => s.id === photo.id);
        return snap ? { ...photo, ...snap } : photo;
      });
      setHistoryIndex(historyIndex + 1);
      setPhotos(nextPhotos);
      persistState(nextPhotos);
    }
  }, [history, historyIndex, persistState, photos, setPhotos]);

  return {
    history,
    historyIndex,
    setHistory,
    setHistoryIndex,
    persistState,
    saveToHistory,
    undo,
    redo,
  };
}
