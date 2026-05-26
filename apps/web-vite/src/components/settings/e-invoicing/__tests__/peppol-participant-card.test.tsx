/**
 * Web-vite port of apps/web/src/components/settings/e-invoicing/__tests__/peppol-participant-card.test.tsx.
 *
 * The card mounts two tRPC-bound dialog containers; we stub both to keep
 * the test scoped to the card surface. Stub `t` returns the i18n key so
 * assertions are independent of copy churn.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../peppol-participant-register-dialog-container', () => ({
  PeppolParticipantRegisterDialogContainer: () => null,
}));
vi.mock('../peppol-participant-deregister-dialog-container', () => ({
  PeppolParticipantDeregisterDialogContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import type {
  PeppolParticipantRow,
  usePeppolParticipantCard,
} from '../hooks/use-peppol-participant-card';
import { PeppolParticipantCard } from '../peppol-participant-card';

type HookReturn = ReturnType<typeof usePeppolParticipantCard>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    tDialog: tStub,
    tCap: tStub,
    registerOpen: false,
    setRegisterOpen: vi.fn(),
    deregisterOpen: false,
    setDeregisterOpen: vi.fn(),
    participantsQuery: {} as HookReturn['participantsQuery'],
    active: null,
    lookupQuery: { isFetching: false, data: undefined } as HookReturn['lookupQuery'],
    handleRecheckCapabilities: vi.fn(),
    isLoading: false,
    ...overrides,
  } as HookReturn;
}

const formatStub = {
  dateTime: () => '2026-04-01 12:00',
} as unknown as Parameters<typeof PeppolParticipantCard>[0]['format'];

const activeRow: PeppolParticipantRow = {
  id: 'p1',
  status: 'ACTIVE',
  schemeId: 'iso6523-actorid-upis::0088',
  identifierValue: '0088:5790000435975',
  participantId: 'iso6523-actorid-upis::0088:5790000435975',
  aspProvider: 'Mercury B2B',
  createdAt: new Date('2026-04-01T10:00:00Z'),
  lastCapabilityCheckAt: new Date('2026-04-15T10:00:00Z'),
};

describe('PeppolParticipantCard', () => {
  it('renders the empty state with register CTA when no active participant', async () => {
    const setRegisterOpen = vi.fn();
    const { user } = setup(
      <PeppolParticipantCard format={formatStub} {...buildHook({ setRegisterOpen })} />,
    );

    expect(screen.getByText('emptyHeading')).toBeInTheDocument();
    expect(screen.getByText('emptyBody')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ctaNotRegistered' }));
    expect(setRegisterOpen).toHaveBeenCalledWith(true);
  });

  it('renders skeletons when loading', () => {
    const { container } = render(
      <PeppolParticipantCard format={formatStub} {...buildHook({ isLoading: true })} />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the active heading, participant identifier and status pill when active', () => {
    render(<PeppolParticipantCard format={formatStub} {...buildHook({ active: activeRow })} />);

    expect(screen.getByText('activeHeading')).toBeInTheDocument();
    expect(screen.getByTestId('participant-id').textContent).toContain(
      'iso6523-actorid-upis::0088',
    );
    expect(screen.getByText('Mercury B2B')).toBeInTheDocument();
  });

  it('fires handleRecheckCapabilities when the recheck button is clicked', async () => {
    const handleRecheckCapabilities = vi.fn();
    const { user } = setup(
      <PeppolParticipantCard
        format={formatStub}
        {...buildHook({ active: activeRow, handleRecheckCapabilities })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'recheckCapabilities' }));
    expect(handleRecheckCapabilities).toHaveBeenCalledTimes(1);
  });

  it('opens the deregister dialog when the destructive button is clicked', async () => {
    const setDeregisterOpen = vi.fn();
    const { user } = setup(
      <PeppolParticipantCard
        format={formatStub}
        {...buildHook({ active: activeRow, setDeregisterOpen })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'deregisterButton' }));
    expect(setDeregisterOpen).toHaveBeenCalledWith(true);
  });
});
