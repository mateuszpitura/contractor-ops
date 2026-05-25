import type { ContractorEInvoicingSectionProps } from './contractor-e-invoicing-section.js';
import { ContractorEInvoicingSectionView } from './contractor-e-invoicing-section.js';
import { useContractorEInvoicing } from './hooks/use-contractor-e-invoicing.js';

// Decision: render gated externally by parent (engagement-detail mounts only
// for DE jurisdiction). Container resolves the contractor.isPublicSectorBuyer
// query so the view stays free of tRPC.
export function ContractorEInvoicingSectionContainer(props: ContractorEInvoicingSectionProps) {
  const { isPublicSectorBuyer: contractorIsPublicSector } = useContractorEInvoicing(
    props.contractorId,
  );
  return (
    <ContractorEInvoicingSectionView
      {...props}
      contractorIsPublicSector={contractorIsPublicSector}
    />
  );
}
