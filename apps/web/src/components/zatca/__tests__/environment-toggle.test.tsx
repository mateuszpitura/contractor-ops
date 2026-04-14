import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

import { EnvironmentToggle } from '../environment-toggle';

describe('EnvironmentToggle', () => {
  it('renders Sandbox and Production options', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} />);
    expect(screen.getByText('Sandbox')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders Environment label', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} />);
    expect(screen.getByText('Environment')).toBeInTheDocument();
  });

  it('renders description text for sandbox', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} />);
    expect(screen.getByText('Test invoices are not submitted to ZATCA')).toBeInTheDocument();
  });

  it('renders description text for production', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} />);
    expect(screen.getByText('Invoices are submitted to ZATCA for clearance')).toBeInTheDocument();
  });

  it('shows onboarding required message when production not ready', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} productionReady={false} />);
    expect(screen.getByText('Complete onboarding to enable production mode')).toBeInTheDocument();
  });

  it('does not show onboarding message when production is ready', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} productionReady={true} />);
    expect(
      screen.queryByText('Complete onboarding to enable production mode'),
    ).not.toBeInTheDocument();
  });

  it('disables production radio when not ready', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} productionReady={false} />);
    const productionRadio = screen.getByRole('radio', { name: /Production/ });
    expect(productionRadio).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders two radio buttons', () => {
    render(<EnvironmentToggle value="sandbox" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });
});
