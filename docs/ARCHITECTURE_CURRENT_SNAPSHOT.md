# Narrative Architecture Snapshot

Date: March 9, 2026

## Purpose

This document summarizes the app's current architecture, state approach, and key files so a solo developer can quickly understand where core behavior lives.

## Current Approach

The app is a React + TypeScript feature-first architecture centered around the `photo-organizer` feature.

Core principles currently in use:

- Single canonical photo state engine via reducer (`photos + undo/redo history`) for deterministic mutation behavior.
- UI composition in one feature container (`PhotoOrganizer`) with supporting hooks/components/services.
- Persistence split between IndexedDB handles/manifests and localStorage state metadata.
- Keyboard scope isolation: global shortcuts are paused while viewer is open.

## Runtime Flow

1. App boots in `src/main.tsx` and renders `App`.
2. `App` wraps `PhotoOrganizer` with `PhotoProvider`.
3. `PhotoOrganizer` composes feature hooks + UI (header, sidebars, grid, viewer, modals).
4. Photo updates dispatch reducer actions.
5. `useProjectState` autosaves and explicit `persistState` writes to storage.
6. Export/undo script workflows use the current photo state.

## State Architecture

## Photo Engine (Reducer)

Primary state object:

- `photos`: current working photo set
- `past`: undo stack
- `future`: redo stack

Reducer actions:

- `SET_PHOTOS`
- `COMMIT_PHOTOS`
- `ASSIGN_BUCKET`
- `ASSIGN_DAY`
- `REMOVE_DAY_ASSIGNMENT`
- `TOGGLE_FAVORITE`
- `UNDO`
- `REDO`
- `CLEAR_HISTORY`

Outcome:

- Every mutation computes from latest reducer state.
- Undo/redo updates remain in lockstep with photo changes.

## UI/Project State

`useProjectState` manages project/session concerns:

- project metadata and loading lifecycle
- day labels and day containers
- onboarding/opening/recent projects
- persistence and autosave

It consumes reducer state and exposes mutation/persistence helpers to `PhotoOrganizer`.

## Keyboard Handling

Two keyboard scopes exist by design:

- Global app shortcuts (`useKeyboardShortcuts`)
- Viewer-local shortcuts (`PhotoViewer`)

Safety rule:

- Global shortcuts are only active when viewer is closed (`isActive = !isViewerOpen`).

## Persistence Model

- `projectService` stores folder handles (IndexedDB), project state edits (localStorage), and optional project manifest (`.narrative.json`).
- Autosave in `useProjectState` writes debounced project snapshots.
- Export manifests support undo export script generation.

## Key Files (Quick Map)

## App Shell

- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: wraps app with `PhotoProvider` and renders `PhotoOrganizer`.

## Feature Container

- `src/features/photo-organizer/PhotoOrganizer.tsx`: composition root for the feature.

## Store

- `src/features/photo-organizer/store/photoReducer.ts`: canonical photo state reducer.
- `src/features/photo-organizer/store/PhotoContext.tsx`: reducer context provider + hooks.

## Core Hooks

- `src/features/photo-organizer/hooks/useProjectState.ts`: project lifecycle + persistence + bridge to reducer state.
- `src/features/photo-organizer/hooks/useKeyboardShortcuts.ts`: global keyboard shortcuts with active switch.
- `src/features/photo-organizer/hooks/useFolderModel.ts`: derived day/folder/filter model.
- `src/features/photo-organizer/hooks/useOnboardingHandlers.ts`: post-onboarding state resets.
- `src/features/photo-organizer/hooks/useExportScript.ts`: export/undo script generation.

## Core UI

- `src/features/photo-organizer/components/PhotoGrid.tsx`: grid rendering and viewer launch.
- `src/features/photo-organizer/ui/PhotoViewer.tsx`: full viewer and viewer-local shortcuts.
- `src/features/photo-organizer/ui/PhotoStrip.tsx`: strip navigation inside viewer.
- `src/features/photo-organizer/components/ProjectHeader.tsx`: top controls and view switching.
- `src/features/photo-organizer/components/LeftSidebar.tsx`: day/folder navigation.
- `src/features/photo-organizer/components/RightSidebar.tsx`: batch actions and assignment controls.

## Services/Utilities

- `src/features/photo-organizer/services/projectService.ts`: file access, state load/save, manifest logic.
- `src/features/photo-organizer/utils/photoOrdering.ts`: deterministic ordering + navigation helpers.
- `src/features/photo-organizer/utils/pathResolver.ts`: source/destination path logic for export.
- `src/features/photo-organizer/utils/exportManifest.ts`: export manifest and undo script support.

## Known Architectural Priorities

1. Continue migrating all photo writes through explicit reducer actions (minimize generic commit pathways).
2. Add stricter typecheck gate in scripts/CI.
3. Expand integration tests for viewer assignment and keyboard scope boundaries.
4. Resolve hover overlay interaction artifact in grid/strip UI.

## Related Docs

- `docs/ROBUSTNESS_REVIEW_SUMMARY.md`
- `docs/ROBUSTNESS_REVIEW_DEEP_DIVE.md`
- `docs/FRONTEND_ARCHITECTURE.md`
- `src/features/photo-organizer/README.md`
