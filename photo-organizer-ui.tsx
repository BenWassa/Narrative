/*
  Deprecated wrapper file
  The component implementation was moved to `src/frontend/PhotoOrganizer.tsx`.
  Keep this file as a thin shim for backward compatibility during transition.
  Remove this file once callers are migrated to the new path.
*/

import PhotoOrganizer from './src/frontend/PhotoOrganizer';

// warn when imported directly
if (typeof console !== 'undefined' && console.warn) {
  console.warn('`photo-organizer-ui.tsx` is deprecated — use `src/frontend/PhotoOrganizer.tsx` instead.');
}

export default PhotoOrganizer;
      </div>

      {/* Fullscreen View */}
      {fullscreenPhoto && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <img
            src={photos.find(p => p.id === fullscreenPhoto)?.thumbnail}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain"
          />

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
            <p className="text-center text-sm font-mono">
              {photos.find(p => p.id === fullscreenPhoto)?.currentName}
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              Press ESC to close · Arrow keys to navigate
            </p>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 hover:bg-gray-800 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-blue-400 mb-3">MECE Categories</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {MECE_BUCKETS.map(bucket => (
                      <div key={bucket.key} className="flex items-center gap-3 text-sm">
                        <kbd className={`px-2 py-1 rounded ${bucket.color} text-white font-bold`}>
                          {bucket.key}
                        </kbd>
                        <span>{bucket.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-400 mb-3">Navigation</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">←→</kbd>
                      <span>Previous / Next photo</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">Enter</kbd>
                      <span>Fullscreen view</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd>
                      <span>Close / Deselect</span>
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
                      <kbd className="px-2 py-1 bg-gray-800 rounded">⌘Z</kbd>
                      <span>Undo</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="px-2 py-1 bg-gray-800 rounded">⌘⇧Z</kbd>
                      <span>Redo</span>
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
      )}
    </div>
  );
}