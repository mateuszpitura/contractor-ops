import { useEquipmentTable } from '../hooks/use-equipment-table.js';
import type { EquipmentRow } from './equipment-columns.js';
import { EquipmentTableView } from './equipment-table.js';

// Decisive: data-table query host. Owns the paginated equipment list query +
// filter/sort/search state via `useEquipmentTable`. View delegates row-level
// loading / empty / no-results variants to the shared `AtelierTableShell` +
// `DataTableBody` primitives (those branch internally on `isLoading` /
// `hasFiltersOrSearch`), so no top-level variant lift applies at this layer
// — the table view is itself a single render path receiving shaped slots.

interface EquipmentTableContainerProps {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
  onAddEquipment: () => void;
  parentLoading?: boolean;
}

export function EquipmentTableContainer(props: EquipmentTableContainerProps) {
  const tableState = useEquipmentTable(props.parentLoading);
  return <EquipmentTableView {...props} {...tableState} />;
}
