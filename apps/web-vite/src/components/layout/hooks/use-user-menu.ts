import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import { useAuth } from '../../../providers/auth-provider.js';

export interface UserMenuView {
  isPending: boolean;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  displayName: string | null;
  initials: string;
  handleSignOut: () => Promise<void>;
  handleSaveName: (name: string) => Promise<{ ok: true } | { ok: false; error: unknown }>;
}

function readLocaleFromPath(): string {
  if (typeof window === 'undefined') return 'en';
  return window.location.pathname.split('/')[1] || 'en';
}

export function useUserMenu(): UserMenuView {
  const t = useTranslations('Common');
  const auth = useAuth();
  const session = auth.useSession();

  const user = session.data?.user ?? null;
  const displayName = user?.name || user?.email?.split('@')[0] || null;
  const initials = getAvatarInitials(user?.name, user?.email ?? undefined);

  const handleSignOut = useCallback(async () => {
    const locale = readLocaleFromPath();
    const { error } = await auth.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = `/${locale}/login`;
        },
      },
    });
    if (error) toast.error(t('signOutFailed'));
  }, [auth, t]);

  const handleSaveName = useCallback(
    async (name: string): Promise<{ ok: true } | { ok: false; error: unknown }> => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === user?.name) return { ok: true };
      try {
        await auth.updateUser({ name: trimmed });
        await session.refetch?.();
        toast.success(t('nameUpdated'));
        return { ok: true };
      } catch (error) {
        toast.error(t('nameUpdateFailed'));
        return { ok: false, error };
      }
    },
    [auth, session, t, user?.name],
  );

  return {
    isPending: session.isPending,
    user: user
      ? {
          name: user.name,
          email: user.email,
          image: user.image,
        }
      : null,
    displayName,
    initials,
    handleSignOut,
    handleSaveName,
  };
}
