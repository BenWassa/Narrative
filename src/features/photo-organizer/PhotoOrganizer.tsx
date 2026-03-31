import React, { useState, useEffect, useCallback, useRef } from 'react';
import safeLocalStorage from './utils/safeLocalStorage';
import OnboardingModal, { RecentProject } from './OnboardingModal';
import StartScreen from './StartScreen';
import LoadingModal from './ui/LoadingModal';
import { versionManager } from '../../lib/versionManager';
import {
  buildProjectTree,
  convertProjectToMultiDay,
  deleteProject as deleteProjectService,
  deleteProjectFolder,
  ProjectPhoto,
  ProjectTreeNode,
  type ProjectState,
  renameProjectFolder,
  saveState,
  saveHandle,
  getHandle,
} from './services/projectService';
import { ACTIVE_PROJECT_KEY, RECENT_PROJECTS_KEY } from './constants/projectKeys';
import { MECE_BUCKETS, isMeceBucketLabel } from './constants/meceBuckets';
import { usePhotoSelection } from './hooks/usePhotoSelection';
import { useProjectState } from './hooks/useProjectState';
import { useViewOptions } from './hooks/useViewOptions';
import { useToast } from './hooks/useToast';
import { useExportScript } from './hooks/useExportScript';
import { useDirectProcessing } from './hooks/useDirectProcessing';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCoverPhoto } from './hooks/useCoverPhoto';
import { useCoverSelection } from './hooks/useCoverSelection';
import { useOnboardingHandlers } from './hooks/useOnboardingHandlers';
import ProjectHeader from './components/ProjectHeader';
import LeftSidebar from './components/LeftSidebar';
import PhotoGrid from './components/PhotoGrid';
import RightSidebar from './components/RightSidebar';
import ViewContextBar from './components/ViewContextBar';
import HelpModal from './components/HelpModal';
import ExportScriptModal from './components/ExportScriptModal';
import DirectProcessingModal from './components/DirectProcessingModal';
import UndoScriptModal from './components/UndoScriptModal';
import Toast from './components/Toast';
import FullscreenOverlay from './components/FullscreenOverlay';
import DebugOverlay from './components/DebugOverlay';
import { sortPhotos } from './utils/photoOrdering';

const ROOT_MEDIA_PATH = '__ROOT_MEDIA__';

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
    selectedTreePath,
    setSelectedTreePath,
    foldersViewStateRef,
  } = useViewOptions();

  const {
    photos,
    setPhotos,
    commitPhotos,
    photoDispatch,
    undo,
    redo,
    clearPhotoHistory,
    persistState,
    projectName,
    setProjectName,
    projectRootPath,
    setProjectRootPath,
    projectFolderLabel,
    projectSettings,
    projectMode,
    ingested,
    sourceRoot,
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

  const {
    showExportScript,
    exportScriptText,
    exportCopyStatus,
    openExportScriptModal,
    closeExportScriptModal,
    copyExportScript,
    downloadExportScript,
    regenerateScript,
    exportStructureMode,
    updateStructureMode,
    getDetectedProjectPath,
    showUndoScript,
    undoScriptText,
    openUndoScriptModal,
    closeUndoScriptModal,
    downloadUndoScript,
    hasExportManifest,
    refreshManifest,
  } = useExportScript(
    photos,
    dayLabels,
    projectSettings,
    projectRootPath || undefined,
    projectMode,
    ingested,
    sourceRoot,
  );

  const {
    showDirectProcessing,
    directProcessingState,
    plan: directPlan,
    progress: directProgress,
    result: directResult,
    error: directProcessingError,
    destinationLabel,
    structureMode: directStructureMode,
    deleteAfterVerify,
    toggleDeleteAfterVerify,
    openDirectProcessing,
    confirmExecution,
    closeDirectProcessing,
    updateStructureMode: updateDirectStructureMode,
    canUndoDirectProcess,
    undoLastDirectProcess,
  } = useDirectProcessing(
    photos,
    dayLabels,
    projectSettings,
    projectRootPath ?? null,
    projectMode,
    ingested,
    sourceRoot,
  );

  const { setCoverForPhotoId } = useCoverPhoto({
    photos,
    projectRootPath,
    projectName,
    projectFolderLabel,
    setRecentProjects,
    showToast,
  });

  const lastDirectSyncRef = useRef<number | null>(null);

  // Refresh manifest and persist canonical file paths when direct processing completes
  useEffect(() => {
    if (!directResult || !directPlan || !projectRootPath) {
      return;
    }

    if (lastDirectSyncRef.current === directResult.manifest.timestamp) {
      return;
    }
    lastDirectSyncRef.current = directResult.manifest.timestamp;

    const syncDirectProcessing = async () => {
      const copiedBySourcePath = new Map(
        directPlan.operations
          .filter(operation =>
            directResult.executionLog.operations.some(
              log => (log.status === 'copied' || log.status === 'verified' || log.status === 'deleted') && log.sourcePath === (operation.sourceRelativePath.startsWith('/') ? operation.sourceRelativePath.slice(1) : operation.sourceRelativePath),
            ),
          )
          .map(operation => [operation.sourceRelativePath.startsWith('/') ? operation.sourceRelativePath.slice(1) : operation.sourceRelativePath, operation]),
      );

      refreshManifest();

      if (copiedBySourcePath.size === 0) {
        return;
      }

      const nextPhotos = photos.map(photo => {
        if (!photo.filePath) return photo;
        const normalizedFilePath = photo.filePath.startsWith('/') ? photo.filePath.slice(1) : photo.filePath;
        const operation = copiedBySourcePath.get(normalizedFilePath);
        if (!operation) return photo;

        return {
          ...photo,
          filePath: operation.destinationRelativePath,
          currentName: operation.currentName,
          day: operation.photo.day,
          bucket: operation.photo.bucket,
          detectedDay: operation.photo.day,
          detectedBucket: operation.photo.bucket,
          isPreOrganized: true,
          organizationConfidence: 'high' as const,
        };
      });

      console.log('Syncing direct processing results. Next photos count:', nextPhotos.length);
      console.log('Inbox folder path:', projectSettings.folderStructure.inboxFolder);
      
      const inboxPhotosBefore = photos.filter(p => p.filePath?.includes(projectSettings.folderStructure.inboxFolder));
      const inboxPhotosAfter = nextPhotos.filter(p => p.filePath?.includes(projectSettings.folderStructure.inboxFolder));
      console.log(`Inbox photos: ${inboxPhotosBefore.length} -> ${inboxPhotosAfter.length}`);

      const nextState: ProjectState = {
        projectName,
        rootPath: projectFolderLabel || projectRootPath,
        photos: nextPhotos,
        settings: projectSettings,
        projectMode,
        dayLabels: dayLabels as any,
        dayContainers: dayContainers || [],
        lastModified: Date.now(),
        ingested,
        sourceRoot,
      };

      setPhotos(nextPhotos);
      await saveState(projectRootPath, nextState);
      await loadProject(projectRootPath, { addRecent: false });
    };

    syncDirectProcessing().catch(error => {
      console.warn('Failed to sync project after direct processing:', error);
    });
  }, [
    directResult,
    directPlan,
    projectRootPath,
    refreshManifest,
    photos,
    projectName,
    projectFolderLabel,
    projectSettings,
    projectMode,
    dayLabels,
    dayContainers,
    ingested,
    sourceRoot,
    setPhotos,
    loadProject,
  ]);

  const handleUndoProcessing = useCallback(async () => {
    if (canUndoDirectProcess()) {
      await undoLastDirectProcess();
      refreshManifest();
      if (projectRootPath) {
        await loadProject(projectRootPath, { addRecent: false });
      }
      showToast('Direct processing was undone.', 'info');
      return;
    }

    openUndoScriptModal();
  }, [
    canUndoDirectProcess,
    undoLastDirectProcess,
    refreshManifest,
    projectRootPath,
    loadProject,
    showToast,
    openUndoScriptModal,
  ]);

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
  const [projectTree, setProjectTree] = useState<ProjectTreeNode[]>([]);

  const refreshProjectTree = useCallback(async () => {
    if (!projectRootPath) {
      setProjectTree([]);
      return;
    }
    const handle = await getHandle(projectRootPath);
    if (!handle) {
      setProjectTree([]);
      return;
    }
    const nextTree = await buildProjectTree(handle, projectMode, projectSettings, photos);
    setProjectTree(nextTree);
  }, [projectRootPath, projectMode, projectSettings, photos]);

  useEffect(() => {
    refreshProjectTree().catch(error => {
      console.warn('Failed to refresh project tree:', error);
    });
  }, [refreshProjectTree]);

  const findTreeNode = useCallback(
    (nodes: ProjectTreeNode[], targetPath: string | null): ProjectTreeNode | null => {
      if (!targetPath) return null;
      for (const node of nodes) {
        if (node.relativePath === targetPath) return node;
        const found = findTreeNode(node.children, targetPath);
        if (found) return found;
      }
      return null;
    },
    [],
  );

  const selectedTreeNode = React.useMemo(
    () => findTreeNode(projectTree, selectedTreePath),
    [findTreeNode, projectTree, selectedTreePath],
  );

  const normalizePath = useCallback(
    (value: string) => value.split(/[\\/]/).filter(Boolean).join('/'),
    [],
  );

  const days = React.useMemo(
    () =>
      Array.from(
        photos.reduce((map, photo) => {
          if (photo.day != null && !photo.archived) {
            if (!map.has(photo.day)) map.set(photo.day, []);
            map.get(photo.day)!.push(photo);
          }
          return map;
        }, new Map<number, ProjectPhoto[]>()),
      ).sort((a, b) => a[0] - b[0]),
    [photos],
  );

  const filteredPhotos = React.useMemo(() => {
    if (currentView === 'archive') {
      return photos.filter(photo => photo.archived);
    }
    if (currentView === 'review') {
      return photos.filter(photo => Boolean(photo.bucket) && !photo.archived);
    }
    if (currentView !== 'folders' || !selectedTreePath) {
      return [];
    }

    const selectedPath = normalizePath(selectedTreePath);
    if (selectedPath === ROOT_MEDIA_PATH) {
      return photos.filter(photo => {
        if (photo.archived) return false;
        const photoPath = normalizePath(photo.filePath || '');
        return Boolean(photoPath) && !photoPath.includes('/');
      });
    }

    const archiveFolderPath = normalizePath(projectSettings.folderStructure.archiveFolder || '');
    const viewingArchiveFolder =
      Boolean(archiveFolderPath) &&
      (selectedPath === archiveFolderPath || selectedPath.startsWith(`${archiveFolderPath}/`));

    return photos.filter(photo => {
      const photoPath = normalizePath(photo.filePath || '');
      if (!photoPath) return false;
      if (viewingArchiveFolder ? !photo.archived : photo.archived) return false;
      return photoPath === selectedPath || photoPath.startsWith(`${selectedPath}/`);
    });
  }, [currentView, normalizePath, photos, projectSettings.folderStructure.archiveFolder, selectedTreePath]);

  const rootMediaPhotoCount = React.useMemo(
    () =>
      photos.filter(photo => {
        if (photo.archived) return false;
        const photoPath = normalizePath(photo.filePath || '');
        return Boolean(photoPath) && !photoPath.includes('/');
      }).length,
    [normalizePath, photos],
  );

  const selectedDayForGrouping = React.useMemo(
    () =>
      selectedTreeNode?.kind === 'day'
        ? filteredPhotos.find(photo => photo.day != null)?.day ?? null
        : null,
    [filteredPhotos, selectedTreeNode],
  );

  const getDerivedSubfolderGroup = useCallback(
    (photo: ProjectPhoto, dayNumber: number | null) => {
      if (dayNumber == null || !photo.filePath) return 'Day Root';
      const dayLabel = dayLabels[dayNumber] || `Day ${String(dayNumber).padStart(2, '0')}`;
      const parts = normalizePath(photo.filePath).split('/');
      const dayIndex = parts.findIndex(part => part === dayLabel);
      if (dayIndex === -1) return 'Day Root';
      const nextPart = parts[dayIndex + 1];
      if (!nextPart || /^[A-Z]_/.test(nextPart)) return 'Day Root';
      return nextPart;
    },
    [dayLabels, normalizePath],
  );

  const getSubfolderGroup = useCallback(
    (photo: ProjectPhoto, dayNumber: number | null) => {
      if (photo.subfolderOverride === null) return 'Day Root';
      if (typeof photo.subfolderOverride === 'string') return photo.subfolderOverride;
      return getDerivedSubfolderGroup(photo, dayNumber);
    },
    [getDerivedSubfolderGroup],
  );

  const isVideoPhoto = useCallback((photo: ProjectPhoto) => {
    if (photo.mimeType?.startsWith('video/')) return true;
    const ext = photo.originalName.split('.').pop()?.toLowerCase() || '';
    return ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
  }, []);

  const orderingResult = React.useMemo(() => {
    return sortPhotos(filteredPhotos, {
      groupBy: selectedDayForGrouping !== null ? 'subfolder' : null,
      separateVideos: true,
      selectedDay: selectedDayForGrouping,
      getSubfolderGroup,
      isVideo: isVideoPhoto,
    });
  }, [filteredPhotos, selectedDayForGrouping, getSubfolderGroup, isVideoPhoto]);

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
    clearPhotoHistory,
    resetSelection,
    setSelectedTreePath,
    setCurrentView,
  });

  useEffect(() => {
    if (currentView !== 'folders' || selectedTreePath) {
      return;
    }
    if (rootMediaPhotoCount > 0) {
      setSelectedTreePath(ROOT_MEDIA_PATH);
      return;
    }
    if (projectTree.length === 0) {
      return;
    }
    const inboxFolder = projectSettings.folderStructure.inboxFolder || 'Inbox';
    const inboxNode = projectTree.find(node => node.relativePath === inboxFolder);
    setSelectedTreePath(inboxNode?.relativePath || projectTree[0].relativePath);
  }, [
    currentView,
    projectSettings.folderStructure.inboxFolder,
    projectTree,
    rootMediaPhotoCount,
    selectedTreePath,
    setSelectedTreePath,
  ]);

  const assignBucket = useCallback(
    (photoIds: string | string[], bucket: string, dayNum: number | null = null) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      photoDispatch({
        type: 'ASSIGN_BUCKET',
        payload: {
          photoIds: ids,
          bucket,
          selectedDay: selectedDayForGrouping,
          projectMode,
          dayNum,
        },
      });
    },
    [photoDispatch, selectedDayForGrouping, projectMode],
  );

  const removeDayAssignment = useCallback(
    (photoIds: string | string[]) => {
      const ids = Array.isArray(photoIds) ? photoIds : [photoIds];
      photoDispatch({ type: 'REMOVE_DAY_ASSIGNMENT', payload: { photoIds: ids } });
    },
    [photoDispatch],
  );

  const currentProjectState = React.useMemo<ProjectState>(
    () => ({
      projectName,
      rootPath: projectFolderLabel || projectRootPath || projectName,
      photos,
      settings: projectSettings,
      projectMode,
      dayLabels: dayLabels as any,
      dayContainers: dayContainers || [],
      lastModified: Date.now(),
      ingested,
      sourceRoot,
    }),
    [
      dayContainers,
      dayLabels,
      ingested,
      photos,
      projectFolderLabel,
      projectMode,
      projectName,
      projectRootPath,
      projectSettings,
      sourceRoot,
    ],
  );

  const handleRenameFolder = useCallback(
    async (path: string, newName: string) => {
      if (!projectRootPath) return;
      await renameProjectFolder(projectRootPath, currentProjectState, path, newName);
      setSelectedTreePath(null);
      await loadProject(projectRootPath, { addRecent: false });
      showToast(`Renamed ${path}.`, 'info');
    },
    [currentProjectState, loadProject, projectRootPath, setSelectedTreePath, showToast],
  );

  const handleDeleteFolder = useCallback(
    async (path: string) => {
      if (!projectRootPath) return;
      await deleteProjectFolder(projectRootPath, currentProjectState, path);
      setSelectedTreePath(null);
      await loadProject(projectRootPath, { addRecent: false });
      showToast(`Deleted ${path}.`, 'info');
    },
    [currentProjectState, loadProject, projectRootPath, setSelectedTreePath, showToast],
  );

  const handleConvertToMultiDay = useCallback(async () => {
    if (!projectRootPath) return;
    const confirmed = window.confirm(
      'Convert this single-day project to multi-day? Root bucket folders will be moved into Day 01.',
    );
    if (!confirmed) return;
    await convertProjectToMultiDay(projectRootPath, currentProjectState);
    setSelectedTreePath(null);
    await loadProject(projectRootPath, { addRecent: false });
    showToast('Project converted to multi-day.', 'info');
  }, [currentProjectState, loadProject, projectRootPath, setSelectedTreePath, showToast]);

  const isViewerOpen = galleryViewPhoto !== null;

  // Keyboard shortcuts
  // Keyboard shortcuts handler
  useKeyboardShortcuts(
    {
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
    },
    !isViewerOpen,
  );

  // Stats
  const stats = React.useMemo(
    () => ({
      total: photos.length,
      sorted: photos.filter(p => p.bucket && !p.archived).length,
      unsorted: photos.filter(p => !p.bucket && !p.archived).length,
      archived: photos.filter(p => p.archived).length,
      root: photos.filter(p => !p.bucket && !p.archived).length,
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
        hasDirectProcessingUndo={canUndoDirectProcess()}
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
        onDirectProcess={openDirectProcessing}
        onUndoExport={handleUndoProcessing}
        onShowHelp={() => setShowHelp(true)}
        onRetryPermission={retryProjectPermission}
        onChangeView={viewId => setCurrentView(viewId)}
        onToggleHideAssigned={() => setHideAssigned(prev => !prev)}
        onRememberFoldersViewState={() => {
          foldersViewStateRef.current = { selectedTreePath };
        }}
        onRestoreFoldersViewState={() => {
          setSelectedTreePath(foldersViewStateRef.current.selectedTreePath);
        }}
        onClearDaySelection={() => {
          setSelectedTreePath(null);
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar
          currentView={currentView}
          sidebarCollapsed={sidebarCollapsed}
          onCollapseSidebar={() => setSidebarCollapsed(true)}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          tree={projectTree}
          selectedTreePath={selectedTreePath}
          onSelectTreePath={setSelectedTreePath}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          projectMode={projectMode}
          projectSettings={projectSettings}
          rootMediaPhotoCount={rootMediaPhotoCount}
          rootMediaPath={ROOT_MEDIA_PATH}
          onConvertToMultiDay={projectMode === 'single_day' ? handleConvertToMultiDay : undefined}
        />

        <main className="flex-1 overflow-y-auto">
          <ViewContextBar
            currentView={currentView}
            selectedTreePath={selectedTreePath}
            rootMediaPath={ROOT_MEDIA_PATH}
            projectMode={projectMode}
            hideAssigned={hideAssigned}
          />
          <div className="p-6">
            <PhotoGrid
              loadingProject={loadingProject}
              currentView={currentView}
              selectedTreePath={selectedTreePath}
              selectedDayForGrouping={selectedDayForGrouping}
              selectedNodeKind={selectedTreeNode?.kind ?? null}
              photos={photos}
              filteredPhotos={filteredPhotos}
              selectedPhotos={selectedPhotos}
              galleryViewPhoto={galleryViewPhoto}
              dayLabels={dayLabels}
              buckets={MECE_BUCKETS}
              onSelectPhoto={photoId => setSelectedPhotos(new Set([photoId]))}
              onOpenViewer={photoId => setGalleryViewPhoto(photoId)}
              onCloseViewer={() => setGalleryViewPhoto(null)}
              onNavigateViewer={photoId => setGalleryViewPhoto(photoId)}
              onAssignBucket={(photoId, bucket) => assignBucket(photoId, bucket)}
              onAssignDay={(photoId, day) => {
                photoDispatch({ type: 'ASSIGN_DAY', payload: { photoIds: [photoId], day } });
              }}
              onSaveToHistory={commitPhotos}
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
            projectMode={projectMode}
            days={days}
            buckets={MECE_BUCKETS}
            onSaveToHistory={commitPhotos}
            onPersistState={persistState}
            onSetDayLabels={setDayLabels}
            onSetSelectedDay={() => {}}
            onSetCurrentView={setCurrentView}
            onSetSelectedPhotos={setSelectedPhotos}
            onRemoveDayAssignment={removeDayAssignment}
            onAssignBucket={assignBucket}
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
        structureMode={exportStructureMode}
        onClose={closeExportScriptModal}
        onCopyScript={copyExportScript}
        onDownloadScript={downloadExportScript}
        onRegenerateScript={regenerateScript}
        onStructureModeChange={updateStructureMode}
      />

      {/* Direct Processing Modal (Beta) */}
      <DirectProcessingModal
        isOpen={showDirectProcessing}
        state={directProcessingState}
        plan={directPlan}
        progress={directProgress}
        result={directResult}
        error={directProcessingError}
        destinationLabel={destinationLabel}
        structureMode={directStructureMode}
        onClose={closeDirectProcessing}
        onConfirm={confirmExecution}
        onStructureModeChange={updateDirectStructureMode}
        deleteAfterVerify={deleteAfterVerify}
        onToggleDeleteAfterVerify={toggleDeleteAfterVerify}
        canUndoDirectProcess={canUndoDirectProcess()}
        onUndoDirectProcess={undoLastDirectProcess}
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
