# Narrative

Fast, narrative-driven travel photo organizer. Sort your trip photos by story role with single keystrokes and export a safe rename script.

![Version](https://img.shields.io/badge/version-1.5.4-blue)

---

## Overview

Narrative is a local-first, keyboard-driven workflow for curating travel photos. It scans a folder, lets you assign MECE story roles, and generates a copy-based rename script without modifying originals.

---

## Features

- **Keyboard-first organization**: A–E and M (Mood/Night), X (Archive), F (Favorite), undo/redo.
- **Day-aware grouping**: Detects day folders or infers days from timestamps.
- **Archive-aware imports**: Files under `98_ARCHIVE/` load as archived automatically.
- **Export rename script**: Generates a script that copies photos into day folders.
- **Local-only storage**: Project state stored in localStorage + IndexedDB handles.
- **Main menu**: Jump back to the project picker from any project.
- **Supported formats**: JPG, JPEG, PNG, HEIC, WEBP.

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
- Copy and run the script to create a new, organized folder tree.

---

## Folder Detection Rules

Narrative detects day folders from common naming patterns:

- Day prefixes: `Day 1`, `D01`, `day_2`
- ISO dates: `2024-03-15`, `2024_03_16`
- Numeric prefixes: `1 Iceland`, `02_Reykjavik`

If your project includes a `98_ARCHIVE/` folder, those files are treated as archived on load.

---

## Keyboard Shortcuts

| Key     | Action                |
| ------- | --------------------- |
| `A–E`   | Assign story category |
| `M`     | Mood/Night            |
| `X`     | Archive photo         |
| `F`     | Toggle favorite       |
| `←→`    | Navigate photos       |
| `Enter` | Fullscreen view       |
| `Esc`   | Close/Deselect        |
| `⌘Z`    | Undo                  |
| `⌘⇧Z`   | Redo                  |
| `?`     | Show shortcuts        |

---

## Scripts

- `npm run dev`: Start the Vite dev server.
- `npm run build`: Lint, test, and build into `docs/`.
- `npm run test`: Run the Vitest suite.
- `npm run format`: Format source and docs.

---

## Project Structure

```
Narrative/
├── src/
│   ├── frontend/        # React app
│   ├── services/        # Shared services (folder detection)
│   ├── shared/          # Shared types/utilities
│   └── styles/          # Global styles
├── archive/             # Deprecated experiments
├── docs/                # GitHub Pages site and specs
└── tests/
```

---

## Documentation

- `docs/TECH_STACK.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN.md`
- `docs/COMMISSION.md`
- `docs/BACKEND_SPEC.md` (historical, not currently implemented)
