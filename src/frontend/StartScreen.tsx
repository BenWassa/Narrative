import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import OnboardingModal, { OnboardingState, RecentProject } from './OnboardingModal';

interface StartScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: (state: OnboardingState) => void;
  onOpenProject: (rootPath: string) => void;
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
      <div className="bg-gray-900 rounded-lg max-w-3xl w-full text-gray-100 shadow-xl overflow-hidden">
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

          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-300">
              Create a new project to start organizing your photos.
            </p>
            <button
              onClick={() => setShowOnboarding(true)}
              className="mt-3 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              Create Project
            </button>
          </div>

          {recentProjects.length > 0 && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-200">Recent Projects</p>
                <p className="text-xs text-gray-500">Open a project you worked on recently.</p>
              </div>
              <div className="space-y-2">
                {recentProjects.map(project => (
                  <button
                    key={project.rootPath}
                    onClick={() => onOpenProject(project.rootPath)}
                    className="w-full text-left rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 hover:border-blue-500"
                  >
                    <div className="text-sm text-gray-100">{project.projectName}</div>
                    <div className="text-xs text-gray-500 truncate">{project.rootPath}</div>
                  </button>
                ))}
              </div>
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
