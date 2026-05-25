import { useContractDetailHeader } from '../hooks/use-contract-detail-header.js';
import { useEditContractDialog } from '../hooks/use-edit-contract-dialog.js';
import { DetailHeader } from './detail-header.js';
import { EditContractDialog } from './edit-contract-dialog.js';

type DetailHeaderContainerProps = {
  contract: Parameters<typeof DetailHeader>[0]['contract'];
};

export function DetailHeaderContainer({ contract }: DetailHeaderContainerProps) {
  const header = useContractDetailHeader(contract.id, contract.status);
  const edit = useEditContractDialog(
    {
      id: contract.id,
      title: contract.title,
      startDate: contract.startDate,
      endDate: contract.endDate,
      currency: contract.currency,
      rateValueMinor: contract.rateValueMinor,
    },
    header.editOpen,
    header.setEditOpen,
  );

  return (
    <>
      <DetailHeader contract={contract} header={header} />
      <EditContractDialog open={header.editOpen} onOpenChange={header.setEditOpen} edit={edit} />
    </>
  );
}
