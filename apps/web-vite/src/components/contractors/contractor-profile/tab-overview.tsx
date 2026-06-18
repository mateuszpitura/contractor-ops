import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ChevronDown } from 'lucide-react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { maskTaxId } from '../../../lib/mask-pii.js';
import { useContractorTabOverview } from '../hooks/use-contractor-tab-overview.js';
import { ComplianceStatusWidget } from './overview/compliance-status-widget.js';
import { FinancialPulseWidget } from './overview/financial-pulse-widget.js';

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
    rateValueMinor == null
      ? null
      : `${minorToMajor(rateValueMinor, contractor.currency).toFixed(minorUnitDigits(contractor.currency))} ${contractor.currency}`;

  const formattedAddress = [
    contractor.addressLine1,
    contractor.addressLine2,
    [contractor.postalCode, contractor.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      {/* Lead: what needs action — compliance (wide) + financial pulse */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ComplianceStatusWidget
          className="lg:col-span-2"
          health={contractor.complianceHealth}
          onSwitchTab={onSwitchTab}
        />
        <FinancialPulseWidget contractorId={contractor.id} currency={contractor.currency} />
      </div>

      {/* Engagement: active contract + key dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('activeContract')}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeContract ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
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

          <div className="mt-4 grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-3">
            <FieldRow label={t('createdAt')} value={formatDate(contractor.createdAt)} />
            <FieldRow label={t('updatedAt')} value={formatDate(contractor.updatedAt)} />
            <FieldRow
              label={t('contractEndDate')}
              value={activeContract?.endDate ? formatDate(activeContract.endDate) : '—'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reference data — demoted to a collapsible (not the next action) */}
      <details className="group rounded-xl border border-border/60 bg-card/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
          {t('widgets.details')}
          <ChevronDown
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-6 border-t border-border/40 px-4 py-4 lg:grid-cols-2">
          <div className="grid gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('companyDetails')}
            </h4>
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
          </div>

          <div className="grid gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('billingInfo')}
            </h4>
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
                value={t('fields.paymentTermsDays', { days: defaultBilling.paymentTermsDays })}
              />
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

export function TabOverview({ contractor }: { contractor: TabOverviewContractor }) {
  const { showPii, onSwitchTab } = useContractorTabOverview();
  return <TabOverviewView contractor={contractor} showPii={showPii} onSwitchTab={onSwitchTab} />;
}
