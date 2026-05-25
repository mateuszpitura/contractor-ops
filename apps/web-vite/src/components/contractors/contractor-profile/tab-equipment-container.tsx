import { useContractorTabEquipment } from '../hooks/use-contractor-tab-equipment.js';
import { TabEquipmentEmpty, TabEquipmentView } from './tab-equipment.js';

type TabEquipmentContainerProps = {
  contractorId: string;
};

export function TabEquipmentContainer({ contractorId }: TabEquipmentContainerProps) {
  const equipment = useContractorTabEquipment(contractorId);

  if (!equipment.isLoading && equipment.items.length === 0) {
    return <TabEquipmentEmpty />;
  }

  return <TabEquipmentView contractorId={contractorId} {...equipment} />;
}
