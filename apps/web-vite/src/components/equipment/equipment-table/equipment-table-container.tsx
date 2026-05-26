import { useEquipmentTable } from '../hooks/use-equipment-table.js';
import type { EquipmentRow } from './equipment-columns.js';
import { EquipmentTableView } from './equipment-table.js';

interface EquipmentTableContainerProps {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
  onAddEquipment: () => void;
  parentLoading?: boolean;
}

// Decision: data-table host — useEquipmentTable owns the paginated list query +
// filter/sort/search state; view delegates row-variant skeletons to
// AtelierTableShell + DataTableBody, which branch internally.
export function EquipmentTableContainer(props: EquipmentTableContainerProps) {
  const tableState = useEquipmentTable(props.parentLoading);
  return <EquipmentTableView {...props} {...tableState} />;
}
