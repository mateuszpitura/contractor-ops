import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, setup, waitFor } from '@/test/test-utils';
import { InviteAcceptForm } from '../invite-accept-form';

const signUpEmail = vi.fn();
const acceptInvitation = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: {
      email: (...args: unknown[]) => signUpEmail(...args),
    },
    organization: {
      acceptInvitation: (...args: unknown[]) => acceptInvitation(...args),
    },
  },
}));

const mockPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/auth/social-buttons', () => ({
  SocialButtons: () => <div data-testid="social-mock" />,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('InviteAcceptForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signUpEmail.mockResolvedValue({ error: null });
    acceptInvitation.mockResolvedValue({ error: null });
  });

  it('renders pre-filled email as disabled', () => {
    setup(<InviteAcceptForm token="tok-123" email="invited@example.com" orgName="Acme Corp" />);
    const emailInput = screen.getByLabelText('Work email');
    expect(emailInput).toHaveValue('invited@example.com');
    expect(emailInput).toBeDisabled();
  });

  it('renders org name in title', () => {
    setup(<InviteAcceptForm token="tok-123" email="invited@example.com" orgName="Acme Corp" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Join Acme Corp');
  });

  it('renders social buttons', () => {
    setup(<InviteAcceptForm token="tok-123" />);
    expect(screen.getByTestId('social-mock')).toBeInTheDocument();
  });

  it('shows validation error for short password', async () => {
    const { user } = setup(<InviteAcceptForm token="tok-123" email="test@example.com" />);
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Accept and join' }));
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('calls signUp and acceptInvitation on valid submit', async () => {
    const { user } = setup(
      <InviteAcceptForm token="tok-123" email="invited@example.com" orgName="Acme" />,
    );
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Accept and join' }));
    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith({
        email: 'invited@example.com',
        password: 'password123',
        name: 'invited',
      });
    });
    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledWith({
        invitationId: 'tok-123',
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows error toast when signUp fails', async () => {
    const { toast } = await import('sonner');
    signUpEmail.mockResolvedValue({
      error: { message: 'Account exists' },
    });
    const { user } = setup(<InviteAcceptForm token="tok-123" email="test@example.com" />);
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Accept and join' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Account exists');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows error toast when acceptInvitation fails', async () => {
    const { toast } = await import('sonner');
    acceptInvitation.mockResolvedValue({
      error: { message: 'Invalid token' },
    });
    const { user } = setup(<InviteAcceptForm token="tok-123" email="test@example.com" />);
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Accept and join' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid token');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("defaults orgName to 'the organization'", () => {
    setup(<InviteAcceptForm token="tok-123" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Join the organization');
  });
});
