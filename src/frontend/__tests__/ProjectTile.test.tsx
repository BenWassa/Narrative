import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectTile from '../ui/ProjectTile';

describe('ProjectTile', () => {
  it('renders with a fallback gradient when no coverUrl', () => {
    const onOpen = vi.fn();

    const project = { projectName: 'Test', projectId: 'project-1', rootPath: '/tmp/test' };

    const { container } = render(<ProjectTile project={project} onOpen={onOpen} />);

    expect(container).toMatchSnapshot();
    const openButton = screen.getByRole('button', { name: /Open project Test/i });
    expect(openButton).toBeInTheDocument();
  });

  it('renders an image when coverUrl is present', () => {
    const onOpen = vi.fn();

    const project = {
      projectName: 'Test',
      projectId: 'project-1',
      rootPath: '/tmp/test',
      coverUrl: 'https://picsum.photos/200/100',
      totalPhotos: 120,
    };

    const { container } = render(<ProjectTile project={project} onOpen={onOpen} />);

    expect(container).toMatchSnapshot();
    expect(screen.getByAltText('Test')).toBeInTheDocument();
  });

  it('calls onOpen when clicking the tile', () => {
    const onOpen = vi.fn();

    const project = { projectName: 'Test', projectId: 'project-1', rootPath: '/tmp/test' };

    render(<ProjectTile project={project} onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Open project Test/i });
    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledWith('project-1');
  });
});
