# Technical Overview

Narrative is a local-first, browser-based photo organizer designed for fast, keyboard-driven workflows. It leverages modern web APIs to provide a desktop-like experience for photographers and travelers.

## Architecture

The application is built as a Single Page Application (SPA) using React and Vite. It follows a modular architecture with features organized into functional domains.

### Technology Stack

- **Framework**: React 18+
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Iconography**: Lucide React
- **Testing**: Vitest & React Testing Library
- **Storage**: Browser File System Access API, IndexedDB (via `idb`), and localStorage.

### Core Modules

1. **File System Integration**: Uses the File System Access API to read local directories without uploading files to a server. This ensures privacy and speed.
2. **Project Management**: `projectService` handles project lifecycle, from initialization to state persistence.
3. **Photo Processing**: Optimized photo loading using `react-window` for virtualization and `heic2any` for HEIC support.
4. **State Management**: A custom state management solution that persists user edits to `localStorage` and directory handles to `IndexedDB`.

## Data Model

### Project State
The application maintains a centralized `ProjectState` which includes:
- **Project Metadata**: Name, root directory handle.
- **Photos**: An array of `ProjectPhoto` objects.
- **Edits**: A record of user assignments (buckets, favorites, archive status) keyed by file path.
- **Settings**: User preferences for the project.

### Photo Object
Each photo is represented by a `ProjectPhoto` interface:
- `id`: Unique identifier.
- `file`: The native `File` object.
- `fileName`: Original name.
- `bucket`: The assigned story role (A-E, M, etc.).
- `isFavorite`: Boolean flag.
- `isArchived`: Boolean flag.
- `dayNumber`: Inferred or manually assigned day.

## Key Workflows

### Project Initialization
When a user opens a folder:
1. The **Folder Detection Service** scans for common naming patterns to identify day subdirectories.
2. A project manifest is created and stored in `IndexedDB`.
3. Photos are indexed, and any existing edits in `localStorage` are merged.

### Keyboard-Driven Sorting
The core UI is optimized for speed:
- Single-key assignments (A-E, M, X, F).
- Instant UI feedback with undo/redo capability.
- Virtualized grids for smooth scrolling through thousands of photos.

### Exporting
Narrative does not modify original files. Instead, it generates a **Bash Export Script**:
1. The application calculates the new destination for each photo based on its assigned bucket and day.
2. A script is generated that uses `cp` or `mv` commands to organize photos into a structured folder hierarchy.
3. The user runs this script locally to apply the changes.

## Development

### Prerequisites
- Node.js >= 20
- A browser supporting the File System Access API (Chrome, Edge, Opera).

### Scripts
- `npm run dev`: Starts the development server.
- `npm test`: Runs the test suite.
- `npm run build`: Builds the production-ready site.
- `npm run format`: Formats code using Prettier.

### Testing Strategy
- **Unit Tests**: Logic for folder detection, version management, and utility functions.
- **Component Tests**: Interaction testing for key UI components like `OnboardingModal` and `PhotoOrganizer`.
- **Integration Tests**: End-to-end workflows like project creation and photo sorting.

---
*Last Updated: March 2026*
