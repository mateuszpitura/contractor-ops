import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { SocialButtons } from '../social-buttons';

const signInSocial = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: (...args: any[]) => signInSocial(...args),
    },
  },
}));

describe('SocialButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInSocial.mockResolvedValue(undefined);
  });

  it('renders Google and Microsoft buttons', () => {
    setup(<SocialButtons />);
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Microsoft/i })).toBeInTheDocument();
  });

  it('renders social divider text', () => {
    setup(<SocialButtons />);
    expect(screen.getByText(/or continue with/i)).toBeInTheDocument();
  });

  it('calls signIn.social with google provider on click', async () => {
    const { user } = setup(<SocialButtons />);
    await user.click(screen.getByRole('button', { name: /Google/i }));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/',
    });
  });

  it('calls signIn.social with microsoft provider on click', async () => {
    const { user } = setup(<SocialButtons />);
    await user.click(screen.getByRole('button', { name: /Microsoft/i }));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'microsoft',
      callbackURL: '/',
    });
  });

  it('disables both buttons while a provider is loading', async () => {
    signInSocial.mockReturnValue(
      new Promise(() => {
        /* never resolves */
      }),
    ); // never resolves
    render(<SocialButtons />);
    // fireEvent does not await the async handler's never-settling Promise; user.click would hang.
    fireEvent.click(screen.getByRole('button', { name: /Google/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Google/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Microsoft/i })).toBeDisabled();
    });
  });
});
