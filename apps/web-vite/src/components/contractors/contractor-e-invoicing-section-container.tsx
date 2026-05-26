import type { ContractorEInvoicingSectionProps } from './contractor-e-invoicing-section.js';
import { ContractorEInvoicingSectionView } from './contractor-e-invoicing-section.js';
import { useContractorEInvoicing } from './hooks/use-contractor-e-invoicing.js';

// Decision: composition — resolves contractor.isPublicSectorBuyer query and
// forwards to ContractorEInvoicingSectionView; engagement-detail mounts only
// for DE jurisdiction.
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
