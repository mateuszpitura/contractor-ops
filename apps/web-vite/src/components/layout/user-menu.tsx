import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Monitor,
  Moon,
  Pencil,
  Save,
  Settings,
  Sun,
  UserPen,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { useDensity } from '../../hooks/use-density.js';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { Theme } from '../../providers/theme-provider.js';
import { useTheme } from '../../providers/theme-provider.js';

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  displayName: string | null;
  initials: string;
  onSignOut: () => void;
  onSaveName: (name: string) => Promise<{ ok: true } | { ok: false; error: unknown }>;
}

export function UserMenuSkeleton() {
  return (
    <SidebarMenuButton size="lg" className="pointer-events-none">
      <Skeleton className="size-8 rounded-lg" />
      <div className="grid flex-1 gap-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </SidebarMenuButton>
  );
}

export function UserMenu({ user, displayName, initials, onSignOut, onSaveName }: UserMenuProps) {
  const t = useTranslations('Common');
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { density, toggleDensity } = useDensity();
  const reactId = useId();

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameDialogOpen) {
      setNameValue(user?.name ?? '');
      const handle = window.setTimeout(() => nameInputRef.current?.select(), 50);
      return () => window.clearTimeout(handle);
    }
  }, [nameDialogOpen, user?.name]);

  const submitName = async () => {
    setNameSaving(true);
    const result = await onSaveName(nameValue);
    setNameSaving(false);
    if (result.ok) setNameDialogOpen(false);
  };

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
          <Avatar className="size-8 rounded-lg">
            {user?.image ? <AvatarImage src={user.image} alt={displayName ?? ''} /> : null}
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
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
              <Avatar className="size-8 rounded-lg">
                {user?.image ? <AvatarImage src={user.image} alt={displayName ?? ''} /> : null}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            // biome-ignore lint/nursery/noJsxPropsBind: dialog open trigger
            onClick={() => setNameDialogOpen(true)}
            className="cursor-pointer">
            <UserPen className="size-4" />
            {t('editName')}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings" className="cursor-pointer" />}>
            <Settings className="size-4" />
            {t('settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              {theme === 'dark' ? (
                <Moon className="size-4" />
              ) : theme === 'light' ? (
                <Sun className="size-4" />
              ) : (
                <Monitor className="size-4" />
              )}
              {t('appearance')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={value => setTheme(value as Theme)}>
                <DropdownMenuRadioItem value="light" className="cursor-pointer">
                  <Sun className="size-4" />
                  {t('appearanceLight')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                  <Moon className="size-4" />
                  {t('appearanceDark')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="cursor-pointer">
                  <Monitor className="size-4" />
                  {t('appearanceSystem')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {/* Density toggle: comfortable ↔ compact. Mirrors the legacy
              inline row with a switch (post-migration regression). */}
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              {density === 'compact' ? (
                <Maximize2 className="size-4" />
              ) : (
                <Minimize2 className="size-4" />
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
          <DropdownMenuItem onClick={onSignOut} className="cursor-pointer">
            <LogOut className="size-4" />
            {t('signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              {t('editName')}
            </DialogTitle>
          </DialogHeader>
          <form
            // biome-ignore lint/nursery/noJsxPropsBind: form submit handler
            onSubmit={e => {
              e.preventDefault();
              void submitName();
            }}
            className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${reactId}-user-name`}>{t('editNamePrompt')}</Label>
              <Input
                ref={nameInputRef}
                id={`${reactId}-user-name`}
                value={nameValue}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                onChange={e => setNameValue(e.target.value)}
                placeholder={t('editNamePrompt')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                // biome-ignore lint/nursery/noJsxPropsBind: dialog close handler
                onClick={() => setNameDialogOpen(false)}>
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
