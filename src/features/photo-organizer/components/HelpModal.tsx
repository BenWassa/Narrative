import React from 'react';
import { X } from 'lucide-react';

export interface MECEBucket {
  key: string;
  label: string;
  color: string;
  description: string;
}

interface HelpModalProps {
  isOpen: boolean;
  buckets: MECEBucket[];
  onClose: () => void;
}

export default function HelpModal({ isOpen, buckets, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-blue-400 mb-3">MECE Categories</h3>
              <div className="grid grid-cols-2 gap-2">
                {buckets.map(bucket => (
                  <div key={bucket.key} className="flex items-center gap-3 text-sm">
                    <kbd className={`px-2 py-1 rounded ${bucket.color} text-white font-bold`}>
                      {bucket.key === 'F' ? 'M' : bucket.key}
                    </kbd>
                    <span>{bucket.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Keyboard shortcuts: A–E, X, M (Mood/Food). F is reserved for Favorite.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-blue-400 mb-3">Navigation</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">←→</kbd>
                  <span>Previous / Next photo</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">J / K</kbd>
                  <span>Next / Previous (grid)</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Shift+J / Shift+K</kbd>
                  <span>Next / Previous unassigned</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Enter</kbd>
                  <span>Fullscreen view</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd>
                  <span>Close / Deselect</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Space / N</kbd>
                  <span>Next unassigned (viewer)</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-blue-400 mb-3">Actions</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">F</kbd>
                  <span>Toggle favorite</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Shift+H</kbd>
                  <span>Toggle Skip Assigned</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">A–E, M, X</kbd>
                  <span>Assign bucket (multi-select supported)</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">⌘Z</kbd>
                  <span>Undo (keyboard)</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">⌘⇧Z</kbd>
                  <span>Redo (keyboard)</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+Shift+D</kbd>
                  <span>Toggle debug overlay</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-gray-800 rounded">?</kbd>
                  <span>Show this help</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
