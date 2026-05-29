import { Image } from '@unpic/react';
import { Check, Loader2 } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import type { OrgSwitcherOption } from './hooks/use-org-switcher.js';

interface OrgSwitcherListProps {
  orgs: OrgSwitcherOption[];
  switchingContractorId: string | null;
  onSelect: (target: { contractorId: string; organizationId: string }) => void;
  variant: 'menu' | 'sheet';
}

interface OrgSwitcherItemProps {
  org: OrgSwitcherOption;
  switching: boolean;
  disabled: boolean;
  isMenu: boolean;
  currentLabel: string;
  switchingLabel: string;
  onSelect: (target: { contractorId: string; organizationId: string }) => void;
}

function OrgSwitcherItem({
  org,
  switching,
  disabled,
  isMenu,
  currentLabel,
  switchingLabel,
  onSelect,
}: OrgSwitcherItemProps) {
  const { contractorId, organizationId, orgName, orgLogo, isCurrent } = org;
  const initial = orgName.charAt(0).toUpperCase();
  const handleClick = useCallback(
    () => onSelect({ contractorId, organizationId }),
    [onSelect, contractorId, organizationId],
  );

  return (
    <button
      type="button"
      role={isMenu ? 'menuitemradio' : undefined}
      aria-checked={isMenu ? isCurrent : undefined}
      aria-current={!isMenu && isCurrent ? 'true' : undefined}
      aria-label={
        isCurrent
          ? `${orgName} — ${currentLabel}`
          : switching
            ? `${orgName} — ${switchingLabel}`
            : orgName
      }
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-3 text-start outline-none transition-colors',
        isMenu
          ? 'rounded-md px-2 py-1.5 text-sm focus-visible:bg-accent focus-visible:text-accent-foreground hover:bg-accent hover:text-accent-foreground'
          : 'min-h-10 rounded-md px-3 py-2 text-sm hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring',
        isCurrent && 'bg-accent/40',
        disabled && !switching && 'cursor-default opacity-90',
        switching && 'opacity-70',
      )}>
      {orgLogo ? (
        <Image
          src={orgLogo}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
          {initial}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{orgName}</span>
      {switching ? (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : isCurrent ? (
        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function OrgSwitcherList({
  orgs,
  switchingContractorId,
  onSelect,
  variant,
}: OrgSwitcherListProps) {
  const t = useTranslations('Portal.orgSwitch');
  const isMenu = variant === 'menu';
  const currentLabel = t('current');
  const switchingLabel = t('switching');

  return (
    <div role={isMenu ? 'group' : undefined} aria-label={t('label')}>
      {orgs.map(org => {
        const switching = switchingContractorId === org.contractorId;
        const disabled = org.isCurrent || !!switchingContractorId;

        return (
          <OrgSwitcherItem
            key={`${org.organizationId}:${org.contractorId}`}
            org={org}
            switching={switching}
            disabled={disabled}
            isMenu={isMenu}
            currentLabel={currentLabel}
            switchingLabel={switchingLabel}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
