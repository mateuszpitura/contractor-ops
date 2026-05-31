import { useEquipmentBulkActions } from '../hooks/use-equipment-bulk-actions.js';
import { useEquipmentTable } from '../hooks/use-equipment-table.js';
import { EquipmentTableView } from './data-table.js';
import type { EquipmentRow } from './equipment-columns.js';

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
// filter/sort/search state; useEquipmentBulkActions owns multi-row mutations;
// view delegates row-variant skeletons to AtelierTableShell + DataTableBody,
// which branch internally.
export function EquipmentTableContainer(props: EquipmentTableContainerProps) {
  const tableState = useEquipmentTable(props.parentLoading);
  const bulkActions = useEquipmentBulkActions();
  return <EquipmentTableView {...props} {...tableState} bulkActions={bulkActions} />;
}
