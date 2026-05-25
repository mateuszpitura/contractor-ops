export interface BillingPastDueLabels {
  paymentFailed: string;
  paymentFailedBody: string;
  goToBilling: string;
}

interface BillingPastDueBannerProps {
  onResolve: () => void;
  labels: BillingPastDueLabels;
}

export function BillingPastDueBanner({ onResolve, labels }: BillingPastDueBannerProps) {
  return (
    <div
      role="alert"
      className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive">
      <span className="font-medium">{labels.paymentFailed}</span> {labels.paymentFailedBody}{' '}
      <button
        type="button"
        onClick={onResolve}
        className="underline font-medium hover:no-underline">
        {labels.goToBilling}
      </button>
    </div>
  );
}
