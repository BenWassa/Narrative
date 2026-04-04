import React, { useState, useEffect } from 'react';
import * as coverStorage from '../utils/coverStorageService';
import type { RecentProject } from '../OnboardingModal';

interface ProjectTileProps {
  project: RecentProject;
  onOpen: (projectId: string) => void;
}

export default function ProjectTile({ project, onOpen }: ProjectTileProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;

    const cleanup = () => {
      if (activeUrl && activeUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeUrl);
      }
      activeUrl = null;
    };

    const applyLegacyCover = () => {
      cleanup();
      if (isMounted) {
        if (project.coverUrl) {
          activeUrl = project.coverUrl;
          setCoverUrl(project.coverUrl);
        } else {
          setCoverUrl(null);
        }
      }
    };

    if (project.coverKey) {
      coverStorage
        .getCoverUrl(project.projectId)
        .then(url => {
          if (isMounted) {
            cleanup();
            activeUrl = url;
            setCoverUrl(url);
          }
        })
        .catch(err => {
          console.warn(`Failed to load cover for ${project.projectId}:`, err);
          if (isMounted) {
            applyLegacyCover();
          }
        });
    } else {
      applyLegacyCover();
    }

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [project.coverKey, project.coverUrl, project.projectId]);

  const total = project.totalPhotos || 1;
  const assignedPct =
    typeof project.assignedCount === 'number' ? (project.assignedCount / total) * 100 : 0;
  const archivedPct =
    typeof project.archivedCount === 'number' ? (project.archivedCount / total) * 100 : 0;

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950 hover:border-blue-500 transition-colors group cursor-pointer pb-1">
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

      <div className="p-3 space-y-1 relative z-10">
        <div className="text-sm font-semibold text-gray-200 truncate">{project.projectName}</div>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>{`${project.totalPhotos || 0} photos`}</span>
          {project.inboxCount !== undefined && project.inboxCount > 0 && (
            <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full text-xs font-medium border border-gray-700">
              {project.inboxCount} inbox
            </span>
          )}
        </div>
        <div className="flex justify-between items-center text-xs text-gray-600 truncate">
          <span>{project.rootPath}</span>
          {typeof project.assignedCount === 'number' && (
            <span className="text-blue-400 font-medium">{Math.round(assignedPct)}% assigned</span>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-900 flex">
        <div
          className="bg-blue-500 h-full transition-all"
          style={{ width: `${Math.min(assignedPct, 100)}%` }}
        />
        <div
          className="bg-gray-600 h-full transition-all"
          style={{ width: `${Math.min(archivedPct, 100)}%` }}
        />
      </div>
    </div>
  );
}
