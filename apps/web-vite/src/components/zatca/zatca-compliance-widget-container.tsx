import { useZatcaComplianceWidget } from './hooks/use-zatca-compliance-widget.js';
import {
  ZatcaComplianceWidgetSkeleton,
  ZatcaComplianceWidgetView,
} from './zatca-compliance-widget.js';

export type ZatcaComplianceWidgetProps = {
  connectionStatus?: string;
  environment?: string;
  certificateExpiresAt?: string;
};

export function ZatcaComplianceWidget(props: ZatcaComplianceWidgetProps) {
  const { isLoading, ...rest } = useZatcaComplianceWidget(
    props.connectionStatus ?? 'production',
    props.environment ?? 'Production',
    props.certificateExpiresAt,
  );
  if (isLoading) return <ZatcaComplianceWidgetSkeleton />;
  return <ZatcaComplianceWidgetView {...rest} />;
}
