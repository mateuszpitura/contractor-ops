import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

const mockUseMutation = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: mockUseMutation };
});

import { ComplianceCsid } from '../compliance-csid';

describe('ComplianceCsid', () => {
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
    render(<ComplianceCsid {...defaultProps} />);
    expect(screen.getByText('Step 3 of 5: Request Compliance Certificate')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ComplianceCsid {...defaultProps} />);
    expect(screen.getByText(/Your CSR will be submitted to ZATCA/)).toBeInTheDocument();
  });

  it('renders Request Compliance CSID button in idle state', () => {
    render(<ComplianceCsid {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Request Compliance CSID' })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<ComplianceCsid {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('renders Next button disabled until done', () => {
    render(<ComplianceCsid {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<ComplianceCsid {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
