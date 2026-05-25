import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { usePaymentRunSidePanel } from './hooks/use-payment-run-side-panel.js';
import { PaymentRunSidePanel, PaymentRunSidePanelSkeleton } from './payment-run-side-panel.js';

interface PaymentRunSidePanelContainerProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportStatement?: (runId: string) => void;
}

export function PaymentRunSidePanelContainer({
  runId,
  open,
  onOpenChange,
  onImportStatement,
}: PaymentRunSidePanelContainerProps) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const { formatDate } = useDateFormatter();
  const bacsEnabled = useFlag('payments.bacs-enabled');
  const skontoEnabled = useFlag('payments.skonto-enabled');
  const panel = usePaymentRunSidePanel({ runId, open, onOpenChange });

  if (panel.isLoading || !panel.run) {
    return <PaymentRunSidePanelSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  const exportFormat = panel.run.exportFormat as string | null | undefined;
  const showBacsPreview =
    bacsEnabled &&
    (exportFormat === 'BACS_STD18' ||
      panel.detectedFormatCounts.some(([format]) => format === 'BACS_STD18'));

  return (
    <PaymentRunSidePanel
      open={open}
      onOpenChange={onOpenChange}
      onImportStatement={onImportStatement}
      panel={{ ...panel, run: panel.run }}
      showBacsPreview={showBacsPreview}
      t={t}
      locale={locale}
      formatDate={formatDate}
      skontoEnabled={skontoEnabled}
    />
  );
}
