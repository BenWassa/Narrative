import { useEffect, type MutableRefObject } from 'react';
import type { ProjectPhoto } from '../services/projectService';

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
  fullscreenPhoto: string | null;
  showHelp: boolean;
  showExportScript: boolean;
  showWelcome: boolean;
  showOnboarding: boolean;
  coverSelectionMode: boolean;
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
  onShowToast?: (message: string, tone?: 'info' | 'error') => void;
  lastSelectedIndexRef?: MutableRefObject<number | null>;
}

export function useKeyboardShortcuts(options: KeyboardHandlerOptions) {
  const {
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
    fullscreenPhoto,
    showHelp,
    showExportScript,
    showWelcome,
    showOnboarding,
    coverSelectionMode,
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

      // Determine primary target (focused photo or if a single selection exists)
      const primaryId =
        focusedPhoto || (selectedPhotos.size === 1 ? Array.from(selectedPhotos)[0] : null);
      if (!primaryId) return;

      if (e.key.toLowerCase() === 'f' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        onToggleFavorite(targets);
        return;
      }

      // MECE bucket assignment
      let bucketKey = e.key.toUpperCase();
      const bucket = MECE_BUCKETS.find(b => b.key === bucketKey);
      if (bucket && bucket.key !== 'F') {
        const targets = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [primaryId];
        onAssignBucket(targets, bucket.key);
        // Move focus to next photo in filteredPhotos
        const currentIndex = filteredPhotos.findIndex(p => p.id === primaryId);
        if (currentIndex < filteredPhotos.length - 1) {
          const nextId = filteredPhotos[currentIndex + 1].id;
          onSetFocusedPhoto(nextId);
          onSetSelectedPhotos(new Set([nextId]));
          onSetLastSelectedIndex(currentIndex + 1);
          if (lastSelectedIndexRef) {
            lastSelectedIndexRef.current = currentIndex + 1;
          }
        }
        return;
      }

      // Navigation
      if (e.key === 'ArrowRight') {
        const currentIndex = filteredPhotos.findIndex(p => p.id === primaryId);
        if (currentIndex < filteredPhotos.length - 1) {
          const nextId = filteredPhotos[currentIndex + 1].id;
          onSetFocusedPhoto(nextId);
          onSetSelectedPhotos(new Set([nextId]));
          onSetLastSelectedIndex(currentIndex + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        const currentIndex = filteredPhotos.findIndex(p => p.id === primaryId);
        if (currentIndex > 0) {
          const prevId = filteredPhotos[currentIndex - 1].id;
          onSetFocusedPhoto(prevId);
          onSetSelectedPhotos(new Set([prevId]));
          onSetLastSelectedIndex(currentIndex - 1);
          if (lastSelectedIndexRef) {
            lastSelectedIndexRef.current = currentIndex - 1;
          }
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
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
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
    MECE_BUCKETS,
    onSetFocusedPhoto,
    onSetSelectedPhotos,
    onSetLastSelectedIndex,
    onSetFullscreenPhoto,
    onSetShowHelp,
    onSetCoverSelectionMode,
    onShowToast,
    lastSelectedIndexRef,
  ]);
}
