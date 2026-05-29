import { useCallback, useState } from 'react';

import { useEquipmentShipments } from '../hooks/use-equipment-shipments.js';
import type { TabShipmentsProps } from './tab-shipments.js';
import {
  TabShipmentsEmpty,
  TabShipmentsError,
  TabShipmentsSkeleton,
  TabShipmentsView,
} from './tab-shipments.js';

export function TabShipmentsContainer(props: TabShipmentsProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const shipmentsState = useEquipmentShipments(props.equipmentId, selectedShipmentId);

  const handleRetry = useCallback(() => {
    void shipmentsState.listQuery.refetch();
  }, [shipmentsState.listQuery]);

  if (shipmentsState.listQuery.isLoading) {
    return <TabShipmentsSkeleton pendingReturn={props.pendingReturn} />;
  }

  if (shipmentsState.listQuery.isError) {
    return <TabShipmentsError onRetry={handleRetry} />;
  }

  if (shipmentsState.shipments.length === 0) {
    return (
      <TabShipmentsEmpty
        pendingReturn={props.pendingReturn}
        onCreateShipment={props.onCreateShipment}
      />
    );
  }

  return (
    <TabShipmentsView
      {...props}
      {...shipmentsState}
      selectedShipmentId={selectedShipmentId}
      setSelectedShipmentId={setSelectedShipmentId}
    />
  );
}
