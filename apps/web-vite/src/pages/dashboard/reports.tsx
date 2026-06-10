import { Navigate } from 'react-router-dom';
import { Suspense } from 'react';

import { ComplianceGapsReport } from '../../components/reports/compliance-gaps-report.js';
import { DateRangeFilter } from '../../components/reports/date-range-filter.js';
import { ExpiringContractsReport } from '../../components/reports/expiring-contracts-report.js';
import { useComplianceGapsReport } from '../../components/reports/hooks/use-compliance-gaps-report.js';
import { useExpiringContractsReport } from '../../components/reports/hooks/use-expiring-contracts-report.js';
import { useOverdueInvoicesReport } from '../../components/reports/hooks/use-overdue-invoices-report.js';
import { useReportsContainer } from '../../components/reports/hooks/use-reports-container.js';
import { useSpendContractorReport } from '../../components/reports/hooks/use-spend-contractor-report.js';
import { useSpendTeamReport } from '../../components/reports/hooks/use-spend-team-report.js';
import { OverdueInvoicesReport } from '../../components/reports/overdue-invoices-report.js';
import { ReportSidebar } from '../../components/reports/report-sidebar.js';
import { SpendContractorReport } from '../../components/reports/spend-contractor-report.js';
import { SpendTeamReport } from '../../components/reports/spend-team-report.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function SpendContractorReportWidget({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const report = useSpendContractorReport(dateFrom, dateTo);
  return <SpendContractorReport report={report} />;
}

function SpendTeamReportWidget({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const report = useSpendTeamReport(dateFrom, dateTo);
  return <SpendTeamReport report={report} />;
}

function ExpiringContractsReportWidget() {
  const report = useExpiringContractsReport();
  return <ExpiringContractsReport report={report} />;
}

function OverdueInvoicesReportWidget() {
  const report = useOverdueInvoicesReport();
  return <OverdueInvoicesReport report={report} />;
}

function ComplianceGapsReportWidget() {
  const report = useComplianceGapsReport();
  return <ComplianceGapsReport report={report} />;
}

function ReportsPageContent() {
  const t = useTranslations('Reports');
  const { locale, canReadReports, report, dateFrom, dateTo, handleDateChange, handleReportChange } =
    useReportsContainer();

  if (!canReadReports) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  const activeReport = (() => {
    switch (report) {
      case 'spend-contractor':
        return <SpendContractorReportWidget dateFrom={dateFrom} dateTo={dateTo} />;
      case 'spend-team':
        return <SpendTeamReportWidget dateFrom={dateFrom} dateTo={dateTo} />;
      case 'expiring-contracts':
        return <ExpiringContractsReportWidget />;
      case 'overdue-invoices':
        return <OverdueInvoicesReportWidget />;
      case 'compliance-gaps':
        return <ComplianceGapsReportWidget />;
      default:
        return <SpendContractorReportWidget dateFrom={dateFrom} dateTo={dateTo} />;
    }
  })();

  return (
    <div className="space-y-section-gap">
      <div className="lg:hidden">
        <ReportSidebar activeReport={report} onSelect={handleReportChange} />
      </div>

      <div className="flex gap-6">
        <div className="hidden lg:block">
          <ReportSidebar activeReport={report} onSelect={handleReportChange} />
        </div>

        <div className="min-w-0 flex-1 space-y-card-gap">
          <AnimateIn delay={0}>
            <WorkbenchPageHeader title={t('title')} />
          </AnimateIn>

          <AnimateIn delay={1}>
            <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateChange={handleDateChange} />
          </AnimateIn>

          <AnimateIn delay={2}>{activeReport}</AnimateIn>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ReportsPageContent />
    </Suspense>
  );
}
