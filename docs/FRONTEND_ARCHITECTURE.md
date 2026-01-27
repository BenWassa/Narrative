# Frontend Architecture

## Overview

Narrative's frontend is built with React, TypeScript, and Vite. The codebase follows a **feature-first** architecture pattern that organizes code by domain concerns rather than technical layers.

## Tech Stack

- **React 18**: UI library with hooks and functional components
- **TypeScript**: Static typing for better developer experience
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Vitest**: Testing framework
- **File System Access API**: Browser-native file handling (Chrome/Edge)

## Folder Structure

```
src/
├── main.tsx              # Application entry point (React root + providers)
├── App.tsx               # Top-level UI composition component
├── vite-env.d.ts         # Vite type definitions
│
├── app/                  # App-level concerns (future: providers, routing)
│
├── features/             # Feature modules (domain-driven)
│   └── photo-organizer/  # Photo organization workflow
│       ├── components/   # Feature-specific UI components
│       ├── hooks/        # Feature-specific React hooks
│       ├── services/     # Feature-specific business logic
│       ├── utils/        # Feature-specific utilities
│       ├── constants/    # Feature-specific constants
│       ├── ui/           # Feature-specific presentational components
│       ├── workers/      # Web Workers for background processing
│       ├── __tests__/    # Feature tests
│       └── PhotoOrganizer.tsx  # Main feature component
│
├── components/           # Shared, reusable UI components (currently empty)
├── hooks/                # Shared custom hooks (currently empty)
├── lib/                  # Shared utilities, services, helpers
├── types/                # Shared TypeScript type definitions
└── styles/               # Global styles (Tailwind CSS)
```

## Architecture Principles

### 1. Feature-First Organization

Large features (like `photo-organizer`) are self-contained modules with their own:

- Components (UI building blocks specific to the feature)
- Hooks (state management and side effects)
- Services (business logic, data access)
- Utils (helper functions)
- Tests

**Why?** This makes it easy to:

- Find related code quickly
- Understand feature scope
- Potentially extract features into separate packages later

### 2. Clear Entry Point

**`src/main.tsx`** is the application entry point:

- Bootstraps React
- Renders the root component
- Loads global styles
- (Future) Will contain global providers (router, theme, etc.)

**`src/App.tsx`** is the top-level UI composition:

- Composes screens/containers
- (Future) Will contain routing logic

**Why?** This is the standard React + Vite pattern that most developers expect.

### 3. Path Aliases for Clean Imports

Instead of messy relative imports like `../../../lib/utils`, we use clean path aliases:

```typescript
// ❌ Avoid
import { helper } from '../../../lib/helper';

// ✅ Prefer (when available)
import { helper } from '@/lib/helper';
```

**Available aliases:**

- `@/*` → `src/*`
- `@/features/*` → `src/features/*`
- `@/components/*` → `src/components/*`
- `@/hooks/*` → `src/hooks/*`
- `@/lib/*` → `src/lib/*`
- `@/types/*` → `src/types/*`
- `@/styles/*` → `src/styles/*`

**Note:** Path aliases are configured in both `tsconfig.json` and `vite.config.ts`.

### 4. Shared vs. Feature-Specific Code

**Shared code** (`src/lib/`, `src/hooks/`, `src/components/`):

- Used by multiple features
- Generic, reusable utilities
- No feature-specific logic

**Feature-specific code** (`src/features/photo-organizer/`):

- Only used within one feature
- Contains domain-specific logic
- Can import from shared code, but not from other features

### 5. File Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `PhotoOrganizer.tsx`, `ProjectTile.tsx`)
- **Hooks**: `camelCase.ts` with `use` prefix (e.g., `useProjectState.ts`)
- **Utils/Services**: `camelCase.ts` (e.g., `projectService.ts`, `safeLocalStorage.ts`)
- **Constants**: `camelCase.ts` (e.g., `projectKeys.ts`)
- **Tests**: `*.test.ts` or `*.test.tsx`

## How the Frontend Works

### Application Bootstrap

1. Browser loads `index.html`
2. `index.html` loads `src/main.tsx`
3. `main.tsx` creates React root and renders `<App />`
4. `App.tsx` renders `<PhotoOrganizer />` (the main feature)

### Photo Organizer Feature

The `photo-organizer` feature is the core of the application:

1. **StartScreen**: Shows recent projects and "Create New Project" button
2. **OnboardingModal**: Wizard for selecting a folder and configuring project structure
3. **PhotoOrganizer**: Main UI for organizing photos
   - **ProjectHeader**: Top bar with project name, actions, view toggles
   - **LeftSidebar**: Days and Folders lists
   - **PhotoGrid**: Thumbnail grid of photos
   - **RightSidebar**: MECE bucket controls and metadata
   - **PhotoViewer**: Enlarged photo view with keyboard shortcuts

### State Management

Currently uses **React hooks** for state:

- `useState` for local component state
- Custom hooks for complex state logic (e.g., `useProjectState`, `useHistory`)
- IndexedDB for persistent storage (via `projectService.ts`)
- LocalStorage for recent projects and settings

### Key Services

- **`projectService.ts`**: Core business logic for photo projects (CRUD, thumbnails, exports)
- **`folderDetectionService.ts`**: Analyzes folder structures to detect days and buckets
- **`coverStorageService.ts`**: Manages project cover images in IndexedDB
- **`photoOrdering.ts`**: Centralized deterministic ordering + navigation helpers
- **`thumbnailCache.ts`**: IndexedDB-backed thumbnail cache (HEIC previews)
- **`safeLocalStorage.ts`**: Wrapper for localStorage with error handling

## Testing

Tests are colocated with features in `__tests__/` directories:

- **Unit tests**: For utilities and services
- **Component tests**: For UI components (React Testing Library)
- **Integration tests**: For feature workflows

Run tests with:

```bash
npm test              # Run tests in watch mode
npm run test:ui       # Open Vitest UI
npm run coverage      # Generate coverage report
```

## Development Workflow

### Start Dev Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build:site    # Builds to docs/ for GitHub Pages
```

### Run Tests

```bash
npm test
```

## Best Practices

### ✅ DO

- Keep components focused and single-purpose
- Use TypeScript types for all public APIs
- Write tests for business logic (services, utils)
- Use meaningful variable and function names
- Colocate related files (tests near code, styles near components)
- Prefer explicit imports over deep relative paths
- Add comments for non-obvious logic

### ❌ DON'T

- Import from other features (e.g., don't import from `features/other-feature/`)
- Use `any` type (prefer `unknown` if type is truly unknown)
- Create circular dependencies
- Put business logic in components (extract to services/hooks)
- Commit commented-out code (use git history instead)

## Future Improvements

- [ ] Add React Router for multi-page navigation
- [ ] Extract more shared components (Button, Modal, etc.)
- [ ] Add global state management if needed (Zustand, Jotai, etc.)
- [ ] Add more path alias usage to reduce relative imports
- [ ] Create a design system with reusable UI components
- [ ] Add E2E tests with Playwright

## Learning Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev/)

## Questions?

If you're new to the codebase:

1. **Where does the app start?** → `src/main.tsx`
2. **Where is the photo organizer feature?** → `src/features/photo-organizer/`
3. **Where do shared utilities go?** → `src/lib/`
4. **How do I run the app?** → `npm run dev`
5. **How do I add a new feature?** → Create a new directory under `src/features/`

For more questions, see the main `README.md` or check the `docs/` folder.
