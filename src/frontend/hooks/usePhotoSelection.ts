import { type MouseEvent, useCallback, useRef, useState } from 'react';
import { ProjectPhoto } from '../services/projectService';

interface UsePhotoSelectionOptions {
  filteredPhotos: ProjectPhoto[];
  coverSelectionMode: boolean;
  setCoverForPhotoId: (photoId: string) => Promise<void> | void;
  setCoverSelectionMode: (value: boolean) => void;
}

export function usePhotoSelection({
  filteredPhotos,
  coverSelectionMode,
  setCoverForPhotoId,
  setCoverSelectionMode,
}: UsePhotoSelectionOptions) {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [focusedPhoto, setFocusedPhoto] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);

  const resetSelection = useCallback(() => {
    setSelectedPhotos(new Set());
    setFocusedPhoto(null);
    setLastSelectedIndex(null);
    lastSelectedIndexRef.current = null;
  }, []);

  const handleSelectPhoto = useCallback(
    async (e: MouseEvent, photoId: string, index: number, orderedList = filteredPhotos) => {
      if (
        e.shiftKey &&
        lastSelectedIndexRef.current !== null &&
        lastSelectedIndexRef.current !== undefined
      ) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = orderedList.slice(start, end + 1).map(p => p.id);
        setSelectedPhotos(new Set(rangeIds));
        setFocusedPhoto(photoId);
        setLastSelectedIndex(index);
        lastSelectedIndexRef.current = index;
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedPhotos);
        if (next.has(photoId)) next.delete(photoId);
        else next.add(photoId);
        setSelectedPhotos(next);
        setFocusedPhoto(photoId);
        setLastSelectedIndex(index);
        lastSelectedIndexRef.current = index;
        return;
      }

      setSelectedPhotos(new Set([photoId]));
      setFocusedPhoto(photoId);
      setLastSelectedIndex(index);
      lastSelectedIndexRef.current = index;

      if (coverSelectionMode) {
        await setCoverForPhotoId(photoId);
        setCoverSelectionMode(false);
      }
    },
    [
      coverSelectionMode,
      filteredPhotos,
      selectedPhotos,
      setCoverForPhotoId,
      setCoverSelectionMode,
    ],
  );

  return {
    selectedPhotos,
    setSelectedPhotos,
    focusedPhoto,
    setFocusedPhoto,
    lastSelectedIndex,
    setLastSelectedIndex,
    lastSelectedIndexRef,
    resetSelection,
    handleSelectPhoto,
  };
}
