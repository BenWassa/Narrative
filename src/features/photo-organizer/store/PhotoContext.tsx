import React, { createContext, useContext, useMemo, useReducer } from 'react';

import {
  initialPhotoEngineState,
  photoReducer,
  type PhotoEngineAction,
  type PhotoEngineState,
} from './photoReducer';

interface PhotoContextType {
  state: PhotoEngineState;
  dispatch: React.Dispatch<PhotoEngineAction>;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);

export function PhotoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(photoReducer, initialPhotoEngineState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <PhotoContext.Provider value={value}>{children}</PhotoContext.Provider>;
}

export function usePhotoContext() {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error('usePhotoContext must be used within a PhotoProvider');
  }
  return context;
}

export function useOptionalPhotoContext() {
  return useContext(PhotoContext);
}
