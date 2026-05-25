import { useState } from 'react';
import type { EquipmentDetailHeaderProps } from './equipment-detail/equipment-detail-header.js';
import { EquipmentDetailHeaderView } from './equipment-detail/equipment-detail-header.js';
import { useEquipmentRetire, useEquipmentUnassign } from './hooks/use-equipment-detail-actions.js';

type EquipmentDetailHeaderContainerProps = Pick<
  EquipmentDetailHeaderProps,
  'equipment' | 'onEdit' | 'onAssign' | 'onCreateShipment'
>;

// Decisive: mutation host + confirm-dialog state owner. Owns retire/unassign
// mutation lifecycles plus the two confirmation dialog open-states that must
// survive a mutation round-trip. View branches on `equipment.status` (a prop
// from the parent's `useEquipmentDetail`), not on a hook-returned variant
// flag — no top-level lift applies.
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
