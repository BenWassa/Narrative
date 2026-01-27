# Photo Organizer Feature

This directory contains the **Photo Organizer** feature - the core workflow for organizing travel photos by day and story role.

## Overview

The Photo Organizer allows users to:

1. Select a folder containing travel photos
2. Automatically detect day-based folder structure
3. Assign photos to MECE story categories (A-E, M for Mood/Food)
4. Toggle favorites and archive unwanted photos
5. Generate a safe export script that copies photos into organized folders

## Structure

```
photo-organizer/
├── PhotoOrganizer.tsx       # Main feature container (orchestrates the workflow)
├── OnboardingModal.tsx      # Project creation/folder selection wizard
├── StartScreen.tsx          # Recent projects and "Create New" screen
│
├── components/              # Feature-specific UI building blocks
│   ├── ExportScriptModal.tsx
│   ├── FullscreenOverlay.tsx
│   ├── HelpModal.tsx
│   ├── LeftSidebar.tsx      # Days and Folders lists
│   ├── PhotoGrid.tsx        # Thumbnail grid
│   ├── ProjectHeader.tsx    # Top bar with actions
│   ├── RightSidebar.tsx     # MECE bucket controls
│   └── Toast.tsx
│
├── ui/                      # Presentational components (lower-level)
│   ├── LoadingModal.tsx
│   ├── PhotoStrip.tsx       # Horizontal photo reel in viewer
│   ├── PhotoViewer.tsx      # Enlarged photo view with keyboard shortcuts
│   ├── ProjectTile.tsx      # Recent project tile
│   └── StepIndicator.tsx    # (deprecated, kept for reference)
│
├── hooks/                   # Custom React hooks for state management
│   ├── useExportScript.ts
│   ├── useHistory.ts        # Undo/redo functionality
│   ├── useKeyboardShortcuts.ts
│   ├── usePhotoSelection.ts
│   ├── useProjectState.ts   # Main project state management
│   ├── useToast.ts
│   └── useViewOptions.ts
│
├── services/                # Business logic and data access
│   ├── projectService.ts    # Core CRUD operations for projects
│   └── __tests__/
│
├── utils/                   # Helper functions
│   ├── coverStorageService.ts  # IndexedDB for cover images
│   ├── groupProjectsByDate.ts  # Groups projects by creation date
│   ├── imageProcessing.ts      # Thumbnail generation, HEIC conversion
│   ├── safeLocalStorage.ts     # localStorage wrapper with error handling
│   └── __tests__/
│
├── constants/               # Feature-specific constants
│   └── projectKeys.ts       # localStorage keys
│
├── workers/                 # Web Workers for background processing
│   └── imageResizer.worker.ts  # Off-main-thread image resizing
│
└── __tests__/              # Feature tests
    ├── PhotoOrganizer.accessibility.test.tsx
    ├── PhotoViewingModes.test.tsx
    ├── accessibility.axe.test.tsx
    ├── groupProjectsByDate.test.ts
    ├── ProjectTile.test.tsx
    └── safeLocalStorage.test.ts
```

## Key Concepts

### MECE Story Categories

Photos are organized into **Mutually Exclusive, Collectively Exhaustive** categories:

- **A**: Establishing shots (wide landscapes, city overviews)
- **B**: Build-up shots (approaching locations, transitions)
- **C**: Climax shots (main attractions, key moments)
- **D**: Details (close-ups, textures, people)
- **E**: Emotional reactions (candid moments, expressions)
- **M**: Mood/Food (atmosphere, meals, local culture)
- **X**: Archive (photos to exclude from final narrative)
- **F**: Favorite (mark special photos regardless of category)

### Day-Based Organization

Photos are grouped by day, either:

1. **Explicit folders**: `Day 1`, `D01`, `2024-03-15`
2. **Inferred from timestamps**: If no day folders exist, photos are grouped by date taken

### Export Script

The export workflow generates a bash script that:

- Creates organized day folders (e.g., `Day 1 - Iceland/`)
- Copies (not moves) photos into subfolders by bucket (e.g., `C_CLIMAX/`)
- Renames files with sequence numbers (e.g., `Day1_C_001.jpg`)
- Preserves originals (safe, non-destructive workflow)

## State Management

The feature uses **custom hooks** to manage complex state:

- **`useProjectState`**: Project data (photos, name, settings)
- **`useHistory`**: Undo/redo stack
- **`usePhotoSelection`**: Selected photos and focus state
- **`useViewOptions`**: UI state (sidebar collapsed, hide assigned, etc.)
- **`useKeyboardShortcuts`**: Global keyboard event handling

This keeps `PhotoOrganizer.tsx` focused on composition rather than state logic.

## Data Flow

```
User selects folder
    ↓
OnboardingModal analyzes structure
    ↓
PhotoOrganizer loads photos into state
    ↓
User organizes with keyboard shortcuts
    ↓
State updates → IndexedDB persistence
    ↓
Export script generation
```

## Testing

- **Unit tests**: Utils and services (`safeLocalStorage.test.ts`, `groupProjectsByDate.test.ts`)
- **Component tests**: UI components (`ProjectTile.test.tsx`)
- **Accessibility tests**: A11y compliance (`accessibility.axe.test.tsx`)
- **Integration tests**: Full workflow (`PhotoViewingModes.test.tsx`)

Run tests: `npm test`

## Future Improvements

- [ ] Wire `VirtualPhotoGrid` into `PhotoGrid` for very large projects
- [ ] Support more file formats (RAW, video)
- [ ] Add cloud sync for projects
- [ ] Export to other formats (zip, shared album, etc.)
- [ ] Add advanced filters (by metadata, camera, etc.)

## Questions?

- **How do I add a new keyboard shortcut?** → `useKeyboardShortcuts.ts`
- **How do I change the export script format?** → `useExportScript.ts`
- **How do I add a new UI component?** → `components/` or `ui/` depending on complexity
- **How do I change photo storage?** → `services/projectService.ts`

For architecture details, see [`docs/FRONTEND_ARCHITECTURE.md`](../../docs/FRONTEND_ARCHITECTURE.md).
