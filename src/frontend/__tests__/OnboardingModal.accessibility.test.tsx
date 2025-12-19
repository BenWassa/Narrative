import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import OnboardingModal from '../OnboardingModal';

describe('OnboardingModal accessibility (contrast-related helpers)', () => {
  it('uses higher-contrast close button and placeholder classes', () => {
    render(
      <OnboardingModal
        isOpen={true}
        onClose={() => {}}
        onComplete={() => {}}
        onDetect={async () => []}
        onApply={async () => ({ summary: '', changes: {} })}
      />,
    );

    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toContain('text-gray-600');

    const projectInput = screen.getByPlaceholderText('e.g., Iceland Trip 2024');
    expect(projectInput).toBeInTheDocument();
    // ensure placeholder color helper class is present so authors don't accidentally use very low-contrast default placeholder
    expect(projectInput.className).toContain('placeholder:text-gray-600');

    // actual input text should be high contrast (dark) on the white modal
    expect(projectInput.className).toContain('text-gray-900');

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    expect(nextBtn).toBeInTheDocument();
    // when empty, the Next button should be disabled and have aria-disabled
    expect(nextBtn).toHaveAttribute('disabled');
    expect(nextBtn).toHaveAttribute('aria-disabled', 'true');
    // ensure our improved disabled class is present
    expect(nextBtn.className).toContain('disabled:bg-gray-200');
  });

  it('shows numbered step indicator and highlights preview as active after folder selection', async () => {
    const onDetect = vi.fn(async () => []);
    render(
      <OnboardingModal
        isOpen={true}
        onClose={() => {}}
        onComplete={() => {}}
        onDetect={onDetect}
        onApply={async () => ({ summary: '', changes: {} })}
      />,
    );

    const nameInput = screen.getByPlaceholderText('e.g., Iceland Trip 2024');
    fireEvent.change(nameInput, { target: { value: 'Test Trip' } });

    const folderInput = screen.getByPlaceholderText('/Users/you/trips/iceland');
    fireEvent.change(folderInput, { target: { value: '/tmp/test' } });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // after clicking Next, preview step should be active (aria-current="step")
    const active = await screen.findByRole('region', { hidden: true }).catch(() => null);
    const activeBubble = document.querySelector('[aria-current="step"]');
    expect(activeBubble).toBeTruthy();
    expect(activeBubble).toHaveTextContent('2');
  });
});
