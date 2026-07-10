import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Image } from '@unpic/react';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';

export interface PortalSubjectOrgInfo {
  subjectType: 'CONTRACTOR' | 'EMPLOYEE';
  subjectId: string;
  contractorId?: string;
  workerId?: string;
  organizationId: string;
  orgName: string;
  orgLogo?: string | null;
}

interface OrgPickerProps {
  orgs: PortalSubjectOrgInfo[];
  email: string;
  onSelect: (org: PortalSubjectOrgInfo) => void;
  loading?: boolean;
}

interface OrgPickerRowProps {
  org: PortalSubjectOrgInfo;
  isSelected: boolean;
  isDisabled: boolean;
  loading: boolean | undefined;
  ariaLabel: string;
  onSelect: (org: PortalSubjectOrgInfo) => void;
}

function OrgPickerRow({
  org,
  isSelected,
  isDisabled,
  loading,
  ariaLabel,
  onSelect,
}: OrgPickerRowProps) {
  const handleClick = useCallback(() => onSelect(org), [onSelect, org]);
  return (
    <Card
      className={cn(
        'transition-colors',
        isSelected && loading ? 'border-primary' : 'hover:border-primary',
        isDisabled && 'opacity-50',
      )}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleClick}
        aria-label={ariaLabel}
        className="block w-full cursor-pointer rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed">
        <CardContent className="flex items-center gap-3 p-4">
          {org.orgLogo ? (
            <Image
              src={org.orgLogo}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
              {org.orgName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{org.orgName}</span>
            <span className="block text-xs text-muted-foreground">
              {org.subjectType === 'EMPLOYEE' ? 'Employee portal' : 'Contractor portal'}
            </span>
          </div>
          {!!isSelected && !!loading && (
            <Loader2
              className="ms-auto h-4 w-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </CardContent>
      </button>
    </Card>
  );
}

export function OrgPicker({ orgs, email, onSelect, loading }: OrgPickerProps) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('Portal.orgPicker');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const handleSelect = useCallback(
    (org: PortalSubjectOrgInfo) => {
      if (loading) return;
      setSelectedKey(`${org.organizationId}:${org.subjectType}:${org.subjectId}`);
      onSelect(org);
    },
    [loading, onSelect],
  );

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-3">
        {orgs.map(org => {
          const key = `${org.organizationId}:${org.subjectType}:${org.subjectId}`;
          const isSelected = selectedKey === key;
          const isDisabled = !!loading && !isSelected;
          return (
            <OrgPickerRow
              key={key}
              org={org}
              isSelected={isSelected}
              isDisabled={isDisabled}
              loading={loading}
              ariaLabel={tAria('selectOrg', { name: org.orgName })}
              onSelect={handleSelect}
            />
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t('signedInAs', { email })}</p>
    </div>
  );
}
