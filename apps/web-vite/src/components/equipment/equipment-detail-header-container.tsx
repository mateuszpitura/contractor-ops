import { useState } from 'react';
import type { EquipmentDetailHeaderProps } from './equipment-detail/equipment-detail-header.js';
import { EquipmentDetailHeaderView } from './equipment-detail/equipment-detail-header.js';
import { useEquipmentRetire, useEquipmentUnassign } from './hooks/use-equipment-detail-actions.js';

type EquipmentDetailHeaderContainerProps = Pick<
  EquipmentDetailHeaderProps,
  'equipment' | 'onEdit' | 'onAssign' | 'onCreateShipment'
>;

// Decision: mutation host — owns useEquipmentRetire + useEquipmentUnassign
// mutations plus the two confirm-dialog open-states; view branches on
// equipment.status prop forwarded by the parent useEquipmentDetail.
export function EquipmentDetailHeaderContainer(props: EquipmentDetailHeaderContainerProps) {
  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);

  const { mutation: retireMutation, retire } = useEquipmentRetire({
    onSuccess: () => setRetireDialogOpen(false),
  });
  const { mutation: unassignMutation, unassign } = useEquipmentUnassign({
    onSuccess: () => setUnassignDialogOpen(false),
  });

  return (
    <EquipmentDetailHeaderView
      {...props}
      retireDialogOpen={retireDialogOpen}
      setRetireDialogOpen={setRetireDialogOpen}
      unassignDialogOpen={unassignDialogOpen}
      setUnassignDialogOpen={setUnassignDialogOpen}
      retireMutation={retireMutation}
      retire={retire}
      unassignMutation={unassignMutation}
      unassign={unassign}
    />
  );
}
