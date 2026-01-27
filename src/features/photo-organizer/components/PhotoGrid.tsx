import { Calendar, FolderOpen, Heart, Loader } from 'lucide-react';
import { useRef } from 'react';
import { PhotoViewer } from '../ui/PhotoViewer';
import type { ProjectPhoto } from '../services/projectService';
import { navigatePhotos, sortPhotos } from '../utils/photoOrdering';
import VirtualPhotoGrid from './VirtualPhotoGrid';

const VIRTUAL_GRID_THRESHOLD = 600;
const DOUBLE_CLICK_DELAY = 300; // milliseconds to wait for double-click detection

interface Bucket {
  key: string;
  label: string;
  color: string;
  description: string;
}

interface PhotoGridProps {
  loadingProject: boolean;
  currentView: string;
  selectedDay: number | null;
  selectedRootFolder: string | null;
  photos: ProjectPhoto[];
  rootGroups: [string, ProjectPhoto[]][];
  filteredPhotos: ProjectPhoto[];
  selectedPhotos: Set<string>;
  galleryViewPhoto: string | null;
  dayLabels: Record<number, string>;
  buckets: Bucket[];
  onSelectPhoto: (photoId: string) => void;
  onOpenViewer: (photoId: string) => void;
  onCloseViewer: () => void;
  onNavigateViewer: (photoId: string) => void;
  onToggleFavorite: (photoId: string) => void;
  onAssignBucket: (photoId: string, bucket: string) => void;
  onAssignDay: (photoId: string, day: number | null) => void;
  onSaveToHistory: (newPhotos: ProjectPhoto[]) => void;
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
  selectedDay,
  selectedRootFolder,
  photos,
  rootGroups,
  filteredPhotos,
  selectedPhotos,
  galleryViewPhoto,
  dayLabels,
  buckets,
  onSelectPhoto,
  onOpenViewer,
  onCloseViewer,
  onNavigateViewer,
  onToggleFavorite,
  onAssignBucket,
  onAssignDay,
  onSaveToHistory,
  onShowToast,
  getSubfolderGroup,
  getDerivedSubfolderGroup,
  isVideoPhoto,
  isMeceBucketLabel,
}: PhotoGridProps) {
  const clickTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handlePhotoClick = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // If we already have a pending click timer, this is the double-click
    if (clickTimerRef.current[photoId]) {
      clearTimeout(clickTimerRef.current[photoId]);
      delete clickTimerRef.current[photoId];
      onOpenViewer(photoId);
    } else {
      // Single click - set timer to select after delay
      clickTimerRef.current[photoId] = setTimeout(() => {
        delete clickTimerRef.current[photoId];
        onSelectPhoto(photoId);
      }, DOUBLE_CLICK_DELAY);
    }
  };

  const renderPhotoGrid = (
    photosList: ProjectPhoto[],
    orderedList: ProjectPhoto[],
    indexMap?: Map<string, number>,
  ) => (
    <div className="grid grid-cols-5 gap-3">
      {photosList.map(photo => (
        <div
          key={photo.id}
          onClick={e => handlePhotoClick(photo.id, e)}
          data-testid={`photo-${photo.id}`}
          className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all shadow-lg hover:shadow-xl ${
            photo.bucket || photo.archived ? 'opacity-70 saturate-75' : 'hover:scale-105'
          } ${selectedPhotos.has(photo.id) ? 'ring-2 ring-blue-500' : ''}`}
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

          {photo.mimeType?.startsWith('video/') && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-full p-1.5">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
              </svg>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-xs font-medium text-white truncate">{photo.currentName}</p>
            </div>
          </div>

          {photo.isPreOrganized && (
            <div className="absolute top-2 right-2 z-10">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white shadow-lg"
                title={`Auto-assigned: Day ${photo.detectedDay ?? '—'}, Bucket ${
                  photo.detectedBucket ?? '—'
                }`}
              >
                Organized
              </span>
            </div>
          )}

          {photo.bucket && (
            <div
              className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                buckets.find(b => b.key === photo.bucket)?.color
              } text-white shadow-lg`}
            >
              <div className="flex items-center gap-1">
                <span>{photo.bucket}</span>
                {photo.favorite && <Heart className="w-3 h-3 fill-current" />}
              </div>
            </div>
          )}

          {!photo.bucket && photo.favorite && (
            <div className="absolute bottom-2 left-2 bg-yellow-500 text-white rounded-full p-1.5 shadow-lg">
              <Heart className="w-3.5 h-3.5 fill-current" />
            </div>
          )}
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

  if (currentView === 'days' && selectedDay === null) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a day to view photos</p>
        </div>
      </div>
    );
  }

  if (currentView === 'folders' && selectedRootFolder === null && selectedDay === null) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a folder to view photos</p>
        </div>
      </div>
    );
  }

  const rootPhotos =
    currentView === 'folders' && selectedRootFolder
      ? (rootGroups.find(r => r[0] === selectedRootFolder)?.[1] || []).filter(p => !p.archived)
      : null;
  const displayPhotos = rootPhotos !== null ? rootPhotos : filteredPhotos;
  const orderingResult = sortPhotos(displayPhotos, {
    groupBy: selectedDay !== null ? 'subfolder' : null,
    separateVideos: true,
    selectedDay,
    getSubfolderGroup,
    isVideo: isVideoPhoto,
  });
  const orderedDisplayPhotos = orderingResult.photos;
  const orderedIndex = orderingResult.indexMap;
  const sortedGroups = selectedDay !== null ? orderingResult.groups ?? null : null;

  if (displayPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No photos in this view</p>
        </div>
      </div>
    );
  }

  if (galleryViewPhoto) {
    const photoData = orderedDisplayPhotos.find(p => p.id === galleryViewPhoto);
    if (photoData) {
      return (
        <PhotoViewer
          photo={photoData}
          filteredPhotos={orderedDisplayPhotos}
          orderingResult={orderingResult}
          onClose={onCloseViewer}
          onNavigate={onNavigateViewer}
          onToggleFavorite={photoId => onToggleFavorite(photoId)}
          onAssignBucket={(photoId, bucket) => {
            onAssignBucket(photoId, bucket);
            // Fast workflow: after assigning a bucket, advance to next unassigned
            if (bucket) {
              const unassignedFilter = (p: ProjectPhoto) => !p.bucket && !p.archived;
              const nextUnassigned = navigatePhotos(
                photoId,
                'next',
                orderingResult,
                unassignedFilter,
              );

              if (nextUnassigned) {
                onNavigateViewer(nextUnassigned.id);
                return;
              }

              // No more unassigned, try regular next/prev
              const next = navigatePhotos(photoId, 'next', orderingResult);
              if (next) {
                onNavigateViewer(next.id);
                return;
              }
              const prev = navigatePhotos(photoId, 'prev', orderingResult);
              if (prev) {
                onNavigateViewer(prev.id);
                return;
              }
              onCloseViewer();
            }
          }}
          onAssignDay={(photoId, day) => onAssignDay(photoId, day)}
          selectedBucket={photoData.bucket || undefined}
          selectedDay={photoData.day}
          buckets={buckets}
          dayLabels={dayLabels}
          onShowToast={onShowToast}
        />
      );
    }
  }

  if (selectedDay !== null && sortedGroups) {
    return (
      <div className="space-y-8">
        {sortedGroups.map(group => {
          const groupSorted = group.photos;
          const videos = groupSorted.filter(isVideoPhoto);
          const stills = groupSorted.filter(photo => !isVideoPhoto(photo));
          const hasSplit = videos.length > 0 && stills.length > 0;
          const derivedGroupPhotos = group.photos.filter(p => {
            if (p.day !== selectedDay) return false;
            return getDerivedSubfolderGroup(p, selectedDay) === group.label;
          });
          const hasExplicitOverride = derivedGroupPhotos.some(
            p => p.subfolderOverride !== undefined,
          );
          const isDayRootGroup = group.label === 'Day Root';
          const isMeceGroup = isMeceBucketLabel(group.label);
          const showIngestActions = !isDayRootGroup && !isMeceGroup;

          return (
            <div key={group.label}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">{group.label}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{group.photos.length} items</span>
                  {showIngestActions && (
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-blue-300 hover:text-blue-200"
                        title="Move photos in this subfolder to the day root"
                        onClick={() => {
                          const previousPhotos = photos;
                          const updated = photos.map(p => {
                            if (p.day !== selectedDay) return p;
                            const derived = getDerivedSubfolderGroup(p, selectedDay);
                            if (derived !== group.label) return p;
                            return { ...p, subfolderOverride: null };
                          });
                          onSaveToHistory(updated);
                          const dayLabel =
                            dayLabels[selectedDay] || `Day ${String(selectedDay).padStart(2, '0')}`;
                          onShowToast(`Photos moved to ${dayLabel}.`, 'info', {
                            durationMs: 5000,
                            actionLabel: 'Undo',
                            onAction: () => {
                              onSaveToHistory(previousPhotos);
                            },
                          });
                        }}
                      >
                        Ingest to Day
                      </button>
                      <button
                        className="text-xs text-gray-300 hover:text-gray-100"
                        onClick={() => {
                          const updated = photos.map(p => {
                            if (p.day !== selectedDay) return p;
                            const derived = getDerivedSubfolderGroup(p, selectedDay);
                            if (derived !== group.label) return p;
                            return { ...p, subfolderOverride: derived };
                          });
                          onSaveToHistory(updated);
                        }}
                      >
                        Keep Subfolder
                      </button>
                      {hasExplicitOverride && (
                        <button
                          className="text-xs text-red-300 hover:text-red-200"
                          onClick={() => {
                            const updated = photos.map(p => {
                              if (p.day !== selectedDay) return p;
                              if (derivedGroupPhotos.find(dp => dp.id === p.id)) {
                                return { ...p, subfolderOverride: undefined };
                              }
                              return p;
                            });
                            onSaveToHistory(updated);
                          }}
                        >
                          Undo Ingest
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {hasSplit && (
                <>
                  <div className="mb-2 text-xs uppercase tracking-wider text-gray-500">Photos</div>
                  {renderPhotoGrid(stills, orderedDisplayPhotos, orderedIndex)}
                  <div className="mt-6 mb-2 text-xs uppercase tracking-wider text-gray-500">
                    Videos
                  </div>
                  {renderPhotoGrid(videos, orderedDisplayPhotos, orderedIndex)}
                </>
              )}

              {!hasSplit && renderPhotoGrid(groupSorted, orderedDisplayPhotos, orderedIndex)}
            </div>
          );
        })}
      </div>
    );
  }

  const useVirtualGrid =
    selectedDay === null && orderedDisplayPhotos.length >= VIRTUAL_GRID_THRESHOLD;
  if (useVirtualGrid) {
    return (
      <VirtualPhotoGrid
        photos={orderedDisplayPhotos}
        selectedPhotos={selectedPhotos}
        onSelectPhoto={onSelectPhoto}
        onOpenViewer={onOpenViewer}
      />
    );
  }

  return renderPhotoGrid(orderedDisplayPhotos, orderedDisplayPhotos);
}
