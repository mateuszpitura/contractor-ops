import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormLayoutClassName,
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
import { ChevronsUpDown, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { memo, useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { OrgInfo } from './dashboard-context.js';
import type { CreateOrgResult, OrgSwitcherListItem } from './hooks/use-org-switcher.js';

interface OrgSwitcherProps {
  currentOrg: OrgInfo | null;
  organizations: OrgSwitcherListItem[];
  onOrgSwitch: (orgId: string) => void;
  onCreateOrg: (name: string) => Promise<CreateOrgResult>;
  isCreating: boolean;
}

interface OrgSwitcherEmptyProps {
  currentOrg: OrgInfo | null;
  onCreateOrg: (name: string) => Promise<CreateOrgResult>;
  isCreating: boolean;
}

interface OrgMenuItemProps {
  org: OrgSwitcherListItem;
  onSwitch: (orgId: string) => void;
}

const OrgMenuItem = memo(function OrgMenuItem({ org, onSwitch }: OrgMenuItemProps) {
  const handleClick = useCallback(() => onSwitch(org.id), [onSwitch, org.id]);
  return (
    <DropdownMenuItem onClick={handleClick} className="cursor-pointer gap-2 p-2">
      <div className="flex size-6 items-center justify-center rounded-sm border">
        {org.name.charAt(0).toUpperCase()}
      </div>
      {org.name}
    </DropdownMenuItem>
  );
});

function OrgSwitcherTrigger({ currentOrg }: { currentOrg: OrgInfo | null }) {
  const t = useTranslations('Common.orgSwitcher');
  return (
    <>
      <div className="org-logo-gradient flex aspect-square size-8 items-center justify-center rounded-lg font-display text-sm font-bold text-primary-foreground shadow-sm">
        {currentOrg?.name?.charAt(0)?.toUpperCase() ?? 'O'}
      </div>
      <div className="grid flex-1 text-start text-sm leading-tight">
        <span className="truncate font-semibold">{currentOrg?.name ?? t('selectOrg')}</span>
      </div>
      <ChevronsUpDown className="ms-auto size-4" />
    </>
  );
}

interface CreateOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<CreateOrgResult>;
  isCreating: boolean;
}

function CreateOrgDialog({ open, onOpenChange, onCreate, isCreating }: CreateOrgDialogProps) {
  const t = useTranslations('Common.orgSwitcher');
  const nameId = useId();
  const [name, setName] = useState('');

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setName('');
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = await onCreate(name);
      if (result.ok) {
        setName('');
        onOpenChange(false);
      }
    },
    [name, onCreate, onOpenChange],
  );

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );

  const handleCancel = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={nameId}>{t('nameLabel')}</Label>
              <Input
                id={nameId}
                value={name}
                onChange={handleNameChange}
                placeholder={t('namePlaceholder')}
                autoFocus
                required
                disabled={isCreating}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isCreating}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isCreating || name.trim().length === 0}>
              {isCreating ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrgSwitcher({
  currentOrg,
  organizations,
  onOrgSwitch,
  onCreateOrg,
  isCreating,
}: OrgSwitcherProps) {
  const t = useTranslations('Common.orgSwitcher');
  const { isMobile } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = useCallback(() => setCreateOpen(true), []);

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
          <OrgSwitcherTrigger currentOrg={currentOrg} />
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
            <OrgMenuItem key={org.id} org={org} onSwitch={onOrgSwitch} />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={openCreate}
            className="cursor-pointer gap-2 p-2 text-muted-foreground">
            <div className="flex size-6 items-center justify-center rounded-sm border border-dashed">
              <Plus className="size-4" aria-hidden="true" />
            </div>
            {t('addOrg')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreateOrg}
        isCreating={isCreating}
      />
    </>
  );
}

export function OrgSwitcherEmpty({ currentOrg, onCreateOrg, isCreating }: OrgSwitcherEmptyProps) {
  const t = useTranslations('Common.orgSwitcher');
  const { isMobile } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = useCallback(() => setCreateOpen(true), []);

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
          <OrgSwitcherTrigger currentOrg={currentOrg} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          side={isMobile ? 'bottom' : 'right'}
          sideOffset={4}>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('orgsLabel')}
          </DropdownMenuLabel>
          <DropdownMenuItem disabled className="text-muted-foreground">
            {t('selectOrg')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={openCreate}
            className="cursor-pointer gap-2 p-2 text-muted-foreground">
            <div className="flex size-6 items-center justify-center rounded-sm border border-dashed">
              <Plus className="size-4" aria-hidden="true" />
            </div>
            {t('addOrg')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreateOrg}
        isCreating={isCreating}
      />
    </>
  );
}
