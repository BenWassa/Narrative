# Narrative

> Fast, narrative-driven travel photo organizer. Sort your trip photos by story role with single keystrokes.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)

Organize 1000+ travel photos in under an hour using keyboard-first MECE categorization, day-based grouping, and slideshow-ready exports. Fully local, completely offline, totally reversible.

---

## Website (GitHub Pages)

There is a lightweight static site in the `docs/` folder suitable for publishing with GitHub Pages (set Pages source to the `docs/` folder on the `main` branch). The site includes an index and links to the backend spec and design notes.

### Frontend demo and publishing

This repo includes a small Vite + React build that outputs a production site to `docs/site/` (so `docs/index.html` can remain a top-level docs landing page). To try locally and publish:

1. Install dependencies: `npm install` (root)
2. Run dev server: `npm run dev` (open `http://localhost:5173` by default)
3. Build for production: `npm run build` — the built site will be placed in `docs/site/`
4. Push to GitHub and ensure GitHub Pages is set to serve from the `docs/` folder on the `main` branch — the app will be available at `/site/` and the docs index will remain at the root of the `docs/` folder.

If you'd rather deploy the app at the docs root (e.g., `docs/index.html`), I can change the Vite output to `docs/` (this will overwrite the current `docs/index.html`).

---

## Why Narrative?

~
After a trip, you have hundreds of photos. Some are establishing shots, some are people, some are details. You need them organized by day and ready for a slideshow or video montage.

**Narrative solves this** with a simple workflow:

1. Select your trip folder
2. Press A-F to categorize each photo by its story role
3. Export clean, day-organized folders

No AI guessing. No cloud upload. No complex tagging. Just fast, manual curation with keyboard shortcuts.

---

## Features

### ⚡ Keyboard-First Operation

- **A-E, M keys**: Assign story categories instantly (M = Mood/Night)
- **Arrow keys**: Navigate photos
- **F key**: Toggle favorites
- **Undo/Redo**: Cmd+Z / Cmd+Shift+Z

### 📖 MECE Story Categories

- **A** - Establishing (landscapes, wide shots)
- **B** - People (portraits, groups)
- **C** - Culture/Detail (local life, close-ups)
- **D** - Action/Moment (events, activities)
- **E** - Transition (travel, movement)
- **F** - Mood/Night (atmosphere, evening) — assigned with **M** shortcut
- **X** - Archive (unwanted shots)

### 📁 Clean File Organization

```
Iceland2024/
├── 01_DAYS/
│   ├── D01/
│   │   ├── D01_A_001__IMG_1234.jpg
│   │   └── D01_B_002__IMG_1235.jpg
│   └── D02/
├── 98_ARCHIVE/
├── FAV/
└── _meta/
```

### 🔒 Local & Safe

- **No cloud**: Everything stays on your computer
- **Non-destructive**: Archive instead of delete
- **Reversible**: Full undo/redo history
- **Human-readable**: No proprietary formats

---

## Installation

### Prerequisites

- macOS 10.15 or later
- 2GB free disk space (for thumbnails)

### Download

```bash
# Download latest release
# (Coming soon - currently in development)

# Or run from source
git clone https://github.com/yourusername/narrative.git
cd narrative
npm install
npm run dev
```

---

## Quick Start

### 1. Create a New Project

- Launch Narrative
- Click "Create Project"
- Choose your photo folder (directory picker)

### 2. Organize Photos

- Click a photo or use arrow keys to navigate
- Press **A-E** or **M** to categorize by story role (M = Mood/Night)
- Press **X** to archive unwanted photos
- Press **F** to mark favorites

### 3. Export for Slideshow

- Click "Export" in the menu
- Choose "Slideshow Ready"
- Select destination folder
- Import into your video editor

---

## Importing Existing Photo Collections

Narrative reads your existing folder as-is and builds a local project view without changing files.

- **Day Prefix**: `Day 1`, `D01`, `day_2`, `D-3`
- **ISO Dates**: `2024-03-15`, `2024_03_16`
- **Numeric Prefix**: `1 Iceland`, `02_Reykjavik`
- **Timestamps**: Auto-groups photos by date if folders aren't named

### Import Workflow

1. Click **Import Trip** button in the header
2. Select your existing trip folder
3. Review detected day mappings (fully editable)
4. Preview what will happen (all folders, renames, moves)
5. Use **dry-run mode** to preview without making changes
6. Click **Apply** to migrate your library
7. Use **Undo** (Cmd+Z) anytime to revert changes

### Safety Features

- **Dry-run preview**: See exactly what will change before applying
- **Full undo support**: Revert any import with Cmd+Z
- **Manifest file**: `_meta/folder_map.json` records all changes for reference
- **No destructive operations**: Original filenames preserved in metadata

---

## Keyboard Shortcuts

| Key     | Action                |
| ------- | --------------------- |
| `A-F`   | Assign story category |
| `X`     | Archive photo         |
| `F`     | Toggle favorite       |
| `←→`    | Navigate photos       |
| `Enter` | Fullscreen view       |
| `Esc`   | Close/Deselect        |
| `⌘Z`    | Undo                  |
| `⌘⇧Z`   | Redo                  |
| `?`     | Show shortcuts        |

---

## File Naming Convention

Photos are renamed with a structured format:

```
D03_A_014__IMG_1234.jpg
│   │ │    └─ Original filename
│   │ └────── Sequence number (auto-increment)
│   └──────── Story category (A-F)
└──────────── Day number
```

This creates:

- **Chronological ordering** by day
- **Story grouping** by category
- **Unique identification** via sequence
- **Traceability** back to original

---

## Use Cases

### 📹 Video Editing

Export day folders directly into Premiere, Final Cut, or DaVinci Resolve. Photos are pre-sorted by story beat.

### 🎞️ Slideshow Creation

Favorites view gives you the best shots. Export filtered by rating for quick slideshow assembly.

### 🗂️ Photo Book Design

Day-organized folders make it easy to structure chapters. MECE categories ensure visual variety.

### 📊 Travel Blogging

Export favorites with metadata to match photos to blog post sections.

---

## Technical Architecture

### Frontend

- **React** - UI components
- **Tailwind CSS** - Styling
- **Lucide Icons** - Icon library

### Local-Only Viewer

- **Browser directory picker** - Read-only access to local files
- **Local storage** - Persists project metadata and edits

### Data Storage

- **Local storage** - Project state and edits
- **IndexedDB handles** - Persisted folder access (reselect if permission revoked)

---

## Project Structure

```
narrative/
├── src/
│   ├── frontend/        # React app
│   └── shared/          # Type definitions
├── archive/
│   ├── backend/         # Archived backend (no longer used)
│   └── onboarding/      # Archived onboarding flows
├── docs/
│   ├── COMMISSION.md    # Original project brief
│   ├── BACKEND_SPEC.md  # API documentation
│   └── DESIGN.md        # Design philosophy
└── tests/
```

---

## Development

### Run Locally

```bash
npm install
npm run dev
```

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
```

---

## Roadmap

### v0.1 (Current - MVP)

- [x] UI design and React components
- [ ] Backend file operations
- [ ] EXIF parsing
- [ ] Undo/redo system
- [ ] Basic export

### v0.2 (Next)

- [ ] Batch operations
- [ ] Advanced export options
- [ ] Video thumbnail support
- [ ] Performance optimization for 10k+ photos

### v0.3 (Future)

- [ ] Multi-day batch import
- [ ] Custom category labels
- [ ] Export templates
- [ ] Windows support

---

## Philosophy

### MECE Principle

**Mutually Exclusive, Collectively Exhaustive** - Every photo belongs to exactly one category. No overlap, no ambiguity, no decision paralysis.

### Local-First

Your photos never leave your computer. No account, no login, no subscription, no data mining.

### Speed Over Complexity

One keystroke per photo. No multi-step wizards, no modal dialogs, no form fills.

### Reversibility

Every operation can be undone. Archive instead of delete. Rename instead of overwrite.

---

## FAQ

**Q: Does this use AI to categorize photos?**  
A: No. You make every decision. Narrative is a tool for manual curation, not automated guessing.

**Q: Can I sync across devices?**  
A: Not built-in. Use your own cloud sync (Dropbox, Google Drive) if needed. Narrative works with synced folders.

**Q: What about RAW files?**  
A: Coming in v0.2. Currently supports JPG, PNG, HEIC.

**Q: Does it modify my original files?**  
A: It renames and moves them, but never modifies image data. You can always undo.

**Q: Can I customize the categories?**  
A: Not yet. MECE categories are designed to be universal. Custom labels coming in v0.3.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built for photographers who value speed, control, and simplicity over automation and complexity.

Inspired by the need for better photo organization tools that respect the filesystem and the user's intelligence.

---

**Built with ❤️ for travel photographers**
