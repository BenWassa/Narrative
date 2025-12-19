import React, { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import OnboardingModal, { FolderMapping, OnboardingState, RecentProject } from './OnboardingModal';
import ProjectTile from './ui/ProjectTile';

interface StartScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: (state: OnboardingState) => void; // forwarded from onboarding
  onOpenProject: (rootPath: string) => void;
  onRunDemo?: () => void;
  onSetCover: (rootPath: string, coverUrl: string) => void;
  recentProjects?: RecentProject[];
}

export default function StartScreen({
  isOpen,
  onClose,
  onCreateComplete,
  onOpenProject,
  onRunDemo,
  onSetCover,
  recentProjects = [],
}: StartScreenProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full text-gray-100 shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Camera className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-bold">Welcome</h2>
            </div>

            <div className="flex items-center gap-3">
              {onRunDemo && (
                <button onClick={onRunDemo} className="text-sm text-gray-300 hover:text-gray-100" aria-label="Run demo">
                  Demo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <button
              onClick={() => setShowOnboarding(true)}
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 p-6 bg-gray-950 hover:bg-gray-900"
              aria-label="Create new project"
            >
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-sm font-medium">New Project</div>
            </button>

            {recentProjects.map(p => (
              <ProjectTile
                key={p.rootPath}
                project={p}
                onOpen={onOpenProject}
                onSetCover={onSetCover}
              />
            ))}
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
      />
    </div>
  );
}
