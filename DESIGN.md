---
name: Narrative
description: Fast, local-first travel photo curation for turning trip folders into story structure.
colors:
  field-black: "#030712"
  panel-slate: "#111827"
  raised-slate: "#1f2937"
  line-slate: "#374151"
  archive-slate: "#4b5563"
  muted-ink: "#9ca3af"
  body-ink: "#d1d5db"
  bright-ink: "#f3f4f6"
  action-blue: "#2563eb"
  focus-blue: "#3b82f6"
  soft-blue: "#60a5fa"
  trust-green: "#22c55e"
  warning-amber: "#f59e0b"
  danger-red: "#dc2626"
  bucket-purple: "#a855f7"
  bucket-orange: "#f97316"
  bucket-yellow: "#eab308"
  bucket-indigo: "#6366f1"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  xxl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.bright-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1.25rem"
  button-secondary:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.bright-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  field-default:
    backgroundColor: "{colors.field-black}"
    textColor: "{colors.bright-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1rem"
  project-card:
    backgroundColor: "{colors.field-black}"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.lg}"
    padding: "0.75rem"
  status-chip:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.body-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
---

# Design System: Narrative

## 1. Overview

**Creative North Star: "The Focused Darkroom"**

Narrative is a dense, local-first editing surface for photographers who are sorting memory into structure. The interface should feel like a focused editing room: low ambient light, crisp operational controls, and photos as the brightest objects in the room. The system is dark because the physical scene is a post-trip curation session at a desk, often at night, where glare fights the photos and the user needs long-session comfort.

The product is restrained by default. Blue is the primary action and focus color, while the MECE bucket colors are functional tags, not decoration. Panels, modals, sidebars, progress strips, and chips should feel durable and practical, with just enough polish to make file operations feel controlled.

The system explicitly rejects generic cloud-gallery aesthetics, social-media album polish, decorative SaaS dashboards, casual or opaque file operations, oversized cards, repeated icon-heading-text tiles, modal-heavy decision points, vague progress language, and UI chrome that competes with the photos.

**Key Characteristics:**
- Dark slate workspace with strong photo contrast.
- Blue reserved for action, progress, selection, and focus.
- Bucket colors communicate story role, not brand flourish.
- Compact controls, dense information, and visible keyboard affordance.
- Flat at rest, lightly lifted on modals, media, and hover states.

## 2. Colors

The palette is a restrained dark slate system with one operational blue and a functional bucket spectrum.

### Primary
- **Action Blue**: The canonical action color for primary buttons, selected rows, progress, links, and focus rings.
- **Focus Blue**: The selection and focus color for rings, borders, and active progress segments.
- **Soft Blue**: The lighter informational color for loaders, secondary text, and icon emphasis.

### Secondary
- **Trust Green**: Success, verified operations, completion states, and the Culture/Detail bucket.
- **Warning Amber**: Warnings, inbox helper text, and reversible caution states.
- **Danger Red**: Delete, blocking errors, failed copy operations, and unsupported states.

### Tertiary
- **Bucket Purple**: People bucket.
- **Bucket Orange**: Action/Moment bucket.
- **Bucket Yellow**: Transition bucket.
- **Bucket Indigo**: Mood/Food bucket and beta processing affordances.

### Neutral
- **Field Black**: Application canvas, text fields, textareas, photo viewer stage, and project cards.
- **Panel Slate**: Headers, sidebars, modal bodies, strips, and persistent chrome.
- **Raised Slate**: Hover buttons, panel headers, selected-neutral elements, and secondary actions.
- **Line Slate**: Borders, dividers, disabled outlines, and low-contrast separators.
- **Archive Slate**: Archive progress and inactive status.
- **Muted Ink**: Secondary labels, helper text, icons, and metadata.
- **Body Ink**: Main body copy and inactive text.
- **Bright Ink**: Headings, primary labels, and high-confidence actions.

### Named Rules

**The Photo-First Rule.** UI surfaces stay in the slate range unless a control is actively communicating action, selection, status, or bucket meaning.

**The One Blue Rule.** Blue is for workflow momentum: open, import, download, selected, assigned, progress, and focus. Do not spend blue on decorative accents.

**The Bucket-Is-Data Rule.** Bucket colors may be saturated because they are classification data. Never use the bucket spectrum as generic brand decoration.

## 3. Typography

**Display Font:** system sans (with platform fallbacks)
**Body Font:** system sans (with platform fallbacks)
**Label/Mono Font:** system mono for file names, shell scripts, paths, and generated commands

**Character:** Typography is utilitarian and compact. It should read like a pro tool: clear hierarchy, short labels, strong weights on actionable names, and mono only where the content is actually code or file-system data.

### Hierarchy
- **Display** (700, 1.25rem, 1.25): Modal titles and dashboard page titles. Use rarely.
- **Headline** (600, 1.125rem, 1.4): Project headers, gallery titles, and major panel headings.
- **Title** (600, 0.875rem, 1.4): Section headings, button labels, selected project names, and form labels.
- **Body** (400, 0.875rem, 1.5): Modal copy, helper text that needs readability, row labels, and descriptions. Keep explanatory copy under 75ch.
- **Label** (600, 0.6875rem, 0.05em letter spacing): Uppercase section labels, compact state labels, and sidebar metadata.
- **Mono** (400, 0.75rem, 1.6): File paths, generated shell script text, current file names, and commands.

### Named Rules

**The Operational Type Rule.** Use weight and compact scale before adding more visual chrome. If a label needs emphasis, make it clearer or heavier, not louder.

**The Mono-Only-For-Files Rule.** Mono means path, script, command, or file name. Do not use it as personality.

## 4. Elevation

Narrative uses tonal layering first and shadow second. Most surfaces are flat dark planes separated by borders and background shifts. Shadows appear when a thing floats above the workspace: modals, photo thumbnails, full-screen media, dropdowns, and hover-lift media cards.

### Shadow Vocabulary
- **Media Lift** (`shadow-lg` to `shadow-xl`): Thumbnail cards, selected media, and hover states where the photo needs to feel selectable.
- **Modal Lift** (`shadow-2xl`): Export, loading, and processing dialogs that sit above the workspace.
- **Dropdown Lift** (`shadow-xl`): Project menus and compact overlays.
- **Glow Signal** (`blur-lg opacity-20`): Loading affordances only, usually with Soft Blue.

### Named Rules

**The Flat Workspace Rule.** Sidebars, headers, bars, and cards are flat at rest. If every panel casts a shadow, the hierarchy has failed.

**The Lift Means Temporary Rule.** Strong shadows belong to transient layers: dialogs, menus, overlays, and media in focus.

## 5. Components

### Buttons
- **Shape:** Compact rounded controls (0.375rem to 0.5rem radius), sized to preserve dense workflow.
- **Primary:** Action Blue background with Bright Ink text, 0.75rem vertical padding for major actions like Download Script, Import Trip, and active selection.
- **Hover / Focus:** Hover darkens or lightens the existing role color. Focus uses a 2px Focus Blue ring, never a decorative glow.
- **Secondary / Ghost / Tertiary:** Secondary buttons use Raised Slate and Bright Ink. Ghost icon buttons use transparent backgrounds at rest and Raised Slate on hover. Danger buttons use red only when the action can delete or fail data.

### Chips
- **Style:** Small rounded pills with Raised Slate background, Line Slate border, Body Ink text, and label-weight typography.
- **State:** Status chips show inbox counts, view context, assignment state, copy state, and temporary filters. A chip should name a live state, not decorate a row.

### Cards / Containers
- **Corner Style:** Gently rounded corners (0.5rem to 0.75rem), clipped media, and no nested card stacks.
- **Background:** Field Black for project tiles and inputs, Panel Slate for persistent chrome, Raised Slate for active or hover layers.
- **Shadow Strategy:** Cards are flat by default. Photo thumbnails may use Media Lift on hover or selection.
- **Border:** Line Slate borders establish structure. Use full borders, not colored side stripes.
- **Internal Padding:** Dense cards use 0.75rem. Modal and panel sections use 1rem to 1.5rem.

### Inputs / Fields
- **Style:** Field Black fill, Line Slate border, Bright Ink text, compact sans or mono depending on content.
- **Focus:** Remove default outline and use a 2px Focus Blue ring with transparent border shift.
- **Error / Disabled:** Error states use Danger Red surfaces and borders. Disabled states reduce contrast and must not mimic secondary actions.

### Navigation
- **Style:** Navigation is persistent, compact, and breadcrumb-like: `Narrative / Dashboard` or `Narrative / Project`. Headers use Panel Slate, Line Slate borders, and compact action clusters.
- **Default / Hover / Active:** Default controls stay neutral. Hover uses Raised Slate. Active routes and selected folders use Action Blue with Bright Ink.
- **Mobile Treatment:** Preserve action priority and keyboard affordance. Collapse sidebars before shrinking photo targets below usable size.

### Photo Grid And Strip

Photo media is the signature component. Thumbnails use square or video-ratio frames, clipped corners, object-cover imagery, bucket badges, selection rings, hover borders, and progress strips. The photo itself should remain visually dominant; metadata rides on the edge or overlay.

### MECE Bucket Controls

Bucket buttons are full-width, saturated, and data-bearing. Each bucket shows the key, label, and description together. Treat the color as a classification token, and pair it with text so color is never the only identifier.

## 6. Do's and Don'ts

### Do:
- **Do** keep the workspace dark slate and restrained so photos dominate the screen.
- **Do** reserve Action Blue for workflow momentum: focus, selection, import, export, progress, and active rows.
- **Do** pair every bucket color with the bucket key and label.
- **Do** use full borders and background shifts for status surfaces instead of ornamental accents.
- **Do** make file operations explicit with concrete labels, visible status, and reversible language.
- **Do** use mono for paths, file names, scripts, and commands.

### Don't:
- **Don't** create generic cloud-gallery aesthetics, social-media album polish, or decorative SaaS dashboards.
- **Don't** make local file operations feel casual or opaque.
- **Don't** use oversized cards, repeated icon-heading-text tiles, vague progress language, or UI chrome that competes with photos.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, callouts, or alerts.
- **Don't** use gradient text, decorative glassmorphism, or the hero-metric template.
- **Don't** use modals as the first design answer when inline status or progressive disclosure can explain the workflow.
