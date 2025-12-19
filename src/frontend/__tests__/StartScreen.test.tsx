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

    const recents = [{ projectName: 'Alpha', rootPath: '/tmp/alpha', coverUrl: undefined, lastOpened: Date.now() }];

    render(
      <StartScreen isOpen={true} onClose={() => {}} onCreateComplete={onCreate} onOpenProject={onOpen} onSetCover={onSetCover} recentProjects={recents} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onSetCover).toHaveBeenCalledWith('/tmp/alpha', 'blob://fake');
  });
});
