import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { Heart, Pencil, Save, X as XIcon } from 'lucide-react';
import type { ProjectPhoto } from '../services/projectService';

interface Bucket {
  key: string;
  label: string;
  color: string;
  description: string;
}

interface RightSidebarProps {
  selectedPhotos: Set<string>;
  photos: ProjectPhoto[];
  days: [number, ProjectPhoto[]][];
  buckets: Bucket[];
  onSaveToHistory: (newPhotos: ProjectPhoto[]) => void;
  onPersistState: (newPhotos?: ProjectPhoto[]) => void;
  onSetDayLabels: Dispatch<SetStateAction<Record<number, string>>>;
  onSetSelectedDay: (day: number | null) => void;
  onSetCurrentView: (view: string) => void;
  onSetSelectedPhotos: (next: Set<string>) => void;
  onRemoveDayAssignment: (photoIds: string[] | string) => void;
  onAssignBucket: (photoIds: string[] | string, bucket: string) => void;
  onToggleFavorite: (photoIds: string[] | string) => void;
}

export default function RightSidebar({
  selectedPhotos,
  photos,
  days,
  buckets,
  onSaveToHistory,
  onPersistState,
  onSetDayLabels,
  onSetSelectedDay,
  onSetCurrentView,
  onSetSelectedPhotos,
  onRemoveDayAssignment,
  onAssignBucket,
  onToggleFavorite,
}: RightSidebarProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    setEditingName(false);
  }, [selectedPhotos]);

  if (selectedPhotos.size === 0) return null;

  const selectedId = selectedPhotos.size === 1 ? Array.from(selectedPhotos)[0] : null;
  const selectedPhoto = selectedId ? photos.find(p => p.id === selectedId) : null;

  return (
    <aside className="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto">
      <div className="p-6">
        <div className="mb-6">
          {selectedPhotos.size === 1 && selectedPhoto ? (
            <>
              {selectedPhoto.mimeType?.startsWith('video/') ? (
                <video src={selectedPhoto.thumbnail} className="w-full rounded-lg" controls />
              ) : (
                <img src={selectedPhoto.thumbnail} alt="Selected" className="w-full rounded-lg" />
              )}
              <div className="mt-2 text-xs text-gray-400 font-mono break-all">
                {!editingName ? (
                  <div className="flex items-center justify-between">
                    <div>{selectedPhoto.currentName}</div>
                    <button
                      onClick={() => {
                        setNameInput(selectedPhoto.currentName || selectedPhoto.originalName || '');
                        setEditingName(true);
                      }}
                      className="p-1 ml-2"
                      aria-label="Edit name"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-gray-800 text-sm text-gray-100"
                    />
                    <button
                      onClick={() => {
                        const newPhotos = photos.map(ph =>
                          ph.id === selectedId ? { ...ph, currentName: nameInput } : ph,
                        );
                        onSaveToHistory(newPhotos);
                        setEditingName(false);
                      }}
                      className="p-1 bg-green-600 rounded"
                      aria-label="Save name"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="p-1 bg-gray-800 rounded"
                      aria-label="Cancel edit name"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-300">{selectedPhotos.size} selected</div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign Day</h3>
          <div className="flex gap-2 items-center">
            <select
              aria-label="Assign to..."
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                const dayNum =
                  val === 'new' ? Math.max(0, ...days.map(d => d[0])) + 1 : Number(val);
                const targets = Array.from(selectedPhotos);
                const newPhotos = photos.map(ph =>
                  targets.includes(ph.id) ? { ...ph, day: dayNum } : ph,
                );
                onSaveToHistory(newPhotos);
                if (val === 'new') {
                  onSetDayLabels(prev => ({
                    ...prev,
                    [dayNum]: `Day ${String(dayNum).padStart(2, '0')}`,
                  }));
                  onPersistState(newPhotos);
                }
                onSetSelectedDay(dayNum);
                onSetCurrentView('days');
                onSetSelectedPhotos(new Set());
              }}
              className="px-3 py-2 rounded bg-gray-800"
              defaultValue=""
            >
              <option value="">Assign to...</option>
              {days.map(([d]) => (
                <option key={d} value={d}>{`Day ${String(d).padStart(2, '0')}`}</option>
              ))}
              <option value="new">Create new day</option>
            </select>
            <div className="text-xs text-gray-400">Assign selected photos to a day folder</div>
          </div>
          <button
            onClick={() => {
              onRemoveDayAssignment(Array.from(selectedPhotos));
              onSetSelectedPhotos(new Set());
            }}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
          >
            Remove Day Assignment
          </button>
        </div>

        <div className="space-y-2 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign Category</h3>
          {buckets.map(bucket => (
            <button
              key={bucket.key}
              onClick={() => onAssignBucket(Array.from(selectedPhotos), bucket.key)}
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
            onClick={() => onToggleFavorite(Array.from(selectedPhotos))}
            className={`w-full px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              selectedPhotos.size === 1 && selectedPhoto?.favorite
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                selectedPhotos.size === 1 && selectedPhoto?.favorite ? 'fill-current' : ''
              }`}
            />
            Toggle Favorite (F)
          </button>
        </div>
      </div>
    </aside>
  );
}
