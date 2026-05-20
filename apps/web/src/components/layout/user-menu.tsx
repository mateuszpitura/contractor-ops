'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { SidebarMenuButton, useSidebar } from '@contractor-ops/ui/components/shadcn/sidebar';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import {
  ChevronsUpDown,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Pencil,
  Save,
  Settings,
  UserPen,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDensity } from '@/hooks/use-density';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { getAvatarInitials } from '@/lib/avatar-initials';

/**
 * User menu in the sidebar footer.
 * Shows avatar, name, email, and dropdown with:
 * - Settings link
 * - Dark mode toggle
 * - Density toggle (comfortable/compact)
 * - Language switcher
 * - Sign out
 */
export function UserMenu() {
  const t = useTranslations('Common');
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { density, toggleDensity } = useDensity();
  const id = useId();
  const session = authClient.useSession();
  const isPending = session.isPending;

  const user = session.data?.user;
  const displayName = user?.name || user?.email?.split('@')[0] || null;
  const initials = getAvatarInitials(user?.name, user?.email ?? undefined);

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameDialogOpen) {
      setNameValue(user?.name ?? '');
      setTimeout(() => nameInputRef.current?.select(), 50);
    }
  }, [nameDialogOpen, user?.name]);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === user?.name) {
      setNameDialogOpen(false);
      return;
    }
    setNameSaving(true);
    try {
      await authClient.updateUser({ name: trimmed });
      await session.refetch();
      toast.success(t('nameUpdated'));
      setNameDialogOpen(false);
    } catch {
      toast.error(t('nameUpdateFailed'));
    } finally {
      setNameSaving(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await authClient.signOut({
      fetchOptions: {
        // onSuccess fires only after the response (including Set-Cookie to
        // clear the session) has been fully processed by the browser.
        onSuccess: () => {
          // Full page navigation to /login clears React Query cache, Zustand
          // stores, and all in-memory state — prevents stale data from the
          // previous session.
          window.location.href = '/login';
        },
      },
    });
    if (error) {
      toast.error(t('signOutFailed'));
    }
  };

  if (isPending) {
    return (
      <SidebarMenuButton size="lg" className="pointer-events-none">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="grid flex-1 gap-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </SidebarMenuButton>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            />
          }>
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user?.image ?? undefined} alt={displayName ?? ''} />
            <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">
              <Bdi>{displayName ?? user?.email ?? ''}</Bdi>
            </span>
            <span className="truncate text-xs text-muted-foreground">
              <Bdi>{user?.email ?? ''}</Bdi>
            </span>
          </div>
          <ChevronsUpDown className="ms-auto size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          side={isMobile ? 'bottom' : 'right'}
          align="end"
          sideOffset={4}>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.image ?? undefined} alt={displayName ?? ''} />
                <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">
                  <Bdi>{displayName ?? user?.email ?? ''}</Bdi>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <Bdi>{user?.email ?? ''}</Bdi>
                </span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <DropdownMenuItem onClick={() => setNameDialogOpen(true)}>
            <UserPen className="me-2 h-4 w-4" />
            {t('editName')}
          </DropdownMenuItem>

          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="me-2 h-4 w-4" />
            {t('settings')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span className="text-sm">{t('darkMode')}</span>
            </div>
            <Switch
              checked={theme === 'dark'}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onCheckedChange={checked => {
                document.documentElement.classList.add('theme-transition');
                setTheme(checked ? 'dark' : 'light');
                setTimeout(() => {
                  document.documentElement.classList.remove('theme-transition');
                }, 350);
              }}
              aria-label={t('darkMode')}
            />
          </div>

          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              {density === 'compact' ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
              <span className="text-sm">{t('density')}</span>
            </div>
            <Switch
              checked={density === 'compact'}
              onCheckedChange={toggleDensity}
              aria-label={t('density')}
            />
          </div>

          <DropdownMenuSeparator />

          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="me-2 h-4 w-4" />
            {t('signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit name dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              {t('editName')}
            </DialogTitle>
          </DialogHeader>
          <form
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onSubmit={e => {
              e.preventDefault();
              void handleSaveName();
            }}
            className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-user-name`}>{t('editNamePrompt')}</Label>
              <Input
                ref={nameInputRef}
                id={`${id}-user-name`}
                value={nameValue}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                onChange={e => setNameValue(e.target.value)}
                placeholder={t('editNamePrompt')}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button type="button" variant="outline" onClick={() => setNameDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={nameSaving || !nameValue.trim()}>
                {nameSaving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
