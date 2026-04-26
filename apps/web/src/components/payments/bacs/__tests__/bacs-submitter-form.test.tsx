import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

// ---------------------------------------------------------------------------
// Mock the tRPC proxy: queryOptions/mutationOptions return safe placeholders
// that work with @tanstack/react-query without an actual network round-trip.
// ---------------------------------------------------------------------------

vi.mock('@/trpc/init', () => {
  return {
    trpc: {
      bacs: {
        getSubmitterMasks: {
          queryOptions: () => ({
            queryKey: ['bacs', 'getSubmitterMasks'],
            queryFn: async () => ({
              configured: false,
              sun: null,
              sortCode: null,
              accountNumber: null,
              submitterName: null,
            }),
          }),
          queryKey: () => ['bacs', 'getSubmitterMasks'],
        },
        saveSubmitterConfig: {
          mutationOptions: () => ({
            mutationFn: async () => ({
              saved: true,
              masks: { sun: 'XXXX56', sortCode: 'XX-XX-33', accountNumber: 'XXXX5678' },
            }),
          }),
        },
      },
    },
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock @contractor-ops/validators to avoid pulling in the zatca/einvoice
// sub-tree, which transitively imports React-PDF font files via file://
// URLs that the jsdom test runtime can't resolve. We only need the BACS
// schemas, so re-implement them inline using Zod.
vi.mock('@contractor-ops/validators', async () => {
  const { z } = await import('zod');
  return {
    sortCodeSchema: z.string().regex(/^\d{6}$/, 'Sort code must be exactly 6 digits'),
    accountNumberSchema: z.string().regex(/^\d{8}$/, 'Account number must be exactly 8 digits'),
    serviceUserNumberSchema: z.string().regex(/^\d{6}$/, 'SUN must be exactly 6 digits'),
    bacsSubmitterNameSchema: z
      .string()
      .max(18)
      .regex(/^[A-Z0-9 \-.'/&()+,:;?=@"]*$/, 'Must be uppercase ASCII BACS characters only'),
  };
});

import { BacsSubmitterForm } from '../bacs-submitter-form';

describe('BacsSubmitterForm', () => {
  it('renders all four input labels (SUN, sort code, account number, submitter name)', () => {
    render(<BacsSubmitterForm featureEnabled={true} />);
    // Use getAllByText since helper-text may contain the same fragments.
    expect(screen.getAllByText(/Service user number/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Originating sort code/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Originating account number/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Submitter name/i).length).toBeGreaterThan(0);
  });

  it('renders the "Save submitter details" button', () => {
    render(<BacsSubmitterForm featureEnabled={true} />);
    expect(screen.getByRole('button', { name: /save submitter details/i })).toBeInTheDocument();
  });

  it('disables the Save button when feature flag is off', () => {
    render(<BacsSubmitterForm featureEnabled={false} />);
    const button = screen.getByRole('button', { name: /save submitter details/i });
    expect(button).toBeDisabled();
  });
});
