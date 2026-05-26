import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLeitwegIdRow } from './hooks/use-leitweg-id-row.js';
import type { LeitwegIdRowData } from './leitweg-id-row.js';
import { LeitwegIdRow } from './leitweg-id-row.js';

interface LeitwegIdRowContainerProps {
  row: LeitwegIdRowData;
}

// Decision: mutation host — row mounted by LeitwegIdListCard per leitweg ID; hook
// exposes edit/delete dialog state + activate/deactivate handlers consumed by the row.
export function LeitwegIdRowContainer({ row }: LeitwegIdRowContainerProps) {
  const t = useTranslations('EInvoice.LeitwegIdRow');
  const rowState = useLeitwegIdRow(row);

  return <LeitwegIdRow row={row} t={t} {...rowState} />;
}
