# Portfolio Template Version Plan

## Overview
Create a standalone, pre-configured version of the Narrative photo organization app that showcases all core functionality with dummy photos, ready for portfolio demonstration.

## Project Structure

### Directory Layout
```
narrative-template/
├── src/                          # Copy of main app source
├── public/                        # Copy of public assets
├── template-photos/              # Sample photo directory structure
│   ├── 2024-01-15/              # Assigned day (complete)
│   ├── 2024-01-16/              # Unassigned day (empty)
│   ├── 2024-01-17/              # Partially assigned day
│   ├── archive/                 # Archive folder
│   └── [root-level photos]/      # Miscellaneous unorganized photos
├── package.json                  # Copied & modified
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.cjs
├── postcss.config.cjs
├── index.html
├── README.md                     # Portfolio-specific documentation
└── [other config files]
```

## Implementation Steps

### Phase 1: Project Setup
- [ ] Create `/narrative-template/` directory
- [ ] Copy all source files from root to `narrative-template/`
  - Exclude: `node_modules/`, `.git/`, `coverage/`, `docs/`, `archive/`
  - Include: `src/`, `public/`, `scripts/`, config files, `package.json`
- [ ] Modify `package.json` with portfolio-specific metadata (name, description, version)
- [ ] Create `README.md` explaining the template and how to use it

### Phase 2: Dummy Photo Generation

#### Photo Structure Details

**Directory: `template-photos/2024-01-15/` (Complete/Assigned)**
- 8-12 photos (simulating a full day's worth)
- Photos should be organized by time (e.g., morning, afternoon, evening)
- All photos assigned to a narrative/project

**Directory: `template-photos/2024-01-16/` (Unassigned)**
- 5-7 photos
- No assignments (showcases the "unassigned" state in UI)
- Demonstrates the core problem the app solves

**Directory: `template-photos/2024-01-17/` (Partial Assignment)**
- 10 photos
- Some assigned, some unassigned
- Shows mixed states within a day

**Directory: `template-photos/archive/` (Archived Content)**
- 4-6 photos
- Demonstrates archive functionality
- Could be marked as "old project" or "reference photos"

**Root Level: `template-photos/` (Misc Photos)**
- 3-5 photos
- Unorganized, at root level
- Shows photos waiting to be organized

#### Photo Generation Approach
- Use placeholder/dummy image generation (could use:
  - Simple colored rectangles via Canvas API
  - Small downloaded stock images
  - Generated pixel art or geometric patterns
- Include metadata/EXIF if possible to simulate realistic photos
- Size: Keep small (100-200KB each) for fast loading
- Formats: Mix of JPG and PNG if possible

### Phase 3: Configuration & State Setup

#### Project State File
- Create a sample project state file or initialize the app with default projects:
  - "Family Trip 2024"
  - "Work Conference"
  - "Personal Archive"
- Initialize with some photos already assigned to projects
- Create an "Unprocessed" or "New" category with unassigned photos

#### LocalStorage/Initial State
- Modify app initialization to load template photos from `template-photos/`
- Set up default project assignments
- Configure folder detection to point to template structure

### Phase 4: Documentation

#### Create `README.md` for Portfolio Template
```markdown
# Narrative - Portfolio Template

A pre-configured demonstration of the Narrative photo organization app 
with sample photos showcasing all core features.

## Features Demonstrated
- [x] Photo organization by date
- [x] Project/narrative assignment
- [x] Archive functionality
- [x] Mixed assignment states
- [x] Unassigned photo handling

## What's Included
- 30+ dummy photos organized in realistic patterns
- Pre-configured project assignments
- Multiple organizational states (assigned, unassigned, archived)
- Ready-to-use template for portfolio showcase

## Getting Started
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Explore the template photos in the Photo Organizer

## Project Structure
- `template-photos/2024-01-15/` - Fully assigned day
- `template-photos/2024-01-16/` - Unassigned day
- `template-photos/2024-01-17/` - Partially assigned day
- `template-photos/archive/` - Archived photos
- `template-photos/` (root) - Miscellaneous photos
```

## Technical Considerations

### Photo Handling
- [ ] Determine if using real small images or generated placeholders
- [ ] Ensure photos load without requiring external APIs
- [ ] Consider image optimization for fast demo loading
- [ ] Make photos representative of real use (different sizes, formats)

### App Configuration
- [ ] Decide if template uses same folder detection as main app or custom path
- [ ] Set `template-photos/` as default working directory in template version
- [ ] Optionally disable file system access for portfolio demo
- [ ] Consider browser-safe image viewing (no security issues)

### Build & Distribution
- [ ] Build process should produce production-ready portfolio template
- [ ] Keep size minimal for web hosting if needed
- [ ] Document how to modify photos/projects if needed
- [ ] Include instructions for customization

## Deliverables
1. Standalone `narrative-template/` directory
2. Pre-populated `narrative-template/template-photos/` with dummy photos
3. Configured app state showing feature demonstrations
4. Clear README explaining features and structure
5. Ready-to-deploy or ready-to-share for portfolio use

## Future Enhancements
- [ ] Add screenshot/GIF showing feature workflow
- [ ] Create interactive demo guide
- [ ] Add "reset to defaults" functionality
- [ ] Option to generate new dummy photos dynamically
- [ ] Deploy as live demo at portfolio site

---

## Timeline Estimate
- Phase 1 (Setup): 30 minutes
- Phase 2 (Dummy photos): 1-2 hours
- Phase 3 (Config/State): 45 minutes
- Phase 4 (Documentation): 30 minutes
- **Total: ~3-4 hours**

