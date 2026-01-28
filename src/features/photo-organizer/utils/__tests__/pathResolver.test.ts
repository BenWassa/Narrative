import { describe, it, expect } from 'vitest';
import {
  resolveSourceRoot,
  resolveDestinationRoot,
  autoDetectIngestState,
  resolveMeceBucketPath,
} from '../pathResolver';
import type { ProjectPhoto, ProjectState } from '../../services/projectService';

describe('pathResolver', () => {
  const mockSettings = {
    autoDay: true,
    folderStructure: {
      daysFolder: '01_DAYS',
      archiveFolder: '98_ARCHIVE',
      favoritesFolder: 'FAV',
      metaFolder: '_meta',
    },
  };

  describe('resolveSourceRoot', () => {
    it('should return explicit sourceRoot if set', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        sourceRoot: '/custom/source',
        ingested: false,
        settings: mockSettings,
      };
      const photos: ProjectPhoto[] = [];

      const result = resolveSourceRoot(state as ProjectState, photos);
      expect(result).toBe('/custom/source');
    });

    it('should return project root for ingested projects', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        ingested: true,
        settings: mockSettings,
      };
      const photos: ProjectPhoto[] = [];

      const result = resolveSourceRoot(state as ProjectState, photos);
      expect(result).toBe('/project/root');
    });

    it('should detect common source path for non-ingested projects', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        ingested: false,
        settings: mockSettings,
      };
      const photos: ProjectPhoto[] = [
        {
          id: '1',
          filePath: '/photos/trip/IMG_001.jpg',
          originalName: 'IMG_001.jpg',
          currentName: 'IMG_001.jpg',
          timestamp: 0,
          day: null,
          bucket: null,
          sequence: null,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
        {
          id: '2',
          filePath: '/photos/trip/IMG_002.jpg',
          originalName: 'IMG_002.jpg',
          currentName: 'IMG_002.jpg',
          timestamp: 0,
          day: null,
          bucket: null,
          sequence: null,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
      ];

      const result = resolveSourceRoot(state as ProjectState, photos);
      expect(result).toBe('/photos/trip');
    });
  });

  describe('resolveDestinationRoot', () => {
    it('should return project root for ingested projects', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        ingested: true,
        settings: mockSettings,
      };
      const photos: ProjectPhoto[] = [];

      const result = resolveDestinationRoot(state as ProjectState, photos);
      expect(result).toBe('/project/root');
    });

    it('should return source root for non-ingested projects', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        ingested: false,
        settings: mockSettings,
      };
      const photos: ProjectPhoto[] = [
        {
          id: '1',
          filePath: '/photos/trip/IMG_001.jpg',
          originalName: 'IMG_001.jpg',
          currentName: 'IMG_001.jpg',
          timestamp: 0,
          day: null,
          bucket: null,
          sequence: null,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
      ];

      const result = resolveDestinationRoot(state as ProjectState, photos);
      expect(result).toBe('/photos/trip');
    });
  });

  describe('autoDetectIngestState', () => {
    it('should detect ingested state when photos are in 01_DAYS folder', () => {
      const photos: ProjectPhoto[] = [
        {
          id: '1',
          folderHierarchy: ['01_DAYS', 'Day 01', 'A_Establishing'],
          filePath: '/project/01_DAYS/Day 01/A_Establishing/photo.jpg',
          originalName: 'photo.jpg',
          currentName: 'photo.jpg',
          timestamp: 0,
          day: 1,
          bucket: 'A',
          sequence: 1,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
        {
          id: '2',
          folderHierarchy: ['01_DAYS', 'Day 01', 'B_People'],
          filePath: '/project/01_DAYS/Day 01/B_People/photo2.jpg',
          originalName: 'photo2.jpg',
          currentName: 'photo2.jpg',
          timestamp: 0,
          day: 1,
          bucket: 'B',
          sequence: 2,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
      ];

      const result = autoDetectIngestState(photos, mockSettings);
      expect(result).toBe(true);
    });

    it('should detect non-ingested state when photos are not in 01_DAYS folder', () => {
      const photos: ProjectPhoto[] = [
        {
          id: '1',
          folderHierarchy: ['Raw Photos', 'Day 1'],
          filePath: '/source/Raw Photos/Day 1/photo.jpg',
          originalName: 'photo.jpg',
          currentName: 'photo.jpg',
          timestamp: 0,
          day: null,
          bucket: null,
          sequence: null,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
      ];

      const result = autoDetectIngestState(photos, mockSettings);
      expect(result).toBe(false);
    });
  });

  describe('resolveMeceBucketPath', () => {
    it('should create bucket path inside day folder for ingested projects', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        ingested: true,
        settings: mockSettings,
        dayLabels: { 1: 'Day 01 - Iceland' },
      };
      const photos: ProjectPhoto[] = [];

      const result = resolveMeceBucketPath(state as ProjectState, photos, 1, 'A', 'Establishing');
      expect(result).toBe('/project/root/01_DAYS/Day 01 - Iceland/A_Establishing');
    });

    it('should create bucket path in source location for non-ingested projects', () => {
      const state: Partial<ProjectState> = {
        rootPath: '/project/root',
        ingested: false,
        settings: mockSettings,
      };
      const photos: ProjectPhoto[] = [
        {
          id: '1',
          filePath: '/photos/trip/IMG_001.jpg',
          originalName: 'IMG_001.jpg',
          currentName: 'IMG_001.jpg',
          timestamp: 0,
          day: 1,
          bucket: null,
          sequence: null,
          favorite: false,
          rating: 0,
          archived: false,
          thumbnail: '',
        },
      ];

      const result = resolveMeceBucketPath(state as ProjectState, photos, 1, 'A', 'Establishing');
      expect(result).toBe('/photos/trip/A_Establishing');
    });
  });
});
