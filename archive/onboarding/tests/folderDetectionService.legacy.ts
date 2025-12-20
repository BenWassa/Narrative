import { describe, it, expect } from 'vitest';
import { detectFolderStructure, generateDryRunSummary } from '../folderDetectionService';

describe('folderDetectionService', () => {
  describe('detectFolderStructure', () => {
    it('detects day prefix patterns (Day 1, D01, etc.)', () => {
      const folders = ['Day 1', 'Day 2', 'Day 3'];
      const result = detectFolderStructure(folders);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        folder: 'Day 1',
        detectedDay: 1,
        confidence: 'high',
        patternMatched: 'day_prefix',
      });
      expect(result[1]).toMatchObject({
        detectedDay: 2,
        confidence: 'high',
      });
      expect(result[2]).toMatchObject({
        detectedDay: 3,
        confidence: 'high',
      });
    });

    it('detects D prefix variations', () => {
      const folders = ['D01', 'D_2', 'D-3', 'D1 Iceland'];
      const result = detectFolderStructure(folders);

      expect(result).toHaveLength(4);
      // After sorting, D01 and D1 Iceland are both day 1
      expect(result[0].detectedDay).toBe(1);
      expect(result[1].detectedDay).toBe(1); // D1 Iceland also maps to day 1
      expect(result[2].detectedDay).toBe(2);
      expect(result[3].detectedDay).toBe(3);
      expect(result[0].confidence).toBe('high');
    });

    it('detects ISO date patterns', () => {
      const folders = ['2024-03-15', '2024-03-16', '2024-03-17'];
      const result = detectFolderStructure(folders, {
        tripStart: '2024-03-15',
      });

      expect(result).toHaveLength(3);
      expect(result[0].detectedDay).toBe(1);
      expect(result[1].detectedDay).toBe(2);
      expect(result[2].detectedDay).toBe(3);
      expect(result[0].patternMatched).toBe('iso_date');
      expect(result[0].confidence).toBe('high'); // high because tripStart provided
    });

    it('detects ISO date patterns with underscores', () => {
      const folders = ['2024_03_15', '2024_03_16'];
      const result = detectFolderStructure(folders, {
        tripStart: '2024-03-15',
      });

      expect(result).toHaveLength(2);
      expect(result[0].detectedDay).toBe(1);
      expect(result[1].detectedDay).toBe(2);
      expect(result[0].patternMatched).toBe('iso_date');
    });

    it('detects numeric prefixes as medium confidence', () => {
      const folders = ['1 Iceland', '02_Reykjavik', '3-Hiking'];
      const result = detectFolderStructure(folders);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        detectedDay: 1,
        confidence: 'medium',
        patternMatched: 'numeric_prefix',
      });
      expect(result[1]).toMatchObject({
        detectedDay: 2,
        confidence: 'medium',
      });
      expect(result[2]).toMatchObject({
        detectedDay: 3,
        confidence: 'medium',
      });
    });

    it('marks undetected folders correctly', () => {
      const folders = ['unsorted', 'misc', 'Random Folder'];
      const result = detectFolderStructure(folders);

      // 'unsorted' is skipped (in shouldSkipFolder)
      // 'misc' and 'Random Folder' should be detected as undetected
      const undetected = result.filter(m => m.detectedDay === null);
      expect(undetected.length).toBeGreaterThan(0);
      expect(undetected[0].confidence).toBe('undetected');
    });

    it('skips system files and metadata folders', () => {
      const folders = ['.DS_Store', '._metadata', '_meta', 'Day 1', 'Day 2'];
      const result = detectFolderStructure(folders);

      // Only Day 1 and Day 2 should be included
      expect(result).toHaveLength(2);
      expect(result[0].folder).toBe('Day 1');
      expect(result[1].folder).toBe('Day 2');
    });

    it('skips folder matching project name', () => {
      const folders = ['Iceland Trip 2024', 'Day 1', 'Day 2'];
      const result = detectFolderStructure(folders, {
        projectName: 'Iceland Trip 2024',
      });

      expect(result).toHaveLength(2);
      expect(result[0].folder).toBe('Day 1');
      expect(result[1].folder).toBe('Day 2');
    });

    it('sorts by detected day (nulls last)', () => {
      const folders = ['random', 'Day 3', 'Day 1', 'something', 'Day 2'];
      const result = detectFolderStructure(folders);

      // Detected: Day 1, 2, 3 (sorted); Undetected: random, something
      const detectedDays = result.filter(m => m.detectedDay !== null).map(m => m.detectedDay);
      expect(detectedDays).toEqual([1, 2, 3]);

      const undetected = result.filter(m => m.detectedDay === null);
      expect(undetected.length).toBeGreaterThan(0);
    });

    it('includes photo count from map', () => {
      const folders = ['Day 1', 'Day 2'];
      const photoCountMap = new Map([
        ['Day 1', 42],
        ['Day 2', 56],
      ]);
      const result = detectFolderStructure(folders, { photoCountMap });

      expect(result[0].photoCount).toBe(42);
      expect(result[1].photoCount).toBe(56);
    });

    it('suggests normalized folder names', () => {
      const folders = ['day 1', 'DAY 2', 'Day_3'];
      const result = detectFolderStructure(folders);

      expect(result[0].suggestedName).toBe('Day 01');
      expect(result[1].suggestedName).toBe('Day 02');
      expect(result[2].suggestedName).toBe('Day 03');
    });

    it('handles case-insensitive day prefixes', () => {
      const folders = ['day 1', 'DAY 2', 'Day 3'];
      const result = detectFolderStructure(folders);

      expect(result).toHaveLength(3);
      expect(result[0].detectedDay).toBe(1);
      expect(result[1].detectedDay).toBe(2);
      expect(result[2].detectedDay).toBe(3);
      expect(result[0].confidence).toBe('high');
    });

    it('handles empty folder list', () => {
      const result = detectFolderStructure([]);
      expect(result).toEqual([]);
    });

    it('rejects invalid day numbers (32, 0, negative)', () => {
      const folders = ['Day 32', 'Day 0', 'Day -1'];
      const result = detectFolderStructure(folders);

      // All should be undetected
      expect(result.every(m => m.detectedDay === null)).toBe(true);
    });
  });

  describe('generateDryRunSummary', () => {
    it('generates summary for detected mappings', () => {
      const mappings = [
        {
          folder: 'Day 1',
          folderPath: '/path/Day 1',
          detectedDay: 1,
          confidence: 'high' as const,
          patternMatched: 'day_prefix',
          suggestedName: 'Day 01',
          manual: false,
          photoCount: 42,
        },
        {
          folder: 'Day 2',
          folderPath: '/path/Day 2',
          detectedDay: 2,
          confidence: 'high' as const,
          patternMatched: 'day_prefix',
          suggestedName: 'Day 02',
          manual: false,
          photoCount: 56,
        },
      ];

      const summary = generateDryRunSummary(mappings);

      expect(summary).toContain('Create 2 folders');
      expect(summary).toContain('Day 01/');
      expect(summary).toContain('Day 02/');
      expect(summary).toContain('Move 98 photos');
      expect(summary).toContain('42 from "Day 1"');
      expect(summary).toContain('56 from "Day 2"');
    });

    it('includes skipped photos in summary', () => {
      const mappings = [
        {
          folder: 'Day 1',
          folderPath: '/path/Day 1',
          detectedDay: 1,
          confidence: 'high' as const,
          patternMatched: 'day_prefix',
          suggestedName: 'Day 01',
          manual: false,
          photoCount: 42,
        },
        {
          folder: 'unsorted',
          folderPath: '/path/unsorted',
          detectedDay: null,
          confidence: 'undetected' as const,
          patternMatched: 'none',
          suggestedName: 'Unsorted',
          manual: false,
          photoCount: 12,
        },
      ];

      const summary = generateDryRunSummary(mappings);

      expect(summary).toContain('Skip 12 photos');
      expect(summary).toContain('undetected folders');
    });

    it('handles empty mappings', () => {
      const summary = generateDryRunSummary([]);

      expect(summary).toContain('Create 0 folders');
      expect(summary).toContain('Move 0 photos');
    });
  });
});
