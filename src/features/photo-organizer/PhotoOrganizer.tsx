import React, { useState, useEffect, useCallback, useRef } from 'react';
import safeLocalStorage from './utils/safeLocalStorage';
import OnboardingModal, { RecentProject } from './OnboardingModal';
import StartScreen from './StartScreen';
import LoadingModal from './ui/LoadingModal';
import { versionManager } from '../../lib/versionManager';
import {
  deleteProject as deleteProjectService,
  ProjectPhoto,
  saveHandle,
  getHandle,
} from './services/projectService';
import { ACTIVE_PROJECT_KEY, RECENT_PROJECTS_KEY } from './constants/projectKeys';
import { useHistory } from './hooks/useHistory';
import { usePhotoSelection } from './hooks/usePhotoSelection';
import { useProjectState } from './hooks/useProjectState';
import { useViewOptions } from './hooks/useViewOptions';
import { useToast } from './hooks/useToast';
import { useExportScript } from './hooks/useExportScript';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDayEditing } from './hooks/useDayEditing';
import { useFolderModel } from './hooks/useFolderModel';
import { useCoverPhoto } from './hooks/useCoverPhoto';
import { usePhotoMutations } from './hooks/usePhotoMutations';
import { useAutoSelection } from './hooks/useAutoSelection';
import { useCoverSelection } from './hooks/useCoverSelection';
import { useOnboardingHandlers } from './hooks/useOnboardingHandlers';
import ProjectHeader from './components/ProjectHeader';
import LeftSidebar from './components/LeftSidebar';
import PhotoGrid from './components/PhotoGrid';
import RightSidebar from './components/RightSidebar';
import HelpModal from './components/HelpModal';
import ExportScriptModal from './components/ExportScriptModal';
import UndoScriptModal from './components/UndoScriptModal';
import Toast from './components/Toast';
import FullscreenOverlay from './components/FullscreenOverlay';
import DebugOverlay from './components/DebugOverlay';
import { sortPhotos } from './utils/photoOrdering';

const MECE_BUCKETS = [
  { key: 'A', label: 'Establishing', color: 'bg-blue-500', description: 'Wide shots, landscapes' },
  { key: 'B', label: 'People', color: 'bg-purple-500', description: 'Portraits, groups' },
  {
    key: 'C',
    label: 'Culture/Detail',
    color: 'bg-green-500',
    description: 'Local life, close-ups',
  },
  { key: 'D', label: 'Action/Moment', color: 'bg-orange-500', description: 'Events, activities' },
  { key: 'E', label: 'Transition', color: 'bg-yellow-500', description: 'Travel, movement' },
  { key: 'M', label: 'Mood/Food', color: 'bg-indigo-500', description: 'Food, mood' },
  { key: 'X', label: 'Archive', color: 'bg-gray-500', description: 'Unwanted shots' },
];
const MECE_BUCKET_KEYS = new Set(MECE_BUCKETS.map(bucket => bucket.key));
const isMeceBucketLabel = (label: string) => {
  const trimmed = label.trim();
  const firstToken = trimmed.split(/[\s_-]+/)[0] || '';
  return MECE_BUCKET_KEYS.has(firstToken.toUpperCase());
};

export default function PhotoOrganizer() {
  const prevThumbnailsRef = useRef<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState(versionManager.getDisplayVersion());
  const debugEnabled = import.meta.env.DEV && safeLocalStorage.get('narrative:debug') === '1';
  const [coverSelectionMode, setCoverSelectionMode] = useState(false);
  const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(false);

  // Hooks for state management
  const { toast, showToast, clearToast } = useToast();
  const {
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
  } = useViewOptions();

  const {
    photos,
    setPhotos,
    projectName,
    setProjectName,
    projectRootPath,
    setProjectRootPath,
    projectFolderLabel,
    projectSettings,
    recentProjects,
    setRecentProjects,
    showOnboarding,
    setShowOnboarding,
    showWelcome,
    setShowWelcome,
    projectError,
    setProjectError,
    permissionRetryProjectId,
    projectNeedingReselection,
    setProjectNeedingReselection,
    loadingProject,
    loadingProgress,
    loadingMessage,
    dayLabels,
    setDayLabels,
    dayContainers,
    loadProject,
    retryProjectPermission,
    handleOnboardingComplete: handleOnboardingCompleteInternal,
  } = useProjectState({
    debugEnabled,
    showToast,
    prevThumbnailsRef,
  });

  const { setHistory, setHistoryIndex, persistState, saveToHistory, undo, redo } = useHistory({
    photos,
    setPhotos,
    projectRootPath,
    projectName,
    projectFolderLabel,
    projectSettings,
    dayLabels,
    prevThumbnailsRef,
  });

  const {
    showExportScript,
    exportScriptText,
    exportCopyStatus,
    openExportScriptModal,
    closeExportScriptModal,
    copyExportScript,
    downloadExportScript,
    regenerateScript,
    getDetectedProjectPath,
    showUndoScript,
    undoScriptText,
    openUndoScriptModal,
    closeUndoScriptModal,
    downloadUndoScript,
    hasExportManifest,
  } = useExportScript(photos, dayLabels, projectSettings, projectRootPath || undefined);

  const { setCoverForPhotoId } = useCoverPhoto({
    photos,
    projectRootPath,
    projectName,
    projectFolderLabel,
    setRecentProjects,
    showToast,
  });

  // Fetch current version on mount for robustness
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await versionManager.getCurrentVersion();
        setCurrentVersion(`v${version}`);
      } catch (error) {
        // Keep build-time version as fallback
        if (debugEnabled) {
          console.warn('Failed to fetch runtime version:', error);
        }
      }
    };

    fetchVersion();
  }, [debugEnabled]);

  const {
    days,
    visibleDays,
    normalizePath,
    sortFolders,
    getDerivedSubfolderGroup,
    getSubfolderGroup,
    rootGroups,
    displayRootGroups,
    filteredPhotos,
  } = useFolderModel({
    photos,
    dayLabels,
    dayContainers,
    projectSettings,
    debugEnabled,
    currentView,
    selectedDay,
    selectedRootFolder,
    hideAssigned,
  });

  const isVideoPhoto = useCallback((photo: ProjectPhoto) => {
    if (photo.mimeType?.startsWith('video/')) return true;
    const ext = photo.originalName.split('.').pop()?.toLowerCase() || '';
    return ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
  }, []);

  const orderingResult = React.useMemo(() => {
    const rootPhotosForOrdering =
      currentView === 'folders' && selectedRootFolder
        ? (rootGroups.find(group => group[0] === selectedRootFolder)?.[1] || []).filter(
            photo => !photo.archived,
          )
        : null;
    const displayPhotosForOrdering = rootPhotosForOrdering ?? filteredPhotos;

    return sortPhotos(displayPhotosForOrdering, {
      groupBy: selectedDay !== null ? 'subfolder' : null,
      separateVideos: true,
      selectedDay,
      getSubfolderGroup,
      isVideo: isVideoPhoto,
    });
  }, [
    currentView,
    selectedRootFolder,
    rootGroups,
    filteredPhotos,
    selectedDay,
    getSubfolderGroup,
    isVideoPhoto,
  ]);

  const {
    editingDay,
    editingDayName,
    setEditingDayName,
    startEditingDay,
    saveDayName,
    cancelEditingDay,
  } = useDayEditing({
    photos,
    persistState,
    setDayLabels,
  });

  const {
    selectedPhotos,
    setSelectedPhotos,
    focusedPhoto,
    setFocusedPhoto,
    setLastSelectedIndex,
    lastSelectedIndexRef,
    resetSelection,
  } = usePhotoSelection({
    filteredPhotos,
    coverSelectionMode,
    setCoverForPhotoId,
    setCoverSelectionMode,
  });

  const { setCoverFromSelection } = useCoverSelection({
    projectRootPath,
    selectedPhotos,
    showToast,
    setCoverForPhotoId,
  });

  const { handleOnboardingComplete } = useOnboardingHandlers({
    handleOnboardingCompleteInternal,
    setHistory,
    setHistoryIndex,
    resetSelection,
    setSelectedDay,
    setSelectedRootFolder,
    setCurrentView,
  });

  const clearSelectedDay = useCallback(() => {
    setSelectedDay(null);
    setSelectedRootFolder(null);
  }, [setSelectedDay, setSelectedRootFolder]);

  useAutoSelection({
    projectRootPath,
    photosLength: photos.length,
    selectedRootFolder,
    selectedDay,
    currentView,
    days,
    rootGroups,
    setSelectedDay,
    setSelectedRootFolder,
  });

  const { assignBucket, removeDayAssignment, toggleFavorite } = usePhotoMutations({
    photos,
    saveToHistory,
    selectedDay,
  });

  // Keyboard shortcuts
  // Keyboard shortcuts handler
  useKeyboardShortcuts({
    selectedPhotos,
    focusedPhoto,
    filteredPhotos,
    orderingResult,
    fullscreenPhoto,
    showHelp,
    showExportScript,
    showWelcome,
    showOnboarding,
    coverSelectionMode,
    hideAssigned,
    MECE_BUCKETS,
    onAssignBucket: assignBucket,
    onToggleFavorite: toggleFavorite,
    onUndo: undo,
    onRedo: redo,
    onSetFocusedPhoto: setFocusedPhoto,
    onSetSelectedPhotos: setSelectedPhotos,
    onSetLastSelectedIndex: setLastSelectedIndex,
    onSetFullscreenPhoto: setFullscreenPhoto,
    onSetShowHelp: setShowHelp,
    onSetCoverSelectionMode: setCoverSelectionMode,
    onSetHideAssigned: setHideAssigned,
    onToggleDebugOverlay: () => setDebugOverlayEnabled(prev => !prev),
    onShowToast: showToast,
    lastSelectedIndexRef,
  });

  // Stats
  const stats = React.useMemo(
    () => ({
      total: photos.length,
      sorted: photos.filter(p => p.bucket && !p.archived).length,
      unsorted: photos.filter(p => !p.bucket && !p.archived).length,
      archived: photos.filter(p => p.archived).length,
      favorites: photos.filter(p => p.favorite).length,
      root: photos.filter(p => p.day === null && !p.archived).length,
    }),
    [photos],
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <ProjectHeader
        showWelcome={showWelcome}
        projectName={projectName}
        stats={stats}
        currentVersion={currentVersion}
        coverSelectionMode={coverSelectionMode}
        selectedPhotosCount={selectedPhotos.size}
        projectRootPath={projectRootPath}
        currentView={currentView}
        hideAssigned={hideAssigned}
        recentProjects={recentProjects}
        projectError={projectError}
        permissionRetryProjectId={permissionRetryProjectId}
        loadingProject={loadingProject}
        hasExportManifest={hasExportManifest()}
        onMainMenu={() => {
          setShowOnboarding(false);
          setProjectError(null);
          setShowWelcome(true);
          safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
        }}
        onStartCoverSelection={() => {
          setCoverSelectionMode(true);
          showToast(
            'Select a photo to set as cover. Click a photo to set, or press Esc to cancel.',
            'info',
          );
        }}
        onUseCoverSelection={async () => {
          await setCoverFromSelection();
          setCoverSelectionMode(false);
        }}
        onCancelCoverSelection={() => {
          setCoverSelectionMode(false);
          showToast('Cover selection cancelled.');
        }}
        onSelectRecentProject={projectId => {
          loadProject(projectId);
        }}
        onOpenProject={() => {
          setShowOnboarding(true);
        }}
        onDeleteProject={async () => {
          if (!projectRootPath) return;
          const confirmed = window.confirm(
            `Delete project '${projectName}'? This will remove local state and stored folder access. This cannot be undone.`,
          );
          if (!confirmed) return;
          try {
            await deleteProjectService(projectRootPath);
          } catch (err) {
            showToast('Failed to delete project.', 'error');
            return;
          }

          try {
            const raw = safeLocalStorage.get(RECENT_PROJECTS_KEY);
            const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
            const filtered = parsed.filter(p => p.projectId !== projectRootPath);
            safeLocalStorage.set(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
            setRecentProjects(filtered);
          } catch (e) {
            // ignore
          }

          safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
          setPhotos([]);
          setProjectRootPath(null);
          setProjectName('No Project');
          setShowWelcome(true);
          showToast('Project deleted.');
        }}
        onImportTrip={() => {
          setProjectError(null);
          setShowOnboarding(true);
        }}
        onExportScript={openExportScriptModal}
        onUndoExport={openUndoScriptModal}
        onShowHelp={() => setShowHelp(true)}
        onRetryPermission={retryProjectPermission}
        onChangeView={viewId => setCurrentView(viewId)}
        onToggleHideAssigned={() => setHideAssigned(prev => !prev)}
        onRememberFoldersViewState={() => {
          foldersViewStateRef.current = { selectedRootFolder, selectedDay };
        }}
        onRestoreFoldersViewState={() => {
          setSelectedRootFolder(foldersViewStateRef.current.selectedRootFolder);
          setSelectedDay(foldersViewStateRef.current.selectedDay);
        }}
        onClearDaySelection={() => {
          setSelectedDay(null);
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar
          currentView={currentView}
          sidebarCollapsed={sidebarCollapsed}
          onCollapseSidebar={() => setSidebarCollapsed(true)}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          visibleDays={visibleDays}
          selectedDay={selectedDay}
          selectedRootFolder={selectedRootFolder}
          onSelectDay={setSelectedDay}
          onSelectRootFolder={setSelectedRootFolder}
          editingDay={editingDay}
          editingDayName={editingDayName}
          onChangeEditingDayName={setEditingDayName}
          onStartEditingDay={startEditingDay}
          onSaveDayName={saveDayName}
          onCancelEditingDay={cancelEditingDay}
          onClearSelectedDay={clearSelectedDay}
          days={days}
          dayLabels={dayLabels}
          dayContainers={dayContainers}
          photos={photos}
          normalizePath={normalizePath}
          rootGroups={rootGroups}
          displayRootGroups={displayRootGroups}
          sortFolders={sortFolders}
          projectSettings={projectSettings}
          debugEnabled={debugEnabled}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <PhotoGrid
              loadingProject={loadingProject}
              currentView={currentView}
              selectedDay={selectedDay}
              selectedRootFolder={selectedRootFolder}
              photos={photos}
              rootGroups={rootGroups}
              filteredPhotos={filteredPhotos}
              selectedPhotos={selectedPhotos}
              galleryViewPhoto={galleryViewPhoto}
              dayLabels={dayLabels}
              buckets={MECE_BUCKETS}
              onSelectPhoto={photoId => setSelectedPhotos(new Set([photoId]))}
              onOpenViewer={photoId => setGalleryViewPhoto(photoId)}
              onCloseViewer={() => setGalleryViewPhoto(null)}
              onNavigateViewer={photoId => setGalleryViewPhoto(photoId)}
              onToggleFavorite={photoId => {
                setPhotos(prev =>
                  prev.map(p => (p.id === photoId ? { ...p, favorite: !p.favorite } : p)),
                );
                persistState(
                  photos.map(p => (p.id === photoId ? { ...p, favorite: !p.favorite } : p)),
                );
              }}
              onAssignBucket={(photoId, bucket) => assignBucket(photoId, bucket)}
              onAssignDay={(photoId, day) => {
                setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, day } : p)));
                persistState(photos.map(p => (p.id === photoId ? { ...p, day } : p)));
              }}
              onSaveToHistory={saveToHistory}
              onShowToast={showToast}
              getSubfolderGroup={getSubfolderGroup}
              getDerivedSubfolderGroup={getDerivedSubfolderGroup}
              isVideoPhoto={isVideoPhoto}
              isMeceBucketLabel={isMeceBucketLabel}
            />
          </div>
        </main>

        {selectedPhotos.size > 0 && !fullscreenPhoto && (
          <RightSidebar
            selectedPhotos={selectedPhotos}
            photos={photos}
            days={days}
            buckets={MECE_BUCKETS}
            onSaveToHistory={saveToHistory}
            onPersistState={persistState}
            onSetDayLabels={setDayLabels}
            onSetSelectedDay={setSelectedDay}
            onSetCurrentView={setCurrentView}
            onSetSelectedPhotos={setSelectedPhotos}
            onRemoveDayAssignment={removeDayAssignment}
            onAssignBucket={assignBucket}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>

      {/* Fullscreen View */}
      <FullscreenOverlay
        photoId={fullscreenPhoto}
        photos={photos}
        onClose={() => setFullscreenPhoto(null)}
      />

      {/* Export Script Modal */}
      <ExportScriptModal
        isOpen={showExportScript}
        scriptText={exportScriptText}
        copyStatus={exportCopyStatus}
        detectedProjectPath={getDetectedProjectPath()}
        onClose={closeExportScriptModal}
        onCopyScript={copyExportScript}
        onDownloadScript={downloadExportScript}
        onRegenerateScript={regenerateScript}
      />

      {/* Undo Script Modal */}
      <UndoScriptModal
        isOpen={showUndoScript}
        scriptText={undoScriptText}
        onClose={closeUndoScriptModal}
        onDownloadScript={downloadUndoScript}
      />

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} buckets={MECE_BUCKETS} onClose={() => setShowHelp(false)} />

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={clearToast} />

      <DebugOverlay
        enabled={debugOverlayEnabled}
        photos={photos.length}
        filteredPhotos={orderingResult.photos.length}
        selectedPhotos={selectedPhotos.size}
        currentView={currentView}
      />

      {/* StartScreen - only show when welcome screen is active */}
      {showWelcome && (
        <StartScreen
          isOpen={showWelcome}
          onClose={() => {
            if (!projectRootPath) return;
            setShowWelcome(false);
            safeLocalStorage.set(ACTIVE_PROJECT_KEY, projectRootPath);
          }}
          onCreateComplete={handleOnboardingComplete}
          onOpenProject={async rootPath => {
            setProjectError(null);
            // Check if File System API is available before attempting to load (skip in test environment)
            const isTest =
              typeof globalThis !== 'undefined' &&
              ((globalThis as any).vitest || (globalThis as any).__APP_VERSION__ === '0.0.0');
            if (!isTest && !('showDirectoryPicker' in window)) {
              setProjectError(
                'This app requires the File System Access API, which is not available in this browser environment. Please use a compatible browser like Chrome or Edge.',
              );
              return;
            }

            // In test environment, always try to load directly
            if (isTest) {
              loadProject(rootPath);
              return;
            }

            // Check if project has a valid handle
            try {
              const handle = await getHandle(rootPath);
              if (!handle) {
                // No stored handle — try to reselect immediately (this click is a user gesture)
                try {
                  const picked = await (window as any).showDirectoryPicker();
                  await saveHandle(rootPath, picked);
                  // Now load using the newly saved handle
                  loadProject(rootPath);
                  return;
                } catch (pickErr) {
                  // User cancelled or an error occurred — fall back to onboarding modal to guide reselection
                  console.warn('Folder re-selection cancelled or failed:', pickErr);
                  setProjectNeedingReselection(rootPath);
                  setShowOnboarding(true);
                  return;
                }
              }

              // Handle exists, try to load the project
              loadProject(rootPath);
            } catch (err) {
              // Error checking handle, fall back to onboarding modal
              console.warn('Error checking stored handle on project open:', err);
              setProjectNeedingReselection(rootPath);
              setShowOnboarding(true);
            }
          }}
          recentProjects={recentProjects}
          canClose={Boolean(projectRootPath)}
          errorMessage={projectError}
        />
      )}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setProjectNeedingReselection(null);
        }}
        onComplete={state => handleOnboardingComplete(state, projectNeedingReselection)}
        recentProjects={recentProjects}
        onSelectRecent={rootPath => {
          setProjectError(null);
          setProjectNeedingReselection(null);
          setShowOnboarding(false);
          loadProject(rootPath);
        }}
      />

      {/* Loading Modal */}
      <LoadingModal
        isOpen={loadingProject}
        title="Loading Project"
        message={loadingMessage}
        progress={loadingProgress}
        showProgressBar={true}
      />
    </div>
  );
}
