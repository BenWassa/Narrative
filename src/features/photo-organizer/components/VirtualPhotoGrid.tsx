import React, { useCallback, useMemo } from 'react';
import { Grid } from 'react-window';

import type { ProjectPhoto } from '../services/projectService';

interface VirtualPhotoGridProps {
  photos: ProjectPhoto[];
  selectedPhotos: Set<string>;
  onSelectPhoto: (photoId: string) => void;
  onOpenViewer: (photoId: string) => void;
  height?: number;
  width?: number;
  columnCount?: number;
  cellSize?: number;
  gap?: number;
}

const DEFAULT_COLUMN_COUNT = 5;
const DEFAULT_CELL_SIZE = 200;
const DEFAULT_GAP = 12;

export default function VirtualPhotoGrid({
  photos,
  selectedPhotos,
  onSelectPhoto,
  onOpenViewer,
  height = 800,
  width,
  columnCount = DEFAULT_COLUMN_COUNT,
  cellSize = DEFAULT_CELL_SIZE,
  gap = DEFAULT_GAP,
}: VirtualPhotoGridProps) {
  const resolvedWidth = width ?? columnCount * cellSize;
  const rowCount = useMemo(
    () => Math.ceil(photos.length / columnCount),
    [photos.length, columnCount],
  );

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: any) => {
      const photoIndex = rowIndex * columnCount + columnIndex;
      if (photoIndex >= photos.length) return null;

      const photo = photos[photoIndex];
      const isSelected = selectedPhotos.has(photo.id);

      const adjustedStyle: React.CSSProperties = {
        ...style,
        left: (style.left as number) + gap,
        top: (style.top as number) + gap,
        width: (style.width as number) - gap,
        height: (style.height as number) - gap,
      };

      return (
        <div
          style={adjustedStyle}
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
    [columnCount, gap, onOpenViewer, onSelectPhoto, photos, selectedPhotos],
  );

  return (
    <Grid
      columnCount={columnCount}
      columnWidth={cellSize}
      height={height}
      rowCount={rowCount}
      rowHeight={cellSize}
      width={resolvedWidth}
    >
      {Cell}
    </Grid>
  );
}
