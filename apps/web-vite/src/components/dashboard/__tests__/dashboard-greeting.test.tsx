/**
 * Step 10 port of apps/web/src/components/dashboard/__tests__/dashboard-greeting.test.tsx.
 *
 * DashboardGreeting reads `session.data.user.name` and picks one of three
 * greeting buckets (morning / afternoon / evening) off the local wall
 * clock. The legacy test mocked `@/lib/auth-client`; here we mock the
 * `auth-provider` so the component's `useAuth().useSession()` call
 * returns a stable stub regardless of Better Auth boot state.
 *
 * The shared `setupTestI18n()` helper patches i18next-icu's `parse()` to
 * work around the Node ESM/CJS interop bug that left `IntlMessageFormat`
 * unresolved as a constructor — so ICU `{name}` placeholders interpolate
 * here exactly as they do in the production Vite bundle, and the
 * "renders the user's first name" assertion below would fail if that
 * regression returns.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { DashboardGreeting } from '../dashboard-greeting.js';
import { findByText, mount } from './_render.js';

const useSessionMock = vi.fn();

vi.mock('../../../providers/auth-provider.js', () => ({
  useAuth: () => ({ useSession: useSessionMock }),
  useSession: () => useSessionMock(),
}));

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

let hoursSpy: ReturnType<typeof vi.spyOn> | undefined;
function stubHours(hour: number): void {
  hoursSpy?.mockRestore();
  hoursSpy = vi.spyOn(Date.prototype, 'getHours').mockReturnValue(hour);
}

beforeEach(() => {
  stubHours(9);
  useSessionMock.mockReturnValue({
    data: { user: { name: 'Jane Contractor' } },
    isPending: false,
  });
});

afterEach(() => {
  hoursSpy?.mockRestore();
  hoursSpy = undefined;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('DashboardGreeting (web-vite)', () => {
  it('returns null when the session user has no name', async () => {
    useSessionMock.mockReturnValue({ data: { user: { name: '' } }, isPending: false });
    const { container } = await mount(<DashboardGreeting />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when the session has no user at all', async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    const { container } = await mount(<DashboardGreeting />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when the session data has no name property', async () => {
    useSessionMock.mockReturnValue({ data: { user: {} }, isPending: false });
    const { container } = await mount(<DashboardGreeting />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an h1 heading and subtitle when the session has a name', async () => {
    const { container } = await mount(<DashboardGreeting />);
    const heading = container.querySelector('h1');
    expect(heading).not.toBeNull();
    expect(heading?.textContent ?? '').toContain('Good morning,');
    expect(
      findByText(container, "Here's what's happening across your organization today."),
    ).not.toBeNull();
  });

  it('uses the afternoon greeting after 12:00 local time', async () => {
    stubHours(14);
    const { container } = await mount(<DashboardGreeting />);
    expect(container.querySelector('h1')?.textContent ?? '').toContain('Good afternoon,');
  });

  it('uses the evening greeting after 18:00 local time', async () => {
    stubHours(20);
    const { container } = await mount(<DashboardGreeting />);
    expect(container.querySelector('h1')?.textContent ?? '').toContain('Good evening,');
  });

  it('uses the morning greeting at the 11:59 boundary', async () => {
    stubHours(11);
    const { container } = await mount(<DashboardGreeting />);
    expect(container.querySelector('h1')?.textContent ?? '').toContain('Good morning,');
  });

  it('uses the evening greeting at the 18:00 boundary', async () => {
    stubHours(18);
    const { container } = await mount(<DashboardGreeting />);
    expect(container.querySelector('h1')?.textContent ?? '').toContain('Good evening,');
  });

  it("renders the user's first name interpolated into the greeting", async () => {
    const { container } = await mount(<DashboardGreeting />);
    const heading = container.querySelector('h1');
    // Regression guard: i18next-icu must interpolate `{name}` from the ICU
    // message — if the Node ESM/CJS interop bug returns, the literal
    // "Good morning, {name}" string would render instead.
    expect(heading?.textContent ?? '').toBe('Good morning, Jane');
  });

  it('applies the heading typography classes for visual hierarchy', async () => {
    const { container } = await mount(<DashboardGreeting />);
    const heading = container.querySelector('h1');
    expect(heading?.className ?? '').toContain('font-display');
    expect(heading?.className ?? '').toContain('font-bold');
  });
});
