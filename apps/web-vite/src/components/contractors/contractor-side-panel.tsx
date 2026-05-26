import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';

import { usePermissions } from '../../hooks/use-permissions.js';
import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { canViewSensitivePii, maskTaxId } from '../../lib/mask-pii.js';
import { ComplianceHealthBadge } from './compliance-health-badge.js';
import type { ContractorRow } from './contractor-table/columns.js';

// ---------------------------------------------------------------------------
// Lifecycle badge colors (same as columns.tsx)
// ---------------------------------------------------------------------------

const lifecycleBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  ONBOARDING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ACTIVE: 'bg-green-500/10 text-green-800 dark:text-green-400',
  OFFBOARDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  ENDED: 'bg-muted text-muted-foreground border border-border',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContractorSidePanelProps {
  contractor: ContractorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-out side panel showing contractor summary.
 * Opens from right on row click. 480px on desktop, 400px on tablet.
 */
export function ContractorSidePanel({ contractor, open, onOpenChange }: ContractorSidePanelProps) {
  const t = useTranslations('Contractors');
  const ts = useTranslations('Contractors.sidePanel');
  const tCommon = useTranslations('Common');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  if (!contractor) return null;

  const custom = contractor.customFieldsJson as Record<string, unknown> | null;
  const billingModel = custom?.billingModel ? String(custom.billingModel) : null;
  const rateMinor = typeof custom?.rateValueMinor === 'number' ? custom.rateValueMinor : null;

  const rateDisplay =
    rateMinor === null
      ? null
      : new Intl.NumberFormat('pl-PL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(rateMinor / 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                {contractor.displayName ?? contractor.legalName}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={lifecycleBadgeColors[contractor.lifecycleStage] ?? ''}>
                  {tDynLoose(t, 'lifecycle', enumKey(contractor.lifecycleStage))}
                </Badge>
                <Badge variant="secondary">{tDynLoose(t, 'type', enumKey(contractor.type))}</Badge>
                <ComplianceHealthBadge health={contractor.complianceHealth} />
              </div>
            </SheetHeader>

            <Separator />

            {/* Details card */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {ts('details')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem
                  label={t('countryCompliance.nipLabel')}
                  value={showPii ? contractor.taxId : maskTaxId(contractor.taxId)}
                  mono
                />
                <DetailItem label={tCommon('emailLabel')} value={contractor.email} />
                <DetailItem label={t('columns.billingModel')} value={billingModel} />
                <DetailItem
                  label={t('columns.rate')}
                  value={rateDisplay ? `${rateDisplay} ${contractor.currency}` : null}
                  mono
                />
                <DetailItem label={t('columns.owner')} value={contractor.owner?.name} />
                <DetailItem label={t('columns.teamProject')} value={contractor.primaryTeam?.name} />
              </div>
            </div>

            <Separator />

            {/* Open full profile CTA */}
            <Button render={<Link href={`/contractors/${contractor.id}`} />} className="w-full">
              {ts('openFullProfile')}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Detail item
// ---------------------------------------------------------------------------

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-[13px]' : ''}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
