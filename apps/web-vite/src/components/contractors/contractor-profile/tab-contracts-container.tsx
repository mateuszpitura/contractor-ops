import { useContractorTabContracts } from '../hooks/use-contractor-tab-contracts.js';
import { TabContractsEmpty, TabContractsView } from './tab-contracts.js';

type TabContractsContainerProps = {
  contractorId: string;
};

export function TabContractsContainer({ contractorId }: TabContractsContainerProps) {
  const contracts = useContractorTabContracts(contractorId);

  if (!contracts.isLoading && contracts.items.length === 0) {
    return (
      <TabContractsEmpty
        contractorId={contracts.contractorId}
        wizardOpen={contracts.wizardOpen}
        setWizardOpen={contracts.setWizardOpen}
      />
    );
  }

  return <TabContractsView {...contracts} />;
}
