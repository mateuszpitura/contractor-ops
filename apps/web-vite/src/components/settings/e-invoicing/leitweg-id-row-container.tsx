// Decision: per-row container mounted by LeitwegIdListCard for each leitweg ID. Container scopes
// per-row dialog open states (edit/delete) and the row-level activate/deactivate mutation hooks.
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLeitwegIdRow } from './hooks/use-leitweg-id-row.js';
import type { LeitwegIdRowData } from './leitweg-id-row.js';
import { LeitwegIdRow } from './leitweg-id-row.js';

interface LeitwegIdRowContainerProps {
  row: LeitwegIdRowData;
}

export function LeitwegIdRowContainer({ row }: LeitwegIdRowContainerProps) {
  const t = useTranslations('EInvoice.LeitwegIdRow');
  const rowState = useLeitwegIdRow(row);

  return <LeitwegIdRow row={row} t={t} {...rowState} />;
}
