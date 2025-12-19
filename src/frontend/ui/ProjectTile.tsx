import React from 'react';
import CoverPicker from './CoverPicker';

interface RecentProject {
  projectName: string;
  rootPath: string;
  coverUrl?: string;
}

interface ProjectTileProps {
  project: RecentProject;
  onOpen: (rootPath: string) => void;
  onSetCover: (rootPath: string, coverUrl: string) => void;
}

export default function ProjectTile({ project, onOpen, onSetCover }: ProjectTileProps) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950">
      <button
        onClick={() => onOpen(project.rootPath)}
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
        <div className="text-sm font-medium truncate">{project.projectName}</div>
        <CoverPicker projectRoot={project.rootPath} onSetCover={onSetCover} />
      </div>
    </div>
  );
}
