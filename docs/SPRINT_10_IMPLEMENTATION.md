# Sprint 10 Implementation: Ingest-Aware Export + Undo

## Overview

Sprint 10 adds explicit "ingest" state tracking and modifies export behavior to honor whether photos have been ingested into the project or are being organized from their source location.

## S10-1: Ingest State Definition

### Ingest State Concept

**Ingested**: Photos have been copied/moved into the project structure (e.g., into `01_DAYS/Day 02/Diving photos/`). The project folder IS the source of truth.

**Not Ingested**: Photos remain in their original location outside the project structure. The project only tracks metadata and assignments.

### Data Model Changes

#### ProjectState Interface

```typescript
export interface ProjectState {
  projectName: string;
  rootPath: string;
  photos: ProjectPhoto[];
  settings: ProjectSettings;
  dayLabels?: Record<string, string>;
  dayContainers?: string[];
  lastModified?: number;

  // NEW: Ingest tracking
  ingested?: boolean; // Whether photos have been ingested into project structure
  sourceRoot?: string; // Original source path (for non-ingested projects)
  lastExportManifest?: ExportManifest; // Last export operation for undo
}
```

#### ExportManifest Interface

```typescript
export interface ExportManifest {
  timestamp: number;
  operations: ExportOperation[];
  sourceRoot: string;
  destinationRoot: string;
  ingested: boolean;
}

export interface ExportOperation {
  sourcePath: string;
  destinationPath: string;
  fileSize: number;
  checksum?: string;
  operation: 'copy' | 'move';
}
```

### Path Resolution Rules

#### Source Root Resolution

1. **Ingested projects**: Source root = project root path (photos are already in project)
2. **Not ingested**: Source root = detected common path from photo file paths

#### Destination Root Resolution

1. **Ingested projects**:
   - Destination = existing day folder structure within project
   - Create MECE buckets: `01_DAYS/Day 02/C_Culture-Detail/`
2. **Not ingested**:
   - Destination = MECE buckets created in the source folder
   - Create buckets: `Original-Folder/A_Establishing/`, `Original-Folder/B_People/`, etc.

### Export Behavior Matrix

| Ingest State | Source Location                 | Destination Location                          | MECE Folder Creation |
| ------------ | ------------------------------- | --------------------------------------------- | -------------------- |
| Ingested     | `01_DAYS/Day 02/Diving photos/` | `01_DAYS/Day 02/C_Culture-Detail/`            | Inside day folder    |
| Not Ingested | `/Users/me/Photos/Trip/Day02/`  | `/Users/me/Photos/Trip/Day02/A_Establishing/` | Inside source folder |

## S10-2: Export Script Updates

### Key Changes

1. Compute source and destination roots based on ingest state
2. Create MECE folders in correct location
3. Add `--dry-run` mode that scans filesystem for accurate counts
4. No hard-coded paths

### Script Structure

```bash
#!/bin/bash
# Narrative Export Script

# Detect ingest state
INGESTED=true/false

# Resolve paths
SOURCE_ROOT="..."
DEST_ROOT="..."

# Dry-run: scan and preview
if [ "$1" == "--dry-run" ]; then
  # Show what would happen
  exit 0
fi

# Execute: copy files
# ...
```

## S10-3: Undo/Redo Implementation

### Manifest Generation

- Create JSON manifest for each export operation
- Store in project metadata or alongside script
- Include file checksums (SHA256) or sizes for validation

### Undo Process

1. Load manifest from last export
2. Verify destination files match checksums
3. Delete only files that match (safety check)
4. Remove empty directories
5. Mark as reverted in manifest

### Safety Features

- Idempotency: track reverted state
- Checksum validation before deletion
- Skip mismatched files with warning
- Dry-run undo mode

## S10-4: UI Integration

### Project Header

- Show ingest status indicator
- Toggle between ingested/not ingested modes (if applicable)

### Export Modal

- Display computed source root
- Display computed destination root
- Show preview of where MECE folders will be created
- "Undo last export" button (if manifest exists)

### State Management

- Track ingest state in project metadata
- Persist last export manifest
- Update UI based on ingest mode

## S10-5: Testing

### Unit Tests

- Path resolution for ingested vs not ingested
- Manifest generation and parsing
- Undo operation logic

### Integration Tests

- Export script generation for both modes
- End-to-end export with dry-run
- Undo operation

### Manual Testing Checklist

- [ ] Create ingested project, assign buckets, export
- [ ] Verify MECE folders created in day folders
- [ ] Create not-ingested project, assign buckets, export
- [ ] Verify MECE folders created in source folders
- [ ] Test undo operation
- [ ] Verify undo doesn't delete modified files
- [ ] Test with missing source files

## Implementation Notes

### Phase 1: Data Model (S10-1) ✓

- Add `ingested`, `sourceRoot` to ProjectState
- Add ExportManifest interfaces
- Update serialization/deserialization
- Document path resolution rules

### Phase 2: Path Resolution

- Implement `resolveSourceRoot()`
- Implement `resolveDestinationRoot()`
- Create path resolver utility

### Phase 3: Export Updates (S10-2)

- Update export script generator
- Add dry-run mode
- Implement accurate filesystem scanning
- Use computed roots (no hard-coded paths)

### Phase 4: Undo (S10-3)

- Generate manifest during export
- Implement undo script generation
- Add checksum/size validation
- Handle edge cases

### Phase 5: UI (S10-4)

- Add ingest indicator
- Update export modal
- Add undo button
- Show destination preview

### Phase 6: Tests (S10-5)

- Write unit tests
- Write integration tests
- Manual test execution

---

## Migration Strategy

### Backward Compatibility

Existing projects without `ingested` flag will default to `ingested = true` (current behavior).

### Auto-Detection

On project load, if `ingested` is undefined:

- Check if photos have `folderHierarchy` starting with `01_DAYS`
- If yes, mark as ingested
- If no, mark as not ingested and detect source root
