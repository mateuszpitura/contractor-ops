/**
 * Mirror of `my-calendar-section.test.tsx` — same FeatureGate stub,
 * different connection scope (org-level vs personal) and the
 * onGoogleConnect / onOutlookConnect handlers come in as props rather
 * than from the hook.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../layout/feature-gate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { CalendarConnection, useMyCalendarSection } from '../hooks/use-my-calendar-section';
import type { useOrgCalendarSection } from '../hooks/use-org-calendar-section';
import { OrgCalendarSectionView, OrgCalendarSectionSkeleton } from '../org-calendar-section';

type HookReturn = ReturnType<typeof useOrgCalendarSection>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

type BuildPropsReturn = HookReturn & {
  onGoogleConnect: () => void;
  onOutlookConnect: () => void;
};

function buildProps(overrides: Partial<BuildPropsReturn> = {}): BuildPropsReturn {
  return {
    t: tStub,
    isLoading: false,
    googleConnection: undefined,
    outlookConnection: undefined,
    handleDisconnect: vi.fn(),
    isDisconnecting: false,
    onGoogleConnect: vi.fn(),
    onOutlookConnect: vi.fn(),
    ...overrides,
  } as BuildPropsReturn;
}

const connectedOutlook: CalendarConnection = {
  id: 'cal-outlook',
  provider: 'OUTLOOK_CALENDAR',
  status: 'CONNECTED',
  displayName: 'ops@acme.test',
  connectedAt: new Date('2026-05-10T00:00:00Z'),
  userId: null,
  tokenExpiresAt: null,
};

type Hook = ReturnType<typeof useMyCalendarSection>;

describe('OrgCalendarSectionView', () => {
  it('renders skeleton placeholders via the Skeleton sibling export', () => {
    const { container } = render(<OrgCalendarSectionSkeleton t={tStub} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders disconnected Google + Outlook cards by default', () => {
    render(<OrgCalendarSectionView {...buildProps()} />);
    expect(screen.getAllByText('Not connected').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('button', { name: 'Connect Calendar' }).length).toBe(2);
  });

  it('fires onOutlookConnect when the Outlook connect button is clicked', async () => {
    const onOutlookConnect = vi.fn();
    const { user } = setup(<OrgCalendarSectionView {...buildProps({ onOutlookConnect })} />);

    // Both providers share the connect-calendar label; the second one
    // ("Outlook Calendar") is below the first card.
    const buttons = screen.getAllByRole('button', { name: 'Connect Calendar' });
    expect(buttons.length).toBe(2);
    await user.click(buttons[1] as HTMLElement);
    expect(onOutlookConnect).toHaveBeenCalledTimes(1);
  });

  it('shows the connected badge + account when Outlook is connected', () => {
    render(
      <OrgCalendarSectionView
        {...buildProps({ outlookConnection: connectedOutlook as Hook['outlookConnection'] })}
      />,
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('ops@acme.test')).toBeInTheDocument();
  });
});
