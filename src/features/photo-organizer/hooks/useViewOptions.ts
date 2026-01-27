import { useRef, useState } from 'react';

export function useViewOptions() {
  const [currentView, setCurrentView] = useState('folders');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hideAssigned, setHideAssigned] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [galleryViewPhoto, setGalleryViewPhoto] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedRootFolder, setSelectedRootFolder] = useState<string | null>(null);

  const foldersViewStateRef = useRef<{
    selectedRootFolder: string | null;
    selectedDay: number | null;
  }>({ selectedRootFolder: null, selectedDay: null });

  return {
    currentView,
    setCurrentView,
    sidebarCollapsed,
    setSidebarCollapsed,
    hideAssigned,
    setHideAssigned,
    showHelp,
    setShowHelp,
    galleryViewPhoto,
    setGalleryViewPhoto,
    fullscreenPhoto,
    setFullscreenPhoto,
    selectedDay,
    setSelectedDay,
    selectedRootFolder,
    setSelectedRootFolder,
    foldersViewStateRef,
  };
}
