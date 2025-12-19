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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Days list when in days view */}
        {currentView === 'days' && (
          <aside className="w-48 border-r border-gray-800 bg-gray-900 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Days</h3>
              <div className="space-y-1">
                {days.map(([day, dayPhotos], idx) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedDay === day
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="font-medium">Day {String(day).padStart(2, '0')}</div>
                    <div className="text-xs opacity-70">{dayPhotos.length} photos</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Photo Grid */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {currentView === 'days' && selectedDay === null ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a day to view photos</p>
                </div>
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No photos in this view</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {filteredPhotos.map(photo => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.id)}
                    onDoubleClick={() => setFullscreenPhoto(photo.id)}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all ${
                      selectedPhoto === photo.id
                        ? 'ring-4 ring-blue-500 scale-105'
                        : 'hover:ring-2 hover:ring-gray-600'
                    }`}
                  >
                    <img
                      src={photo.thumbnail}
                      alt={photo.currentName}
                      className="w-full aspect-[4/3] object-cover"
                    />
                    
                    {/* Overlay info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-xs font-mono truncate">{photo.currentName}</p>
                      </div>
                    </div>

                    {/* Bucket badge */}
                    {photo.bucket && (
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                        MECE_BUCKETS.find(b => b.key === photo.bucket)?.color
                      } text-white shadow-lg`}>
                        {photo.bucket}
                      </div>
                    )}

                    {/* Favorite star */}
                    {photo.favorite && (
                      <div className="absolute top-2 right-2">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Panel - MECE Controls */}
        {selectedPhoto && !fullscreenPhoto && (
          <aside className="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <img
                  src={photos.find(p => p.id === selectedPhoto)?.thumbnail}
                  alt="Selected"
                  className="w-full rounded-lg"
                />
                <p className="mt-2 text-xs text-gray-400 font-mono break-all">
                  {photos.find(p => p.id === selectedPhoto)?.currentName}
                </p>
              </div>

              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign Category</h3>
                {MECE_BUCKETS.map(bucket => (
                  <button
                    key={bucket.key}
                    onClick={() => assignBucket(selectedPhoto, bucket.key)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${bucket.color} hover:brightness-110 text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-lg">{bucket.key}</span>
                        <span className="ml-3 font-medium">{bucket.label}</span>
                      </div>
                    </div>
                    <p className="text-xs mt-1 opacity-80">{bucket.description}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-800">
                <button
                  onClick={() => toggleFavorite(selectedPhoto)}
                  className={`w-full px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    photos.find(p => p.id === selectedPhoto)?.favorite
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${
                    photos.find(p => p.id === selectedPhoto)?.favorite ? 'fill-current' : ''
                  }`} />
                  Toggle Favorite (F)
                </button>
              </div>
            </div>
          </aside>
        )}
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