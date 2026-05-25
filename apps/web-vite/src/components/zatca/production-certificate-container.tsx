import { useProductionCertificate } from './hooks/use-production-certificate.js';
import type { ProductionCertificateViewProps } from './production-certificate.js';
import {
  ProductionCertificateCompleted,
  ProductionCertificateIdle,
} from './production-certificate.js';

export function ProductionCertificate(
  props: Pick<ProductionCertificateViewProps, 'onSuccess' | 'onBack'>,
) {
  const { completed, exchangeProductionCert, isPending, t } = useProductionCertificate();

  if (completed) {
    return <ProductionCertificateCompleted onSuccess={props.onSuccess} t={t} />;
  }

  return (
    <ProductionCertificateIdle
      onBack={props.onBack}
      exchangeProductionCert={exchangeProductionCert}
      isPending={isPending}
      t={t}
    />
  );
}
