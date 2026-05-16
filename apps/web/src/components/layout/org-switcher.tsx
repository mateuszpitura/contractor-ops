'use client';

import { Building2, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useDashboardContext } from '@/components/layout/dashboard-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';

/**
 * Organization switcher dropdown at the top of the sidebar.
 * Uses server-provided activeOrg from DashboardContext for instant rendering.
 * Falls back to client-side hooks for the org list (dropdown only).
 * Includes "Add organization" button that opens a creation dialog.
 */
export function OrgSwitcher() {
  const t = useTranslations('Common.orgSwitcher');
  const { isMobile } = useSidebar();
  const { activeOrg: serverOrg } = useDashboardContext();
  const { data: orgList } = authClient.useListOrganizations();
  const id = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const currentOrg = serverOrg;
  const organizations = orgList ?? [];

  const handleOrgSwitch = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    window.location.reload();
  };

  const handleCreateOrg = async () => {
    const name = newOrgName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const { error } = await authClient.organization.create({ name, slug });

      if (error) {
        toast.error(error.message ?? t('createFailed'));
        return;
      }

      setDialogOpen(false);
      setNewOrgName('');
      window.location.reload();
    } catch {
      toast.error(t('createFailed'));
    } finally {
      setIsCreating(false);
    }
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
          <div className="org-logo-gradient flex aspect-square size-8 items-center justify-center rounded-lg text-primary-foreground font-display text-sm font-bold shadow-sm">
            {currentOrg?.name?.charAt(0)?.toUpperCase() ?? 'O'}
          </div>
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{currentOrg?.name ?? t('selectOrg')}</span>
          </div>
          <ChevronsUpDown className="ms-auto size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          side={isMobile ? 'bottom' : 'right'}
          sideOffset={4}>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('orgsLabel')}
          </DropdownMenuLabel>
          {organizations.map(org => (
            <DropdownMenuItem
              key={org.id}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => handleOrgSwitch(org.id)}
              className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <Building2 className="size-4 shrink-0" />
              </div>
              <span className="truncate">{org.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <DropdownMenuItem className="gap-2 p-2" onClick={() => setDialogOpen(true)}>
            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
              <Plus className="size-3.5" />
            </div>
            <span>{t('addOrg')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              {t('createTitle')}
            </DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
          </DialogHeader>
          <form
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onSubmit={e => {
              e.preventDefault();
              void handleCreateOrg();
            }}
            className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-org-name`}>{t('nameLabel')}</Label>
              <Input
                id={`${id}-org-name`}
                value={newOrgName}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                onChange={e => setNewOrgName(e.target.value)}
                placeholder={t('namePlaceholder')}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isCreating || !newOrgName.trim()}>
                {isCreating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                {isCreating ? t('creating') : t('create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
