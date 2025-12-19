import React, { useState, useEffect, useCallback } from 'react';
import { Camera, ChevronLeft, ChevronRight, Star, Archive, Calendar, Heart, Undo2, Redo2, Grid3x3, Maximize2, X, FolderOpen, Settings } from 'lucide-react';

// Sample photo data
const generateSamplePhotos = () => {
  const categories = ['unsorted', 'unsorted', 'unsorted'];
  const days = ['2024-03-15', '2024-03-15', '2024-03-16', '2024-03-16', '2024-03-17'];
  const photos = [];
  
  for (let i = 1; i <= 24; i++) {
    photos.push({
      id: `photo_${i}`,
      originalName: `IMG_${1000 + i}.jpg`,
      currentName: `IMG_${1000 + i}.jpg`,
      timestamp: new Date(days[i % days.length]).getTime() + (i * 3600000),
      day: null,
      bucket: null,
      sequence: null,
      favorite: false,
      rating: 0,
      archived: false,
      thumbnail: `https://picsum.photos/seed/${i}/400/300`
    });
  }
  return photos;
};

const MECE_BUCKETS = [
  { key: 'A', label: 'Establishing', color: 'bg-blue-500', description: 'Wide shots, landscapes' },
  { key: 'B', label: 'People', color: 'bg-purple-500', description: 'Portraits, groups' },
  { key: 'C', label: 'Culture/Detail', color: 'bg-green-500', description: 'Local life, close-ups' },
  { key: 'D', label: 'Action/Moment', color: 'bg-orange-500', description: 'Events, activities' },
  { key: 'E', label: 'Transition', color: 'bg-yellow-500', description: 'Travel, movement' },
  { key: 'F', label: 'Mood/Night', color: 'bg-indigo-500', description: 'Atmosphere, evening' },
  { key: 'X', label: 'Archive', color: 'bg-gray-500', description: 'Unwanted shots' }
];

const VIEWS = ['inbox', 'days', 'favorites', 'archive', 'review'];

export default function PhotoOrganizer() {
  const [photos, setPhotos] = useState(generateSamplePhotos());
  const [currentView, setCurrentView] = useState('inbox');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [projectName, setProjectName] = useState('Iceland Trip 2024');

  // Get days from photos
  const days = React.useMemo(() => {
    const dayMap = new Map();
    photos.forEach(photo => {
      if (photo.day) {
        if (!dayMap.has(photo.day)) {
          dayMap.set(photo.day, []);
        }
        dayMap.get(photo.day).push(photo);
      }
    });
    return Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [photos]);

  // Filter photos based on current view
  const filteredPhotos = React.useMemo(() => {
    switch (currentView) {
      case 'inbox':
        return photos.filter(p => !p.bucket && !p.archived);
      case 'days':
        if (selectedDay !== null) {
          return photos.filter(p => p.day === selectedDay);
        }
        return photos.filter(p => p.day !== null && !p.archived);
      case 'favorites':
        return photos.filter(p => p.favorite && !p.archived);
      case 'archive':
        return photos.filter(p => p.archived);
      case 'review':
        return photos.filter(p => p.bucket && !p.archived);
      default:
        return photos;
    }
  }, [photos, currentView, selectedDay]);

  // Save state to history
  const saveToHistory = useCallback((newPhotos) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(photos)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setPhotos(newPhotos);
  }, [history, historyIndex, photos]);

  // Assign bucket to photo
  const assignBucket = useCallback((photoId, bucket, dayNum = null) => {
    const newPhotos = photos.map(photo => {
      if (photo.id === photoId) {
        const day = dayNum || photo.day || Math.ceil((new Date(photo.timestamp).getDate()) / 1);
        const sequence = photos.filter(p => p.day === day && p.bucket === bucket).length + 1;
        const newName = bucket === 'X' 
          ? photo.originalName 
          : `D${String(day).padStart(2, '0')}_${bucket}_${String(sequence).padStart(3, '0')}__${photo.originalName}`;
        
        return {
          ...photo,
          bucket,
          day,
          sequence,
          currentName: newName,
          archived: bucket === 'X'
        };
      }
      return photo;
    });
    saveToHistory(newPhotos);
  }, [photos, saveToHistory]);

  // Toggle favorite
  const toggleFavorite = useCallback((photoId) => {
    const newPhotos = photos.map(photo => 
      photo.id === photoId ? { ...photo, favorite: !photo.favorite } : photo
    );
    saveToHistory(newPhotos);
  }, [photos, saveToHistory]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPhotos(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPhotos(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (showHelp) {
        if (e.key === 'Escape' || e.key === '?') {
          setShowHelp(false);
        }
        return;
      }

      if (e.key === '?') {
        setShowHelp(true);
        return;
      }

      if (!selectedPhoto) return;

      // MECE bucket assignment
      const bucket = MECE_BUCKETS.find(b => b.key.toLowerCase() === e.key.toLowerCase());
      if (bucket) {
        assignBucket(selectedPhoto, bucket.key);
        // Move to next photo
        const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto);
        if (currentIndex < filteredPhotos.length - 1) {
          setSelectedPhoto(filteredPhotos[currentIndex + 1].id);
        }
        return;
      }

      // Navigation
      if (e.key === 'ArrowRight') {
        const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto);
        if (currentIndex < filteredPhotos.length - 1) {
          setSelectedPhoto(filteredPhotos[currentIndex + 1].id);
        }
      } else if (e.key === 'ArrowLeft') {
        const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto);
        if (currentIndex > 0) {
          setSelectedPhoto(filteredPhotos[currentIndex - 1].id);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setFullscreenPhoto(selectedPhoto);
      } else if (e.key === 'Escape') {
        if (fullscreenPhoto) {
          setFullscreenPhoto(null);
        } else {
          setSelectedPhoto(null);
        }
      } else if (e.key === 'f') {
        toggleFavorite(selectedPhoto);
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedPhoto, filteredPhotos, assignBucket, toggleFavorite, undo, redo, showHelp, fullscreenPhoto]);

  // Stats
  const stats = React.useMemo(() => ({
    total: photos.length,
    sorted: photos.filter(p => p.bucket && !p.archived).length,
    unsorted: photos.filter(p => !p.bucket && !p.archived).length,
    archived: photos.filter(p => p.archived).length,
    favorites: photos.filter(p => p.favorite).length
  }), [photos]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Camera className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold">{projectName}</h1>
              <p className="text-xs text-gray-400">
                {stats.sorted} sorted · {stats.unsorted} inbox · {stats.favorites} favorites
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 hover:bg-gray-800 rounded disabled:opacity-30"
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 hover:bg-gray-800 rounded disabled:opacity-30"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 hover:bg-gray-800 rounded"
              title="Show shortcuts (?)"
            >
              ?
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 px-6 pb-2">
          {[
            { id: 'inbox', label: 'Inbox', count: stats.unsorted },
            { id: 'days', label: 'Days', count: days.length },
            { id: 'favorites', label: 'Favorites', count: stats.favorites },
            { id: 'archive', label: 'Archive', count: stats.archived },
            { id: 'review', label: 'Review', count: stats.sorted }
          ].map(view => (
            <button
              key={view.id}
              onClick={() => {
                setCurrentView(view.id);
                setSelectedDay(null);
              }}
              className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
                currentView === view.id
                  ? 'bg-gray-950 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {view.label} {view.count > 0 && <span className="text-xs opacity-60">({view.count})</span>}
            </button>
          ))}
        </div>
      </header>

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