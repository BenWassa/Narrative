import { describe, it, expect } from 'vitest';
import type { ProjectPhoto, ProjectSettings } from '../../services/projectService';
import { buildOperationPlan } from '../buildOperationPlan';

const createMockPhoto = (overrides: Partial<ProjectPhoto> = {}): ProjectPhoto => ({
  id: 'photo-1',
  originalName: 'IMG_1234.jpg',
  currentName: 'IMG_1234.jpg',
  timestamp: 1000000,
  fileModifiedTimestamp: 1000000,
  timestampSource: 'filesystem',
  fileSize: 5000000,
  day: null,
  bucket: null,
  sequence: null,
  favorite: false,
  rating: 0,
  archived: false,
  thumbnail: '',
  filePath: 'source/IMG_1234.jpg',
  detectedDay: null,
  detectedBucket: null,
  isPreOrganized: false,
  organizationConfidence: 'none',
  ...overrides,
});

const mockSettings: ProjectSettings = {
  autoDay: true,
  folderStructure: {
    inboxFolder: 'Inbox',
    daysFolder: '01_DAYS',
    archiveFolder: 'X_Archive',
  },
};

const dayLabels: Record<number, string> = {
  1: 'Day 01 – Reykjavik',
  2: 'Day 02 – Highlands',
};

describe('buildOperationPlan', () => {
  it('should skip unmodified photos', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      isPreOrganized: true,
      detectedDay: null,
      day: null,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.copyCount).toBe(0);
  });

  it('should include renamed photos', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0].reason).toBe('renamed');
  });

  it('should resolve auto mode to single-day flat for one active day', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations[0].destinationRelativePath).toBe(
      'A_Establishing/D01_A_001__IMG_1234.jpg',
    );
    expect(plan.resolvedStructureMode).toBe('single_day_flat');
  });

  it('should generate correct single-day flat paths', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'single_day_flat',
    });

    expect(plan.operations[0].destinationRelativePath).toBe(
      'A_Establishing/D01_A_001__IMG_1234.jpg',
    );
    expect(plan.resolvedStructureMode).toBe('single_day_flat');
  });

  it('should let projectMode force single-day flat even when multiple days are assigned', () => {
    const photo1 = createMockPhoto({
      id: 'photo-1',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });
    const photo2 = createMockPhoto({
      id: 'photo-2',
      originalName: 'IMG_5678.jpg',
      currentName: 'D02_B_001__IMG_5678.jpg',
      filePath: 'source/IMG_5678.jpg',
      bucket: 'B',
      day: 2,
    });

    const plan = buildOperationPlan({
      photos: [photo1, photo2],
      dayLabels,
      projectSettings: mockSettings,
      projectMode: 'single_day',
      structureMode: 'auto',
    });

    expect(plan.resolvedStructureMode).toBe('single_day_flat');
    expect(plan.operations.map(operation => operation.destinationRelativePath)).toEqual([
      'A_Establishing/D01_A_001__IMG_1234.jpg',
      'B_People/D02_B_001__IMG_5678.jpg',
    ]);
  });

  it('should route archive photos correctly', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      archived: true,
      bucket: 'X',
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations[0].destinationRelativePath).toBe('X_Archive/IMG_1234.jpg');
  });

  it('should skip photos with missing filePath', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: undefined,
      bucket: 'A',
      day: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations).toHaveLength(0);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].kind).toBe('missing_file_path');
  });

  it('should detect duplicate destination paths', () => {
    const photo1 = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: 'source1/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const photo2 = createMockPhoto({
      id: 'photo-2',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg', // same renamed name
      filePath: 'source2/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo1, photo2],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0].kind).toBe('duplicate_destination');
    expect(plan.blockers[0].conflictingPhotos).toHaveLength(2);
  });

  it('should include user-assigned bucket assignments', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      bucket: 'B',
      day: 1,
      isPreOrganized: false,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0].reason).toBe('bucket_assigned');
  });

  it('should skip already pre-organized photos', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'IMG_1234.jpg',
      filePath: '01_DAYS/Day 01 – Reykjavik/B_People/IMG_1234.jpg', // already in correct place
      bucket: 'B',
      day: 1,
      isPreOrganized: true, // already organized
      detectedBucket: 'B',
      detectedDay: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.operations).toHaveLength(0);
  });

  it('should resolve auto mode with 2+ days as nested', () => {
    const photo1 = createMockPhoto({
      id: 'photo-1',
      originalName: 'IMG_1234.jpg',
      currentName: 'D01_A_001__IMG_1234.jpg',
      filePath: 'source/IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const photo2 = createMockPhoto({
      id: 'photo-2',
      originalName: 'IMG_5678.jpg',
      currentName: 'D02_A_001__IMG_5678.jpg',
      filePath: 'source/IMG_5678.jpg',
      bucket: 'A',
      day: 2,
    });

    const plan = buildOperationPlan({
      photos: [photo1, photo2],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.resolvedStructureMode).toBe('multi_day_nested');
  });

  it('should set conflictPolicy to skip_on_existing', () => {
    const plan = buildOperationPlan({
      photos: [createMockPhoto()],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'auto',
    });

    expect(plan.conflictPolicy).toBe('skip_on_existing');
  });

  it('should skip already-existing destination files during direct processing planning', () => {
    const photo = createMockPhoto({
      id: 'photo-1',
      currentName: 'D01_A_001__IMG_1234.jpg',
      bucket: 'A',
      day: 1,
    });

    const plan = buildOperationPlan({
      photos: [photo],
      dayLabels,
      projectSettings: mockSettings,
      structureMode: 'single_day_flat',
      existingDestinationPaths: ['A_Establishing/D01_A_001__IMG_1234.jpg'],
    });

    expect(plan.operations).toHaveLength(0);
    expect(plan.preexistingSkips).toHaveLength(1);
    expect(plan.summary.preexistingSkipCount).toBe(1);
  });
});
