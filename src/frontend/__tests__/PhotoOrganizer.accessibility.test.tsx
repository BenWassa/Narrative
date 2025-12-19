import React from 'react';
import { render, screen } from '@testing-library/react';
import PhotoOrganizer from '../PhotoOrganizer';

describe('PhotoOrganizer header contrast helpers', () => {
  it('renders project name with a high-contrast color class', () => {
    render(<PhotoOrganizer />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    // ensure we explicitly apply a high-contrast color class
    expect(heading.className).toContain('text-gray-100');
  });
});
