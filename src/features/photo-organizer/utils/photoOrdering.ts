/**
 * Centralized photo ordering utility.
 * Ensures consistent ordering across all views (grid, viewer, strip).
 */

import type { ProjectPhoto } from '../services/projectService';

export interface SortOptions {
  groupBy?: 'subfolder' | 'bucket' | 'day' | null;
  separateVideos?: boolean;
  selectedDay?: number | null;
  getSubfolderGroup?: (photo: ProjectPhoto, day: number | null) => string;
  isVideo?: (photo: ProjectPhoto) => boolean;
}

export interface OrderingGroup {
  label: string;
  photos: ProjectPhoto[];
  startIndex: number;
}

export interface OrderingResult {
  photos: ProjectPhoto[];
  indexMap: Map<string, number>;
  groups?: OrderingGroup[];
}

/**
 * Primary ordering logic:
 * 1. timestamp (ascending - chronological)
 * 2. filePath (alphabetical - maintains folder structure)
 * 3. originalName (alphabetical - stable within same folder)
 * 4. id (stable tie-breaker - ensures deterministic ordering)
 */
function comparePhotos(a: ProjectPhoto, b: ProjectPhoto): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }

  const pathA = a.filePath || a.originalName || '';
  const pathB = b.filePath || b.originalName || '';
  const pathCmp = pathA.localeCompare(pathB);
  if (pathCmp !== 0) {
    return pathCmp;
  }

  const nameCmp = (a.originalName || '').localeCompare(b.originalName || '');
  if (nameCmp !== 0) {
    return nameCmp;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Sort photos with optional grouping.
 */
export function sortPhotos(photos: ProjectPhoto[], options: SortOptions = {}): OrderingResult {
  const { groupBy, separateVideos, selectedDay, getSubfolderGroup, isVideo } = options;

  // Step 1: Base sort (always apply)
  const sorted = [...photos].sort(comparePhotos);

  // Step 2: Apply grouping if requested
  if (groupBy === 'subfolder' && selectedDay != null && getSubfolderGroup) {
    return groupBySubfolder(sorted, selectedDay, getSubfolderGroup, separateVideos, isVideo);
  }
  if (groupBy === 'bucket') {
    return groupByBucket(sorted, separateVideos, isVideo);
  }
  if (groupBy === 'day') {
    return groupByDay(sorted, separateVideos, isVideo);
  }

  // Step 3: Separate videos if requested (without grouping)
  if (separateVideos && isVideo) {
    const stills = sorted.filter(photo => !isVideo(photo));
    const videos = sorted.filter(photo => isVideo(photo));
    return buildIndexMap([...stills, ...videos]);
  }

  // No grouping: return sorted with index map
  return buildIndexMap(sorted);
}

function groupBySubfolder(
  sorted: ProjectPhoto[],
  selectedDay: number,
  getSubfolderGroup: (photo: ProjectPhoto, day: number | null) => string,
  separateVideos?: boolean,
  isVideo?: (photo: ProjectPhoto) => boolean,
): OrderingResult {
  const groups = new Map<string, ProjectPhoto[]>();

  sorted.forEach(photo => {
    const label = getSubfolderGroup(photo, selectedDay);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(photo);
  });

  const sortedGroups = Array.from(groups.entries())
    .sort(([labelA], [labelB]) => {
      if (labelA === 'Day Root') return -1;
      if (labelB === 'Day Root') return 1;
      return labelA.localeCompare(labelB);
    })
    .map(([label, photos]) => ({ label, photos }));

  const orderedPhotos: ProjectPhoto[] = [];
  const groupsWithIndices: OrderingGroup[] = [];

  sortedGroups.forEach(group => {
    const startIndex = orderedPhotos.length;

    if (separateVideos && isVideo) {
      const stills = group.photos.filter(photo => !isVideo(photo));
      const videos = group.photos.filter(photo => isVideo(photo));
      orderedPhotos.push(...stills, ...videos);
    } else {
      orderedPhotos.push(...group.photos);
    }

    groupsWithIndices.push({
      label: group.label,
      photos: group.photos,
      startIndex,
    });
  });

  const indexMap = new Map<string, number>();
  orderedPhotos.forEach((photo, index) => indexMap.set(photo.id, index));

  return {
    photos: orderedPhotos,
    indexMap,
    groups: groupsWithIndices,
  };
}

function groupByBucket(
  sorted: ProjectPhoto[],
  separateVideos?: boolean,
  isVideo?: (photo: ProjectPhoto) => boolean,
): OrderingResult {
  const buckets: Array<string | null> = ['A', 'B', 'C', 'D', 'E', 'M', 'X', null];
  const groups = new Map<string | null, ProjectPhoto[]>();

  sorted.forEach(photo => {
    const bucket = photo.bucket || null;
    if (!groups.has(bucket)) {
      groups.set(bucket, []);
    }
    groups.get(bucket)!.push(photo);
  });

  const orderedPhotos: ProjectPhoto[] = [];
  buckets.forEach(bucket => {
    if (!groups.has(bucket)) return;
    const groupPhotos = groups.get(bucket)!;
    if (separateVideos && isVideo) {
      const stills = groupPhotos.filter(photo => !isVideo(photo));
      const videos = groupPhotos.filter(photo => isVideo(photo));
      orderedPhotos.push(...stills, ...videos);
    } else {
      orderedPhotos.push(...groupPhotos);
    }
  });

  return buildIndexMap(orderedPhotos);
}

function groupByDay(
  sorted: ProjectPhoto[],
  separateVideos?: boolean,
  isVideo?: (photo: ProjectPhoto) => boolean,
): OrderingResult {
  const days = new Map<number | null, ProjectPhoto[]>();

  sorted.forEach(photo => {
    const day = photo.day ?? null;
    if (!days.has(day)) {
      days.set(day, []);
    }
    days.get(day)!.push(photo);
  });

  const sortedDays = Array.from(days.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  const orderedPhotos: ProjectPhoto[] = [];
  sortedDays.forEach(day => {
    const groupPhotos = days.get(day)!;
    if (separateVideos && isVideo) {
      const stills = groupPhotos.filter(photo => !isVideo(photo));
      const videos = groupPhotos.filter(photo => isVideo(photo));
      orderedPhotos.push(...stills, ...videos);
    } else {
      orderedPhotos.push(...groupPhotos);
    }
  });

  return buildIndexMap(orderedPhotos);
}

function buildIndexMap(photos: ProjectPhoto[]): OrderingResult {
  const indexMap = new Map<string, number>();
  photos.forEach((photo, index) => indexMap.set(photo.id, index));
  return { photos, indexMap };
}

/**
 * Fast lookup: given a photo ID, get its index in the ordered array.
 */
export function getPhotoIndex(photoId: string, indexMap: Map<string, number>): number {
  return indexMap.get(photoId) ?? -1;
}

/**
 * Navigate to next/previous photo in ordered list.
 */
export function navigatePhotos(
  currentPhotoId: string,
  direction: 'next' | 'prev',
  result: OrderingResult,
  filter?: (photo: ProjectPhoto) => boolean,
): ProjectPhoto | null {
  const currentIndex = getPhotoIndex(currentPhotoId, result.indexMap);
  if (currentIndex === -1) return null;

  const step = direction === 'next' ? 1 : -1;
  let nextIndex = currentIndex + step;

  if (filter) {
    while (nextIndex >= 0 && nextIndex < result.photos.length) {
      if (filter(result.photos[nextIndex])) {
        return result.photos[nextIndex];
      }
      nextIndex += step;
    }
    return null;
  }

  if (nextIndex >= 0 && nextIndex < result.photos.length) {
    return result.photos[nextIndex];
  }

  return null;
}
