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

test('view mode toggle persists to localStorage and reflects active state', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);
  render(<PhotoOrganizer />);

  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Inspect/Gallery toggles should be visible
  const inspectBtn = await screen.findByRole('button', { name: /Inspect/i });
  const galleryBtn = await screen.findByRole('button', { name: /Gallery/i });
  expect(inspectBtn).toBeInTheDocument();
  expect(galleryBtn).toBeInTheDocument();

  // Click Inspect and expect persistence
  fireEvent.click(inspectBtn);
  await waitFor(() => expect(localStorage.getItem('narrative:viewMode')).toBe('inspect'));

  // Click Gallery and expect persistence
  fireEvent.click(galleryBtn);
  await waitFor(() => expect(localStorage.getItem('narrative:viewMode')).toBe('gallery'));
});

test('double-clicking a photo opens Inspect mode and Esc closes it', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Wait for images to render
  const photoTile = await screen.findByTestId('photo-photo_1');
  expect(photoTile).toBeInTheDocument();

  // Double-click should open Inspect (PhotoViewer)
  fireEvent.doubleClick(photoTile);
  const inspectHeader = await screen.findByText(/Inspect Mode/i);
  expect(inspectHeader).toBeInTheDocument();

  // Press Escape to close
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Inspect Mode/i)).toBeNull());

  // The gallery should still show the photo tile
  expect(screen.queryByTestId('photo-photo_1')).toBeInTheDocument();
});

test('arrow keys navigate within Inspect and update the counter', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open inspect for the first photo
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(first);
  const counter = await screen.findByText(/1 \//i);
  expect(counter).toBeInTheDocument();

  // Press ArrowRight and expect counter to increment
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  await waitFor(() => expect(screen.getByText(/2 \//i)).toBeInTheDocument());

  // Press ArrowLeft and expect counter to decrement
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  await waitFor(() => expect(screen.getByText(/1 \//i)).toBeInTheDocument());

  // Press Escape to exit
  fireEvent.keyDown(window, { key: 'Escape' });
});

test('assigning a bucket in Inspect updates the gallery badge', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open inspect for the first photo
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(first);
  await screen.findByText(/Inspect Mode/i);

  // Click the 'Establishing' bucket (A)
  const meceLabel = await screen.findByText(/MECE Category/i);
  const meceContainer = meceLabel.closest('div');
  expect(meceContainer).toBeTruthy();
  const establishingBtn = within(meceContainer as Element).getByRole('button', {
    name: /Establishing/i,
  });
  fireEvent.click(establishingBtn);

  // Exit inspect
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Inspect Mode/i)).toBeNull());

  // The gallery tile should now contain the bucket badge 'A'
  const tile = await screen.findByTestId('photo-photo_1');
  const badge = within(tile).getByText('A');
  expect(badge).toBeInTheDocument();
  // Make sure it's the badge, not part of the filename
  expect(badge.closest('.absolute')).toBeTruthy();
});

test('archiving a photo in Inspect auto-advances to next photo', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open inspect for the first photo
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(first);
  await screen.findByText(/Inspect Mode/i);

  // Archive the photo (bucket X)
  const meceLabel = await screen.findByText(/MECE Category/i);
  const meceContainer = meceLabel.closest('div');
  expect(meceContainer).toBeTruthy();
  const archiveBtn = within(meceContainer as Element).getByRole('button', { name: /Archive/i });
  fireEvent.click(archiveBtn);

  // Should auto-advance to photo #2 (now 1st in filtered list)
  await waitFor(() => expect(screen.getByText(/1 \/ 3/i)).toBeInTheDocument());

  // Exit inspect and verify photo #1 is archived (no longer visible in gallery)
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Inspect Mode/i)).toBeNull());

  // Photo #1 should not be visible in the gallery (archived)
  expect(screen.queryByTestId('photo-photo_1')).toBeNull();
});

test('archiving the last photo in Inspect exits to gallery', async () => {
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

  // Open inspect for the only photo
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(first);
  await screen.findByText(/Inspect Mode/i);

  // Archive the photo
  const meceLabel = await screen.findByText(/MECE Category/i);
  const meceContainer = meceLabel.closest('div');
  expect(meceContainer).toBeTruthy();
  const archiveBtn = within(meceContainer as Element).getByRole('button', { name: /Archive/i });
  fireEvent.click(archiveBtn);

  // Should exit Inspect mode automatically (no photos left)
  await waitFor(() => expect(screen.queryByText(/Inspect Mode/i)).toBeNull());

  // The photo may still be visible in the gallery depending on the view
  // The important thing is that Inspect mode exited
  expect(screen.queryByText(/Inspect Mode/i)).toBeNull();
});

test('exiting Inspect validates focused photo exists in current view', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open inspect for the first photo
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(first);
  await screen.findByText(/Inspect Mode/i);

  // Switch to a different view that doesn't include this photo (e.g., favorites - assuming photo is not favorited)
  const favoritesBtn = await screen.findByRole('button', { name: /Favorites/i });
  fireEvent.click(favoritesBtn);

  // Exit inspect
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText(/Inspect Mode/i)).toBeNull());

  // The focused photo should be cleared since it's not in the current view
  // (No photo should be selected in the gallery)
  const selectedPhotos = screen.queryAllByTestId(/^photo-/, { selector: '[class*="ring-4"]' });
  expect(selectedPhotos).toHaveLength(0);
});

test('Shift+click bucket auto-advances to next photo', async () => {
  const state = makeSampleState();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([{ projectName: state.projectName, projectId: 'p1', rootPath: state.rootPath }]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(state as any);

  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Viewer Project/i });
  fireEvent.click(projectButton);

  // Open inspect for the first photo
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.doubleClick(first);
  await screen.findByText(/Inspect Mode/i);

  // Shift+click the 'Establishing' bucket (A)
  const meceLabel = await screen.findByText(/MECE Category/i);
  const meceContainer = meceLabel.closest('div');
  expect(meceContainer).toBeTruthy();
  const establishingBtn = within(meceContainer as Element).getByRole('button', {
    name: /Establishing/i,
  });
  fireEvent.click(establishingBtn, { shiftKey: true });

  // Should auto-advance to photo #2
  await waitFor(() => expect(screen.getByText(/2 \/ 4/i)).toBeInTheDocument());
});
