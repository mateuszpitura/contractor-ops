import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { usePermissions } from '../../hooks/use-permissions.js';
import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { canViewSensitivePii, maskTaxId } from '../../lib/mask-pii.js';
import { formatAmount } from '../../lib/money.js';
import { EntityDetailItem, EntitySummarySheet } from '../table-kit/entity-summary-sheet.js';
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

  const customRaw = contractor.customFieldsJson;
  const custom: Record<string, unknown> =
    typeof customRaw === 'object' && customRaw !== null && !Array.isArray(customRaw)
      ? customRaw
      : {};
  const billingModel = custom.billingModel == null ? null : String(custom.billingModel);
  const rateMinor = typeof custom.rateValueMinor === 'number' ? custom.rateValueMinor : null;

  const rateDisplay =
    rateMinor === null ? null : formatAmount(rateMinor, contractor.currency, 'pl-PL');

  return (
    <EntitySummarySheet
      open={open}
      onOpenChange={onOpenChange}
      title={contractor.displayName ?? contractor.legalName}
      badges={
        <>
          <Badge
            variant="secondary"
            className={lifecycleBadgeColors[contractor.lifecycleStage] ?? ''}>
            {tDynLoose(t, 'lifecycle', enumKey(contractor.lifecycleStage))}
          </Badge>
          <Badge variant="secondary">{tDynLoose(t, 'type', enumKey(contractor.type))}</Badge>
          <ComplianceHealthBadge health={contractor.complianceHealth} />
        </>
      }
      detailsTitle={ts('details')}
      footer={
        <Button render={<Link href={`/contractors/${contractor.id}`} />} className="w-full">
          {ts('openFullProfile')}
        </Button>
      }>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <EntityDetailItem
          label={t('countryCompliance.nipLabel')}
          value={showPii ? contractor.taxId : maskTaxId(contractor.taxId)}
          mono
        />
        <EntityDetailItem label={tCommon('emailLabel')} value={contractor.email} />
        <EntityDetailItem label={t('columns.billingModel')} value={billingModel} />
        <EntityDetailItem label={t('columns.rate')} value={rateDisplay} mono />
        <EntityDetailItem label={t('columns.owner')} value={contractor.owner?.name} />
        <EntityDetailItem label={t('columns.teamProject')} value={contractor.primaryTeam?.name} />
      </div>
    </EntitySummarySheet>
  );
}
