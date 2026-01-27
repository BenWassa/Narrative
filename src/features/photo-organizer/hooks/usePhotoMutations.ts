import { useCallback } from 'react';

import type { ProjectPhoto } from '../services/projectService';

interface UsePhotoMutationsOptions {
  photos: ProjectPhoto[];
  saveToHistory: (nextPhotos: ProjectPhoto[]) => void;
  selectedDay: number | null;
}

export function usePhotoMutations({ photos, saveToHistory, selectedDay }: UsePhotoMutationsOptions) {
  const assignBucket = useCallback(
    (photoIds: string | string[], bucket: string, dayNum: number | null = null) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      const counters: Record<string, number> = {};

      const newPhotos = photos.map(photo => {
        if (!ids.includes(photo.id)) {
          return photo;
        }

        const day =
          dayNum || photo.day || selectedDay || Math.ceil(new Date(photo.timestamp).getDate() / 1);
        const key = `${day}_${bucket}`;
        const existing = photos.filter(p => p.day === day && p.bucket === bucket).length;
        const next = (counters[key] || existing) + 1;
        counters[key] = next;

        const newName =
          bucket === 'X'
            ? photo.originalName
            : `D${String(day).padStart(2, '0')}_${bucket}_${String(next).padStart(3, '0')}__${
                photo.originalName
              }`;

        return {
          ...photo,
          bucket,
          day,
          sequence: next,
          currentName: newName,
          archived: bucket === 'X',
        };
      });

      saveToHistory(newPhotos);
    },
    [photos, saveToHistory, selectedDay],
  );

  const removeDayAssignment = useCallback(
    (photoIds: string | string[]) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      const newPhotos = photos.map(photo =>
        ids.includes(photo.id) ? { ...photo, day: null } : photo,
      );
      saveToHistory(newPhotos);
    },
    [photos, saveToHistory],
  );

  const toggleFavorite = useCallback(
    (photoIds: string | string[]) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      const newPhotos = photos.map(photo =>
        ids.includes(photo.id) ? { ...photo, favorite: !photo.favorite } : photo,
      );
      saveToHistory(newPhotos);
    },
    [photos, saveToHistory],
  );

  return {
    assignBucket,
    removeDayAssignment,
    toggleFavorite,
  };
}
