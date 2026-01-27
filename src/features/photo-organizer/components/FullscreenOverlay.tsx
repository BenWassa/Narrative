import React from 'react';
import { X } from 'lucide-react';
import { ProjectPhoto } from '../services/projectService';

interface FullscreenOverlayProps {
  photoId: string | null;
  photos: ProjectPhoto[];
  onClose: () => void;
}

export default function FullscreenOverlay({ photoId, photos, onClose }: FullscreenOverlayProps) {
  if (!photoId) return null;

  const photo = photos.find(p => p.id === photoId);
  if (!photo) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {photo.mimeType?.startsWith('video/') ? (
        <video
          src={photo.thumbnail}
          controls
          className="max-w-full max-h-full object-contain"
          autoPlay={false}
        />
      ) : (
        <img
          src={photo.thumbnail}
          alt="Fullscreen"
          className="max-w-full max-h-full object-contain"
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
        <p className="text-center text-sm font-mono">{photo.currentName}</p>
        <p className="text-center text-xs text-gray-400 mt-2">
          Press ESC to close · Arrow keys to navigate
        </p>
      </div>
    </div>
  );
}
