# Sprint 9: Detailed Implementation Guide

## Overview

This document provides step-by-step implementation details for Sprint 9: Workflow Optimization & Deterministic Ordering.

---

## Phase 1: Centralized Photo Ordering (S9-2)

### Task 1.1: Create Photo Ordering Utility

**File**: `src/features/photo-organizer/utils/photoOrdering.ts`

```typescript
/**
 * Centralized photo ordering utility
 * Ensures consistent ordering across all views (grid, viewer, strip)
 */

import type { ProjectPhoto } from '../services/projectService';

export interface SortOptions {
  groupBy?: 'subfolder' | 'bucket' | 'day' | null;
  separateVideos?: boolean;
  selectedDay?: number | null;
  getSubfolderGroup?: (photo: ProjectPhoto, day: number | null) => string;
  isVideo?: (photo: ProjectPhoto) => boolean;
}

export interface OrderingResult {
  photos: ProjectPhoto[];
  indexMap: Map<string, number>;
  groups?: Array<{ label: string; photos: ProjectPhoto[]; startIndex: number }>;
}

/**
 * Primary ordering logic:
 * 1. timestamp (ascending - chronological)
 * 2. filePath (alphabetical - maintains folder structure)
 * 3. originalName (alphabetical - stable within same folder)
 * 4. id (stable tie-breaker - ensures deterministic ordering)
 */
function comparePhotos(a: ProjectPhoto, b: ProjectPhoto): number {
  // Primary: timestamp
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }

  // Tie-breaker 1: filePath
  const pathA = a.filePath || a.originalName || '';
  const pathB = b.filePath || b.originalName || '';
  const pathCmp = pathA.localeCompare(pathB);
  if (pathCmp !== 0) return pathCmp;

  // Tie-breaker 2: originalName
  const nameCmp = (a.originalName || '').localeCompare(b.originalName || '');
  if (nameCmp !== 0) return nameCmp;

  // Tie-breaker 3: id (stable unique identifier)
  return a.id.localeCompare(b.id);
}

/**
 * Sort photos with optional grouping
 */
export function sortPhotos(photos: ProjectPhoto[], options: SortOptions = {}): OrderingResult {
  const { groupBy, separateVideos, selectedDay, getSubfolderGroup, isVideo } = options;

  // Step 1: Base sort (always apply)
  const sorted = [...photos].sort(comparePhotos);

  // Step 2: Apply grouping if requested
  if (groupBy === 'subfolder' && selectedDay != null && getSubfolderGroup) {
    return groupBySubfolder(sorted, selectedDay, getSubfolderGroup, separateVideos, isVideo);
  } else if (groupBy === 'bucket') {
    return groupByBucket(sorted, separateVideos, isVideo);
  } else if (groupBy === 'day') {
    return groupByDay(sorted, separateVideos, isVideo);
  }

  // Step 3: Separate videos if requested (without grouping)
  if (separateVideos && isVideo) {
    const stills = sorted.filter(p => !isVideo(p));
    const videos = sorted.filter(p => isVideo(p));
    const combined = [...stills, ...videos];
    return buildIndexMap(combined);
  }

  // No grouping: return sorted with index map
  return buildIndexMap(sorted);
}

function groupBySubfolder(
  sorted: ProjectPhoto[],
  selectedDay: number,
  getSubfolderGroup: (photo: ProjectPhoto, day: number | null) => string,
  separateVideos?: boolean,
  isVideo?: (photo: ProjectPhoto) => boolean,
): OrderingResult {
  // Group photos by subfolder
  const groups = new Map<string, ProjectPhoto[]>();

  sorted.forEach(photo => {
    const label = getSubfolderGroup(photo, selectedDay);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(photo);
  });

  // Sort groups: "Day Root" first, then alphabetical
  const sortedGroups = Array.from(groups.entries())
    .sort(([labelA], [labelB]) => {
      if (labelA === 'Day Root') return -1;
      if (labelB === 'Day Root') return 1;
      return labelA.localeCompare(labelB);
    })
    .map(([label, photos]) => ({ label, photos }));

  // Flatten groups, optionally separating videos within each group
  const orderedPhotos: ProjectPhoto[] = [];
  const groupsWithIndices: Array<{ label: string; photos: ProjectPhoto[]; startIndex: number }> =
    [];

  sortedGroups.forEach(group => {
    const startIndex = orderedPhotos.length;

    if (separateVideos && isVideo) {
      const stills = group.photos.filter(p => !isVideo(p));
      const videos = group.photos.filter(p => isVideo(p));
      orderedPhotos.push(...stills, ...videos);
    } else {
      orderedPhotos.push(...group.photos);
    }

    groupsWithIndices.push({ ...group, startIndex });
  });

  const indexMap = new Map<string, number>();
  orderedPhotos.forEach((photo, idx) => indexMap.set(photo.id, idx));

  return {
    photos: orderedPhotos,
    indexMap,
    groups: groupsWithIndices,
  };
}

function groupByBucket(
  sorted: ProjectPhoto[],
  separateVideos?: boolean,
  isVideo?: (photo: ProjectPhoto) => boolean,
): OrderingResult {
  // Group by bucket (A, B, C, D, E, M, X, null/undefined)
  const buckets = ['A', 'B', 'C', 'D', 'E', 'M', 'X', null];
  const groups = new Map<string | null, ProjectPhoto[]>();

  sorted.forEach(photo => {
    const bucket = photo.bucket || null;
    if (!groups.has(bucket)) {
      groups.set(bucket, []);
    }
    groups.get(bucket)!.push(photo);
  });

  const orderedPhotos: ProjectPhoto[] = [];
  buckets.forEach(bucket => {
    if (groups.has(bucket)) {
      const groupPhotos = groups.get(bucket)!;
      if (separateVideos && isVideo) {
        const stills = groupPhotos.filter(p => !isVideo(p));
        const videos = groupPhotos.filter(p => isVideo(p));
        orderedPhotos.push(...stills, ...videos);
      } else {
        orderedPhotos.push(...groupPhotos);
      }
    }
  });

  return buildIndexMap(orderedPhotos);
}

function groupByDay(
  sorted: ProjectPhoto[],
  separateVideos?: boolean,
  isVideo?: (photo: ProjectPhoto) => boolean,
): OrderingResult {
  const days = new Map<number | null, ProjectPhoto[]>();

  sorted.forEach(photo => {
    const day = photo.day ?? null;
    if (!days.has(day)) {
      days.set(day, []);
    }
    days.get(day)!.push(photo);
  });

  // Sort days numerically, null last
  const sortedDays = Array.from(days.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  const orderedPhotos: ProjectPhoto[] = [];
  sortedDays.forEach(day => {
    const groupPhotos = days.get(day)!;
    if (separateVideos && isVideo) {
      const stills = groupPhotos.filter(p => !isVideo(p));
      const videos = groupPhotos.filter(p => isVideo(p));
      orderedPhotos.push(...stills, ...videos);
    } else {
      orderedPhotos.push(...groupPhotos);
    }
  });

  return buildIndexMap(orderedPhotos);
}

function buildIndexMap(photos: ProjectPhoto[]): OrderingResult {
  const indexMap = new Map<string, number>();
  photos.forEach((photo, idx) => indexMap.set(photo.id, idx));
  return { photos, indexMap };
}

/**
 * Fast lookup: given a photo ID, get its index in the ordered array
 */
export function getPhotoIndex(photoId: string, indexMap: Map<string, number>): number {
  return indexMap.get(photoId) ?? -1;
}

/**
 * Navigate to next/previous photo in ordered list
 */
export function navigatePhotos(
  currentPhotoId: string,
  direction: 'next' | 'prev',
  result: OrderingResult,
  filter?: (photo: ProjectPhoto) => boolean,
): ProjectPhoto | null {
  const currentIndex = getPhotoIndex(currentPhotoId, result.indexMap);
  if (currentIndex === -1) return null;

  const step = direction === 'next' ? 1 : -1;
  let nextIndex = currentIndex + step;

  // If filter provided, skip photos until we find one that matches
  if (filter) {
    while (nextIndex >= 0 && nextIndex < result.photos.length) {
      if (filter(result.photos[nextIndex])) {
        return result.photos[nextIndex];
      }
      nextIndex += step;
    }
    return null; // No matching photo found
  }

  // No filter: just return next/prev if in bounds
  if (nextIndex >= 0 && nextIndex < result.photos.length) {
    return result.photos[nextIndex];
  }

  return null;
}
```

### Task 1.2: Create Ordering Tests

**File**: `src/features/photo-organizer/__tests__/photoOrdering.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { sortPhotos, navigatePhotos, getPhotoIndex } from '../utils/photoOrdering';
import type { ProjectPhoto } from '../services/projectService';

// Helper to create test photos
function createPhoto(overrides: Partial<ProjectPhoto>): ProjectPhoto {
  return {
    id: Math.random().toString(36),
    originalName: 'test.jpg',
    currentName: 'test.jpg',
    timestamp: Date.now(),
    thumbnail: '',
    archived: false,
    favorite: false,
    ...overrides,
  } as ProjectPhoto;
}

describe('photoOrdering', () => {
  describe('comparePhotos - tie-breaking', () => {
    it('should sort by timestamp first', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000 }),
        createPhoto({ id: 'b', timestamp: 500 }),
        createPhoto({ id: 'c', timestamp: 1500 }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['b', 'a', 'c']);
    });

    it('should break ties by filePath', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000, filePath: 'folder2/test.jpg' }),
        createPhoto({ id: 'b', timestamp: 1000, filePath: 'folder1/test.jpg' }),
        createPhoto({ id: 'c', timestamp: 1000, filePath: 'folder3/test.jpg' }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['b', 'a', 'c']);
    });

    it('should break ties by originalName when filePath is same', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000, filePath: 'folder/c.jpg', originalName: 'c.jpg' }),
        createPhoto({ id: 'b', timestamp: 1000, filePath: 'folder/a.jpg', originalName: 'a.jpg' }),
        createPhoto({ id: 'c', timestamp: 1000, filePath: 'folder/b.jpg', originalName: 'b.jpg' }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('should break ties by id when everything else is equal', () => {
      const photos = [
        createPhoto({ id: 'ccc', timestamp: 1000, filePath: 'test.jpg', originalName: 'test.jpg' }),
        createPhoto({ id: 'aaa', timestamp: 1000, filePath: 'test.jpg', originalName: 'test.jpg' }),
        createPhoto({ id: 'bbb', timestamp: 1000, filePath: 'test.jpg', originalName: 'test.jpg' }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['aaa', 'bbb', 'ccc']);
    });
  });

  describe('video separation', () => {
    const isVideo = (p: ProjectPhoto) => p.mimeType?.startsWith('video/') ?? false;

    it('should separate videos when requested', () => {
      const photos = [
        createPhoto({ id: 'v1', timestamp: 1000, mimeType: 'video/mp4' }),
        createPhoto({ id: 'p1', timestamp: 1001, mimeType: 'image/jpeg' }),
        createPhoto({ id: 'v2', timestamp: 1002, mimeType: 'video/mp4' }),
        createPhoto({ id: 'p2', timestamp: 1003, mimeType: 'image/jpeg' }),
      ];

      const result = sortPhotos(photos, { separateVideos: true, isVideo });

      // Stills first, then videos
      expect(result.photos.map(p => p.id)).toEqual(['p1', 'p2', 'v1', 'v2']);
    });
  });

  describe('subfolder grouping', () => {
    const getSubfolderGroup = (photo: ProjectPhoto, day: number | null) => {
      if (!photo.filePath) return 'Day Root';
      const parts = photo.filePath.split('/');
      return parts.length > 2 ? parts[2] : 'Day Root';
    };

    it('should group by subfolder while preserving timestamp order', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1003, filePath: '01_DAYS/Day 01/subfolder/a.jpg' }),
        createPhoto({ id: 'b', timestamp: 1001, filePath: '01_DAYS/Day 01/b.jpg' }), // Day Root
        createPhoto({ id: 'c', timestamp: 1002, filePath: '01_DAYS/Day 01/subfolder/c.jpg' }),
      ];

      const result = sortPhotos(photos, {
        groupBy: 'subfolder',
        selectedDay: 1,
        getSubfolderGroup,
      });

      // Day Root first, then subfolder (chronological within each)
      expect(result.photos.map(p => p.id)).toEqual(['b', 'c', 'a']);
      expect(result.groups).toHaveLength(2);
      expect(result.groups![0].label).toBe('Day Root');
      expect(result.groups![1].label).toBe('subfolder');
    });
  });

  describe('navigatePhotos', () => {
    it('should navigate to next photo', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000 }),
        createPhoto({ id: 'b', timestamp: 1001 }),
        createPhoto({ id: 'c', timestamp: 1002 }),
      ];

      const result = sortPhotos(photos);
      const next = navigatePhotos('a', 'next', result);

      expect(next?.id).toBe('b');
    });

    it('should navigate to previous photo', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000 }),
        createPhoto({ id: 'b', timestamp: 1001 }),
        createPhoto({ id: 'c', timestamp: 1002 }),
      ];

      const result = sortPhotos(photos);
      const prev = navigatePhotos('c', 'prev', result);

      expect(prev?.id).toBe('b');
    });

    it('should skip to next unassigned photo when filter provided', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000, bucket: undefined }),
        createPhoto({ id: 'b', timestamp: 1001, bucket: 'A' }),
        createPhoto({ id: 'c', timestamp: 1002, bucket: 'B' }),
        createPhoto({ id: 'd', timestamp: 1003, bucket: undefined }),
      ];

      const result = sortPhotos(photos);
      const filter = (p: ProjectPhoto) => !p.bucket;
      const next = navigatePhotos('a', 'next', result, filter);

      expect(next?.id).toBe('d'); // Skips b and c
    });

    it('should return null when no next photo exists', () => {
      const photos = [createPhoto({ id: 'a', timestamp: 1000 })];
      const result = sortPhotos(photos);
      const next = navigatePhotos('a', 'next', result);

      expect(next).toBeNull();
    });
  });
});
```

### Task 1.3: Refactor PhotoGrid to Use Central Ordering

**File**: `src/features/photo-organizer/components/PhotoGrid.tsx`

**Changes**:

1. Remove `stableSortPhotos` function
2. Import `sortPhotos` from `utils/photoOrdering`
3. Update rendering logic to use `OrderingResult`

```typescript
// OLD:
const baseOrderedPhotos = stableSortPhotos(displayPhotos);

// NEW:
const orderingResult = sortPhotos(displayPhotos, {
  groupBy: selectedDay !== null ? 'subfolder' : null,
  separateVideos: true,
  selectedDay,
  getSubfolderGroup,
  isVideo: isVideoPhoto,
});
const orderedDisplayPhotos = orderingResult.photos;
const orderedIndex = orderingResult.indexMap;
```

### Task 1.4: Update useFolderModel

**File**: `src/features/photo-organizer/hooks/useFolderModel.ts`

Ensure `filteredPhotos` uses the central ordering utility for consistency.

---

## Phase 2: Workflow Speed Improvements (S9-1)

### Task 2.1: Add Skip Assigned Toggle Shortcut

**File**: `src/features/photo-organizer/hooks/useKeyboardShortcuts.ts`

```typescript
// Add to handleKeyPress:
if (e.key === 'H' && e.shiftKey) {
  e.preventDefault();
  const newValue = !hideAssigned;
  onSetHideAssigned(newValue);
  onShowToast?.(newValue ? 'Hiding assigned photos' : 'Showing all photos', 'info');
  return;
}
```

**File**: `src/features/photo-organizer/components/ProjectHeader.tsx`

Add visual indicator when skip mode is active:

```tsx
{
  hideAssigned && (
    <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg">
      <span className="text-xs text-blue-300">Skip Assigned: ON</span>
      <kbd className="text-xs text-blue-200">Shift+H to toggle</kbd>
    </div>
  );
}
```

### Task 2.2: Implement Smart Auto-Advance

**File**: `src/features/photo-organizer/ui/PhotoViewer.tsx`

```typescript
// Add to handleKeyDown:
if (e.key === ' ' || e.key.toLowerCase() === 'n') {
  e.preventDefault();
  // Navigate to next unassigned photo
  const filter = (p: ProjectPhoto) => !p.bucket && !p.archived;
  const nextPhoto = navigatePhotos(currentPhoto.id, 'next', orderingResult, filter);

  if (nextPhoto) {
    onNavigate(nextPhoto.id);
    onShowToast?.(`${remainingUnassigned - 1} unassigned remaining`, 'info', { durationMs: 1000 });
  } else {
    onShowToast?.('No more unassigned photos', 'info');
  }
  return;
}
```

Add unassigned counter in viewer UI:

```tsx
<div className="absolute top-4 right-4 bg-black/70 px-3 py-1 rounded-lg">
  <span className="text-sm text-gray-300">
    {currentIndex + 1} / {filteredPhotos.length}
  </span>
  {unassignedCount > 0 && (
    <span className="ml-2 text-xs text-blue-300">({unassignedCount} unassigned)</span>
  )}
</div>
```

### Task 2.3: Add Bulk Assignment

**File**: `src/features/photo-organizer/hooks/useKeyboardShortcuts.ts`

```typescript
// Modify bucket assignment logic:
const validBuckets = ['A', 'B', 'C', 'D', 'E', 'M', 'X'];
if (validBuckets.includes(e.key.toUpperCase())) {
  e.preventDefault();
  const bucket = e.key.toUpperCase();

  if (selectedPhotos.size > 1) {
    // Bulk assignment
    const photoIds = Array.from(selectedPhotos);
    onAssignBucket(photoIds, bucket);
    onShowToast?.(`Assigned ${photoIds.length} photos to bucket ${bucket}`, 'info');

    // Clear selection after bulk assignment
    onSetSelectedPhotos(new Set());
  } else if (primaryId) {
    // Single assignment
    const newBucket = currentPhoto.bucket === bucket ? '' : bucket;
    onAssignBucket([primaryId], newBucket);

    // Auto-advance if assigning (not un-assigning)
    if (newBucket && !e.shiftKey) {
      const nextPhoto = navigatePhotos(primaryId, 'next', orderingResult);
      if (nextPhoto) {
        onSetFocusedPhoto(nextPhoto.id);
        onSetSelectedPhotos(new Set([nextPhoto.id]));
      }
    }
  }
  return;
}
```

### Task 2.4: Add J/K Navigation

**File**: `src/features/photo-organizer/hooks/useKeyboardShortcuts.ts`

```typescript
// Add vim-style navigation
if (e.key === 'j' || e.key === 'J') {
  e.preventDefault();
  const filter = e.shiftKey ? (p: ProjectPhoto) => !p.bucket : undefined;
  const next = navigatePhotos(primaryId, 'next', orderingResult, filter);

  if (next) {
    onSetFocusedPhoto(next.id);
    onSetSelectedPhotos(new Set([next.id]));
    onSetLastSelectedIndex(getPhotoIndex(next.id, orderingResult.indexMap));
  }
  return;
}

if (e.key === 'k' || e.key === 'K') {
  e.preventDefault();
  const filter = e.shiftKey ? (p: ProjectPhoto) => !p.bucket : undefined;
  const prev = navigatePhotos(primaryId, 'prev', orderingResult, filter);

  if (prev) {
    onSetFocusedPhoto(prev.id);
    onSetSelectedPhotos(new Set([prev.id]));
    onSetLastSelectedIndex(getPhotoIndex(prev.id, orderingResult.indexMap));
  }
  return;
}
```

### Task 2.5: Add Performance Instrumentation

**File**: `src/features/photo-organizer/hooks/useProjectState.ts`

```typescript
// Add performance logging on project load
const loadProject = useCallback(async (rootPath: string) => {
  const startTime = performance.now();
  console.log('[Performance] Starting project load:', rootPath);

  // ... existing load logic ...

  const endTime = performance.now();
  const duration = endTime - startTime;
  console.log('[Performance] Project loaded in:', duration.toFixed(2), 'ms');
  console.log('[Performance] Photo count:', photos.length);
  console.log('[Performance] Time per photo:', (duration / photos.length).toFixed(2), 'ms');

  if (duration > 5000) {
    showToast('Large project loaded. Performance may be slower.', 'info');
  }
}, []);
```

**File**: Create new debug overlay component

`src/features/photo-organizer/components/DebugOverlay.tsx`

```typescript
import React, { useEffect, useState } from 'react';

interface DebugOverlayProps {
  enabled: boolean;
  photos: number;
  filteredPhotos: number;
  selectedPhotos: number;
  currentView: string;
}

export default function DebugOverlay({
  enabled,
  photos,
  filteredPhotos,
  selectedPhotos,
  currentView,
}: DebugOverlayProps) {
  const [renderTime, setRenderTime] = useState(0);

  useEffect(() => {
    const start = performance.now();
    return () => {
      const end = performance.now();
      setRenderTime(end - start);
    };
  });

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white text-xs p-3 rounded-lg font-mono z-50">
      <div className="font-bold mb-2">Debug Info</div>
      <div>Total Photos: {photos}</div>
      <div>Filtered: {filteredPhotos}</div>
      <div>Selected: {selectedPhotos}</div>
      <div>View: {currentView}</div>
      <div>Last Render: {renderTime.toFixed(2)}ms</div>
      <div className="mt-2 text-gray-400">Press Ctrl+Shift+D to toggle</div>
    </div>
  );
}
```

---

## Phase 3: Performance Optimization (S9-3)

### Task 3.1: Profile Current Performance

Create test script to generate large project:

**File**: `scripts/generate_test_project.js`

```javascript
// Generate 1000+ dummy photos for performance testing
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './test-projects/large-project';
const PHOTO_COUNT = 1000;

// Create simple 1x1 pixel JPEG
const JPEG_DATA = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (let i = 1; i <= PHOTO_COUNT; i++) {
  const day = Math.floor((i - 1) / 100) + 1;
  const dayFolder = path.join(OUTPUT_DIR, `01_DAYS/Day ${String(day).padStart(2, '0')}`);
  fs.mkdirSync(dayFolder, { recursive: true });

  const filename = `IMG_${String(i).padStart(4, '0')}.jpg`;
  fs.writeFileSync(path.join(dayFolder, filename), JPEG_DATA);
}

console.log(`Generated ${PHOTO_COUNT} test photos in ${OUTPUT_DIR}`);
```

### Task 3.2: Implement Virtual Scrolling

**Install dependency**:

```bash
npm install react-window
```

**File**: `src/features/photo-organizer/components/VirtualPhotoGrid.tsx`

```typescript
import React, { useCallback, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { ProjectPhoto } from '../services/projectService';

interface VirtualPhotoGridProps {
  photos: ProjectPhoto[];
  selectedPhotos: Set<string>;
  onSelectPhoto: (photoId: string) => void;
  onOpenViewer: (photoId: string) => void;
  // ... other props
}

const COLUMN_COUNT = 5;
const CELL_SIZE = 200; // Width/height of each cell
const GAP = 12; // Gap between cells

export default function VirtualPhotoGrid({
  photos,
  selectedPhotos,
  onSelectPhoto,
  onOpenViewer,
}: VirtualPhotoGridProps) {
  const rowCount = Math.ceil(photos.length / COLUMN_COUNT);

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: any) => {
      const photoIndex = rowIndex * COLUMN_COUNT + columnIndex;
      if (photoIndex >= photos.length) return null;

      const photo = photos[photoIndex];
      const isSelected = selectedPhotos.has(photo.id);

      return (
        <div
          style={{
            ...style,
            left: style.left + GAP,
            top: style.top + GAP,
            width: style.width - GAP,
            height: style.height - GAP,
          }}
          onClick={() => onSelectPhoto(photo.id)}
          onDoubleClick={() => onOpenViewer(photo.id)}
          className={`cursor-pointer rounded-lg overflow-hidden ${
            isSelected ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          {photo.thumbnail ? (
            <img
              src={photo.thumbnail}
              alt={photo.currentName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <span className="text-xs text-gray-400">{photo.currentName}</span>
            </div>
          )}
        </div>
      );
    },
    [photos, selectedPhotos, onSelectPhoto, onOpenViewer],
  );

  return (
    <Grid
      columnCount={COLUMN_COUNT}
      columnWidth={CELL_SIZE}
      height={800} // Set based on viewport
      rowCount={rowCount}
      rowHeight={CELL_SIZE}
      width={COLUMN_COUNT * CELL_SIZE}
    >
      {Cell}
    </Grid>
  );
}
```

### Task 3.3: Optimize Thumbnail Loading

**File**: `src/features/photo-organizer/utils/thumbnailCache.ts`

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ThumbnailDB extends DBSchema {
  thumbnails: {
    key: string; // photo ID
    value: {
      id: string;
      thumbnail: string;
      timestamp: number;
    };
  };
}

class ThumbnailCache {
  private db: IDBPDatabase<ThumbnailDB> | null = null;

  async init() {
    this.db = await openDB<ThumbnailDB>('narrative-thumbnails', 1, {
      upgrade(db) {
        db.createObjectStore('thumbnails', { keyPath: 'id' });
      },
    });
  }

  async get(photoId: string): Promise<string | null> {
    if (!this.db) await this.init();
    const entry = await this.db!.get('thumbnails', photoId);
    return entry?.thumbnail || null;
  }

  async set(photoId: string, thumbnail: string) {
    if (!this.db) await this.init();
    await this.db!.put('thumbnails', {
      id: photoId,
      thumbnail,
      timestamp: Date.now(),
    });
  }

  async clear() {
    if (!this.db) await this.init();
    await this.db!.clear('thumbnails');
  }
}

export const thumbnailCache = new ThumbnailCache();
```

Use in `projectService.ts`:

```typescript
// Before generating thumbnail:
const cached = await thumbnailCache.get(photoId);
if (cached) return cached;

// After generating:
await thumbnailCache.set(photoId, thumbnailUrl);
```

---

## Testing Strategy

### Unit Tests

- [x] Photo ordering (all tie-breakers)
- [ ] Navigation with filters
- [ ] Grouping logic (subfolder, bucket, day)
- [ ] Index map generation

### Integration Tests

- [ ] Grid ordering matches viewer ordering
- [ ] Keyboard navigation in grid
- [ ] Bulk assignment workflow
- [ ] Skip assigned mode
- [ ] Auto-advance in viewer

### Performance Tests

- [ ] Load 1000 photos in <3s
- [ ] Smooth scrolling at 60fps
- [ ] Virtual grid vs regular grid comparison
- [ ] Memory usage over time

### Manual Testing

- [ ] Test with real photo project (500+ photos)
- [ ] Test all new keyboard shortcuts
- [ ] Test workflow: open → filter → assign → export
- [ ] Test edge cases (no photos, single photo, all assigned)

---

## Rollout Plan

1. **Merge S9-2 first** (ordering) - Critical foundation
2. **Test thoroughly** - No regressions
3. **Merge S9-1** (workflow) - Additive features
4. **Gather feedback** - Real usage data
5. **Merge S9-3** (performance) - Optimization based on actual bottlenecks

## Documentation Updates

- [x] Update README.md with new keyboard shortcuts
- [x] Update ARCHITECTURE.md with ordering spec
- [x] Update HelpModal.tsx with new shortcuts
- [ ] Create performance benchmarking guide
- [ ] Document virtual scrolling implementation

---

## Success Criteria

- ✅ All tests pass
- ✅ <3s load time for 1000 photos
- ✅ Consistent ordering across all views
- ✅ Smooth 60fps scrolling
- ✅ No regressions in existing features
- ✅ Can organize 100 photos in <2 minutes
- ✅ Documentation complete

---

Last Updated: 2026-01-27  
Status: Ready for Implementation
