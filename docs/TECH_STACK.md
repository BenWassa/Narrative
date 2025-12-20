# Tech Stack

## Runtime and Build

- Node.js >= 20
- Vite 7 + React 18 + TypeScript

## UI and Styling

- React components in `src/frontend/`
- Tailwind CSS for styling
- Lucide icons

## Storage and Persistence

- `localStorage` for project state and edits
- IndexedDB for persisted folder handles (File System Access API)
- `safeLocalStorage` wrapper for resilient reads/writes

## Browser APIs

- File System Access API for directory reads
- Clipboard API for export script copy

## Testing and Quality

- Vitest (jsdom)
- Testing Library (React + Jest DOM)
- Axe-core for accessibility checks
- Prettier for formatting
