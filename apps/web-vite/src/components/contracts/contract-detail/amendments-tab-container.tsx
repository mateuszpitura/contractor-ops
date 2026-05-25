import {
  useAddAmendmentDialog,
  useContractAmendmentsTab,
} from '../hooks/use-contract-amendments-tab.js';
import { AmendmentsTab } from './amendments-tab.js';

type AmendmentsTabContainerProps = {
  contract: Parameters<typeof AmendmentsTab>[0]['contract'];
};

export function AmendmentsTabContainer({ contract }: AmendmentsTabContainerProps) {
  const tab = useContractAmendmentsTab();
  const addDialog = useAddAmendmentDialog(contract.id, tab.dialogOpen, tab.setDialogOpen);

  return <AmendmentsTab contract={contract} tab={tab} addDialog={addDialog} />;
}
