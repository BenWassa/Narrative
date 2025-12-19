import React, { useRef, useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import OnboardingModal, { FolderMapping, OnboardingState, RecentProject } from './OnboardingModal';

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
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
                <button
                  onClick={onRunDemo}
                  className="text-sm text-gray-300 hover:text-gray-100"
                  aria-label="Run demo"
                >
                  Demo
                </button>
              )}
              <button
                onClick={onClose}
                className="text-sm text-gray-400 hover:text-gray-200"
                aria-label="Close welcome"
              >
                Dismiss
              </button>
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
              <div
                key={p.rootPath}
                className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950"
              >
                <button
                  onClick={() => onOpenProject(p.rootPath)}
                  className="w-full h-36 block text-left"
                  aria-label={`Open project ${p.projectName}`}
                >
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt={p.projectName}
                      className="w-full h-36 object-cover"
                    />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-sm text-gray-400">
                      {p.projectName}
                    </div>
                  )}
                </button>

                <div className="p-3 flex items-center justify-between">
                  <div className="text-sm font-medium truncate">{p.projectName}</div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={el => (fileInputRefs.current[p.rootPath] = el)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          onSetCover(p.rootPath, url);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[p.rootPath]?.click()}
                      className="text-xs text-gray-400 hover:text-gray-200"
                    >
                      Change cover
                    </button>
                  </div>
                </div>
              </div>
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
