import { useCallback, useEffect, useMemo } from 'react';

import { detectDayNumberFromFolderName } from '../../../lib/folderDetectionService';
import type { ProjectPhoto, ProjectSettings } from '../services/projectService';
import { sortPhotos } from '../utils/photoOrdering';

export interface FolderCategory {
  folder: string;
  items: ProjectPhoto[];
  isSelected: boolean;
  isDayLike: boolean;
  dayNumber: number | null;
  displayName: string;
}

interface UseFolderModelOptions {
  photos: ProjectPhoto[];
  dayLabels: Record<number, string>;
  dayContainers: string[];
  projectSettings: ProjectSettings;
  debugEnabled: boolean;
  currentView: string;
  selectedDay: number | null;
  selectedRootFolder: string | null;
  hideAssigned: boolean;
}

export function useFolderModel({
  photos,
  dayLabels,
  dayContainers,
  projectSettings,
  debugEnabled,
  currentView,
  selectedDay,
  selectedRootFolder,
  hideAssigned,
}: UseFolderModelOptions) {
  const days = useMemo(() => {
    const dayMap = new Map<number, ProjectPhoto[]>();
    photos.forEach(photo => {
      if (photo.day) {
        if (!dayMap.has(photo.day)) {
          dayMap.set(photo.day, []);
        }
        dayMap.get(photo.day)!.push(photo);
      }
    });
    return Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [photos]);

  const visibleDays = useMemo(
    () => days.filter(([day]) => dayLabels[day] != null),
    [days, dayLabels],
  );

  const normalizePath = useCallback((value: string) => {
    return value.split(/[\\/]/).filter(Boolean).join('/');
  }, []);

  const DAY_PREFIX_RE = /^(?:day|d)[\s_-]?(\d{1,2})/i;

  const categorizeFolder = useCallback(
    (folder: string, items: ProjectPhoto[]) => {
      const isSelected = (dayContainers || []).includes(folder);

      const hasDayAssigned = items.some(p => p.day !== null);
      const detectedDnn = items.some(p => {
        const parts = (p.filePath || p.originalName || '').split('/');
        return parts.length > 1 && /^D\d{1,2}/i.test(parts[1]);
      });
      const isDayName = days.some(
        ([day]) => (dayLabels[day] || `Day ${String(day).padStart(2, '0')}`) === folder,
      );
      const isDaysContainer = folder === projectSettings?.folderStructure?.daysFolder;
      const hasDayPrefix = DAY_PREFIX_RE.test(folder) || folder.toLowerCase().startsWith('day');

      const isDayLike =
        hasDayAssigned || detectedDnn || isDayName || isDaysContainer || hasDayPrefix;

      let dayNumber: number | null = null;
      if (hasDayAssigned) {
        const dayCounts: Record<number, number> = {};
        items.forEach(p => {
          if (p.day != null) dayCounts[p.day] = (dayCounts[p.day] || 0) + 1;
        });
        if (Object.keys(dayCounts).length) {
          dayNumber = Number(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]);
        }
      }

      if (dayNumber == null) {
        const match = folder.match(DAY_PREFIX_RE);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!Number.isNaN(parsed)) {
            dayNumber = parsed;
          }
        }
      }

      const displayName =
        dayNumber != null
          ? dayLabels[dayNumber] || `Day ${String(dayNumber).padStart(2, '0')}`
          : folder;

      return { isSelected, isDayLike, dayNumber, displayName };
    },
    [dayContainers, dayLabels, days, projectSettings],
  );

  const sortFolders = useCallback(
    (folders: [string, ProjectPhoto[]][]) => {
      const categorized: FolderCategory[] = folders.map(([folder, items]) => {
        const category = categorizeFolder(folder, items);
        return { folder, items, ...category };
      });

      const selected = categorized.filter(f => f.isSelected);
      const nonDay = categorized.filter(f => !f.isSelected && !f.isDayLike);
      const dayLike = categorized.filter(f => !f.isSelected && f.isDayLike);

      selected.sort((a, b) => (a.dayNumber ?? 999) - (b.dayNumber ?? 999));
      nonDay.sort((a, b) => a.folder.localeCompare(b.folder));
      dayLike.sort((a, b) => a.folder.localeCompare(b.folder));

      return { selected, nonDay, dayLike };
    },
    [categorizeFolder],
  );

  const getDerivedSubfolderGroup = useCallback(
    (photo: ProjectPhoto, dayNumber: number | null) => {
      if (dayNumber == null) return 'Day Root';

      const filePath = normalizePath(photo.filePath || photo.originalName || '');
      const folderSegments = filePath.split('/').slice(0, -1);
      const daysFolder = projectSettings?.folderStructure?.daysFolder;
      let dayIndex = -1;

      if (daysFolder) {
        const normalizedDaysFolder = normalizePath(daysFolder);
        const daysIndex = folderSegments.findIndex(
          segment => segment.toLowerCase() === normalizedDaysFolder.toLowerCase(),
        );
        if (daysIndex !== -1 && daysIndex + 1 < folderSegments.length) {
          const dayFolder = folderSegments[daysIndex + 1];
          if (detectDayNumberFromFolderName(dayFolder) === dayNumber) {
            dayIndex = daysIndex + 1;
          }
        }
      }

      if (dayIndex === -1) {
        dayIndex = folderSegments.findIndex(segment => {
          if (daysFolder && segment.toLowerCase() === daysFolder.toLowerCase()) return false;
          return detectDayNumberFromFolderName(segment) === dayNumber;
        });
      }

      if (dayIndex !== -1 && dayIndex + 1 < folderSegments.length) {
        return folderSegments[dayIndex + 1];
      }

      return 'Day Root';
    },
    [normalizePath, projectSettings],
  );

  const getSubfolderGroup = useCallback(
    (photo: ProjectPhoto, dayNumber: number | null) => {
      if (photo.subfolderOverride !== undefined) {
        return photo.subfolderOverride ?? 'Day Root';
      }
      return getDerivedSubfolderGroup(photo, dayNumber);
    },
    [getDerivedSubfolderGroup],
  );

  const rootGroups = useMemo(() => {
    const map = new Map<string, ProjectPhoto[]>();
    for (const photo of photos) {
      if (photo.archived) continue;
      const parts = (photo.filePath || photo.originalName || '').split(/[\\/]/);
      const folder = parts.length > 1 ? parts[0] : '(root)';
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(photo);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [photos]);

  const displayRootGroups = useMemo(() => {
    const combined = new Map(rootGroups);
    (dayContainers || []).forEach(container => {
      const top = normalizePath(container).split('/')[0];
      if (!combined.has(top)) combined.set(top, []);
    });
    return Array.from(combined.entries());
  }, [rootGroups, dayContainers, normalizePath]);

  useEffect(() => {
    if (!debugEnabled) return;
    try {
      console.group('[PhotoOrganizer] Folder & Day Diagnostics');
      console.debug(
        '[PhotoOrganizer] Days:',
        days.map(([day]) => ({
          day,
          label: dayLabels[day] || `Day ${String(day).padStart(2, '0')}`,
        })),
      );

      const daySources: Record<number, { count: number; sources: Set<string> }> = {};
      photos.forEach(photo => {
        if (photo.day == null) return;
        const day = photo.day as number;
        if (!daySources[day]) daySources[day] = { count: 0, sources: new Set() };
        daySources[day].count += 1;
        const parts = (photo.filePath || photo.originalName || '').split('/');
        if (parts.length > 1 && /^D\d{1,2}/i.test(parts[1])) {
          daySources[day].sources.add('DnnSubfolder');
        } else if ((dayContainers || []).includes(parts[0])) {
          daySources[day].sources.add('SelectedContainer');
        } else if (parts[0] === projectSettings?.folderStructure?.daysFolder) {
          daySources[day].sources.add('DaysFolder');
        } else {
          daySources[day].sources.add('Inferred');
        }
      });

      const configuredDays = Object.keys(dayLabels).map(key => Number(key));
      console.debug(
        '[PhotoOrganizer] Day breakdown (count + sources):',
        Object.entries(daySources).map(([key, value]) => ({
          day: Number(key),
          count: value.count,
          sources: Array.from(value.sources),
        })),
      );
      console.debug('[PhotoOrganizer] Configured day labels:', configuredDays);

      const extraneous = Object.keys(daySources)
        .map(Number)
        .filter(day => !configuredDays.includes(day));
      if (extraneous.length) {
        console.debug('[PhotoOrganizer] Extraneous/unexpected day numbers:', extraneous);
      }

      console.group('Root folders (all top-level folders)');
      rootGroups.forEach(([folder, items]) => {
        const reason = categorizeFolder(folder, items);
        console.groupCollapsed(`${folder} → ${reason.displayName}`);
        console.table(items.map(item => ({ id: item.id, filePath: item.filePath, day: item.day })));
        console.groupEnd();
      });
      console.groupEnd();

      console.groupEnd();
    } catch (error) {
      console.debug('[PhotoOrganizer] debug logging failed', error);
    }
  }, [
    debugEnabled,
    days,
    dayLabels,
    photos,
    dayContainers,
    projectSettings,
    rootGroups,
    categorizeFolder,
  ]);

  const filteredPhotos = useMemo(() => {
    const isAssigned = (photo: ProjectPhoto) =>
      Boolean(photo.bucket) || (photo.isPreOrganized && Boolean(photo.detectedBucket));
    const baseFilter = (photo: ProjectPhoto) =>
      !hideAssigned || (!isAssigned(photo) && !photo.archived);

    let rawFiltered: ProjectPhoto[] = [];

    switch (currentView) {
      case 'days':
        if (selectedDay !== null) {
          rawFiltered = photos
            .filter(photo => !photo.archived && photo.day === selectedDay)
            .filter(baseFilter);
          break;
        }
        rawFiltered = photos
          .filter(photo => photo.day !== null && !photo.archived)
          .filter(baseFilter);
        break;
      case 'folders':
        if (selectedRootFolder !== null) {
          rawFiltered = photos.filter(photo => {
            if (photo.archived) return false;
            const filePath = normalizePath(photo.filePath || photo.originalName || '');
            const selectedPath = normalizePath(selectedRootFolder);
            const folder = filePath.split('/')[0] || '(root)';
            const matches = selectedPath.includes('/')
              ? filePath === selectedPath || filePath.startsWith(`${selectedPath}/`)
              : folder === selectedPath;
            return matches && baseFilter(photo);
          });
          break;
        }
        if (selectedDay !== null) {
          rawFiltered = photos
            .filter(photo => !photo.archived && photo.day === selectedDay)
            .filter(baseFilter);
          break;
        }
        rawFiltered = [];
        break;
      case 'root':
        if (selectedRootFolder !== null) {
          rawFiltered = photos.filter(
            photo =>
              !photo.archived &&
              (normalizePath(photo.filePath || photo.originalName || '').split('/')[0] ||
                '(root)') === normalizePath(selectedRootFolder) &&
              baseFilter(photo),
          );
          break;
        }
        rawFiltered = [];
        break;
      case 'favorites':
        rawFiltered = photos.filter(photo => photo.favorite && !photo.archived).filter(baseFilter);
        break;
      case 'archive':
        rawFiltered = photos.filter(photo => photo.archived).filter(baseFilter);
        break;
      case 'review':
        rawFiltered = photos.filter(photo => photo.bucket && !photo.archived).filter(baseFilter);
        break;
      default:
        rawFiltered = photos.filter(baseFilter);
        break;
    }

    // Centralized deterministic ordering for all views.
    return sortPhotos(rawFiltered).photos;
  }, [photos, hideAssigned, currentView, selectedDay, selectedRootFolder, normalizePath]);

  return {
    days,
    visibleDays,
    normalizePath,
    categorizeFolder,
    sortFolders,
    getDerivedSubfolderGroup,
    getSubfolderGroup,
    rootGroups,
    displayRootGroups,
    filteredPhotos,
  };
}
