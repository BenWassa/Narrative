import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoOrganizer from '../PhotoOrganizer';

describe('PhotoOrganizer header contrast helpers', () => {
  it('renders project name with a high-contrast color class', () => {
    render(<PhotoOrganizer />);
    // Run the demo to hide the StartScreen (it's shown on initial load) so the header is visible
    const runDemo = screen.getByRole('button', { name: /run demo/i });
    fireEvent.click(runDemo);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    // ensure we explicitly apply a high-contrast color class
    expect(heading.className).toContain('text-gray-100');
  });
});
