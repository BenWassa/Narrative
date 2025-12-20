import React, { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';
import ProjectTile from './ui/ProjectTile';

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
    <div className="h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full text-gray-100 shadow-xl overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-bold">Welcome</h2>
            </div>
            {/* App version badge — non-interactive, stylized */}
            <div className="px-2 py-1 bg-gray-800 text-gray-200 rounded-md text-xs font-medium tracking-wide">
              <span className="uppercase">{`v${__APP_VERSION__}`}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-6">
            <div className="w-40 flex-shrink-0">
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 p-6 bg-gray-950 hover:bg-gray-900 w-full"
                aria-label="Create new project"
              >
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-sm font-medium">New Project</div>
              </button>
            </div>

            {recentProjects.length > 0 && (
              <>
                <div aria-hidden className="w-px bg-gray-700 rounded h-40" />
                <div className="flex-1 grid grid-cols-2 gap-4">
                  {recentProjects.map(project => (
                    <ProjectTile key={project.projectId} project={project} onOpen={onOpenProject} />
                  ))}
                </div>
              </>
            )}
          </div>
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
