# Architecture

## Overview

Narrative is a local-first, browser-based photo organizer. It reads folders with the File System Access API, keeps project state in the browser, and generates a rename script instead of modifying files directly.

## Core Flow

1. **StartScreen** lets users create a new project or open a recent one.
2. **OnboardingModal** collects a project name and scans the folder to detect day mappings.
3. **projectService** builds a `ProjectState` by scanning files and merging saved edits.
4. **PhotoOrganizer** drives the UI, selection, and bucket assignment.
5. **Export Script** is generated from current state for copy-based organization.

## Data Model

- `ProjectPhoto` includes original name, derived name, bucket, day, and archive status.
- `ProjectState` includes settings, labels, and edits.
- Edits are stored as a compact list keyed by file path and merged on load.

## Storage Strategy

- `localStorage` stores serialized `ProjectState` edits.
- IndexedDB stores directory handles for re-accessing folders.
- If permission is revoked, the user is prompted to reselect a folder.

## Folder Detection

`detectFolderStructure` infers day numbers from folder names and provides suggested mappings. These mappings are applied during project initialization.

## Archive Handling

Files inside the configured archive folder (default `98_ARCHIVE`) load as archived and are assigned the archive bucket.
