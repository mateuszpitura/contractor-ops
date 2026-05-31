import { Navigate } from 'react-router-dom';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { ComplianceGapsReport } from './compliance-gaps-report.js';
import { DateRangeFilter } from './date-range-filter.js';
import { ExpiringContractsReport } from './expiring-contracts-report.js';
import { useComplianceGapsReport } from './hooks/use-compliance-gaps-report.js';
import { useExpiringContractsReport } from './hooks/use-expiring-contracts-report.js';
import { useOverdueInvoicesReport } from './hooks/use-overdue-invoices-report.js';
import { useReportsContainer } from './hooks/use-reports-container.js';
import { useSpendContractorReport } from './hooks/use-spend-contractor-report.js';
import { useSpendTeamReport } from './hooks/use-spend-team-report.js';
import { OverdueInvoicesReport } from './overdue-invoices-report.js';
import { ReportSidebar } from './report-sidebar.js';
import { SpendContractorReport } from './spend-contractor-report.js';
import { SpendTeamReport } from './spend-team-report.js';

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

export function ReportsContainer() {
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
