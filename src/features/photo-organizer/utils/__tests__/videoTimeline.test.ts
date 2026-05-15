import { describe, expect, it } from 'vitest';

import type { ProjectPhoto, ProjectState } from '../../services/projectService';
import { buildVideoTimeline } from '../videoTimeline';

const basePhoto: ProjectPhoto = {
  id: 'photo-1',
  mediaKind: 'photo',
  originalName: 'IMG_0001.jpg',
  currentName: 'IMG_0001.jpg',
  timestamp: Date.parse('2026-03-12T10:00:00Z'),
  fileModifiedTimestamp: Date.parse('2026-03-12T10:00:00Z'),
  timestampSource: 'exif',
  day: 1,
  bucket: 'A',
  sequence: null,
  favorite: false,
  rating: 0,
  archived: false,
  thumbnail: '',
  filePath: '01_DAYS/Day 1/IMG_0001.jpg',
};

function makeState(photos: ProjectPhoto[]): ProjectState {
  return {
    projectName: 'Japan, Spring 2026',
    rootPath: 'Japan',
    photos,
    settings: {
      autoDay: true,
      folderStructure: {
        inboxFolder: 'Inbox',
        daysFolder: '01_DAYS',
        archiveFolder: 'X_Archive',
      },
    },
    dayLabels: { 1: 'Arrival in Tokyo' },
    dayNotes: { 1: 'Jet-lagged ramen run.' },
  };
}

describe('videoTimeline', () => {
  it('builds the Narrative video pipeline timeline contract', () => {
    const video: ProjectPhoto = {
      ...basePhoto,
      id: 'video-1',
      mediaKind: 'video',
      originalName: 'CLIP_0001.mp4',
      currentName: 'CLIP_0001.mp4',
      filePath: '01_DAYS/Day 1/CLIP_0001.mp4',
      bucket: 'D',
      durationSec: 14.2,
      timestamp: Date.parse('2026-03-12T11:00:00Z'),
    };

    const timeline = buildVideoTimeline(makeState([video, basePhoto]), {
      songPath: 'songs/track.mp3',
      targetDurationSec: 360,
    });

    expect(timeline.schema).toBe(1);
    expect(timeline.trip.id).toBe('japan-spring-2026');
    expect(timeline.days[0]).toMatchObject({
      day_number: 1,
      date: '2026-03-12',
      title: 'Arrival in Tokyo',
      notes: 'Jet-lagged ramen run.',
    });
    expect(timeline.days[0].media).toEqual([
      {
        kind: 'photo',
        path: '01_DAYS/Day 1/IMG_0001.jpg',
        bucket: 'A',
        order: 0,
        caption: null,
      },
      {
        kind: 'video',
        path: '01_DAYS/Day 1/CLIP_0001.mp4',
        bucket: 'D',
        order: 1,
        caption: null,
        duration_sec: 14.2,
        best_segment_sec: null,
      },
    ]);
  });

  it('does not invent trip dates from filesystem-only timestamps', () => {
    const timeline = buildVideoTimeline(
      makeState([{ ...basePhoto, timestampSource: 'filesystem' }]),
    );

    expect(timeline.trip.date_range).toEqual([null, null]);
    expect(timeline.days[0].date).toBeNull();
  });
});
