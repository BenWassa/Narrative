import { useCallback } from 'react';

interface UseCoverSelectionOptions {
  projectRootPath: string | null;
  selectedPhotos: Set<string>;
  showToast: (message: string, tone?: 'info' | 'error') => void;
  setCoverForPhotoId: (photoId: string) => Promise<void> | void;
}

export function useCoverSelection({
  projectRootPath,
  selectedPhotos,
  showToast,
  setCoverForPhotoId,
}: UseCoverSelectionOptions) {
  const setCoverFromSelection = useCallback(async () => {
    if (!projectRootPath) return;

    if (selectedPhotos.size === 0) {
      showToast('Select a photo to set as cover.');
      return;
    }

    if (selectedPhotos.size > 1) {
      showToast('Select a single photo to set as cover.');
      return;
    }

    const selectedId = Array.from(selectedPhotos)[0];
    await setCoverForPhotoId(selectedId);
  }, [projectRootPath, selectedPhotos, showToast, setCoverForPhotoId]);

  return {
    setCoverFromSelection,
  };
}
