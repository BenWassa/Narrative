import React from 'react';
import { render, screen } from '@testing-library/react';
import StepIndicator from '../ui/StepIndicator';

describe('StepIndicator', () => {
  const steps = [
    { key: 'a', label: 'First' },
    { key: 'b', label: 'Second' },
    { key: 'c', label: 'Third' },
  ];

  it('shows numbers and highlights the active step', () => {
    const { container } = render(<StepIndicator steps={steps} currentKey="b" />);

    // Active label should be present
    expect(screen.getByText('Second')).toBeInTheDocument();

    // Active bubble should contain the active step number
    const active = container.querySelector('[aria-current="step"]');
    expect(active).toBeTruthy();
    expect(active).toHaveTextContent('2');

    // Completed steps should render a check icon
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a check icon for completed steps', () => {
    const { container } = render(<StepIndicator steps={steps} currentKey="c" />);
    // when current is c, steps before it are done (have check SVG)
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });
});
