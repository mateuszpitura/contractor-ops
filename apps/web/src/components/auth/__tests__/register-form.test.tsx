import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, setup, waitFor } from '@/test/test-utils';
import { RegisterForm } from '../register-form';

const signUpEmail = vi.fn();
const organizationCreate = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: {
      email: (...args: any[]) => signUpEmail(...args),
    },
    organization: {
      create: (...args: any[]) => organizationCreate(...args),
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

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signUpEmail.mockResolvedValue({ error: null });
    organizationCreate.mockResolvedValue({ error: null });
  });

  it('renders all form fields', () => {
    setup(<RegisterForm />);
    expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders social buttons', () => {
    setup(<RegisterForm />);
    expect(screen.getByTestId('social-mock')).toBeInTheDocument();
  });

  it('renders link to login page', () => {
    setup(<RegisterForm />);
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('shows validation error for short org name', async () => {
    const { user } = setup(<RegisterForm />);
    await user.type(screen.getByLabelText('Organization name'), 'A');
    await user.click(screen.getByRole('button', { name: 'Create organization' }));
    await waitFor(() => {
      expect(
        screen.getByText('Organization name must be at least 2 characters'),
      ).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    const { user } = setup(<RegisterForm />);
    await user.type(screen.getByLabelText('Organization name'), 'My Org');
    await user.type(screen.getByLabelText('Work email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create organization' }));
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('calls signUp and organization create on valid submit', async () => {
    const { user } = setup(<RegisterForm />);
    await user.type(screen.getByLabelText('Organization name'), 'My Company');
    await user.type(screen.getByLabelText('Work email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create organization' }));
    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        name: 'test',
      });
    });
    await waitFor(() => {
      expect(organizationCreate).toHaveBeenCalledWith({
        name: 'My Company',
        slug: 'my-company',
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows error toast when signUp fails', async () => {
    const { toast } = await import('sonner');
    signUpEmail.mockResolvedValue({
      error: { message: 'Email already exists' },
    });
    const { user } = setup(<RegisterForm />);
    await user.type(screen.getByLabelText('Organization name'), 'My Company');
    await user.type(screen.getByLabelText('Work email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create organization' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Email already exists');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows error toast when org create fails', async () => {
    const { toast } = await import('sonner');
    organizationCreate.mockResolvedValue({
      error: { message: 'Org name taken' },
    });
    const { user } = setup(<RegisterForm />);
    await user.type(screen.getByLabelText('Organization name'), 'My Company');
    await user.type(screen.getByLabelText('Work email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create organization' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Org name taken');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
