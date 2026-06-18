import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { ComplianceHealthBadge } from '../../compliance-health-badge.js';

export type ComplianceHealthFactor = {
  key: 'documents' | 'contract' | 'tasks' | 'invoices';
  status: 'green' | 'yellow' | 'red';
  label: string;
  detail?: string;
};

export type ComplianceHealthValue = {
  overall: 'green' | 'yellow' | 'red';
  factors: ComplianceHealthFactor[];
};

export interface ComplianceStatusWidgetProps {
  health: ComplianceHealthValue;
  onSwitchTab: (tab: string) => void;
  className?: string;
}

const FACTOR_TAB: Record<ComplianceHealthFactor['key'], string> = {
  documents: 'compliance',
  contract: 'contracts',
  tasks: 'workflows',
  invoices: 'invoices',
};

const FACTOR_ICON = { green: CheckCircle2, yellow: AlertTriangle, red: XCircle } as const;
const FACTOR_COLOR = {
  green: 'text-green-600 dark:text-green-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-500 dark:text-red-400',
} as const;

/**
 * Compliance status — leads with the single most urgent factor as the next
 * action, then lists every factor as a tab deep-link. Reuses the shared
 * health badge so the overview matches the list/profile-header verdict.
 */
export function ComplianceStatusWidget({
  health,
  onSwitchTab,
  className,
}: ComplianceStatusWidgetProps) {
  const t = useTranslations('ContractorProfile.overview');

  const labelFor = (key: ComplianceHealthFactor['key']) => {
    switch (key) {
      case 'documents':
        return t('healthChecks.documents');
      case 'contract':
        return t('healthChecks.contract');
      case 'tasks':
        return t('healthChecks.tasks');
      case 'invoices':
        return t('healthChecks.invoices');
    }
  };

  const worst =
    health.factors.find(f => f.status === 'red') ??
    health.factors.find(f => f.status === 'yellow') ??
    null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{t('widgets.compliance.title')}</CardTitle>
        <CardAction>
          <ComplianceHealthBadge health={health.overall} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          {worst
            ? t('widgets.compliance.nextAction', { action: labelFor(worst.key) })
            : t('widgets.compliance.allClear')}
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {health.factors.map(factor => (
            <FactorButton key={factor.key} factor={factor} onSwitchTab={onSwitchTab}>
              {labelFor(factor.key)}
            </FactorButton>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FactorButton({
  factor,
  onSwitchTab,
  children,
}: {
  factor: ComplianceHealthFactor;
  onSwitchTab: (tab: string) => void;
  children: React.ReactNode;
}) {
  const Icon = FACTOR_ICON[factor.status];
  const handleClick = useCallback(
    () => onSwitchTab(FACTOR_TAB[factor.key]),
    [factor.key, onSwitchTab],
  );
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-muted">
      <Icon className={`size-4 shrink-0 ${FACTOR_COLOR[factor.status]}`} aria-hidden="true" />
      <span className="text-sm">{children}</span>
    </button>
  );
}
