import { describe, it, expect } from 'vitest';
import { generateUndoScript } from '../exportManifest';
import type { ExportManifest } from '../../services/projectService';

describe('exportManifest', () => {
  describe('generateUndoScript', () => {
    it('should generate a valid undo script with file deletions', () => {
      const manifest: ExportManifest = {
        timestamp: 1234567890000,
        sourceRoot: '/source/photos',
        destinationRoot: '/project/root',
        ingested: true,
        operations: [
          {
            sourcePath: '/source/photos/day1/IMG_001.jpg',
            destinationPath: '/project/root/01_DAYS/Day 01/A_Establishing/Day1_A_001.jpg',
            fileSize: 1024000,
            operation: 'copy',
          },
          {
            sourcePath: '/source/photos/day1/IMG_002.jpg',
            destinationPath: '/project/root/01_DAYS/Day 01/B_People/Day1_B_002.jpg',
            fileSize: 2048000,
            operation: 'copy',
          },
        ],
      };

      const script = generateUndoScript(manifest);

      // Verify script header
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('Narrative Export Undo Script');

      // Verify metadata
      expect(script).toContain('Source root: /source/photos');
      expect(script).toContain('Destination root: /project/root');
      expect(script).toContain('Ingested: true');

      // Verify file deletions
      expect(script).toContain('/project/root/01_DAYS/Day 01/A_Establishing/Day1_A_001.jpg');
      expect(script).toContain('/project/root/01_DAYS/Day 01/B_People/Day1_B_002.jpg');

      // Verify size validation
      expect(script).toContain('FILE_SIZE');
      expect(script).toContain('1024000');
      expect(script).toContain('2048000');

      // Verify confirmation prompt
      expect(script).toContain('Type \\"DELETE\\" to confirm');
    });

    it('should handle empty operations list', () => {
      const manifest: ExportManifest = {
        timestamp: Date.now(),
        sourceRoot: '/source',
        destinationRoot: '/dest',
        ingested: false,
        operations: [],
      };

      const script = generateUndoScript(manifest);

      expect(script).toContain('This will delete 0 files');
      expect(script).toContain('#!/bin/bash');
    });

    it('should generate cleanup for empty directories', () => {
      const manifest: ExportManifest = {
        timestamp: Date.now(),
        sourceRoot: '/source',
        destinationRoot: '/dest',
        ingested: true,
        operations: [
          {
            sourcePath: '/source/photo.jpg',
            destinationPath: '/dest/bucket/subfolder/photo.jpg',
            fileSize: 1000,
            operation: 'copy',
          },
        ],
      };

      const script = generateUndoScript(manifest);

      // Should contain directory cleanup logic
      expect(script).toContain('Cleaning up empty directories');
      expect(script).toContain('rmdir');
    });
  });
});
