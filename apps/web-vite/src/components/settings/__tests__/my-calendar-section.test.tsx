/**
 * Web-vite port of apps/web/src/components/settings/__tests__/my-calendar-section.test.tsx.
 *
 * Component is wrapped in a `FeatureGateContainer` that consults tRPC for
 * billing tier — stubbed here to a pass-through so the test exercises the
 * loading / connected / disconnected branches of the calendar surface.
 *
 * Texts come from the component-local `useTranslations('CalendarSettings')`
 * call and the live i18n bundle (English copy).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../billing/feature-gate-container', () => ({
  FeatureGateContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { render, screen } from '@/test/test-utils';
import type { CalendarConnection, useMyCalendarSection } from '../hooks/use-my-calendar-section';
import { MyCalendarSection, MyCalendarSectionSkeleton } from '../my-calendar-section';

type HookReturn = ReturnType<typeof useMyCalendarSection>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    isLoading: false,
    eventCount: 0,
    googleConnection: undefined,
    outlookConnection: undefined,
    handleGoogleConnect: vi.fn(),
    handleOutlookConnect: vi.fn(),
    handleDisconnect: vi.fn(),
    isDisconnecting: false,
    ...overrides,
  } as HookReturn;
}

const connectedGoogle: CalendarConnection = {
  id: 'cal-google',
  provider: 'GOOGLE_CALENDAR',
  status: 'CONNECTED',
  displayName: 'jane@acme.test',
  connectedAt: new Date('2026-05-01T00:00:00Z'),
  userId: 'user-1',
  tokenExpiresAt: null,
};

describe('MyCalendarSection', () => {
  it('renders skeleton placeholders via the Skeleton sibling export', () => {
    const { container } = render(<MyCalendarSectionSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    // Connect buttons should not render in the skeleton view.
    expect(screen.queryByText('Connect Calendar')).not.toBeInTheDocument();
  });

  it('renders disconnected Google + Outlook cards by default', () => {
    render(<MyCalendarSection {...buildHook()} />);

    expect(screen.getAllByText('Not connected').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('button', { name: 'Connect Calendar' }).length).toBe(2);
  });

  it('shows the connected badge and account when Google is connected', () => {
    render(
      <MyCalendarSection {...buildHook({ googleConnection: connectedGoogle, eventCount: 4 })} />,
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('jane@acme.test')).toBeInTheDocument();
  });
});
