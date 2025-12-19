import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StartScreen from '../StartScreen';

describe('StartScreen', () => {
  beforeAll(() => {
    // @ts-ignore
    global.URL.createObjectURL = vi.fn(() => 'blob://fake');
  });

  it('renders a new project tile and project tiles', () => {
    const onCreate = vi.fn();
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const recents = [
      { projectName: 'Alpha', rootPath: '/tmp/alpha', coverUrl: undefined, lastOpened: Date.now() },
      { projectName: 'Beta', rootPath: '/tmp/beta', coverUrl: undefined, lastOpened: Date.now() },
    ];

    render(
      <StartScreen
        isOpen={true}
        onClose={() => {}}
        onCreateComplete={onCreate}
        onOpenProject={onOpen}
        onSetCover={onSetCover}
        recentProjects={recents}
      />,
    );

    expect(screen.getByRole('button', { name: /Create new project/i })).toBeInTheDocument();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSetCover when a file is selected', () => {
    const onCreate = vi.fn();
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const recents = [
      { projectName: 'Alpha', rootPath: '/tmp/alpha', coverUrl: undefined, lastOpened: Date.now() },
    ];

    render(
      <StartScreen
        isOpen={true}
        onClose={() => {}}
        onCreateComplete={onCreate}
        onOpenProject={onOpen}
        onSetCover={onSetCover}
        recentProjects={recents}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onSetCover).toHaveBeenCalledWith('/tmp/alpha', 'blob://fake');
  });

  it('renders a divider and groups projects by date', () => {
    const onCreate = vi.fn();
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;

    const recents = [
      { projectName: 'Alpha', rootPath: '/tmp/alpha', coverUrl: undefined, lastOpened: now },
      { projectName: 'Beta', rootPath: '/tmp/beta', coverUrl: undefined, lastOpened: now - oneDay },
    ];

    const { container } = render(
      <StartScreen
        isOpen={true}
        onClose={() => {}}
        onCreateComplete={onCreate}
        onOpenProject={onOpen}
        onSetCover={onSetCover}
        recentProjects={recents}
      />,
    );

    // Divider exists between new project and recents
    const divider = container.querySelector('div[aria-hidden]');
    expect(divider).toBeInTheDocument();

    expect(screen.getByText(/Today/i)).toBeInTheDocument();
    expect(screen.getByText(/Yesterday/i)).toBeInTheDocument();
  });
});
