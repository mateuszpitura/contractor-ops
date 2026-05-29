import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useCallback } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { maskTaxId } from '../../../lib/mask-pii.js';
import { ComplianceHealthBadge } from '../compliance-health-badge.js';

type HealthFactor = {
  key: 'documents' | 'contract' | 'tasks' | 'invoices';
  status: 'green' | 'yellow' | 'red';
  label: string;
  detail?: string;
};

type ComplianceHealth = {
  overall: 'green' | 'yellow' | 'red';
  factors: HealthFactor[];
};

type BillingProfile = {
  id: string;
  legalEntityName: string;
  preferredCurrency: string;
  bankAccountMasked: string | null;
  paymentTermsDays: number | null;
  isDefault: boolean;
};

type Contract = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  billingModel: string | null;
};

export type TabOverviewContractor = {
  id: string;
  legalName: string;
  displayName: string;
  type: string;
  taxId: string | null;
  vatId: string | null;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string;
  currency: string;
  customFieldsJson: unknown;
  billingProfiles: BillingProfile[];
  contracts: Contract[];
  complianceHealth: ComplianceHealth;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type TabOverviewViewProps = {
  contractor: TabOverviewContractor;
  showPii: boolean;
  onSwitchTab: (tab: string) => void;
};

const healthFactorTabMap: Record<string, string> = {
  documents: 'compliance',
  contract: 'contracts',
  tasks: 'workflows',
  invoices: 'invoices',
};

const healthStatusIcons = {
  green: CheckCircle2,
  yellow: AlertTriangle,
  red: XCircle,
} as const;

const healthStatusColors = {
  green: 'text-green-600 dark:text-green-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-500 dark:text-red-400',
} as const;

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-[13px]' : ''}`}>{value}</span>
    </div>
  );
}

function HealthFactorButton({
  factor,
  onSwitchTab,
  children,
}: {
  factor: HealthFactor;
  onSwitchTab: (tab: string) => void;
  children: React.ReactNode;
}) {
  const Icon = healthStatusIcons[factor.status];
  const colorClass = healthStatusColors[factor.status];
  const targetTab = healthFactorTabMap[factor.key];
  const handleClick = useCallback(() => {
    if (targetTab) onSwitchTab(targetTab);
  }, [targetTab, onSwitchTab]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-muted">
      <Icon className={`size-4 shrink-0 ${colorClass}`} />
      <span className="text-sm">{children}</span>
    </button>
  );
}

export function TabOverviewView({ contractor, showPii, onSwitchTab }: TabOverviewViewProps) {
  const t = useTranslations('ContractorProfile.overview');
  const { formatDate } = useDateFormatter();
  const tc = useTranslations('Contractors');

  const customFields = (contractor.customFieldsJson as Record<string, unknown>) ?? {};
  const billingModel = customFields.billingModel as string | undefined;
  const rateValueMinor = customFields.rateValueMinor as number | undefined;

  const defaultBilling = contractor.billingProfiles.find(bp => bp.isDefault);
  const activeContract = contractor.contracts.find(c => c.status === 'ACTIVE');

  const formattedRate =
    rateValueMinor == null ? null : `${(rateValueMinor / 100).toFixed(2)} ${contractor.currency}`;

  const formattedAddress = [
    contractor.addressLine1,
    contractor.addressLine2,
    [contractor.postalCode, contractor.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('companyDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldRow label={t('fields.legalName')} value={contractor.legalName} />
          <FieldRow label={t('fields.displayName')} value={contractor.displayName} />
          <FieldRow
            label={t('fields.type')}
            value={tDynLoose(tc, 'type', enumKey(contractor.type))}
          />
          <FieldRow
            label={t('fields.nip')}
            value={showPii ? contractor.taxId : maskTaxId(contractor.taxId)}
            mono
          />
          <FieldRow
            label={t('fields.vatEu')}
            value={showPii ? contractor.vatId : maskTaxId(contractor.vatId)}
            mono
          />
          <FieldRow label={t('fields.regon')} value={contractor.registrationNumber} mono />
          {contractor.email ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t('fields.email')}</span>
              <a
                href={`mailto:${contractor.email}`}
                className="text-sm text-primary hover:underline">
                {contractor.email}
              </a>
            </div>
          ) : null}
          <FieldRow label={t('fields.phone')} value={contractor.phone} />
          <FieldRow label={t('fields.address')} value={formattedAddress} />
          <FieldRow label={t('fields.country')} value={contractor.countryCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('billingInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldRow label={t('fields.billingModel')} value={billingModel} />
          <FieldRow label={t('fields.rate')} value={formattedRate} mono />
          <FieldRow label={t('fields.currency')} value={contractor.currency} />
          <FieldRow
            label={t('fields.bankAccount')}
            value={defaultBilling?.bankAccountMasked}
            mono
          />
          {defaultBilling?.paymentTermsDays == null ? null : (
            <FieldRow
              label={t('fields.paymentTerms')}
              value={t('fields.paymentTermsDays', {
                days: defaultBilling.paymentTermsDays,
              })}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('activeContract')}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeContract ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {activeContract.title ?? activeContract.type}
                </span>
                <span className="rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  {activeContract.status}
                </span>
              </div>
              {activeContract.startDate ? (
                <span className="text-xs text-muted-foreground">
                  {formatDate(activeContract.startDate)}
                  {activeContract.endDate ? ` - ${formatDate(activeContract.endDate)}` : ''}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noActiveContract')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('healthCard')}</CardTitle>
          <CardAction>
            <ComplianceHealthBadge health={contractor.complianceHealth.overall} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-2">
          {contractor.complianceHealth.factors.map(factor => (
            <HealthFactorButton key={factor.key} factor={factor} onSwitchTab={onSwitchTab}>
              {t(
                `healthChecks.${factor.key}` as
                  | 'healthChecks.documents'
                  | 'healthChecks.contract'
                  | 'healthChecks.tasks'
                  | 'healthChecks.invoices',
              )}
            </HealthFactorButton>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('keyDates')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldRow label={t('createdAt')} value={formatDate(contractor.createdAt)} />
          <FieldRow label={t('updatedAt')} value={formatDate(contractor.updatedAt)} />
          <FieldRow
            label={t('contractEndDate')}
            value={activeContract?.endDate ? formatDate(activeContract.endDate) : '\u2014'}
          />
          <FieldRow label={t('nextInvoice')} value={'\u2014'} />
        </CardContent>
      </Card>
    </div>
  );
}
