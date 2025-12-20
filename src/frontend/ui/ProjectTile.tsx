import React from 'react';
import CoverPicker from './CoverPicker';

interface RecentProject {
  projectName: string;
  projectId: string;
  rootPath: string;
  coverUrl?: string;
  totalPhotos?: number;
}

interface ProjectTileProps {
  project: RecentProject;
  onOpen: (projectId: string) => void;
  onSetCover: (projectId: string, coverUrl: string) => void;
}

export default function ProjectTile({ project, onOpen, onSetCover }: ProjectTileProps) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950">
      <button
        onClick={() => onOpen(project.projectId)}
        className="w-full h-36 block text-left"
        aria-label={`Open project ${project.projectName}`}
      >
        {project.coverUrl ? (
          <img
            src={project.coverUrl}
            alt={project.projectName}
            className="w-full h-36 object-cover"
          />
        ) : (
          <div className="w-full h-36 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-sm text-gray-400">
            {project.projectName}
          </div>
        )}
      </button>

      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{project.projectName}</div>
          {typeof project.totalPhotos === 'number' && (
            <div className="text-xs text-gray-500">{project.totalPhotos} photos</div>
          )}
        </div>
        <CoverPicker projectId={project.projectId} onSetCover={onSetCover} />
      </div>
    </div>
  );
}
