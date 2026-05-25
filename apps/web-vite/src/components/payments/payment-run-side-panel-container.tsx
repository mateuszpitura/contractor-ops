import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { usePaymentRunSidePanel } from './hooks/use-payment-run-side-panel.js';
import { PaymentRunSidePanel } from './payment-run-side-panel.js';

interface PaymentRunSidePanelContainerProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportStatement?: (runId: string) => void;
}

export function PaymentRunSidePanelContainer(props: PaymentRunSidePanelContainerProps) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const { formatDate } = useDateFormatter();
  const bacsEnabled = useFlag('payments.bacs-enabled');
  const skontoEnabled = useFlag('payments.skonto-enabled');
  const panel = usePaymentRunSidePanel({
    runId: props.runId,
    open: props.open,
    onOpenChange: props.onOpenChange,
  });

  return (
    <PaymentRunSidePanel
      {...props}
      panel={panel}
      t={t}
      locale={locale}
      formatDate={formatDate}
      bacsEnabled={bacsEnabled}
      skontoEnabled={skontoEnabled}
    />
  );
}
