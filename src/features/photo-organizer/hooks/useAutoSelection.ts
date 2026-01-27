import { useEffect } from 'react';

import type { ProjectPhoto } from '../services/projectService';

interface UseAutoSelectionOptions {
  projectRootPath: string | null;
  photosLength: number;
  selectedRootFolder: string | null;
  selectedDay: number | null;
  currentView: string;
  days: [number, ProjectPhoto[]][];
  rootGroups: [string, ProjectPhoto[]][];
  setSelectedDay: (day: number | null) => void;
  setSelectedRootFolder: (folder: string | null) => void;
}

export function useAutoSelection({
  projectRootPath,
  photosLength,
  selectedRootFolder,
  selectedDay,
  currentView,
  days,
  rootGroups,
  setSelectedDay,
  setSelectedRootFolder,
}: UseAutoSelectionOptions) {
  useEffect(() => {
    if (
      !projectRootPath ||
      photosLength === 0 ||
      selectedRootFolder !== null ||
      selectedDay !== null ||
      currentView !== 'folders'
    ) {
      return;
    }

    const firstDay = days[0]?.[0] ?? null;
    if (firstDay !== null) {
      setSelectedDay(firstDay);
      return;
    }

    const firstFolder = rootGroups[0]?.[0];
    if (firstFolder) {
      setSelectedRootFolder(firstFolder);
    }
  }, [
    projectRootPath,
    photosLength,
    selectedRootFolder,
    selectedDay,
    currentView,
    rootGroups,
    days,
    setSelectedDay,
    setSelectedRootFolder,
  ]);
}
