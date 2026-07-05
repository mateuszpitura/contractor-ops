/**
 * Employee pay section — pay stubs are computed and owned by the external
 * payroll system in v7.0 (the payroll integration is export-only), so this
 * renders a truthful "no pay stubs here" empty state, never a fabricated stub.
 * The tRPC boundary (getPayStubAvailability) lives in `use-employee-dashboard`.
 */

import { Wallet } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SectionCard, SectionMessage, SectionSkeleton } from './employee-section-shell.js';
import { useEmployeeDashboard } from './hooks/use-employee-dashboard.js';

export function EmployeePaySectionView({ description }: { description: string }) {
  const t = useTranslations('Portal.employee.pay');
  return (
    <SectionCard icon={Wallet} title={t('title')}>
      <SectionMessage icon={Wallet} title={t('unavailableTitle')} description={description} />
    </SectionCard>
  );
}

export function EmployeePaySection() {
  const t = useTranslations('Portal.employee.pay');
  const { payStub } = useEmployeeDashboard();

  if (payStub.isLoading) return <SectionSkeleton rows={2} />;

  // v7.0 always resolves `available:false`; a future payslip surface would
  // branch to a stub list here.
  return <EmployeePaySectionView description={t('externalPayroll')} />;
}
