import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { DashboardGreeting } from '../dashboard-greeting';

const useSession = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => useSession(),
  },
}));

describe('DashboardGreeting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Local wall clock so getHours() matches greeting bucket regardless of CI TZ
    vi.setSystemTime(new Date(2026, 3, 4, 9, 0, 0));
    useSession.mockReturnValue({
      data: { user: { name: 'Jane Contractor' } },
      isPending: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns null when user name is missing', () => {
    useSession.mockReturnValue({ data: { user: { name: '' } }, isPending: false });
    const { container } = render(<DashboardGreeting />);
    expect(container.firstChild).toBeNull();
  });

  it('renders morning greeting and subtitle when session has a name', () => {
    render(<DashboardGreeting />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Good morning, Jane/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Here's what's happening across your organization today."),
    ).toBeInTheDocument();
  });

  it('uses afternoon greeting after noon local time', () => {
    vi.setSystemTime(new Date(2026, 3, 4, 14, 0, 0));
    render(<DashboardGreeting />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Good afternoon, Jane/ }),
    ).toBeInTheDocument();
  });
});
