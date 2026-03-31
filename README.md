# Narrative

Fast, narrative-driven travel photo organizer. Sort your trip photos by story role with single keystrokes and export a safe rename script.

![Version](https://img.shields.io/badge/version-4.2.0-blue)

---

## Overview

Narrative is a local-first, keyboard-driven workflow for curating travel photos. It scans a folder, lets you assign MECE story roles, and generates a copy-based rename script without modifying originals.

---

## Features

- **Keyboard-first organization**: A–E and M (Mood/Food), X (Archive), F (Favorite), undo/redo.
- **Day-aware grouping**: Detects day folders or infers days from timestamps.
- **Archive-aware imports**: Files under `98_ARCHIVE/` load as archived automatically.
- **Export script**: Generates a bash script that copies photos into day folders.
- **Local-only storage**: Project state stored in localStorage + IndexedDB handles.
- **Main menu**: Jump back to the project picker from any project.
- **Supported formats**: JPG, JPEG, PNG, HEIC, WEBP.

---

## Technical Overview

For a detailed look at the architecture, data model, and development workflow, see the [Technical Overview](./docs/TECHNICAL_OVERVIEW.md).

---

## Requirements

- Node.js >= 20
- Chromium-based browser (File System Access API)

---

## Getting Started

```bash
git clone https://github.com/BenWassa/Narrative.git
cd Narrative
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome or Edge.

---

## Usage

### Create or Open a Project

- Use the **Main Menu** button to return to the project picker.
- Create a new project or open a recent one.

### Organize

- Click a photo or use arrow keys to navigate.
- Press **A–E** or **M** to set the story role.
- Press **X** to archive.
- Press **F** to toggle favorite.

### Export

- Click **Export Script** in the header.
- Copy and run the generated bash script from your project root directory.

---

## Folder Detection Rules

Narrative detects day folders from common naming patterns:

- Day prefixes: `Day 1`, `D01`, `day_2`
- ISO dates: `2024-03-15`, `2024_03_16`
- Numeric prefixes: `1 Iceland`, `02_Reykjavik`

If your project includes a `98_ARCHIVE/` folder, those files are treated as archived on load.

---

## Keyboard Shortcuts

| Key         | Action                     |
| ----------- | -------------------------- |
| `A–E`       | Assign story category      |
| `M`         | Mood/Food                  |
| `X`         | Archive photo              |
| `F`         | Toggle favorite            |
| `←→`        | Navigate photos            |
| `J / K`     | Next / Previous            |
| `⇧J / ⇧K`   | Next / Previous unassigned |
| `Space / N` | Next unassigned (viewer)   |
| `Enter`     | Fullscreen view            |
| `Esc`       | Close/Deselect             |
| `⇧H`        | Toggle Skip Assigned       |
| `⌘Z`        | Undo                       |
| `⌘⇧Z`       | Redo                       |
| `Ctrl+⇧D`   | Toggle debug overlay       |
| `?`         | Show shortcuts             |

---

## Scripts

- `npm run dev`: Start the Vite dev server.
- `npm run build`: Format, lint, test, and build into `docs/`.
- `npm run test`: Run the Vitest suite.
- `npm run format`: Format source and docs.
- `npm run lint`: Check formatting (prettier --check).

---

## Release Workflow

To create a new release:

### Patch Release (1.5.6 → 1.5.7)

```bash
npm version patch
node ./scripts/sync-version.js
npm run build
git add .
git commit -m "Release v$(node -p "require('./package.json').version") - [brief description]"
git push
```

### Minor Release (1.5.6 → 1.6.0)

```bash
npm version minor
node ./scripts/sync-version.js
npm run build
git add .
git commit -m "Release v$(node -p "require('./package.json').version") - [brief description]"
git push
```

### Major Release (1.5.6 → 2.0.0)

```bash
npm version major
node ./scripts/sync-version.js
npm run build
git add .
git commit -m "Release v$(node -p "require('./package.json').version") - [brief description]"
git push
```

For manual version control:

```bash
# Edit package.json version manually
# Then sync and build
node ./scripts/sync-version.js
npm run build
git add .
git commit -m "Release v1.x.x - [description]"
git push
```

---

## Project Structure

```
Narrative/
├── src/
│   ├── main.tsx                   # Application entry point
│   ├── App.tsx                    # Top-level UI composition
│   ├── features/
│   │   └── photo-organizer/       # Photo organization feature
│   ├── components/                # Shared UI components
│   ├── hooks/                     # Shared React hooks
│   ├── lib/                       # Shared utilities & services
│   ├── types/                     # Shared TypeScript types
│   └── styles/                    # Global styles
├── archive/                       # Deprecated experiments
├── docs/                          # GitHub Pages site and documentation
└── tests/
```

For detailed frontend architecture, see [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md).

---

## Documentation

- **[Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)** - How the frontend is organized
- `docs/TECH_STACK.md` - Technology choices and rationale
- `docs/ARCHITECTURE.md` - Overall system architecture
- `docs/DESIGN.md` - Design decisions and UX patterns
- `docs/COMMISSION.md` - Commission tracking
- `docs/BACKEND_SPEC.md` (historical, not currently implemented)

---
