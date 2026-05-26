import {
  useAddAmendmentDialog,
  useContractAmendmentsTab,
} from '../hooks/use-contract-amendments-tab.js';
import {
  AddAmendmentDialog,
  AmendmentsTabEmpty,
  AmendmentsTabTimeline,
  sortAmendmentsNewestFirst,
} from './amendments-tab.js';

type AmendmentContract = {
  id: string;
  title: string | null;
  startDate: string | Date | null;
  createdAt: string | Date;
  amendments: Array<{
    id: string;
    amendmentNumber: string | null;
    title: string;
    effectiveDate: string | Date;
    description: string | null;
    changesSummaryJson: unknown;
    createdAt: string | Date;
  }>;
};

type AmendmentsTabContainerProps = {
  contract: AmendmentContract;
};

export function AmendmentsTabContainer({ contract }: AmendmentsTabContainerProps) {
  const tab = useContractAmendmentsTab();
  const addDialog = useAddAmendmentDialog(contract.id, tab.dialogOpen, tab.setDialogOpen);
  const amendments = sortAmendmentsNewestFirst(contract.amendments ?? []);

  if (amendments.length === 0) {
    return (
      <>
        <AmendmentsTabEmpty tab={tab} />
        <AddAmendmentDialog
          open={tab.dialogOpen}
          onOpenChange={tab.setDialogOpen}
          addDialog={addDialog}
        />
      </>
    );
  }

  return (
    <>
      <AmendmentsTabTimeline contract={contract} amendments={amendments} tab={tab} />
      <AddAmendmentDialog
        open={tab.dialogOpen}
        onOpenChange={tab.setDialogOpen}
        addDialog={addDialog}
      />
    </>
  );
}
