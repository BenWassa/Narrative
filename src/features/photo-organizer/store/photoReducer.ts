import type { ProjectMode, ProjectPhoto } from '../services/projectService';

const MAX_HISTORY = 30;

export interface PhotoEngineState {
  photos: ProjectPhoto[];
  past: ProjectPhoto[][];
  future: ProjectPhoto[][];
}

export type PhotoEngineAction =
  | { type: 'SET_PHOTOS'; payload: ProjectPhoto[]; resetHistory?: boolean }
  | { type: 'COMMIT_PHOTOS'; payload: ProjectPhoto[] }
  | {
      type: 'ASSIGN_BUCKET';
      payload: {
        photoIds: string[];
        bucket: string;
        selectedDay: number | null;
        projectMode?: ProjectMode;
        dayNum?: number | null;
      };
    }
  | { type: 'REMOVE_DAY_ASSIGNMENT'; payload: { photoIds: string[] } }
  | { type: 'ASSIGN_DAY'; payload: { photoIds: string[]; day: number | null } }
  | { type: 'TOGGLE_FAVORITE'; payload: { photoIds: string[] } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' };

export const initialPhotoEngineState: PhotoEngineState = {
  photos: [],
  past: [],
  future: [],
};

function isSamePhotos(a: ProjectPhoto[], b: ProjectPhoto[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function pushPast(state: PhotoEngineState): ProjectPhoto[][] {
  const nextPast = [...state.past, state.photos];
  return nextPast.slice(-MAX_HISTORY);
}

function commit(state: PhotoEngineState, nextPhotos: ProjectPhoto[]): PhotoEngineState {
  if (isSamePhotos(state.photos, nextPhotos)) {
    return state;
  }
  return {
    photos: nextPhotos,
    past: pushPast(state),
    future: [],
  };
}

function assignBucketReducer(
  state: PhotoEngineState,
  payload: {
    photoIds: string[];
    bucket: string;
    selectedDay: number | null;
    projectMode?: ProjectMode;
    dayNum?: number | null;
  },
): PhotoEngineState {
  const { photoIds, bucket, selectedDay, projectMode, dayNum = null } = payload;
  if (photoIds.length === 0) return state;

  const idSet = new Set(photoIds);
  const counters: Record<string, number> = {};

  const nextPhotos = state.photos.map(photo => {
    if (!idSet.has(photo.id)) {
      return photo;
    }

    if (!bucket) {
      return {
        ...photo,
        bucket: null,
        sequence: null,
        archived: false,
        currentName: photo.originalName,
      };
    }

    const day =
      projectMode === 'single_day'
        ? 1
        : dayNum || photo.day || selectedDay || Math.ceil(new Date(photo.timestamp).getDate() / 1);
    const key = `${day}_${bucket}`;
    const existing = state.photos.filter(p => p.day === day && p.bucket === bucket).length;
    const next = (counters[key] || existing) + 1;
    counters[key] = next;

    const newName =
      bucket === 'X'
        ? photo.originalName
        : `D${String(day).padStart(2, '0')}_${bucket}_${String(next).padStart(3, '0')}__${
            photo.originalName
          }`;

    return {
      ...photo,
      bucket,
      day,
      sequence: next,
      currentName: newName,
      archived: bucket === 'X',
    };
  });

  return commit(state, nextPhotos);
}

export function photoReducer(state: PhotoEngineState, action: PhotoEngineAction): PhotoEngineState {
  switch (action.type) {
    case 'SET_PHOTOS': {
      if (action.resetHistory ?? true) {
        return {
          photos: action.payload,
          past: [],
          future: [],
        };
      }
      return commit(state, action.payload);
    }

    case 'COMMIT_PHOTOS':
      return commit(state, action.payload);

    case 'ASSIGN_BUCKET':
      return assignBucketReducer(state, action.payload);

    case 'REMOVE_DAY_ASSIGNMENT': {
      const idSet = new Set(action.payload.photoIds);
      if (idSet.size === 0) return state;
      const nextPhotos = state.photos.map(photo =>
        idSet.has(photo.id) ? { ...photo, day: null } : photo,
      );
      return commit(state, nextPhotos);
    }

    case 'ASSIGN_DAY': {
      const idSet = new Set(action.payload.photoIds);
      if (idSet.size === 0) return state;
      const nextPhotos = state.photos.map(photo =>
        idSet.has(photo.id) ? { ...photo, day: action.payload.day } : photo,
      );
      return commit(state, nextPhotos);
    }

    case 'TOGGLE_FAVORITE': {
      const idSet = new Set(action.payload.photoIds);
      if (idSet.size === 0) return state;
      const nextPhotos = state.photos.map(photo =>
        idSet.has(photo.id) ? { ...photo, favorite: !photo.favorite } : photo,
      );
      return commit(state, nextPhotos);
    }

    case 'UNDO': {
      if (state.past.length === 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      return {
        photos: previous,
        past: state.past.slice(0, -1),
        future: [state.photos, ...state.future],
      };
    }

    case 'REDO': {
      if (state.future.length === 0) {
        return state;
      }
      const [next, ...remainingFuture] = state.future;
      return {
        photos: next,
        past: [...state.past, state.photos].slice(-MAX_HISTORY),
        future: remainingFuture,
      };
    }

    case 'CLEAR_HISTORY':
      return {
        ...state,
        past: [],
        future: [],
      };

    default:
      return state;
  }
}
