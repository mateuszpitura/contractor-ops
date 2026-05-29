import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { EquipmentRow } from '../equipment-table/equipment-columns.js';

export interface EquipmentBulkActionsHandlers {
  onBulkRetire: (ids: string[]) => Promise<void>;
  onBulkUnassign: (ids: string[]) => Promise<void>;
  onExportCsv: (rows: EquipmentRow[]) => void;
  isRetiring: boolean;
  isUnassigning: boolean;
}

/**
 * Bulk action mutations for the equipment table. There are no native bulk
 * tRPC procedures yet, so retire/unassign fan out per-id with
 * `Promise.allSettled` and aggregate the result in a single toast. Export is
 * a pure client-side CSV from already-loaded rows.
 */
export function useEquipmentBulkActions(): EquipmentBulkActionsHandlers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Equipment');

  const retireMutation = useMutation(trpc.equipment.retire.mutationOptions({}));
  const unassignMutation = useMutation(trpc.equipment.unassign.mutationOptions({}));

  const [isRetiring, setIsRetiring] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const invalidateList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.equipment.list.queryKey() });
  }, [queryClient, trpc.equipment.list]);

  const onBulkRetire = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setIsRetiring(true);
      try {
        const results = await Promise.allSettled(ids.map(id => retireMutation.mutateAsync({ id })));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed === 0) {
          toast.success(t('toast.retired'));
        } else if (failed === ids.length) {
          toast.error(t('error.actionFailed'));
        } else {
          toast.warning(t('bulkActions.partial', { ok: ids.length - failed, total: ids.length }));
        }
      } finally {
        setIsRetiring(false);
        invalidateList();
      }
    },
    [retireMutation, t, invalidateList],
  );

  const onBulkUnassign = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setIsUnassigning(true);
      try {
        const results = await Promise.allSettled(
          ids.map(id => unassignMutation.mutateAsync({ equipmentId: id })),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed === 0) {
          toast.success(t('toast.unassigned'));
        } else if (failed === ids.length) {
          toast.error(t('error.actionFailed'));
        } else {
          toast.warning(t('bulkActions.partial', { ok: ids.length - failed, total: ids.length }));
        }
      } finally {
        setIsUnassigning(false);
        invalidateList();
      }
    },
    [unassignMutation, t, invalidateList],
  );

  const onExportCsv = useCallback(
    (rows: EquipmentRow[]) => {
      if (rows.length === 0) return;
      const header = ['id', 'name', 'serialNumber', 'type', 'status', 'assigneeId', 'assigneeName'];
      const csvRows = rows.map(row => [
        row.id,
        row.name,
        row.serialNumber ?? '',
        row.type,
        row.status,
        row.currentAssignment?.contractorId ?? '',
        row.currentAssignment?.contractorName ?? '',
      ]);
      const body = [header, ...csvRows].map(line => line.map(escapeCsvCell).join(',')).join('\n');
      const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `equipment-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('bulkActions.exported', { count: rows.length }));
    },
    [t],
  );

  return {
    onBulkRetire,
    onBulkUnassign,
    onExportCsv,
    isRetiring,
    isUnassigning,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
