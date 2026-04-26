import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

const mockUseMutation = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: mockUseMutation };
});

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string) => {
      const translations: Record<string, string> = {
        title: 'Step 2 of 5: Generate CSR',
        description: 'Generate a Certificate Signing Request.',
        keyType: 'Key Type:',
        keyTypeValue: 'ECDSA P-256',
        privateKeyNote: 'Private key never leaves the server.',
        csrPreviewLabel: 'CSR Preview',
        back: 'Back',
        next: 'Next',
        generateCsr: 'Generate CSR',
        'toast.success': 'CSR generated',
        'toast.error': 'Failed to generate CSR',
      };
      return translations[key] ?? key;
    },
  };
});

import { CsrGeneration } from '../csr-generation';

describe('CsrGeneration', () => {
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

  it('renders step title and description', () => {
    render(<CsrGeneration {...defaultProps} />);
    expect(screen.getByText('Step 2 of 5: Generate CSR')).toBeInTheDocument();
    expect(screen.getByText('Generate a Certificate Signing Request.')).toBeInTheDocument();
  });

  it('renders key type info', () => {
    render(<CsrGeneration {...defaultProps} />);
    expect(screen.getByText('Key Type:')).toBeInTheDocument();
    expect(screen.getByText('ECDSA P-256')).toBeInTheDocument();
  });

  it('renders Generate CSR button when CSR not yet generated', () => {
    render(<CsrGeneration {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Generate CSR' })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<CsrGeneration {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<CsrGeneration {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Generate CSR button while pending', () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });
    render(<CsrGeneration {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Generate CSR/ })).toBeDisabled();
  });

  it('does not render Next button before CSR is generated', () => {
    render(<CsrGeneration {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
