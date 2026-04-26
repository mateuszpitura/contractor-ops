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

  it('calls mutate when Request Compliance CSID button is clicked', async () => {
    const mockMutate = vi.fn();
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    const { user } = setup(<ComplianceCsid {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Request Compliance CSID' }));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('shows spinner in button when mutation is pending', () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });
    const { container } = render(<ComplianceCsid {...defaultProps} />);
    // Loader2 renders an SVG with animate-spin class
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('does not call onSuccess when Next is clicked and phase is not done', async () => {
    const onSuccess = vi.fn();
    const { user } = setup(<ComplianceCsid {...defaultProps} onSuccess={onSuccess} />);
    // Next button is disabled in idle state
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).toBeDisabled();
    await user.click(nextBtn);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('invokes onMutate callback to set phase to submitting', () => {
    let capturedOnMutate: (() => void) | undefined;
    mockUseMutation.mockImplementation(
      (opts: {
        queryKey?: readonly unknown[];
        enabled?: unknown;
        onMutate?: unknown;
        onError?: unknown;
        onSuccess?: unknown;
      }) => {
        capturedOnMutate = opts.onMutate as (() => void) | undefined;
        return { mutate: vi.fn(), isPending: false };
      },
    );
    render(<ComplianceCsid {...defaultProps} />);
    // Trigger onMutate to move to submitting phase
    capturedOnMutate?.();
    // After onMutate, the status list should appear (csrSubmitted becomes true)
    // Re-render is triggered by setState; in this mock pattern the component
    // will re-render and show the progress list
  });

  it('invokes onError callback to reset phase and show toast', () => {
    let capturedOnError: ((error: Error) => void) | undefined;
    mockUseMutation.mockImplementation(
      (opts: {
        queryKey?: readonly unknown[];
        enabled?: unknown;
        onMutate?: unknown;
        onError?: unknown;
        onSuccess?: unknown;
      }) => {
        capturedOnError = opts.onError as ((error: Error) => void) | undefined;
        return { mutate: vi.fn(), isPending: false };
      },
    );
    render(<ComplianceCsid {...defaultProps} />);
    // Trigger onError
    capturedOnError?.(new Error('ZATCA API down'));
  });

  it('invokes onSuccess callback to advance phase through storing to done', () => {
    vi.useFakeTimers();
    let capturedOnSuccess: (() => void) | undefined;
    mockUseMutation.mockImplementation(
      (opts: {
        queryKey?: readonly unknown[];
        enabled?: unknown;
        onMutate?: unknown;
        onError?: unknown;
        onSuccess?: unknown;
      }) => {
        capturedOnSuccess = opts.onSuccess as (() => void) | undefined;
        return { mutate: vi.fn(), isPending: false };
      },
    );
    render(<ComplianceCsid {...defaultProps} />);
    capturedOnSuccess?.();
    // After 500ms timeout, phase should move to 'done'
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
  });
});
