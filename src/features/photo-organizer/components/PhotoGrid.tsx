import { FolderOpen, Loader } from 'lucide-react';
import { useRef } from 'react';
import { PhotoViewer } from '../ui/PhotoViewer';
import type { ProjectPhoto } from '../services/projectService';
import { navigatePhotos, sortPhotos } from '../utils/photoOrdering';
import VirtualPhotoGrid from './VirtualPhotoGrid';

const VIRTUAL_GRID_THRESHOLD = 600;
const DOUBLE_CLICK_DELAY = 300;

interface Bucket {
  key: string;
  label: string;
  color: string;
  description: string;
}

interface PhotoGridProps {
  loadingProject: boolean;
  currentView: string;
  selectedTreePath: string | null;
  selectedDayForGrouping: number | null;
  selectedNodeKind?: 'folder' | 'bucket' | 'day' | 'system' | null;
  photos: ProjectPhoto[];
  filteredPhotos: ProjectPhoto[];
  selectedPhotos: Set<string>;
  galleryViewPhoto: string | null;
  dayLabels: Record<number, string>;
  dayNotes: Record<number, string>;
  buckets: Bucket[];
  onSelectPhoto: (photoId: string) => void;
  onOpenViewer: (photoId: string) => void;
  onCloseViewer: () => void;
  onNavigateViewer: (photoId: string) => void;
  onAssignBucket: (photoId: string, bucket: string) => void;
  onAssignDay: (photoId: string, day: number | null) => void;
  onSaveToHistory: (newPhotos: ProjectPhoto[]) => void;
  onUpdateDayTitle: (day: number, title: string) => void;
  onUpdateDayNotes: (day: number, notes: string) => void;
  onShowToast: (
    message: string,
    tone?: 'info' | 'error',
    options?: { durationMs?: number; actionLabel?: string; onAction?: () => void },
  ) => void;
  getSubfolderGroup: (photo: ProjectPhoto, dayNumber: number | null) => string;
  getDerivedSubfolderGroup: (photo: ProjectPhoto, dayNumber: number | null) => string;
  isVideoPhoto: (photo: ProjectPhoto) => boolean;
  isMeceBucketLabel: (label: string) => boolean;
}

export default function PhotoGrid({
  loadingProject,
  currentView,
  selectedTreePath,
  selectedDayForGrouping,
  selectedNodeKind,
  photos,
  filteredPhotos,
  selectedPhotos,
  galleryViewPhoto,
  dayLabels,
  dayNotes,
  buckets,
  onSelectPhoto,
  onOpenViewer,
  onCloseViewer,
  onNavigateViewer,
  onAssignBucket,
  onAssignDay,
  onSaveToHistory,
  onUpdateDayTitle,
  onUpdateDayNotes,
  onShowToast,
  getSubfolderGroup,
  getDerivedSubfolderGroup,
  isVideoPhoto,
  isMeceBucketLabel,
}: PhotoGridProps) {
  const clickTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handlePhotoClick = (photoId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (clickTimerRef.current[photoId]) {
      clearTimeout(clickTimerRef.current[photoId]);
      delete clickTimerRef.current[photoId];
      onOpenViewer(photoId);
      return;
    }

    clickTimerRef.current[photoId] = setTimeout(() => {
      delete clickTimerRef.current[photoId];
      onSelectPhoto(photoId);
    }, DOUBLE_CLICK_DELAY);
  };

  const renderPhotoGrid = (photosList: ProjectPhoto[]) => (
    <div className="grid grid-cols-5 gap-3">
      {photosList.map(photo => (
        <div
          key={photo.id}
          onClick={event => handlePhotoClick(photo.id, event)}
          data-testid={`photo-${photo.id}`}
          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 border-transparent transition-all shadow-lg hover:shadow-xl hover:border-blue-500 ${
            selectedPhotos.has(photo.id) ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div
            className={`rounded-lg overflow-hidden ${
              photo.bucket || photo.archived ? 'opacity-70 saturate-75' : ''
            }`}
          >
            {photo.thumbnail ? (
              photo.mimeType?.startsWith('video/') ? (
                <video
                  src={photo.thumbnail}
                  className="w-full aspect-square object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  src={photo.thumbnail}
                  alt={photo.currentName}
                  className="w-full aspect-square object-cover"
                />
              )
            ) : (
              <div className="w-full aspect-square bg-gray-900 flex items-center justify-center text-xs text-gray-400 px-2 text-center">
                {photo.currentName}
              </div>
            )}
          </div>

          {photo.bucket ? (
            <div className="absolute bottom-2 left-2 rounded px-2 py-1 text-xs font-bold text-white shadow-lg z-10 bg-black/70">
              <span>{photo.bucket}</span>
            </div>
          ) : null}
          {isVideoPhoto(photo) ? (
            <div className="absolute right-2 top-2 rounded bg-black/75 px-2 py-1 text-xs font-semibold text-white shadow-lg">
              {photo.durationSec ? `${Math.round(photo.durationSec)}s` : 'Video'}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );

  if (loadingProject) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-400" />
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'folders' && !selectedTreePath) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a folder to view photos</p>
        </div>
      </div>
    );
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No photos in this view</p>
        </div>
      </div>
    );
  }

  const orderingResult = sortPhotos(filteredPhotos, {
    groupBy: selectedNodeKind === 'day' && selectedDayForGrouping !== null ? 'subfolder' : null,
    separateVideos: true,
    selectedDay: selectedDayForGrouping,
    getSubfolderGroup,
    isVideo: isVideoPhoto,
  });

  const orderedPhotos = orderingResult.photos;
  const sortedGroups =
    selectedNodeKind === 'day' && selectedDayForGrouping !== null
      ? orderingResult.groups ?? null
      : null;

  if (galleryViewPhoto) {
    const photoData = orderedPhotos.find(photo => photo.id === galleryViewPhoto);
    if (photoData) {
      return (
        <PhotoViewer
          photo={photoData}
          filteredPhotos={orderedPhotos}
          orderingResult={orderingResult}
          onClose={onCloseViewer}
          onNavigate={onNavigateViewer}
          onAssignBucket={(photoId, bucket) => {
            onAssignBucket(photoId, bucket);
            if (!bucket) return;
            const nextUnassigned = navigatePhotos(
              photoId,
              'next',
              orderingResult,
              candidate => !candidate.bucket && !candidate.archived,
            );
            if (nextUnassigned) {
              onNavigateViewer(nextUnassigned.id);
            }
          }}
          onAssignDay={onAssignDay}
          selectedBucket={photoData.bucket || undefined}
          selectedDay={photoData.day}
          buckets={buckets}
          dayLabels={dayLabels}
          onShowToast={onShowToast}
        />
      );
    }
  }

  if (sortedGroups && selectedDayForGrouping !== null) {
    return (
      <div className="space-y-8">
        <div className="grid gap-3 rounded border border-gray-800 bg-gray-900/60 p-4 md:grid-cols-[minmax(12rem,18rem)_1fr]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Day Title
            <input
              value={
                dayLabels[selectedDayForGrouping] ||
                `Day ${String(selectedDayForGrouping).padStart(2, '0')}`
              }
              onChange={event => onUpdateDayTitle(selectedDayForGrouping, event.target.value)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-gray-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Day Notes
            <input
              value={dayNotes[selectedDayForGrouping] || ''}
              onChange={event => onUpdateDayNotes(selectedDayForGrouping, event.target.value)}
              placeholder="Short recap line for lower-thirds"
              className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-gray-100 placeholder:text-gray-600"
            />
          </label>
        </div>
        {sortedGroups.map(group => {
          const groupPhotos = group.photos.filter(photo => photo.day === selectedDayForGrouping);
          const hasExplicitOverride = groupPhotos.some(
            photo => photo.subfolderOverride !== undefined,
          );
          const isIngestedGroup = groupPhotos.some(photo => photo.subfolderOverride === null);
          const isDayRootGroup = group.label === 'Day Root';
          const isMeceGroup = isMeceBucketLabel(group.label);

          return (
            <div key={group.label}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">{group.label}</h3>
                {!isMeceGroup && !isDayRootGroup && hasExplicitOverride ? (
                  <button
                    className="text-xs text-red-300 hover:text-red-200"
                    onClick={() => {
                      const updated = photos.map(photo => {
                        if (photo.day !== selectedDayForGrouping) return photo;
                        const derived = getDerivedSubfolderGroup(photo, selectedDayForGrouping);
                        if (derived !== group.label) return photo;
                        return { ...photo, subfolderOverride: undefined };
                      });
                      onSaveToHistory(updated);
                      onShowToast('Subfolder override cleared.', 'info');
                    }}
                  >
                    Undo Override
                  </button>
                ) : null}
                {!isMeceGroup && !isDayRootGroup && !hasExplicitOverride ? (
                  <button
                    className="text-xs text-blue-300 hover:text-blue-200"
                    onClick={() => {
                      const updated = photos.map(photo => {
                        if (photo.day !== selectedDayForGrouping) return photo;
                        const derived = getDerivedSubfolderGroup(photo, selectedDayForGrouping);
                        if (derived !== group.label) return photo;
                        return { ...photo, subfolderOverride: isIngestedGroup ? derived : null };
                      });
                      onSaveToHistory(updated);
                    }}
                  >
                    {isIngestedGroup ? 'Keep Subfolder' : 'Ingest To Day'}
                  </button>
                ) : null}
              </div>
              {renderPhotoGrid(group.photos)}
            </div>
          );
        })}
      </div>
    );
  }

  if (selectedDayForGrouping === null && orderedPhotos.length >= VIRTUAL_GRID_THRESHOLD) {
    return (
      <VirtualPhotoGrid
        photos={orderedPhotos}
        selectedPhotos={selectedPhotos}
        onSelectPhoto={onSelectPhoto}
        onOpenViewer={onOpenViewer}
      />
    );
  }

  return renderPhotoGrid(orderedPhotos);
}
