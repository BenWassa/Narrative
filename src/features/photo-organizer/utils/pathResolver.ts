import type { ProjectPhoto, ProjectState } from '../services/projectService';

/**
 * Resolves the source root directory for a project.
 * 
 * For ingested projects: returns the project root path (photos are already in project)
 * For non-ingested projects: returns the detected common path from photo file paths
 */
export function resolveSourceRoot(state: ProjectState, photos: ProjectPhoto[]): string {
  // If explicitly set, use that
  if (state.sourceRoot) {
    return state.sourceRoot;
  }

  // If ingested (or defaulting to ingested), source is the project root
  if (state.ingested !== false) {
    return state.rootPath;
  }

  // For non-ingested projects, detect common source path from photos
  return detectCommonSourcePath(photos);
}

/**
 * Resolves the destination root directory for export operations.
 * 
 * For ingested projects: returns day folder structure within project
 * For non-ingested projects: returns the source folder (MECE buckets created in-place)
 */
export function resolveDestinationRoot(
  state: ProjectState,
  photos: ProjectPhoto[],
  dayNumber?: number,
): string {
  const sourceRoot = resolveSourceRoot(state, photos);

  // Ingested: destination is within project structure
  if (state.ingested !== false) {
    return sourceRoot;
  }

  // Non-ingested: destination is the source folder
  // For specific day, find the day container folder
  if (dayNumber !== undefined && dayNumber !== null) {
    const dayPhotos = photos.filter(p => p.day === dayNumber);
    if (dayPhotos.length > 0) {
      return detectDaySourceFolder(dayPhotos, sourceRoot);
    }
  }

  return sourceRoot;
}

/**
 * Detects the common source path from photo file paths.
 * Assumes photos have filePath property with absolute paths.
 */
function detectCommonSourcePath(photos: ProjectPhoto[]): string {
  const photosWithPaths = photos.filter(p => p.filePath);

  if (photosWithPaths.length === 0) {
    return '';
  }

  // Get the first photo's path as baseline
  const firstPath = photosWithPaths[0].filePath!;
  const pathParts = firstPath.split('/');

  // Find common prefix across all photo paths
  let commonDepth = 0;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const prefix = pathParts.slice(0, i + 1).join('/');
    const allMatch = photosWithPaths.every(p => p.filePath?.startsWith(prefix + '/'));

    if (allMatch) {
      commonDepth = i + 1;
    } else {
      break;
    }
  }

  // Return common path (at least 2 levels up from file)
  const commonPath = pathParts.slice(0, Math.max(commonDepth, pathParts.length - 2)).join('/');
  return commonPath || '/';
}

/**
 * Detects the source folder for a specific day's photos.
 * This is used for non-ingested projects where each day might be in a different folder.
 */
function detectDaySourceFolder(dayPhotos: ProjectPhoto[], fallbackRoot: string): string {
  if (dayPhotos.length === 0) {
    return fallbackRoot;
  }

  // Use the first photo's folder hierarchy if available
  const firstPhoto = dayPhotos[0];
  if (firstPhoto.folderHierarchy && firstPhoto.folderHierarchy.length > 0) {
    return firstPhoto.folderHierarchy.join('/');
  }

  // Fall back to detecting from file path
  if (firstPhoto.filePath) {
    const parts = firstPhoto.filePath.split('/');
    // Return parent folder (one level up from file)
    return parts.slice(0, -1).join('/');
  }

  return fallbackRoot;
}

/**
 * Auto-detects ingest state for a project that doesn't have it set.
 * Checks if photos are organized within a days folder structure.
 */
export function autoDetectIngestState(photos: ProjectPhoto[], settings: any): boolean {
  const daysFolder = settings?.folderStructure?.daysFolder || '01_DAYS';

  // Check if any photos have folder hierarchy starting with days folder
  const ingestedPhotos = photos.filter(
    p => p.folderHierarchy && p.folderHierarchy[0] === daysFolder,
  );

  // If more than 50% of photos are in days folder, consider it ingested
  return ingestedPhotos.length > photos.length * 0.5;
}

/**
 * Determines the MECE bucket destination path based on ingest state.
 */
export function resolveMeceBucketPath(
  state: ProjectState,
  photos: ProjectPhoto[],
  dayNumber: number,
  bucketKey: string,
  bucketLabel: string,
): string {
  const destRoot = resolveDestinationRoot(state, photos, dayNumber);
  const daysFolder = state.settings.folderStructure.daysFolder;

  // Ingested: create bucket inside day folder
  if (state.ingested !== false) {
    const dayLabel = state.dayLabels?.[dayNumber] || `Day ${String(dayNumber).padStart(2, '0')}`;
    return `${destRoot}/${daysFolder}/${dayLabel}/${bucketKey}_${bucketLabel}`;
  }

  // Non-ingested: create bucket inside source folder
  return `${destRoot}/${bucketKey}_${bucketLabel}`;
}
