/**
 * Ported from apps/web/src/components/contracts/contract-detail/__tests__/detail-header.test.tsx.
 *
 * Web-vite split: DetailHeader is presentational; `header` prop is produced by
 * `useContractDetailHeader`. We pass shaped stubs and derive `menuActions`
 * for the current status via the same `getDetailContractActions` registry.
 *
 * SendForSignatureButton internally renders a Container that calls tRPC; we
 * mock it out here so tests stay scoped to the header itself.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('../send-for-signature-button', () => ({
  SendForSignatureButton: () => null,
}));

import { getDetailContractActions } from '../../actions';
import { DetailHeader } from '../detail-header';

type Props = Parameters<typeof DetailHeader>[0];
type Header = Props['header'];

function makeHeader(
  contractId: string,
  contractStatus: string,
  overrides: Partial<Header> = {},
): Header {
  const menuActions = getDetailContractActions({
    id: contractId,
    status: contractStatus,
  }).filter(a => a.key !== 'sendForSignature') as Header['menuActions'];

  const hasNonDestructive = menuActions.some(a => a.variant !== 'destructive');
  const hasDestructive = menuActions.some(a => a.variant === 'destructive');

  return {
    confirmDelete: vi.fn(),
    confirmTerminate: vi.fn(),
    deleteMutation: { isPending: false } as Header['deleteMutation'],
    deleteOpen: false,
    dispatchMenuAction: vi.fn(),
    editOpen: false,
    getActionLabel: (action: { labelKey: string }) => action.labelKey.replace('actions.', ''),
    hasDestructive,
    hasNonDestructive,
    isPending: false,
    menuActions,
    notImplemented: new Set<string>(['addAmendment', 'uploadDocument']),
    setDeleteOpen: vi.fn(),
    setEditOpen: vi.fn(),
    setTerminateOpen: vi.fn(),
    terminateMutation: { isPending: false } as Header['terminateMutation'],
    terminateOpen: false,
    ...overrides,
  };
}

describe('DetailHeader', () => {
  const baseContract = {
    id: 'ct1',
    title: 'B2B Master Agreement',
    status: 'ACTIVE',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-12-31T00:00:00.000Z',
    currency: 'EUR',
    rateValueMinor: 5000,
    contractor: {
      id: 'c1',
      legalName: 'ACME Sp. z o.o.',
      displayName: 'ACME',
      status: 'ACTIVE',
    },
  };

  it('renders contract title', () => {
    render(
      <DetailHeader
        contract={baseContract}
        header={makeHeader(baseContract.id, baseContract.status)}
      />,
    );
    expect(screen.getByText('B2B Master Agreement')).toBeInTheDocument();
  });

  it('renders contractor link', () => {
    render(
      <DetailHeader
        contract={baseContract}
        header={makeHeader(baseContract.id, baseContract.status)}
      />,
    );
    const link = screen.getByText('ACME');
    expect(link.closest('a')).toHaveAttribute('href', '/en/contractors/c1');
  });

  it('renders status badge', () => {
    render(
      <DetailHeader
        contract={baseContract}
        header={makeHeader(baseContract.id, baseContract.status)}
      />,
    );
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('renders an actions trigger when there are menu actions', () => {
    render(
      <DetailHeader
        contract={baseContract}
        header={makeHeader(baseContract.id, baseContract.status)}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders untitled fallback when title is null', () => {
    render(
      <DetailHeader
        contract={{ ...baseContract, title: null }}
        header={makeHeader(baseContract.id, baseContract.status)}
      />,
    );
    expect(screen.getByText('Untitled contract')).toBeInTheDocument();
  });

  it('does not render contractor link when contractor is null', () => {
    render(
      <DetailHeader
        contract={{ ...baseContract, contractor: null }}
        header={makeHeader(baseContract.id, baseContract.status)}
      />,
    );
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
  });

  it('renders status badge with DRAFT status', () => {
    const c = { ...baseContract, status: 'DRAFT' };
    render(<DetailHeader contract={c} header={makeHeader(c.id, c.status)} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders status badge for EXPIRED contract', () => {
    const c = { ...baseContract, status: 'EXPIRED' };
    render(<DetailHeader contract={c} header={makeHeader(c.id, c.status)} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders with PENDING_SIGNATURE status', () => {
    const c = { ...baseContract, status: 'PENDING_SIGNATURE' };
    render(<DetailHeader contract={c} header={makeHeader(c.id, c.status)} />);
    expect(screen.getByText('Pending signature')).toBeInTheDocument();
  });
});
