import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { SidebarMenuButton, useSidebar } from '@contractor-ops/ui/components/shadcn/sidebar';
import { ChevronsUpDown } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { OrgInfo } from './dashboard-context.js';
import type { OrgSwitcherListItem } from './hooks/use-org-switcher.js';

interface OrgSwitcherProps {
  currentOrg: OrgInfo | null;
  organizations: OrgSwitcherListItem[];
  onOrgSwitch: (orgId: string) => void;
}

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

export function OrgSwitcher({ currentOrg, organizations, onOrgSwitch }: OrgSwitcherProps) {
  const t = useTranslations('Common.orgSwitcher');
  const { isMobile } = useSidebar();

  return (
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
          {t('label')}
        </DropdownMenuLabel>
        {organizations.map(org => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onOrgSwitch(org.id)}
            className="cursor-pointer gap-2 p-2">
            <div className="flex size-6 items-center justify-center rounded-sm border">
              {org.name.charAt(0).toUpperCase()}
            </div>
            {org.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrgSwitcherEmpty({ currentOrg }: { currentOrg: OrgInfo | null }) {
  const t = useTranslations('Common.orgSwitcher');
  const { isMobile } = useSidebar();

  return (
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
          {t('label')}
        </DropdownMenuLabel>
        <DropdownMenuItem disabled className="text-muted-foreground">
          {t('selectOrg')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
