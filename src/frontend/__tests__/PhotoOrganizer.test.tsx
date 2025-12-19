import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect } from 'vitest';
import PhotoOrganizer from '../PhotoOrganizer';

test('renders project name', async () => {
  render(<PhotoOrganizer />);
  expect(await screen.findByText(/Iceland Trip 2024/i)).toBeInTheDocument();
});

test('shift-click selects a contiguous range', async () => {
  const user = userEvent.setup();
  const { container } = render(<PhotoOrganizer />);

  // wait for images to render
  const imgs = await screen.findAllByRole('img');
  expect(imgs.length).toBeGreaterThanOrEqual(4);

  // click first (on the tile wrapper)
  const first = await screen.findByTestId('photo-photo_1');
  const fourth = await screen.findByTestId('photo-photo_4');
  fireEvent.click(first);
  // shift-click fourth
  fireEvent.click(fourth, { shiftKey: true });

  // selected tiles get the 'ring-4' class
  const selected = container.querySelectorAll('.ring-4');
  expect(selected.length).toBeGreaterThanOrEqual(4);
});
