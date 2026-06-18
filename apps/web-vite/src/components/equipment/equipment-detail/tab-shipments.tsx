import type { AtelierEmptyStateAction } from '@contractor-ops/ui';
import { AtelierEmptyState, DataTable, EquipmentIllustration } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Download, Eye, Loader2, Trash2, Truck } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useEquipmentShipments } from '../hooks/use-equipment-shipments.js';
import { ShipmentStatusBadge } from '../shipment-status-badge.js';
import { ReturnApprovalBanner } from './return-approval-banner.js';
import { ShipmentTimeline } from './shipment-timeline.js';

interface PendingReturn {
  id: string;
  contractorName: string;
  itemCount: number;
  targetPointName: string;
  createdAt: string | Date;
}

export interface TabShipmentsProps {
  equipmentId: string;
  onCreateShipment: () => void;
  pendingReturn?: PendingReturn | null;
}

type ShipmentsHookState = ReturnType<typeof useEquipmentShipments>;
type Shipment = ShipmentsHookState['shipments'][number];

const getShipmentRowId = (row: Shipment) => row.id;

export type TabShipmentsViewProps = TabShipmentsProps &
  ShipmentsHookState & {
    selectedShipmentId: string | null;
    setSelectedShipmentId: (id: string | null) => void;
  };

interface ShipmentActionsCellProps {
  shipment: Shipment;
  labelLoadingId: string | null;
  viewLabel: string;
  labelActionLabel: string;
  deleteLabel: string;
  onView: (id: string) => void;
  onFetchLabel: (id: string) => void;
  onDelete: (id: string) => void;
}

const ShipmentActionsCell = memo(function ShipmentActionsCell({
  shipment,
  labelLoadingId,
  viewLabel,
  labelActionLabel,
  deleteLabel,
  onView,
  onFetchLabel,
  onDelete,
}: ShipmentActionsCellProps) {
  const canLabel = shipment.carrier === 'InPost';
  const isCreated = shipment.currentStatus === 'CREATED';
  const isLabelLoading = labelLoadingId === shipment.id;

  const handleView = useCallback(() => onView(shipment.id), [onView, shipment.id]);
  const handleFetchLabel = useCallback(
    () => onFetchLabel(shipment.id),
    [onFetchLabel, shipment.id],
  );
  const handleDelete = useCallback(() => onDelete(shipment.id), [onDelete, shipment.id]);

  return (
    <div className="inline-flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={viewLabel} onClick={handleView}>
        <Eye className="size-3.5" />
      </Button>
      {canLabel && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={labelActionLabel}
          disabled={isLabelLoading}
          onClick={handleFetchLabel}>
          {isLabelLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>
      )}
      {isCreated && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={deleteLabel}
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
});

function PendingReturnBanner({
  pendingReturn,
}: {
  pendingReturn: PendingReturn | null | undefined;
}) {
  if (!pendingReturn) return null;
  const normalized = {
    ...pendingReturn,
    createdAt: new Date(pendingReturn.createdAt).toISOString(),
  };
  return <ReturnApprovalBanner returnRequest={normalized} />;
}

function renderShipmentsEmptyAction(
  action: AtelierEmptyStateAction,
  variant: 'primary' | 'secondary',
) {
  const Icon = action.icon;
  return (
    <Button variant={variant === 'secondary' ? 'outline' : 'default'} onClick={action.onClick}>
      {Icon ? <Icon className="me-1.5 size-4" /> : null}
      {action.label}
    </Button>
  );
}

export function TabShipmentsSkeleton({ pendingReturn }: { pendingReturn?: PendingReturn | null }) {
  return (
    <div className="space-y-3">
      <PendingReturnBanner pendingReturn={pendingReturn} />
      <div className="rounded-xl border bg-background">
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton placeholder, never reordered
            <Skeleton key={`shipment-skel-${i}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabShipmentsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Equipment');
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background p-8 text-center">
      <p className="text-sm text-muted-foreground">{t('error.loadFailed')}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('detail.retry')}
      </Button>
    </div>
  );
}

export function TabShipmentsEmpty({
  pendingReturn,
  onCreateShipment,
}: {
  pendingReturn?: PendingReturn | null;
  onCreateShipment: () => void;
}) {
  const t = useTranslations('Equipment');
  return (
    <div className="space-y-4">
      <PendingReturnBanner pendingReturn={pendingReturn} />
      <AtelierEmptyState
        variant="subview"
        illustration={EquipmentIllustration}
        heading={t('detail.shipmentsEmpty')}
        body={t('detail.shipmentsEmptyDescription')}
        primaryAction={{
          label: t('detail.createShipment'),
          onClick: onCreateShipment,
          icon: Truck,
        }}
        renderAction={renderShipmentsEmptyAction}
      />
    </div>
  );
}

export function TabShipmentsView({
  onCreateShipment,
  pendingReturn,
  shipments,
  detailQuery,
  deleteMutation,
  fetchLabel,
  selectedShipmentId,
  setSelectedShipmentId,
}: TabShipmentsViewProps) {
  const t = useTranslations('Equipment');

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelLoadingId, setLabelLoadingId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handleFetchLabel = useCallback(
    async (shipmentId: string) => {
      setLabelLoadingId(shipmentId);
      try {
        await fetchLabel(shipmentId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('label.downloadError'));
      } finally {
        setLabelLoadingId(null);
      }
    },
    [fetchLabel, t],
  );

  const handleCloseSheet = useCallback(
    (open: boolean) => {
      if (!open) setSelectedShipmentId(null);
    },
    [setSelectedShipmentId],
  );

  const handleViewShipment = useCallback(
    (id: string) => setSelectedShipmentId(id),
    [setSelectedShipmentId],
  );
  const handleFetchLabelById = useCallback(
    (id: string) => {
      void handleFetchLabel(id);
    },
    [handleFetchLabel],
  );
  const handleStartDelete = useCallback((id: string) => setDeleteTarget(id), []);
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);
  const handleCloseDeleteDialog = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null);
  }, []);
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget }, { onSuccess: () => setDeleteTarget(null) });
  }, [deleteMutation, deleteTarget]);

  const viewLabel = t('shipmentsTable.action.view');
  const labelActionLabel = t('shipmentsTable.action.label');
  const deleteLabel = t('shipment.deleteTitle');

  const columns = useMemo<ColumnDef<Shipment, unknown>[]>(
    () => [
      {
        id: 'trackingNumber',
        accessorKey: 'trackingNumber',
        header: t('shipmentsTable.col.trackingNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.trackingNumber ?? <span className="text-muted-foreground">&mdash;</span>}
          </span>
        ),
      },
      {
        id: 'carrier',
        accessorKey: 'carrier',
        header: t('shipmentsTable.col.carrier'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.carrier}
            {!!row.original.carrierCustom && (
              <span className="ms-1 text-xs text-muted-foreground">
                ({row.original.carrierCustom})
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'currentStatus',
        header: t('shipmentsTable.col.status'),
        cell: ({ row }) => <ShipmentStatusBadge status={row.original.currentStatus} />,
      },
      {
        id: 'created',
        accessorFn: row => new Date(row.createdAt).getTime(),
        header: t('shipmentsTable.col.created'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-end">{t('shipmentsTable.col.actions')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-end">
            <ShipmentActionsCell
              shipment={row.original}
              labelLoadingId={labelLoadingId}
              viewLabel={viewLabel}
              labelActionLabel={labelActionLabel}
              deleteLabel={deleteLabel}
              onView={handleViewShipment}
              onFetchLabel={handleFetchLabelById}
              onDelete={handleStartDelete}
            />
          </div>
        ),
      },
    ],
    [
      t,
      labelLoadingId,
      viewLabel,
      labelActionLabel,
      deleteLabel,
      handleViewShipment,
      handleFetchLabelById,
      handleStartDelete,
    ],
  );

  return (
    <div className="space-y-4">
      <PendingReturnBanner pendingReturn={pendingReturn} />

      <div className="flex justify-end">
        <Button onClick={onCreateShipment}>
          <Truck className="me-1.5 size-3.5" />
          {t('detail.createShipment')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={shipments}
        totalRows={shipments.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        constrainHeight={false}
        hideDensityToggle
        getRowId={getShipmentRowId}
        entityLabel={t('shipmentsEntityLabel', { count: shipments.length })}
        emptyTitle={t('detail.shipmentsEmpty')}
        emptyDescription={t('detail.shipmentsEmptyDescription')}
        noResultsTitle={t('detail.shipmentsEmpty')}
      />

      <Sheet open={!!selectedShipmentId} onOpenChange={handleCloseSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('shipmentsTable.detail.title')}</SheetTitle>
            <SheetDescription>{t('shipmentsTable.detail.subtitle')}</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            {detailQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : null}

            {detailQuery.isError ? (
              <p className="text-sm text-destructive">{t('error.loadFailed')}</p>
            ) : null}

            {!!detailQuery.data && (
              <>
                <dl className="grid grid-cols-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.direction')}</dt>
                  <dd className="col-span-2">
                    {detailQuery.data.direction === 'OUTBOUND'
                      ? t('shipment.outbound')
                      : t('shipment.return')}
                  </dd>

                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.carrier')}</dt>
                  <dd className="col-span-2">
                    {detailQuery.data.carrier}
                    {!!detailQuery.data.carrierCustom && ` (${detailQuery.data.carrierCustom})`}
                  </dd>

                  <dt className="text-muted-foreground">
                    {t('shipmentsTable.detail.trackingNumber')}
                  </dt>
                  <dd className="col-span-2 font-mono text-xs">
                    {detailQuery.data.trackingNumber ?? '—'}
                  </dd>

                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.status')}</dt>
                  <dd className="col-span-2">
                    <ShipmentStatusBadge status={detailQuery.data.currentStatus} />
                  </dd>

                  <dt className="text-muted-foreground">
                    {t('shipmentsTable.detail.expectedDelivery')}
                  </dt>
                  <dd className="col-span-2">
                    {detailQuery.data.expectedDeliveryAt
                      ? format(new Date(detailQuery.data.expectedDeliveryAt), 'MMM d, yyyy')
                      : '—'}
                  </dd>

                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.equipment')}</dt>
                  <dd className="col-span-2">{detailQuery.data.equipment?.name ?? '—'}</dd>
                </dl>

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-medium">
                    {t('shipmentsTable.detail.timeline')}
                  </h3>
                  <ShipmentTimeline
                    shipmentId={detailQuery.data.id}
                    currentStatus={detailQuery.data.currentStatus}
                    events={detailQuery.data.events}
                    direction={detailQuery.data.direction}
                  />
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('shipment.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('shipment.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('form.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}>
              {t('shipment.deleteTitle')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TabShipments(props: TabShipmentsProps) {
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
