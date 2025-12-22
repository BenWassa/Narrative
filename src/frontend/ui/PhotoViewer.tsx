import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { ProjectPhoto } from '../services/projectService';

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
  const objectUrlRef = useRef<string | null>(null);

  const currentPhoto = filteredPhotos[currentIndex] || photo;

  // Load full resolution image/video
  useEffect(() => {
    setFullResUrl(null);
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
      }
    },
    [currentPhoto.id, onClose, handleNavigate, onToggleFavorite],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-black z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-gray-100">Inspect Mode</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Close inspect mode"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Viewer */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-auto relative group">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Loading image...</p>
              </div>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
              <div className="text-center">
                <p className="text-sm text-red-400">{loadError}</p>
              </div>
            </div>
          )}

          {fullResUrl && (
            <>
              {currentPhoto.mimeType?.startsWith('video/') ? (
                <video
                  src={fullResUrl}
                  className="max-w-full max-h-full object-contain"
                  controls
                  muted
                />
              ) : (
                <img
                  src={fullResUrl}
                  alt={currentPhoto.currentName}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </>
          )}

          {/* Navigation Arrows */}
          {currentIndex > 0 && (
            <button
              onClick={() => handleNavigate('prev')}
              className="absolute left-4 p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < filteredPhotos.length - 1 && (
            <button
              onClick={() => handleNavigate('next')}
              className="absolute right-4 p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Photo counter */}
          <div className="absolute bottom-4 left-4 text-sm text-gray-400">
            {currentIndex + 1} / {filteredPhotos.length}
          </div>
        </div>

        {/* Right Panel - Controls */}
        <div className="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto flex flex-col">
          {/* Photo Info */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">Photo Details</h3>
            <p className="text-xs text-gray-400 break-words">{currentPhoto.currentName}</p>
            {currentPhoto.filePath && (
              <p className="text-xs text-gray-500 mt-1 break-words">{currentPhoto.filePath}</p>
            )}
          </div>

          {/* Assignment Controls */}
          <div className="p-4 space-y-4 flex-1">
            {/* Bucket Assignment */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
                MECE Category
              </label>
              <div className="space-y-1">
                {buckets.map(bucket => (
                  <button
                    key={bucket.key}
                    onClick={() => {
                      // Toggle bucket if already selected, otherwise set it
                      const newBucket = currentPhoto.bucket === bucket.key ? null : bucket.key;
                      onAssignBucket(currentPhoto.id, newBucket || '');
                    }}
                    className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${
                      currentPhoto.bucket === bucket.key
                        ? `${bucket.color} text-white font-semibold`
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{bucket.key}</span>
                      <span>{bucket.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Day Assignment */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
                Day
              </label>
              <select
                value={currentPhoto.day ?? ''}
                onChange={e => {
                  const day = e.target.value ? Number.parseInt(e.target.value, 10) : null;
                  onAssignDay(currentPhoto.id, day);
                }}
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 text-sm"
              >
                <option value="">Unassigned</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    {dayLabels[day] || `Day ${String(day).padStart(2, '0')}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Favorite Toggle */}
            <button
              onClick={() => onToggleFavorite(currentPhoto.id)}
              className={`w-full px-3 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2 ${
                currentPhoto.favorite
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Heart className={`w-4 h-4 ${currentPhoto.favorite ? 'fill-current' : ''}`} />
              {currentPhoto.favorite ? 'Favorited' : 'Mark as Favorite'}
            </button>
          </div>

          {/* Keyboard Hints */}
          <div className="px-4 py-3 border-t border-gray-800 bg-gray-950 space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>←→</span>
              <span>Navigate</span>
            </div>
            <div className="flex justify-between">
              <span>F</span>
              <span>Toggle Favorite</span>
            </div>
            <div className="flex justify-between">
              <span>Esc</span>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
