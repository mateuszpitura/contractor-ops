import { Image } from '@unpic/react';
import { Check, Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import type { OrgSwitcherOption } from './hooks/use-org-switcher.js';

interface OrgSwitcherListProps {
  orgs: OrgSwitcherOption[];
  switchingContractorId: string | null;
  onSelect: (target: { contractorId: string; organizationId: string }) => void;
  variant: 'menu' | 'sheet';
}

export function OrgSwitcherList({
  orgs,
  switchingContractorId,
  onSelect,
  variant,
}: OrgSwitcherListProps) {
  const t = useTranslations('Portal.orgSwitch');
  const isMenu = variant === 'menu';

  return (
    <div role={isMenu ? 'group' : undefined} aria-label={t('label')}>
      {orgs.map(org => {
        const switching = switchingContractorId === org.contractorId;
        const disabled = org.isCurrent || !!switchingContractorId;
        const initial = org.orgName.charAt(0).toUpperCase();

        return (
          <button
            key={`${org.organizationId}:${org.contractorId}`}
            type="button"
            role={isMenu ? 'menuitemradio' : undefined}
            aria-checked={isMenu ? org.isCurrent : undefined}
            aria-current={!isMenu && org.isCurrent ? 'true' : undefined}
            aria-label={
              org.isCurrent
                ? `${org.orgName} — ${t('current')}`
                : switching
                  ? `${org.orgName} — ${t('switching')}`
                  : org.orgName
            }
            disabled={disabled}
            onClick={() =>
              onSelect({ contractorId: org.contractorId, organizationId: org.organizationId })
            }
            className={cn(
              'flex w-full items-center gap-3 text-start outline-none transition-colors',
              isMenu
                ? 'rounded-md px-2 py-1.5 text-sm focus-visible:bg-accent focus-visible:text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                : 'min-h-10 rounded-md px-3 py-2 text-sm hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring',
              org.isCurrent && 'bg-accent/40',
              disabled && !switching && 'cursor-default opacity-90',
              switching && 'opacity-70',
            )}>
            {org.orgLogo ? (
              <Image
                src={org.orgLogo}
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
            <span className="min-w-0 flex-1 truncate">{org.orgName}</span>
            {switching ? (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : org.isCurrent ? (
              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
