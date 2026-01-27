import React, { useState, useEffect } from 'react';
import * as coverStorage from '../utils/coverStorageService';

interface RecentProject {
  projectName: string;
  projectId: string;
  rootPath: string;
  coverUrl?: string; // Legacy base64
  coverKey?: string; // New IndexedDB reference
  totalPhotos?: number;
}

interface ProjectTileProps {
  project: RecentProject;
  onOpen: (projectId: string) => void;
}

export default function ProjectTile({ project, onOpen }: ProjectTileProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    // Load cover from IndexedDB if coverKey exists, otherwise use legacy coverUrl
    if (project.coverKey) {
      coverStorage
        .getCoverUrl(project.projectId)
        .then(url => setCoverUrl(url))
        .catch(err => {
          console.warn(`Failed to load cover for ${project.projectId}:`, err);
          // Fall back to legacy coverUrl if available
          if (project.coverUrl) {
            setCoverUrl(project.coverUrl);
          }
        });
    } else if (project.coverUrl) {
      // Legacy base64 cover
      setCoverUrl(project.coverUrl);
    }

    // Cleanup: revoke object URLs on unmount
    return () => {
      if (coverUrl && coverUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverUrl);
      }
    };
  }, [project, project.coverKey, project.coverUrl]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950 hover:border-blue-500 transition-colors group cursor-pointer">
      <button
        onClick={() => onOpen(project.projectId)}
        className="w-full block text-left"
        aria-label={`Open project ${project.projectName}`}
      >
        <div className="aspect-video overflow-hidden bg-gray-900 relative">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={project.projectName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-sm text-gray-400">
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500">No cover</div>
              </div>
            </div>
          )}
        </div>
      </button>

      <div className="p-3 space-y-1">
        <div className="text-sm font-semibold text-gray-200 truncate">{project.projectName}</div>
        {typeof project.totalPhotos === 'number' && (
          <div className="text-xs text-gray-500">{`${project.totalPhotos} ${
            project.totalPhotos === 1 ? 'photo' : 'photos'
          }`}</div>
        )}
        <div className="text-xs text-gray-600 truncate">{project.rootPath}</div>
      </div>
    </div>
  );
}
