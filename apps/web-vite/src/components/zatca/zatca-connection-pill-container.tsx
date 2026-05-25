import { useZatcaConnectionPill } from './hooks/use-zatca-connection-pill.js';
import { ZatcaConnectionPillSkeleton, ZatcaConnectionPillView } from './zatca-connection-pill.js';

export function ZatcaConnectionPill() {
  const { isLoading, ...props } = useZatcaConnectionPill();
  if (isLoading) return <ZatcaConnectionPillSkeleton />;
  return <ZatcaConnectionPillView {...props} />;
}
