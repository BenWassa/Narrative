import React, { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';

interface StartScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: (state: OnboardingState) => void;
  onOpenProject: (projectId: string) => void;
  recentProjects?: RecentProject[];
}

export default function StartScreen({
  isOpen,
  onClose,
  onCreateComplete,
  onOpenProject,
  recentProjects = [],
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
            <button
              onClick={onClose}
              className="text-sm text-gray-300 hover:text-gray-100"
              aria-label="Close welcome"
            >
              Close
            </button>
          </div>

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
                  <button
                    key={project.rootPath}
                    onClick={() => onOpenProject(project.projectId)}
                    className="text-left rounded-lg border border-gray-800 bg-gray-950 px-3 py-3 hover:border-blue-500"
                  >
                      <div className="text-sm text-gray-100">{project.projectName}</div>
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {project.rootPath}
                      </div>
                    </button>
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
