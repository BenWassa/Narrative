import React from 'react';

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
}

export default function ProjectTile({ project, onOpen }: ProjectTileProps) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950 hover:border-blue-500 transition-colors group cursor-pointer">
      <button
        onClick={() => onOpen(project.projectId)}
        className="w-full block text-left"
        aria-label={`Open project ${project.projectName}`}
      >
        <div className="aspect-video overflow-hidden bg-gray-900 relative">
          {project.coverUrl ? (
            <img
              src={project.coverUrl}
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
