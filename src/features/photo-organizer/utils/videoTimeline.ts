import type { ProjectPhoto, ProjectState } from '../services/projectService';
import { sortPhotos } from './photoOrdering';

export interface TimelineMediaItem {
  kind: 'photo' | 'video';
  path: string;
  bucket: string | null;
  order: number;
  caption: string | null;
  duration_sec?: number;
  best_segment_sec?: [number, number] | null;
}

export interface TimelineDay {
  day_number: number;
  date: string | null;
  title: string;
  notes: string;
  media: TimelineMediaItem[];
}

export interface VideoTimeline {
  schema: 1;
  trip: {
    id: string;
    title: string;
    date_range: [string | null, string | null];
  };
  music: {
    path: string;
    target_duration_sec: number;
  };
  days: TimelineDay[];
  render: {
    aspect: '16:9' | '9:16';
    resolution: [number, number];
    template: string;
  };
}

export interface VideoTimelineReadiness {
  unassignedCount: number;
  missingPaths: string[];
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'trip'
  );
}

function toIsoCaptureDate(photo: ProjectPhoto) {
  if (photo.timestampSource !== 'exif') return null;
  const timestamp = photo.timestamp;
  if (!timestamp || Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isVideo(photo: ProjectPhoto) {
  if (photo.mediaKind === 'video' || photo.mimeType?.startsWith('video/')) return true;
  const ext = photo.originalName.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.has(ext);
}

function getMediaPath(photo: ProjectPhoto) {
  return (photo.filePath || photo.currentName || photo.originalName).split(/[\\/]/).join('/');
}

async function pathExists(dirHandle: FileSystemDirectoryHandle, path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return false;

  let current = dirHandle;
  for (const part of parts.slice(0, -1)) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch (_error) {
      return false;
    }
  }

  try {
    await current.getFileHandle(parts[parts.length - 1]);
    return true;
  } catch (_error) {
    return false;
  }
}

export async function checkVideoTimelineReadiness(
  dirHandle: FileSystemDirectoryHandle,
  state: ProjectState,
): Promise<VideoTimelineReadiness> {
  const activePhotos = state.photos.filter(photo => !photo.archived);
  const assignedPhotos = activePhotos.filter(photo => photo.day != null);
  const missingPaths: string[] = [];

  for (const photo of assignedPhotos) {
    const path = getMediaPath(photo);
    if (!(await pathExists(dirHandle, path))) {
      missingPaths.push(path);
    }
  }

  return {
    unassignedCount: activePhotos.length - assignedPhotos.length,
    missingPaths,
  };
}

export function buildVideoTimeline(
  state: ProjectState,
  options: {
    songPath?: string;
    targetDurationSec?: number;
    aspect?: '16:9' | '9:16';
    resolution?: [number, number];
    template?: string;
  } = {},
): VideoTimeline {
  const activePhotos = state.photos.filter(photo => !photo.archived && photo.day != null);
  const sorted = sortPhotos(activePhotos).photos;
  const days = new Map<number, ProjectPhoto[]>();

  sorted.forEach(photo => {
    if (photo.day == null) return;
    const existing = days.get(photo.day) || [];
    existing.push(photo);
    days.set(photo.day, existing);
  });

  const allDates = activePhotos
    .map(photo => toIsoCaptureDate(photo))
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    schema: 1,
    trip: {
      id: slugify(state.projectName || state.rootPath || 'trip'),
      title: state.projectName || 'Untitled Trip',
      date_range: [allDates[0] || null, allDates[allDates.length - 1] || null],
    },
    music: {
      path: options.songPath || '',
      target_duration_sec: options.targetDurationSec || 360,
    },
    days: Array.from(days.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayNumber, photos]) => {
        const dayDates = photos
          .map(photo => toIsoCaptureDate(photo))
          .filter((date): date is string => Boolean(date))
          .sort();
        const title = state.dayLabels?.[dayNumber] || `Day ${dayNumber}`;
        const notes = state.dayNotes?.[dayNumber] || '';

        return {
          day_number: dayNumber,
          date: dayDates[0] || null,
          title,
          notes,
          media: photos.map((photo, index) => {
            const video = isVideo(photo);
            return {
              kind: video ? 'video' : 'photo',
              path: getMediaPath(photo),
              bucket: photo.bucket,
              order: index,
              caption: null,
              ...(video
                ? {
                    duration_sec: photo.durationSec,
                    best_segment_sec: null,
                  }
                : {}),
            };
          }),
        };
      }),
    render: {
      aspect: options.aspect || '16:9',
      resolution: options.resolution || [1920, 1080],
      template: options.template || 'recap-v1',
    },
  };
}

export async function writeVideoTimeline(
  dirHandle: FileSystemDirectoryHandle,
  state: ProjectState,
  options?: Parameters<typeof buildVideoTimeline>[1],
) {
  const timeline = buildVideoTimeline(state, options);
  const fileHandle = await dirHandle.getFileHandle('timeline.json', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(timeline, null, 2));
  await writable.close();
  return timeline;
}
