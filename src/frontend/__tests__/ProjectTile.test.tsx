import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectTile from '../ui/ProjectTile';

describe('ProjectTile', () => {
  beforeAll(() => {
    // @ts-ignore
    global.FileReader = class {
      result = null;
      onload: null | (() => void) = null;
      readAsDataURL() {
        this.result = 'data:image/png;base64,fake';
        if (this.onload) this.onload();
      }
    };
  });

  it('renders with a fallback gradient when no coverUrl', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', projectId: 'project-1', rootPath: '/tmp/test' };

    const { container } = render(
      <ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />,
    );

    expect(container).toMatchSnapshot();
    const openButton = screen.getByRole('button', { name: /Open project Test/i });
    expect(openButton).toHaveTextContent('Test');
  });

  it('renders an image when coverUrl is present', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = {
      projectName: 'Test',
      projectId: 'project-1',
      rootPath: '/tmp/test',
      coverUrl: 'https://picsum.photos/200/100',
      totalPhotos: 120,
    };

    const { container } = render(
      <ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />,
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByAltText('Test')).toBeInTheDocument();
  });

  it('calls onOpen when clicking the tile', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', projectId: 'project-1', rootPath: '/tmp/test' };

    render(<ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />);

    const button = screen.getByRole('button', { name: /Open project Test/i });
    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledWith('project-1');
  });

  it('calls onSetCover when a file is chosen', () => {
    const onOpen = vi.fn();
    const onSetCover = vi.fn();

    const project = { projectName: 'Test', projectId: 'project-1', rootPath: '/tmp/test' };

    render(<ProjectTile project={project} onOpen={onOpen} onSetCover={onSetCover} />);

    const changeButton = screen.getByText(/Change cover/i);
    fireEvent.click(changeButton);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onSetCover).toHaveBeenCalledWith('project-1', 'data:image/png;base64,fake');
  });
});
