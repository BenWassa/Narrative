import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectTile from '../ui/ProjectTile';

describe('ProjectTile', () => {
  beforeAll(() => {
    // @ts-ignore
    global.URL.createObjectURL = vi.fn(() => 'blob://fake');
  });

  it('renders with a fallback gradient when no coverUrl', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', rootPath: '/tmp/test' };

    const { container } = render(<ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />);

    expect(container).toMatchSnapshot();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders an image when coverUrl is present', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', rootPath: '/tmp/test', coverUrl: 'https://picsum.photos/200/100' };

    const { container } = render(<ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />);

    expect(container).toMatchSnapshot();
    expect(screen.getByAltText('Test')).toBeInTheDocument();
  });

  it('calls onOpen when clicking the tile', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', rootPath: '/tmp/test' };

    render(<ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />);

    const button = screen.getByRole('button', { name: /Open project Test/i });
    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledWith('/tmp/test');
  });

  it('calls onSetCover when a file is chosen', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', rootPath: '/tmp/test' };

    render(<ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />);

    const changeButton = screen.getByText(/Change cover/i);
    fireEvent.click(changeButton);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onSetCover).toHaveBeenCalledWith('/tmp/test', 'blob://fake');
  });
});
