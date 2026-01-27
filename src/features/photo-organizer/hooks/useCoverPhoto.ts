import { useCallback } from 'react';

import type { RecentProject } from '../OnboardingModal';
import { RECENT_PROJECTS_KEY } from '../constants/projectKeys';
import type { ProjectPhoto } from '../services/projectService';
import * as coverStorage from '../utils/coverStorageService';
import safeLocalStorage from '../utils/safeLocalStorage';

interface UseCoverPhotoOptions {
  photos: ProjectPhoto[];
  projectRootPath: string | null;
  projectName: string;
  projectFolderLabel: string | null;
  setRecentProjects: (projects: RecentProject[]) => void;
  showToast: (message: string, tone?: 'info' | 'error') => void;
}

export function useCoverPhoto({
  photos,
  projectRootPath,
  projectName,
  projectFolderLabel,
  setRecentProjects,
  showToast,
}: UseCoverPhotoOptions) {
  const setCoverForPhotoId = useCallback(
    async (photoId: string) => {
      if (!projectRootPath) return;

      const selectedPhoto = photos.find(photo => photo.id === photoId);
      if (!selectedPhoto) {
        showToast('Selected photo is no longer available.', 'error');
        return;
      }

      try {
        let sourceBlob: Blob;
        if (selectedPhoto.fileHandle) {
          sourceBlob = await selectedPhoto.fileHandle.getFile();
        } else if (selectedPhoto.thumbnail) {
          const response = await fetch(selectedPhoto.thumbnail);
          sourceBlob = await response.blob();
        } else {
          showToast('Cannot create cover from this photo.', 'error');
          return;
        }

        const usedSize = `original (${(sourceBlob.size / 1024).toFixed(1)}KB)`;

        await coverStorage.evictOldCovers(10);
        const coverKey = await coverStorage.saveCover(projectRootPath, sourceBlob, 0, 0);

        const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
        const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
        const normalized = parsed.map(project => ({
          ...project,
          projectId: project.projectId || project.rootPath,
        }));

        let existingIndex = normalized.findIndex(project => project.projectId === projectRootPath);
        if (existingIndex === -1) {
          existingIndex = normalized.findIndex(project => project.rootPath === projectRootPath);
        }

        const updated = normalized.map((project, index) =>
          index === existingIndex
            ? {
                ...project,
                coverKey,
                lastOpened: Date.now(),
              }
            : project,
        );

        if (existingIndex === -1) {
          updated.unshift({
            projectName: projectName || 'Untitled Project',
            projectId: projectRootPath,
            rootPath: projectFolderLabel || projectRootPath,
            lastOpened: Date.now(),
            totalPhotos: photos.length,
            coverKey,
          });
        }

        safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(updated.slice(0, 20)));
        setRecentProjects(updated.slice(0, 20));

        console.log(`Cover saved to IndexedDB (${usedSize}):`, projectRootPath);
        showToast('Cover photo updated.');
      } catch (error) {
        console.error('Failed to set cover photo:', error);
        showToast('Failed to set cover photo.', 'error');
      }
    },
    [
      photos,
      projectRootPath,
      projectName,
      projectFolderLabel,
      setRecentProjects,
      showToast,
    ],
  );

  return {
    setCoverForPhotoId,
  };
}
