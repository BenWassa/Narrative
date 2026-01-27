import React, { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { ProjectPhoto } from '../services/projectService';

interface PhotoStripProps {
  photos: ProjectPhoto[];
  currentPhotoId: string;
  onSelectPhoto: (photoId: string) => void;
  visibleCount?: number;
}

// Helper function to extract first frame from video
const generateVideoThumbnail = async (fileHandle: any): Promise<string | null> => {
  try {
    const file = await fileHandle.getFile();
    return new Promise(resolve => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const handleLoadedMetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = 0; // Get first frame
      };

      const handleSeeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('seeked', handleSeeked);
          resolve(dataUrl);
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('seeked', handleSeeked);
      video.src = URL.createObjectURL(file);
      video.load();

      // Fallback after 2 seconds
      setTimeout(() => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('seeked', handleSeeked);
        resolve(null);
      }, 2000);
    });
  } catch (error) {
    console.error('Failed to generate video thumbnail:', error);
    return null;
  }
};

export const PhotoStrip: React.FC<PhotoStripProps> = ({
  photos,
  currentPhotoId,
  onSelectPhoto,
  visibleCount = 7,
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const currentPhotoRef = useRef<HTMLButtonElement>(null);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string | null>>({});

  // Generate thumbnails for videos on mount
  useEffect(() => {
    const generateThumbnails = async () => {
      const videoPhotos = photos.filter(
        p => p.mimeType?.startsWith('video/') && !videoThumbnails[p.id],
      );

      for (const photo of videoPhotos) {
        if (photo.fileHandle) {
          const thumbnail = await generateVideoThumbnail(photo.fileHandle);
          setVideoThumbnails(prev => ({
            ...prev,
            [photo.id]: thumbnail,
          }));
        }
      }
    };

    generateThumbnails();
  }, [photos]);

  // Auto-scroll to keep current photo visible
  useEffect(() => {
    if (currentPhotoRef.current && stripRef.current) {
      const stripContainer = stripRef.current;
      const photoElement = currentPhotoRef.current;

      const stripRect = stripContainer.getBoundingClientRect();
      const photoRect = photoElement.getBoundingClientRect();

      // Check if current photo is outside visible area
      if (photoRect.left < stripRect.left || photoRect.right > stripRect.right) {
        photoElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentPhotoId]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (stripRef.current) {
      const scrollAmount = stripRef.current.clientWidth * 0.7;
      stripRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const currentIndex = photos.findIndex(p => p.id === currentPhotoId);
  const canScrollLeft = currentIndex > 0;
  const canScrollRight = currentIndex < photos.length - 1;

  // Separate photos and videos
  const stillPhotos = photos.filter(p => !p.mimeType?.startsWith('video/'));
  const videos = photos.filter(p => p.mimeType?.startsWith('video/'));

  const renderPhotoItem = (photo: ProjectPhoto, index: number) => {
    const isActive = photo.id === currentPhotoId;
    const bucketInfo = photo.bucket
      ? (() => {
          const colors: Record<string, string> = {
            A: 'bg-blue-500',
            B: 'bg-purple-500',
            C: 'bg-green-500',
            D: 'bg-orange-500',
            E: 'bg-yellow-500',
            M: 'bg-indigo-500',
            X: 'bg-gray-500',
          };
          return colors[photo.bucket] || 'bg-gray-500';
        })()
      : null;

    const thumbnailUrl = photo.mimeType?.startsWith('video/')
      ? videoThumbnails[photo.id] || photo.thumbnail
      : photo.thumbnail;

    return (
      <button
        key={photo.id}
        ref={isActive ? currentPhotoRef : null}
        onClick={() => onSelectPhoto(photo.id)}
        className={`relative flex-shrink-0 group ${
          isActive ? 'ring-4 ring-blue-500 shadow-xl scale-110' : 'hover:ring-2 hover:ring-gray-600'
        } transition-all duration-200 rounded-lg overflow-hidden`}
        style={{
          width: '120px',
          height: '90px',
        }}
        aria-label={`${photo.currentName}${isActive ? ' (current)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
      >
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={photo.currentName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-xs text-gray-500 text-center px-2 break-words">
              {photo.currentName}
            </span>
          </div>
        )}

        {/* Video indicator */}
        {photo.mimeType?.startsWith('video/') && (
          <div className="absolute top-1 left-1 bg-black/70 rounded p-1">
            <Video className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Bucket badge */}
        {bucketInfo && (
          <div
            className={`absolute top-1 right-1 ${bucketInfo} text-white text-xs font-bold rounded px-1.5 py-0.5 shadow-lg`}
          >
            {photo.bucket}
          </div>
        )}

        {/* Favorite indicator */}
        {photo.favorite && (
          <div className="absolute bottom-1 right-1 bg-yellow-500 text-white text-xs rounded-full p-1">
            <svg
              className="w-3 h-3 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        )}

        {/* Photo number overlay (shows on hover for non-active) */}
        {!isActive && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-medium">#{index + 1}</span>
          </div>
        )}

        {/* Active indicator */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-blue-500/10" />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="relative bg-gray-900 border-t border-gray-800">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-950/80 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-colors shadow-lg"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Photo Strip */}
      <div
        ref={stripRef}
        className="flex items-center gap-3 px-12 py-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        style={{
          scrollbarWidth: 'thin',
        }}
      >
        {/* Photos Section */}
        {stillPhotos.length > 0 && (
          <>
            {stillPhotos.map((photo, index) => renderPhotoItem(photo, index))}
            {videos.length > 0 && <div className="h-20 border-l border-gray-700 mx-2" />}
          </>
        )}

        {/* Videos Section */}
        {videos.length > 0 && (
          <div className="flex gap-3">
            {videos.map((video, index) => {
              const photoIndex = photos.findIndex(p => p.id === video.id);
              return renderPhotoItem(video, photoIndex);
            })}
          </div>
        )}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-950/80 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-colors shadow-lg"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Photo counter */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-gray-950/80 px-3 py-1 rounded-full text-xs text-gray-300">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
};
