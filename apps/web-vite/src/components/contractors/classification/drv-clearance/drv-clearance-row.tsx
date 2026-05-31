import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { TableCell, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { CircleCheck, ShieldAlert, ShieldQuestion, ShieldX } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useLocale } from '../../../../i18n/navigation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';

type Outcome = 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';

export interface DrvClearanceRowData {
  id: string;
  filedAt: string | Date;
  drvReference: string;
  outcome: Outcome;
  validFrom: string | Date | null;
  validTo: string | Date | null;
  notes: string | null;
}

export interface DrvClearanceRowProps {
  clearance: DrvClearanceRowData;
  onEdit: (clearance: DrvClearanceRowData) => void;
}

interface OutcomeVisual {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof CircleCheck;
  labelKey: 'outcomePending' | 'outcomeSelbstandig' | 'outcomeAbhangig' | 'outcomeWithdrawn';
}

const OUTCOME_VISUALS: Record<Outcome, OutcomeVisual> = {
  PENDING: { variant: 'secondary', icon: ShieldQuestion, labelKey: 'outcomePending' },
  SELBSTANDIG: { variant: 'default', icon: CircleCheck, labelKey: 'outcomeSelbstandig' },
  ABHANGIG: { variant: 'destructive', icon: ShieldX, labelKey: 'outcomeAbhangig' },
  WITHDRAWN: { variant: 'outline', icon: ShieldAlert, labelKey: 'outcomeWithdrawn' },
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export const DrvClearanceRow = memo(function DrvClearanceRow({
  clearance,
  onEdit,
}: DrvClearanceRowProps) {
  const t = useTranslations('Classification.polish.drvClearance');
  const locale = useLocale();
  const visual = OUTCOME_VISUALS[clearance.outcome];
  const Icon = visual.icon;

  const validToDate = useMemo(() => toDate(clearance.validTo), [clearance.validTo]);
  const filedAtDate = useMemo(() => toDate(clearance.filedAt), [clearance.filedAt]);

  const filedAtLabel = useMemo(() => {
    if (!filedAtDate) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(filedAtDate);
  }, [filedAtDate, locale]);

  const countdownLabel = useMemo(() => {
    if (!validToDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = daysBetween(validToDate, today);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return rtf.format(days, 'day');
  }, [validToDate, locale]);

  const validToLabel = useMemo(() => {
    if (!validToDate) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(validToDate);
  }, [validToDate, locale]);

  const handleEditClick = useCallback(() => onEdit(clearance), [onEdit, clearance]);

  return (
    <TableRow>
      <TableCell className="text-sm">{filedAtLabel}</TableCell>
      <TableCell className="font-mono text-sm">{clearance.drvReference}</TableCell>
      <TableCell>
        <Badge variant={visual.variant} className="gap-1">
          <Icon aria-hidden className="size-3.5" />
          <span>{t(visual.labelKey)}</span>
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        <div>{validToLabel}</div>
        {countdownLabel ? (
          <div aria-live="polite" className="text-xs text-muted-foreground">
            {countdownLabel}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleEditClick}
          aria-label={t('editAction')}>
          {t('editAction')}
        </Button>
      </TableCell>
    </TableRow>
  );
});
