import { useEffect, type MutableRefObject } from 'react';
import type { ProjectPhoto } from '../services/projectService';
import { getPhotoIndex, navigatePhotos, type OrderingResult } from '../utils/photoOrdering';

export interface MECEBucket {
  key: string;
  label: string;
  color: string;
  description: string;
}

export interface KeyboardHandlerOptions {
  selectedPhotos: Set<string>;
  focusedPhoto: string | null;
  filteredPhotos: ProjectPhoto[];
  orderingResult: OrderingResult;
  fullscreenPhoto: string | null;
  showHelp: boolean;
  showExportScript: boolean;
  showWelcome: boolean;
  showOnboarding: boolean;
  coverSelectionMode: boolean;
  hideAssigned: boolean;
  MECE_BUCKETS: MECEBucket[];
  onAssignBucket: (photoIds: string[], bucket: string) => void;
  onToggleFavorite: (photoIds: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSetFocusedPhoto: (photoId: string | null) => void;
  onSetSelectedPhotos: (photos: Set<string>) => void;
  onSetLastSelectedIndex: (index: number | null) => void;
  onSetFullscreenPhoto: (photoId: string | null) => void;
  onSetShowHelp: (show: boolean) => void;
  onSetCoverSelectionMode: (mode: boolean) => void;
  onSetHideAssigned: (value: boolean) => void;
  onToggleDebugOverlay?: () => void;
  onShowToast?: (message: string, tone?: 'info' | 'error') => void;
  lastSelectedIndexRef?: MutableRefObject<number | null>;
}

export function useKeyboardShortcuts(options: KeyboardHandlerOptions) {
  const {
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
    orderingResult,
    fullscreenPhoto,
    showHelp,
    showExportScript,
    showWelcome,
    showOnboarding,
    coverSelectionMode,
    hideAssigned,
    MECE_BUCKETS,
    onAssignBucket,
    onToggleFavorite,
    onUndo,
    onRedo,
    onSetFocusedPhoto,
    onSetSelectedPhotos,
    onSetLastSelectedIndex,
    onSetFullscreenPhoto,
    onSetShowHelp,
    onSetCoverSelectionMode,
    onSetHideAssigned,
    onToggleDebugOverlay,
    onShowToast,
    lastSelectedIndexRef,
  } = options;

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        showWelcome ||
        showOnboarding ||
        showExportScript ||
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable))
      ) {
        return;
      }

      if (showHelp) {
        if (e.key === 'Escape' || e.key === '?') {
          onSetShowHelp(false);
        }
        return;
      }

      if (coverSelectionMode && e.key === 'Escape') {
        onSetCoverSelectionMode(false);
        onShowToast?.('Cover selection cancelled.');
        return;
      }

      if (e.key === '?') {
        onSetShowHelp(true);
        return;
      }

      // Global toggles that should work without a selection
      if (e.key === 'H' && e.shiftKey) {
        e.preventDefault();
        const nextValue = !hideAssigned;
        onSetHideAssigned(nextValue);
        onShowToast?.(nextValue ? 'Hiding assigned photos' : 'Showing all photos', 'info');
        return;
      }

      if (e.key.toLowerCase() === 'd' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onToggleDebugOverlay?.();
        return;
      }

      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      // Determine primary target (focused photo, otherwise first selected)
      const primaryId =
        focusedPhoto || (selectedPhotos.size > 0 ? Array.from(selectedPhotos)[0] : null);
      if (!primaryId) return;

      const focusPhoto = (photoId: string) => {
        const nextIndex = getPhotoIndex(photoId, orderingResult.indexMap);
        onSetFocusedPhoto(photoId);
        onSetSelectedPhotos(new Set([photoId]));
        onSetLastSelectedIndex(nextIndex === -1 ? null : nextIndex);
        if (lastSelectedIndexRef) {
          lastSelectedIndexRef.current = nextIndex === -1 ? null : nextIndex;
        }
      };

      if (e.key.toLowerCase() === 'f' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        onToggleFavorite(targets);
        return;
      }

      // MECE bucket assignment
      const validBuckets = ['A', 'B', 'C', 'D', 'E', 'M', 'X'];
      const pressedBucket = e.key.toUpperCase();
      const isValidBucket = validBuckets.includes(pressedBucket);
      const isReservedFavorite = pressedBucket === 'F';
      const existsInBuckets = MECE_BUCKETS.some(bucket => bucket.key === pressedBucket);

      if (isValidBucket || (existsInBuckets && !isReservedFavorite)) {
        e.preventDefault();
        const bucket = pressedBucket;

        if (selectedPhotos.size > 1) {
          const photoIds = Array.from(selectedPhotos);
          onAssignBucket(photoIds, bucket);
          onShowToast?.(`Assigned ${photoIds.length} photos to bucket ${bucket}`, 'info');
          onSetSelectedPhotos(new Set());
          onSetFocusedPhoto(null);
          onSetLastSelectedIndex(null);
          if (lastSelectedIndexRef) {
            lastSelectedIndexRef.current = null;
          }
          return;
        }

        const currentPhoto = filteredPhotos.find(photo => photo.id === primaryId);
        const newBucket = currentPhoto?.bucket === bucket ? '' : bucket;
        onAssignBucket([primaryId], newBucket);

        // Auto-advance when assigning (not un-assigning) unless shift is held
        if (newBucket && !e.shiftKey) {
          const nextPhoto = navigatePhotos(primaryId, 'next', orderingResult);
          if (nextPhoto) {
            focusPhoto(nextPhoto.id);
          }
        }
        return;
      }

      // Navigation
      if (e.key === 'ArrowRight') {
        const next = navigatePhotos(primaryId, 'next', orderingResult);
        if (next) {
          focusPhoto(next.id);
        }
      } else if (e.key === 'ArrowLeft') {
        const prev = navigatePhotos(primaryId, 'prev', orderingResult);
        if (prev) {
          focusPhoto(prev.id);
        }
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const filter = e.shiftKey ? (photo: ProjectPhoto) => !photo.bucket : undefined;
        const next = navigatePhotos(primaryId, 'next', orderingResult, filter);
        if (next) {
          focusPhoto(next.id);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const filter = e.shiftKey ? (photo: ProjectPhoto) => !photo.bucket : undefined;
        const prev = navigatePhotos(primaryId, 'prev', orderingResult, filter);
        if (prev) {
          focusPhoto(prev.id);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSetFullscreenPhoto(primaryId);
      } else if (e.key === 'Escape') {
        if (fullscreenPhoto) {
          onSetFullscreenPhoto(null);
        } else {
          onSetSelectedPhotos(new Set());
          onSetFocusedPhoto(null);
          onSetLastSelectedIndex(null);
          if (lastSelectedIndexRef) {
            lastSelectedIndexRef.current = null;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
    orderingResult,
    onAssignBucket,
    onToggleFavorite,
    onUndo,
    onRedo,
    showHelp,
    fullscreenPhoto,
    showWelcome,
    showOnboarding,
    showExportScript,
    coverSelectionMode,
    hideAssigned,
    MECE_BUCKETS,
    onSetFocusedPhoto,
    onSetSelectedPhotos,
    onSetLastSelectedIndex,
    onSetFullscreenPhoto,
    onSetShowHelp,
    onSetCoverSelectionMode,
    onSetHideAssigned,
    onToggleDebugOverlay,
    onShowToast,
    lastSelectedIndexRef,
  ]);
}
