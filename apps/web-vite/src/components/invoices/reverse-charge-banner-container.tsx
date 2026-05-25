import { useReverseChargeBanner } from './hooks/use-reverse-charge-banner.js';
import { ReverseChargeBanner } from './reverse-charge-banner.js';

interface ReverseChargeBannerContainerProps {
  invoiceId: string;
  isReverseCharge: boolean;
  onToggle?: (newValue: boolean) => void;
}

export function ReverseChargeBannerContainer({
  invoiceId,
  isReverseCharge,
  onToggle,
}: ReverseChargeBannerContainerProps) {
  const { isPending, onRemove } = useReverseChargeBanner(invoiceId, onToggle);

  if (!isReverseCharge) return null;

  return <ReverseChargeBanner isPending={isPending} onRemove={onRemove} />;
}
