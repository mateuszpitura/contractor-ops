import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import type { LeitwegIdRowData } from '../leitweg-id-row';
import { LeitwegIdRow } from '../leitweg-id-row';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    leitwegId: {
      setDefault: { mutationOptions: vi.fn(() => ({ mutationKey: ['lid', 'setDefault'] })) },
      list: { queryKey: vi.fn(() => ['lid', 'list']) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------

describe('LeitwegIdRow', () => {
  const baseRow: LeitwegIdRowData = {
    id: 'r1',
    value: '991-33333TEST-33',
    description: 'Agency A',
    isDefaultForContractor: false,
    contractorId: 'c1',
    contract: null,
    contractor: { id: 'c1', displayName: 'Acme GmbH' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the value wrapped in <Bdi dir="ltr"> with mono styling', () => {
    render(
      <table>
        <tbody>
          <LeitwegIdRow row={baseRow} />
        </tbody>
      </table>,
    );
    const bdi = screen.getByTestId(`leitweg-value-${baseRow.id}`);
    expect(bdi.tagName).toBe('BDI');
    expect(bdi).toHaveAttribute('dir', 'ltr');
    expect(bdi.className).toContain('font-mono');
    expect(bdi.textContent).toBe(baseRow.value);
  });

  it('renders default badge when isDefaultForContractor=true', () => {
    render(
      <table>
        <tbody>
          <LeitwegIdRow row={{ ...baseRow, isDefaultForContractor: true }} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders contractor assignment badge', () => {
    render(
      <table>
        <tbody>
          <LeitwegIdRow row={baseRow} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
  });

  it('renders the actions trigger button with aria-label', () => {
    render(
      <table>
        <tbody>
          <LeitwegIdRow row={baseRow} />
        </tbody>
      </table>,
    );
    const trigger = screen.getByTestId(`leitweg-actions-${baseRow.id}`);
    expect(trigger).toHaveAttribute('aria-label', expect.stringContaining('Actions'));
  });

  it('renders description column or "—" fallback', () => {
    const { rerender } = render(
      <table>
        <tbody>
          <LeitwegIdRow row={baseRow} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('Agency A')).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <LeitwegIdRow row={{ ...baseRow, description: null }} />
        </tbody>
      </table>,
    );
    // At least one "—" fallback present (description or assigned-to col could emit one)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
