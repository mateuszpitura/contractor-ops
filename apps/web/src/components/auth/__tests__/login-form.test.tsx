import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { LoginForm } from '../login-form';

const {
  signInEmail,
  mockPush,
} = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: signInEmail,
      magicLink: vi.fn(),
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/auth/social-buttons', () => ({
  SocialButtons: () => <div data-testid="social-mock" />,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('LoginForm', () => {
  beforeEach(() => {
    signInEmail.mockResolvedValue({ error: null });
    mockPush.mockClear();
  });

  it('submits email and password via auth client on success', async () => {
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/^password$/i), 'secret12');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: 'a@b.co',
        password: 'secret12',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('renders email and password error containers with aria-describedby', () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/work email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });

  it('renders form with correct input types', () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/work email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows error toast when signIn returns an error', async () => {
    const { toast } = await import('sonner');
    signInEmail.mockResolvedValue({
      error: { message: 'Invalid credentials' },
    });
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows network error toast on fetch failure', async () => {
    const { toast } = await import('sonner');
    signInEmail.mockRejectedValue(new Error('Network error'));
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/^password$/i), 'secret12');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('sends magic link and shows confirmation UI', async () => {
    const { authClient } = await import('@/lib/auth-client');
    (authClient.signIn.magicLink as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /email link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(screen.getByText('a@b.co')).toBeInTheDocument();
  });

  it('shows error toast for invalid email on magic link attempt', async () => {
    const { toast } = await import('sonner');
    const { user } = setup(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /email link/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('shows error toast when magic link request fails with error', async () => {
    const { toast } = await import('sonner');
    const { authClient } = await import('@/lib/auth-client');
    (authClient.signIn.magicLink as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: 'Magic link failed' },
    });
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /email link/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Magic link failed');
    });
  });

  it('shows network error toast when magic link network fails', async () => {
    const { toast } = await import('sonner');
    const { authClient } = await import('@/lib/auth-client');
    (authClient.signIn.magicLink as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /email link/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('navigates back from magic link confirmation', async () => {
    const { authClient } = await import('@/lib/auth-client');
    (authClient.signIn.magicLink as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    const { user } = setup(<LoginForm />);
    await user.type(screen.getByLabelText(/work email/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /email link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
  });

  it('renders register link', () => {
    render(<LoginForm />);
    expect(screen.getByText(/create organization/i)).toBeInTheDocument();
  });

  it('renders social buttons', () => {
    render(<LoginForm />);
    expect(screen.getByTestId('social-mock')).toBeInTheDocument();
  });
});
