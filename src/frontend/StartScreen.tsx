import React, { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';
import ProjectTile from './ui/ProjectTile';
import { versionManager } from '../utils/versionManager';

interface StartScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: (state: OnboardingState) => void;
  onOpenProject: (projectId: string) => void;
  recentProjects?: RecentProject[];
  canClose?: boolean;
  errorMessage?: string | null;
}

export default function StartScreen({
  isOpen,
  onClose,
  onCreateComplete,
  onOpenProject,
  recentProjects = [],
  canClose = false,
  errorMessage = null,
}: StartScreenProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">Narrative</h1>
          </div>
          <div className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md text-xs font-medium tracking-wide">
            <span className="uppercase">{versionManager.getDisplayVersion()}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-7xl">
          {/* Title section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Projects</h2>
            <p className="text-gray-400 text-sm">Create a new project or open a recent one</p>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200 mb-6">
              {errorMessage}
            </div>
          )}

          {/* Projects grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
            {/* New Project Button - same size as ProjectTile */}
            <div className="relative rounded-lg overflow-hidden border-2 border-dashed border-gray-700 bg-gray-950 hover:border-blue-500 transition-colors group cursor-pointer">
              <button
                onClick={() => setShowOnboarding(true)}
                className="w-full block text-left"
                aria-label="Create new project"
              >
                <div className="aspect-video overflow-hidden bg-gray-900 relative">
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center group-hover:from-gray-700 group-hover:to-gray-800 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-gray-700 group-hover:bg-blue-500/20 flex items-center justify-center mb-2 transition-colors">
                      <Plus className="w-7 h-7 text-blue-400" />
                    </div>
                  </div>
                </div>
              </button>

              <div className="p-3 space-y-1">
                <div className="text-sm font-semibold text-gray-200">New Project</div>
                <div className="text-xs text-gray-500">Start organizing photos</div>
              </div>
            </div>

            {/* Recent Projects */}
            {recentProjects.map(project => (
              <ProjectTile key={project.projectId} project={project} onOpen={onOpenProject} />
            ))}
          </div>

          {/* Empty state */}
          {recentProjects.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">No recent projects. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={state => {
          setShowOnboarding(false);
          onCreateComplete(state);
        }}
        recentProjects={recentProjects}
        onSelectRecent={onOpenProject}
      />
    </div>
  );
}
