import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import PhotoOrganizer from '../PhotoOrganizer';
import * as projectService from '../services/projectService';

vi.mock('../services/projectService', () => ({
  initProject: vi.fn(),
  getState: vi.fn(),
  saveState: vi.fn(),
  deleteProject: vi.fn(),
  buildPhotosFromHandle: vi.fn(),
  saveHandle: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(projectService.saveState).mockResolvedValue(undefined);
});

afterEach(() => {
  localStorage.clear();
});

const makeSampleState = () => {
  const samplePhotos = Array.from({ length: 4 }, (_, index) => {
    const id = `photo_${index + 1}`;
    return {
      id,
      originalName: `IMG_${1000 + index}.jpg`,
      currentName: `IMG_${1000 + index}.jpg`,
      timestamp: Date.now() + index * 1000,
      day: null,
      bucket: null,
      sequence: null,
      favorite: false,
      rating: 0,
      archived: false,
      thumbnail: `https://picsum.photos/seed/${index + 1}/400/300`,
      filePath: `Folder/${index + 1}/IMG.jpg`,
    };
  });

  return {
    projectName: 'Viewer Project',
    rootPath: '/path/to/viewer',
    photos: samplePhotos,
    dayLabels: {},
    dayContainers: [],
    settings: {
      autoDay: true,
      folderStructure: {
        daysFolder: '01_DAYS',
        archiveFolder: '98_ARCHIVE',
        favoritesFolder: 'FAV',
        metaFolder: '_meta',
      },
    },
  };
};

test('double-clicking a photo opens PhotoViewer (Gallery View)', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);
  render(<PhotoOrganizer />);

  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Gallery view should show photos
  const photoTile = await screen.findByTestId('photo-photo_1');
  expect(photoTile).toBeInTheDocument();

  // Double-click to open PhotoViewer
  fireEvent.doubleClick(photoTile);

  // PhotoViewer should open (look for "Gallery View" header)
  await screen.findByText(/Gallery View/i);
});

test('Esc key closes PhotoViewer', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  const photoTile = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(photoTile);

  // Verify PhotoViewer opened
  await screen.findByText(/Gallery View/i);

  // Press Esc to close
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Gallery View/i)).not.toBeInTheDocument());

  // The gallery should still show the photo tile
  expect(screen.getByTestId('photo-photo_1')).toBeInTheDocument();
});

test('arrow keys navigate within PhotoViewer and update the counter', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open PhotoViewer by double-clicking a photo
  const photoTile = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(photoTile);

  const counter = await screen.findByText(/1 \/ 4/i);
  expect(counter).toBeInTheDocument();

  // Press ArrowRight and expect counter to increment
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  await waitFor(() => expect(screen.getByText(/2 \/ 4/i)).toBeInTheDocument());

  // Press ArrowLeft and expect counter to decrement
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  await waitFor(() => expect(screen.getByText(/1 \/ 4/i)).toBeInTheDocument());

  // Press Escape to exit
  fireEvent.keyDown(window, { key: 'Escape' });
});

test('assigning a bucket in PhotoViewer updates the gallery badge', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open PhotoViewer by double-clicking first photo
  const photoTile = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(photoTile);
  await screen.findByText(/Gallery View/i);

  // Press 'A' key to assign Establishing bucket
  fireEvent.keyDown(window, { key: 'a' });

  // Exit PhotoViewer
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Gallery View/i)).toBeNull());

  // The gallery tile should now contain the bucket badge 'A'
  const tile = await screen.findByTestId('photo-photo_1');
  const badge = within(tile).getByText('A');
  expect(badge).toBeInTheDocument();
  // Make sure it's the badge, not part of the filename
  expect(badge.closest('.absolute')).toBeTruthy();
});

test('archiving a photo in PhotoViewer auto-advances to next photo', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open PhotoViewer by double-clicking first photo
  const photoTile = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(photoTile);
  await screen.findByText(/Gallery View/i);

  // Verify we start at photo 1 of 4
  expect(screen.getByText(/1 of 4/i)).toBeInTheDocument();

  // Press 'X' key to archive the photo
  fireEvent.keyDown(window, { key: 'x' });

  // Should auto-advance - still showing 1 of 3 (since we archived one, but advanced to what was #2)
  await waitFor(() => expect(screen.getByText(/1 of 3/i)).toBeInTheDocument());

  // Exit PhotoViewer and verify photo #1 is archived (no longer visible in gallery)
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Gallery View/i)).toBeNull());

  // Photo #1 should not be visible in the gallery (archived)
  expect(screen.queryByTestId('photo-photo_1')).toBeNull();
});

test('archiving the last photo in PhotoViewer exits to gallery', async () => {
  // Create state with only one photo
  const singlePhotoState = {
    ...makeSampleState(),
    photos: [makeSampleState().photos[0]], // Only first photo
  };
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([
      {
        projectName: singlePhotoState.projectName,
        projectId: 'p1',
        rootPath: singlePhotoState.rootPath,
      },
    ]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(singlePhotoState as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open PhotoViewer by double-clicking first photo
  const photoTile = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(photoTile);
  await screen.findByText(/Gallery View/i);

  // Press 'X' key to archive the photo
  fireEvent.keyDown(window, { key: 'x' });

  // Should exit PhotoViewer automatically (no photos left)
  await waitFor(() => expect(screen.queryByText(/Gallery View/i)).toBeNull());

  // The important thing is that PhotoViewer exited
  expect(screen.queryByText(/Gallery View/i)).toBeNull();
});
