/**
 * Kleinunternehmer (§ 19 UStG) toggle — render parity test.
 *
 * Flipping this DE-only flag rewrites VAT handling for every future
 * invoice issued by the organisation. The legacy guard "non-DE orgs
 * never see the toggle" must hold in web-vite too. After the passthrough
 * refactor the DE gate lives in `KleinunternehmerToggleContainer`, so
 * non-DE coverage tests the container; checked/unchecked rendering still
 * tests the presentational view directly with a hand-rolled hook return.
 *
 * The view takes the `useKleinunternehmerToggle` hook return as a prop,
 * so we hand-roll toggle state instead of mocking tRPC.
 */

import { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 requires this signal for act() to flush state updates in tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

const useKleinunternehmerToggleMock = vi.fn();
vi.mock('../hooks/use-kleinunternehmer-toggle.js', () => ({
  useKleinunternehmerToggle: () => useKleinunternehmerToggleMock(),
}));

import { KleinunternehmerToggle } from '../kleinunternehmer-toggle.js';
import { KleinunternehmerToggleContainer } from '../kleinunternehmer-toggle-container.js';

interface Harness {
  container: HTMLDivElement;
  root: Root;
}

function mount(ui: React.ReactNode): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(h: Harness) {
  act(() => {
    h.root.unmount();
  });
  h.container.remove();
}

type ToggleHookReturn = React.ComponentProps<typeof KleinunternehmerToggle>['toggle'];

function buildToggle(overrides: Partial<ToggleHookReturn> = {}): ToggleHookReturn {
  const noop = () => undefined;
  return {
    t: ((key: string) => key) as ToggleHookReturn['t'],
    confirmOpen: false,
    setConfirmOpen: noop,
    pendingValue: null,
    mutation: { isPending: false, mutate: noop } as unknown as ToggleHookReturn['mutation'],
    handleCheckedChange: noop,
    handleConfirm: noop,
    ...overrides,
  };
}

function Harnessed({ isKlein }: { isKlein: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const toggle = buildToggle({
    confirmOpen,
    setConfirmOpen,
    pendingValue,
    handleCheckedChange: next => {
      setPendingValue(next);
      setConfirmOpen(true);
    },
  });
  return <KleinunternehmerToggle isKleinunternehmer={isKlein} toggle={toggle} />;
}

let harness: Harness | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  useKleinunternehmerToggleMock.mockReturnValue(buildToggle());
});

afterEach(() => {
  if (harness) {
    unmount(harness);
    harness = undefined;
  }
});

describe('KleinunternehmerToggleContainer (web-vite)', () => {
  it('renders nothing for non-DE organizations', () => {
    harness = mount(
      <KleinunternehmerToggleContainer orgCountryCode="GB" isKleinunternehmer={false} />,
    );
    expect(harness.container.innerHTML).toBe('');
  });

  it('renders nothing when orgCountryCode is null', () => {
    harness = mount(
      <KleinunternehmerToggleContainer orgCountryCode={null} isKleinunternehmer={false} />,
    );
    expect(harness.container.innerHTML).toBe('');
  });

  it('renders nothing when orgCountryCode is undefined', () => {
    harness = mount(
      <KleinunternehmerToggleContainer orgCountryCode={undefined} isKleinunternehmer={false} />,
    );
    expect(harness.container.innerHTML).toBe('');
  });

  it('renders the toggle view for DE organizations', () => {
    harness = mount(
      <KleinunternehmerToggleContainer orgCountryCode="DE" isKleinunternehmer={false} />,
    );
    expect(
      harness.container.querySelector('[data-testid="kleinunternehmer-toggle"]'),
    ).not.toBeNull();
  });
});

describe('KleinunternehmerToggle view (web-vite)', () => {
  it('renders toggle, label and description', () => {
    harness = mount(<Harnessed isKlein={false} />);
    expect(
      harness.container.querySelector('[data-testid="kleinunternehmer-toggle"]'),
    ).not.toBeNull();
    expect(harness.container.textContent).toContain('toggleLabel');
    expect(harness.container.textContent).toContain('description');
  });

  it('reflects isKleinunternehmer=true as a checked switch', () => {
    harness = mount(<Harnessed isKlein={true} />);
    const sw = harness.container.querySelector('[data-slot="switch"]');
    expect(sw).not.toBeNull();
    // base-ui Switch exposes data-checked when on, data-unchecked when off.
    expect(sw?.hasAttribute('data-checked')).toBe(true);
    expect(sw?.hasAttribute('data-unchecked')).toBe(false);
  });

  it('reflects isKleinunternehmer=false as an unchecked switch', () => {
    harness = mount(<Harnessed isKlein={false} />);
    const sw = harness.container.querySelector('[data-slot="switch"]');
    expect(sw).not.toBeNull();
    expect(sw?.hasAttribute('data-unchecked')).toBe(true);
    expect(sw?.hasAttribute('data-checked')).toBe(false);
  });
});
