/**
 * Peppol participant card — render parity test.
 *
 * The Peppol participant record is the EU e-invoicing identity for the
 * tenant; rendering an inactive participant as "ACTIVE" (or the reverse)
 * misleads the operator and would route real invoices into a network
 * that has already revoked routing for them. We pin both the empty
 * state (no active participant) and the active state (with status pill,
 * participant id, ASP provider details).
 */

import type * as React from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../e-invoicing/peppol-participant-register-dialog.js', () => ({
  PeppolParticipantRegisterDialog: () => null,
}));

vi.mock('../e-invoicing/peppol-participant-deregister-dialog.js', () => ({
  PeppolParticipantDeregisterDialog: () => null,
}));

import type { PeppolParticipantRow } from '../e-invoicing/hooks/use-peppol-participant-card.js';
import { PeppolParticipantCardView } from '../e-invoicing/peppol-participant-card.js';

type CardProps = React.ComponentProps<typeof PeppolParticipantCardView>;

interface Harness {
  container: HTMLDivElement;
  root: Root;
}

function mount(ui: React.ReactNode): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  void act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(h: Harness) {
  void act(() => {
    h.root.unmount();
  });
  h.container.remove();
}

function buildProps(overrides: Partial<CardProps> = {}): CardProps {
  const noop = () => undefined;
  const tFn = ((key: string) => key) as CardProps['t'];
  const formatStub = {
    dateTime: () => '2026-05-01',
  } as unknown as CardProps['format'];
  const lookupQuery = {
    isFetching: false,
    data: undefined,
  } as unknown as CardProps['lookupQuery'];
  const participantsQuery = {
    isLoading: false,
    data: [],
  } as unknown as CardProps['participantsQuery'];
  return {
    format: formatStub,
    t: tFn,
    tDialog: tFn,
    tCap: tFn,
    registerOpen: false,
    setRegisterOpen: noop,
    deregisterOpen: false,
    setDeregisterOpen: noop,
    active: null,
    participantsQuery,
    lookupQuery,
    handleRecheckCapabilities: () => Promise.resolve(),
    isLoading: false,
    ...overrides,
  };
}

const activeParticipant: PeppolParticipantRow = {
  id: 'peppol-1',
  status: 'ACTIVE',
  schemeId: '0007',
  identifierValue: '5567321707',
  participantId: '0007:5567321707',
  aspProvider: 'Storecove',
  createdAt: new Date('2026-04-01').toISOString(),
  lastCapabilityCheckAt: new Date('2026-05-01').toISOString(),
};

let harness: Harness | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (harness) {
    unmount(harness);
    harness = undefined;
  }
});

describe('PeppolParticipantCard (web-vite)', () => {
  it('renders the empty-state heading + register CTA when no participant is active', () => {
    harness = mount(<PeppolParticipantCardView {...buildProps()} />);
    expect(harness.container.textContent).toContain('emptyHeading');
    expect(harness.container.textContent).toContain('ctaNotRegistered');
    // No participant id rendered yet.
    expect(harness.container.querySelector('[data-testid="participant-id"]')).toBeNull();
  });

  it('shows the active heading + participant identifier when an active row is supplied', () => {
    harness = mount(<PeppolParticipantCardView {...buildProps({ active: activeParticipant })} />);
    expect(harness.container.textContent).toContain('activeHeading');
    const idEl = harness.container.querySelector('[data-testid="participant-id"]');
    expect(idEl).not.toBeNull();
    expect(idEl?.textContent).toBe('0007:5567321707');
  });

  it('renders the ASP provider in the detail list when active', () => {
    harness = mount(<PeppolParticipantCardView {...buildProps({ active: activeParticipant })} />);
    expect(harness.container.textContent).toContain('Storecove');
  });

  it('exposes a deregister button on the active card', () => {
    harness = mount(<PeppolParticipantCardView {...buildProps({ active: activeParticipant })} />);
    const buttons = Array.from(harness.container.querySelectorAll('button')).map(
      b => b.textContent,
    );
    expect(buttons.some(text => text?.includes('deregisterButton'))).toBe(true);
  });

  it('renders skeleton placeholders in the loading state', () => {
    harness = mount(<PeppolParticipantCardView {...buildProps({ isLoading: true })} />);
    const skeletons = harness.container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
