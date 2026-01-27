import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { ProjectPhoto } from '../services/projectService';

interface UseDayEditingOptions {
  photos: ProjectPhoto[];
  persistState: (nextPhotos: ProjectPhoto[]) => void | Promise<void>;
  setDayLabels: Dispatch<SetStateAction<Record<number, string>>>;
}

export function useDayEditing({ photos, persistState, setDayLabels }: UseDayEditingOptions) {
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingDayName, setEditingDayName] = useState('');

  const startEditingDay = useCallback((day: number, name: string) => {
    setEditingDay(day);
    setEditingDayName(name);
  }, []);

  const saveDayName = useCallback(
    (day: number) => {
      setDayLabels(prev => ({ ...prev, [day]: editingDayName }));
      persistState(photos);
      setEditingDay(null);
    },
    [editingDayName, persistState, photos, setDayLabels],
  );

  const cancelEditingDay = useCallback(() => {
    setEditingDay(null);
  }, []);

  return {
    editingDay,
    editingDayName,
    setEditingDayName,
    startEditingDay,
    saveDayName,
    cancelEditingDay,
  };
}
