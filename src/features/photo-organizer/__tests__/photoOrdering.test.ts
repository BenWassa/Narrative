import { describe, expect, it } from 'vitest';

import type { ProjectPhoto } from '../services/projectService';
import { getPhotoIndex, navigatePhotos, sortPhotos } from '../utils/photoOrdering';

function createPhoto(overrides: Partial<ProjectPhoto>): ProjectPhoto {
  return {
    id: Math.random().toString(36),
    originalName: 'test.jpg',
    currentName: 'test.jpg',
    timestamp: Date.now(),
    thumbnail: '',
    archived: false,
    favorite: false,
    day: null,
    bucket: null,
    sequence: null,
    rating: 0,
    ...overrides,
  } as ProjectPhoto;
}

describe('photoOrdering', () => {
  describe('comparePhotos - tie-breaking', () => {
    it('sorts by timestamp first', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000 }),
        createPhoto({ id: 'b', timestamp: 500 }),
        createPhoto({ id: 'c', timestamp: 1500 }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['b', 'a', 'c']);
    });

    it('breaks ties by filePath', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000, filePath: 'folder2/test.jpg' }),
        createPhoto({ id: 'b', timestamp: 1000, filePath: 'folder1/test.jpg' }),
        createPhoto({ id: 'c', timestamp: 1000, filePath: 'folder3/test.jpg' }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['b', 'a', 'c']);
    });

    it('breaks ties by originalName when filePath is the same', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000, filePath: 'folder/a.jpg', originalName: 'c.jpg' }),
        createPhoto({ id: 'b', timestamp: 1000, filePath: 'folder/a.jpg', originalName: 'a.jpg' }),
        createPhoto({ id: 'c', timestamp: 1000, filePath: 'folder/a.jpg', originalName: 'b.jpg' }),
      ];

      const result = sortPhotos(photos);
      expect(result.photos.map(p => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('breaks ties by id when everything else is equal', () => {
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
    const isVideo = (photo: ProjectPhoto) => photo.mimeType?.startsWith('video/') ?? false;

    it('separates videos when requested', () => {
      const photos = [
        createPhoto({ id: 'v1', timestamp: 1000, mimeType: 'video/mp4' }),
        createPhoto({ id: 'p1', timestamp: 1001, mimeType: 'image/jpeg' }),
        createPhoto({ id: 'v2', timestamp: 1002, mimeType: 'video/mp4' }),
        createPhoto({ id: 'p2', timestamp: 1003, mimeType: 'image/jpeg' }),
      ];

      const result = sortPhotos(photos, { separateVideos: true, isVideo });
      expect(result.photos.map(p => p.id)).toEqual(['p1', 'p2', 'v1', 'v2']);
    });
  });

  describe('subfolder grouping', () => {
    const getSubfolderGroup = (photo: ProjectPhoto) => {
      if (!photo.filePath) return 'Day Root';
      const parts = photo.filePath.split('/');
      return parts.length > 3 ? parts[2] : 'Day Root';
    };

    it('groups by subfolder while preserving timestamp order', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1003, filePath: '01_DAYS/Day 01/subfolder/a.jpg' }),
        createPhoto({ id: 'b', timestamp: 1001, filePath: '01_DAYS/Day 01/b.jpg' }),
        createPhoto({ id: 'c', timestamp: 1002, filePath: '01_DAYS/Day 01/subfolder/c.jpg' }),
      ];

      const result = sortPhotos(photos, {
        groupBy: 'subfolder',
        selectedDay: 1,
        getSubfolderGroup: (photo, _day) => getSubfolderGroup(photo),
      });

      expect(result.photos.map(p => p.id)).toEqual(['b', 'c', 'a']);
      expect(result.groups).toHaveLength(2);
      expect(result.groups?.[0].label).toBe('Day Root');
      expect(result.groups?.[1].label).toBe('subfolder');
    });
  });

  describe('navigatePhotos', () => {
    it('navigates to the next photo', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000 }),
        createPhoto({ id: 'b', timestamp: 1001 }),
        createPhoto({ id: 'c', timestamp: 1002 }),
      ];

      const result = sortPhotos(photos);
      const next = navigatePhotos('a', 'next', result);

      expect(next?.id).toBe('b');
      expect(getPhotoIndex('b', result.indexMap)).toBe(1);
    });

    it('navigates to the previous photo', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000 }),
        createPhoto({ id: 'b', timestamp: 1001 }),
        createPhoto({ id: 'c', timestamp: 1002 }),
      ];

      const result = sortPhotos(photos);
      const prev = navigatePhotos('c', 'prev', result);

      expect(prev?.id).toBe('b');
    });

    it('skips to the next matching photo when a filter is provided', () => {
      const photos = [
        createPhoto({ id: 'a', timestamp: 1000, bucket: null }),
        createPhoto({ id: 'b', timestamp: 1001, bucket: 'A' }),
        createPhoto({ id: 'c', timestamp: 1002, bucket: 'B' }),
        createPhoto({ id: 'd', timestamp: 1003, bucket: null }),
      ];

      const result = sortPhotos(photos);
      const filter = (photo: ProjectPhoto) => !photo.bucket;
      const next = navigatePhotos('a', 'next', result, filter);

      expect(next?.id).toBe('d');
    });

    it('returns null when no next photo exists', () => {
      const photos = [createPhoto({ id: 'a', timestamp: 1000 })];
      const result = sortPhotos(photos);
      const next = navigatePhotos('a', 'next', result);

      expect(next).toBeNull();
    });
  });
});
