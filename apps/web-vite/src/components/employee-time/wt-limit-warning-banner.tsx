import { useTranslations } from '../../i18n/useTranslations.js';
import type { WtFinding } from './hooks/use-employee-time.js';
import { minutesToHours } from './hooks/use-employee-time.js';
import { WtLimitAlertBanner } from './wt-limit-alert-banner.js';

interface WtLimitWarningBannerProps {
  findings: WtFinding[];
  workerName: string;
  onViewRecord?: () => void;
  onDismiss?: () => void;
}

/**
 * On-save non-blocking working-time warning. The record already committed
 * server-side (findings are an advisory payload, never a thrown error), so this
 * surfaces the breach without blocking. Resolves the finding's dotted copy-key
 * for the highest-severity finding.
 */
export function WtLimitWarningBanner({
  findings,
  workerName,
  onViewRecord,
  onDismiss,
}: WtLimitWarningBannerProps) {
  const t = useTranslations('EmployeeTime.wtLimit');
  const tRoot = useTranslations();

  if (findings.length === 0) return null;

  const breach = findings.find(finding => finding.level === 'breach');
  const primary = breach ?? findings[0];

  return (
    <WtLimitAlertBanner
      level={breach ? 'breach' : 'approaching'}
      title={breach ? t('breachTitle') : t('approachingTitle')}
      message={tRoot(primary.copyKey, {
        name: workerName,
        limit: minutesToHours(primary.limit),
        actual: minutesToHours(primary.actual),
      })}
      onViewRecord={onViewRecord}
      onDismiss={onDismiss}
    />
  );
}
