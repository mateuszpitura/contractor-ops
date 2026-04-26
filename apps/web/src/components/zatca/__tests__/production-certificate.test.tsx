import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

const mockUseMutation = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: mockUseMutation };
});

import { ProductionCertificate } from '../production-certificate';

describe('ProductionCertificate', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('renders step title', () => {
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.getByText('Step 5 of 5: Activate Production Certificate')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.getByText(/All compliance checks passed/)).toBeInTheDocument();
  });

  it('renders warning alert about production activation', () => {
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.getByText('Production Activation')).toBeInTheDocument();
    expect(
      screen.getByText(/Once activated, all invoices for Saudi organizations/),
    ).toBeInTheDocument();
  });

  it('renders Complete Onboarding button', () => {
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Complete Onboarding' })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<ProductionCertificate {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Complete Onboarding button while pending', () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Complete Onboarding/ })).toBeDisabled();
  });

  it('does not render Complete button when not shown', () => {
    render(<ProductionCertificate {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
  });
});
