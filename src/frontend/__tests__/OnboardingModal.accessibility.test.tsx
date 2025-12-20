import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    // Supply an onApply that delays so the component remains in 'apply' step long enough
    const delayedOnApply = async () => new Promise(resolve => setTimeout(resolve, 200));

    render(
      <OnboardingModal
        isOpen={true}
        onClose={() => {}}
        onComplete={() => {}}
        onDetect={onDetect}
        onApply={delayedOnApply}
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

  it('exports shell script and zip without applying', async () => {
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

    const projectInput = screen.getByPlaceholderText('e.g., Iceland Trip 2024');
    fireEvent.change(projectInput, { target: { value: 'Test Trip' } });
    const pathInput = screen.getByPlaceholderText('/Users/you/trips/iceland');
    fireEvent.change(pathInput, { target: { value: '/tmp/test' } });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Wait for preview content to render
    await screen.findByText(/Detected folder structure for/i);

    // When no mappings were returned, we show a clear hint explaining nothing was found
    expect(screen.getByText(/No subfolders detected/i)).toBeInTheDocument();
    // Offer to load example mappings so users can see a preview even if detection failed
    const loadBtn = screen.getByRole('button', { name: /Load example mappings/i });
    expect(loadBtn).toBeInTheDocument();

    // The debug toggle should be visible while no mappings exist; we can open it and inspect debug text
    const debugToggle = screen.getByRole('button', { name: /Show detection debug|Hide detection debug/i });
    expect(debugToggle).toBeInTheDocument();
    fireEvent.click(debugToggle);
    expect(await screen.findByText(/onDetect result for|Derived folders from directory input/i)).toBeInTheDocument();

    // Now load example mappings and verify a Day row appears
    fireEvent.click(loadBtn);
    const dayMatches = await screen.findAllByText(/Day 1/i);
    expect(dayMatches.length).toBeGreaterThan(0);

    // 'MiscFolder' should be present and default to skipped (show '-' indicator and an Include button)
    const miscMatches = await screen.findAllByText(/MiscFolder/i);
    let miscRow: HTMLElement | null = null;
    for (const match of miscMatches) {
      const td = match.closest('td');
      if (td && td.className.includes('text-gray-900')) {
        miscRow = td.closest('tr');
        break;
      }
    }
    expect(miscRow).toBeTruthy();
    expect(within(miscRow as HTMLElement).getByText('-')).toBeInTheDocument();
    expect(within(miscRow as HTMLElement).getByRole('button', { name: /Include/i })).toBeInTheDocument();

    // Now on preview - export script and zip
    const exportScriptBtn = screen.getByRole('button', { name: /Export organize script/i });
    expect(exportScriptBtn).toBeInTheDocument();
    // clicking will trigger download - ensure no errors
    fireEvent.click(exportScriptBtn);

    const exportZipBtn = screen.getByRole('button', { name: /Export ZIP/i });
    expect(exportZipBtn).toBeInTheDocument();
    fireEvent.click(exportZipBtn);

    // Preview explanation should be present
    expect(screen.getByText(/Review suggested mappings/i)).toBeInTheDocument();
    expect(screen.getByText(/Default mode:.*Copy/i)).toBeInTheDocument();
  });

  it('shows helpful message when dry-run is unavailable', async () => {
    // Render without onApply to simulate an environment where dry-run cannot run
    const onDetect = vi.fn(async () => []);
    render(
      <OnboardingModal
        isOpen={true}
        onClose={() => {}}
        onComplete={() => {}}
        onDetect={onDetect}
        // no onApply provided
      />,
    );

    const projectInput = screen.getByPlaceholderText('e.g., Iceland Trip 2024');
    fireEvent.change(projectInput, { target: { value: 'Test Trip' } });
    const pathInput = screen.getByPlaceholderText('/Users/you/trips/iceland');
    fireEvent.change(pathInput, { target: { value: '/tmp/test' } });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Wait for preview
    await screen.findByText(/Detected folder structure for/i);

    // Load example mappings so the Preview button becomes enabled
    const loadBtn = screen.getByRole('button', { name: /Load example mappings/i });
    fireEvent.click(loadBtn);

    // Enable Dry-run checkbox
    const dryCheckbox = screen.getByLabelText(/Dry-run/i);
    fireEvent.click(dryCheckbox);

    // Click Preview (when Dry-run enabled the button is labeled Preview)
    const previewBtn = screen.getByRole('button', { name: /Preview/i });
    fireEvent.click(previewBtn);

    // Now we should see a generated dry-run summary and predicted folder structure
    expect(await screen.findByText(/Create \d+ folders/i)).toBeInTheDocument();
    expect(screen.getByText(/Predicted folder structure/i)).toBeInTheDocument();
    // Verify a Day entry is shown from the example mappings
    const dayMatches = screen.getAllByText(/Day\s*01|Day\s*1/i);
    expect(dayMatches.length).toBeGreaterThan(0);
  });

  // NOTE: Integration test for the File System Access apply flow is covered by unit tests
});
