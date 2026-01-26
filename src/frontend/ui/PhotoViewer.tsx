import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, Loader, ChevronUp, ChevronDown } from 'lucide-react';
import { ProjectPhoto } from '../services/projectService';
import { PhotoStrip } from './PhotoStrip';

interface PhotoViewerProps {
  photo: ProjectPhoto;
  filteredPhotos: ProjectPhoto[];
  onClose: () => void;
  onNavigate: (photoId: string) => void;
  onToggleFavorite: (photoId: string) => void;
  onAssignBucket: (photoId: string, bucket: string) => void;
  onAssignDay: (photoId: string, day: number | null) => void;
  selectedBucket?: string;
  selectedDay?: number | null;
  buckets: Array<{ key: string; label: string; color: string; description: string }>;
  dayLabels?: Record<number, string>;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photo,
  filteredPhotos,
  onClose,
  onNavigate,
  onToggleFavorite,
  onAssignBucket,
  onAssignDay,
  selectedBucket,
  selectedDay,
  buckets,
  dayLabels = {},
}) => {
  const [currentIndex, setCurrentIndex] = useState(
    filteredPhotos.findIndex(p => p.id === photo.id),
  );
  const [fullResUrl, setFullResUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showBuckets, setShowBuckets] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  // Update currentIndex when filteredPhotos or photo changes
  useEffect(() => {
    const newIndex = filteredPhotos.findIndex(p => p.id === photo.id);
    if (newIndex !== -1 && newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  }, [filteredPhotos, photo.id, currentIndex]);

  const currentPhoto = filteredPhotos[currentIndex] || photo;

  // Load full resolution image/video
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    objectUrlRef.current = null;

    const loadFullRes = async () => {
      try {
        if (currentPhoto.fileHandle) {
          const file = await currentPhoto.fileHandle.getFile();
          const url = URL.createObjectURL(file);
          objectUrlRef.current = url;
          setFullResUrl(url);
        } else if (currentPhoto.thumbnail) {
          // Fallback to thumbnail if no fileHandle
          setFullResUrl(currentPhoto.thumbnail);
        } else {
          setLoadError('No image data available');
        }
      } catch (err) {
        console.error('Failed to load full resolution image:', err);
        // Fallback to thumbnail
        if (currentPhoto.thumbnail) {
          setFullResUrl(currentPhoto.thumbnail);
        } else {
          setLoadError('Failed to load image');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadFullRes();

    return () => {
      // Revoke object URL on cleanup
      if (objectUrlRef.current && objectUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(objectUrlRef.current);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [currentPhoto.id, currentPhoto.fileHandle, currentPhoto.thumbnail]);

  // Preload next/prev images to prevent blinking on navigation
  useEffect(() => {
    const preloadImages = async () => {
      const nextIndex = Math.min(currentIndex + 1, filteredPhotos.length - 1);
      const prevIndex = Math.max(currentIndex - 1, 0);
      const indicesToPreload = [nextIndex, prevIndex].filter(i => i !== currentIndex);

      for (const index of indicesToPreload) {
        const photoToPreload = filteredPhotos[index];
        if (photoToPreload?.fileHandle) {
          try {
            await photoToPreload.fileHandle.getFile();
          } catch (e) {
            // preload failed, will load on demand
          }
        }
      }
    };

    preloadImages();
  }, [currentIndex, filteredPhotos]);

  const handleNavigate = useCallback(
    (direction: 'next' | 'prev') => {
      let newIndex = currentIndex;
      if (direction === 'next') {
        newIndex = Math.min(currentIndex + 1, filteredPhotos.length - 1);
      } else {
        newIndex = Math.max(currentIndex - 1, 0);
      }

      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        onNavigate(filteredPhotos[newIndex].id);
      }
    },
    [currentIndex, filteredPhotos, onNavigate],
  );

  const handleSelectPhoto = useCallback(
    (photoId: string) => {
      const newIndex = filteredPhotos.findIndex(p => p.id === photoId);
      if (newIndex !== -1 && newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        onNavigate(photoId);
      }
    },
    [filteredPhotos, currentIndex, onNavigate],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigate('next');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigate('prev');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onToggleFavorite(currentPhoto.id);
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        onAssignBucket(currentPhoto.id, 'X');
      } else {
        // Check for bucket assignment shortcuts (A, B, C, D, E, M)
        const key = e.key.toUpperCase();
        const validBuckets = ['A', 'B', 'C', 'D', 'E', 'M'];
        if (validBuckets.includes(key)) {
          e.preventDefault();
          // Toggle if already assigned, otherwise assign
          const newBucket = currentPhoto.bucket === key ? '' : key;
          onAssignBucket(currentPhoto.id, newBucket);
        }
      }
    },
    [
      currentPhoto.id,
      currentPhoto.bucket,
      onClose,
      handleNavigate,
      onToggleFavorite,
      onAssignBucket,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get bucket info for current photo
  const currentBucket = buckets.find(b => b.key === currentPhoto.bucket);

  return (
    <div className="fixed inset-0 bg-black z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-100">Gallery View</h2>
          <div className="text-sm text-gray-400">
            {currentIndex + 1} of {filteredPhotos.length}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Close gallery view"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content - Enlarged Photo */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="text-center">
              <Loader className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Loading image...</p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{loadError}</p>
              <p className="text-xs text-gray-500">File: {currentPhoto.currentName}</p>
            </div>
          </div>
        )}

        {fullResUrl && (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {currentPhoto.mimeType?.startsWith('video/') ? (
              <video
                src={fullResUrl}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                controls
                autoPlay
                muted
              />
            ) : (
              <img
                src={fullResUrl}
                alt={currentPhoto.currentName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        )}

        {/* Metadata Overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
          {/* Bucket Assignment */}
          {currentBucket && (
            <div
              className={`${currentBucket.color} text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2`}
            >
              <span className="text-xl font-bold">{currentBucket.key}</span>
              <div className="text-left">
                <div className="text-sm font-semibold">{currentBucket.label}</div>
                <div className="text-xs opacity-90">{currentBucket.description}</div>
              </div>
            </div>
          )}

          {/* Day Info */}
          {currentPhoto.day && (
            <div className="bg-gray-900/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-xl">
              <div className="text-xs text-gray-400">Day</div>
              <div className="text-sm font-semibold">
                {dayLabels[currentPhoto.day] || `Day ${String(currentPhoto.day).padStart(2, '0')}`}
              </div>
            </div>
          )}

          {/* Favorite Indicator */}
          {currentPhoto.favorite && (
            <div className="bg-yellow-500 text-white px-3 py-2 rounded-lg shadow-xl flex items-center gap-2">
              <Heart className="w-4 h-4 fill-current" />
              <span className="text-sm font-semibold">Favorite</span>
            </div>
          )}
        </div>

        {/* Quick Action Hints */}
        <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur rounded-lg shadow-lg overflow-hidden flex flex-col">
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="flex items-center justify-between px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors border-b border-gray-700"
          >
            <span className="font-semibold">Quick Actions</span>
            {showQuickActions ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {showQuickActions && (
            <div className="px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">←→</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">A-E,M,X</kbd>
                <span>Assign</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">F</kbd>
                <span>Favorite</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">Esc</kbd>
                <span>Exit</span>
              </div>
            </div>
          )}
        </div>

        {/* MECE Bucket Reference Panel */}
        <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur rounded-lg shadow-lg overflow-hidden flex flex-col max-w-xs">
          <button
            onClick={() => setShowBuckets(!showBuckets)}
            className="flex items-center justify-between px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors border-b border-gray-700"
          >
            <span className="font-semibold">MECE Categories</span>
            {showBuckets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBuckets && (
            <div className="px-3 py-3 space-y-2 max-h-80 overflow-y-auto">
              {buckets.map(bucket => (
                <div
                  key={bucket.key}
                  className={`${bucket.color} text-white px-3 py-2 rounded text-xs`}
                >
                  <div className="font-bold text-sm">
                    {bucket.key} - {bucket.label}
                  </div>
                  <div className="opacity-90 text-[11px] mt-0.5">{bucket.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo Strip */}
      <PhotoStrip
        photos={filteredPhotos}
        currentPhotoId={currentPhoto.id}
        onSelectPhoto={handleSelectPhoto}
      />
    </div>
  );
};
