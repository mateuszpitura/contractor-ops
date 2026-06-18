import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Loader2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type {
  NitaqatBand,
  UpsertConfigInput,
  UpsertHeadcountInput,
} from './hooks/use-saudization-config.js';

/** The 6 locked Nitaqat band labels. Admin entry only — never computed. */
const BANDS: NitaqatBand[] = ['PLATINUM', 'HIGH_GREEN', 'MID_GREEN', 'LOW_GREEN', 'YELLOW', 'RED'];

export interface SaudizationConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBand: NitaqatBand | null;
  initialSegment: string | null;
  initialTotalHeadcount: number | null;
  initialSaudiHeadcount: number | null;
  onSaveBand: (input: UpsertConfigInput) => void;
  isSavingBand: boolean;
  onSaveHeadcount: (input: UpsertHeadcountInput) => void;
  isSavingHeadcount: boolean;
}

/**
 * Manual band + industry-segment + headcount entry. The band is the 6-value
 * enum entered by hand — the system NEVER auto-computes it. Uses the canonical
 * DialogBody (scroll) + DialogFooter (sticky single-CTA) convention. Logical
 * properties only; WCAG-labelled controls.
 */
export function SaudizationConfigDialog({
  open,
  onOpenChange,
  initialBand,
  initialSegment,
  initialTotalHeadcount,
  initialSaudiHeadcount,
  onSaveBand,
  isSavingBand,
  onSaveHeadcount,
  isSavingHeadcount,
}: SaudizationConfigDialogProps) {
  const t = useTranslations('Saudization.config');
  const tBands = useTranslations('Saudization.bands');
  const id = useId();

  const [band, setBand] = useState<NitaqatBand | null>(initialBand);
  const [segment, setSegment] = useState(initialSegment ?? '');
  const [total, setTotal] = useState(numToInput(initialTotalHeadcount));
  const [saudi, setSaudi] = useState(numToInput(initialSaudiHeadcount));

  // Re-sync from server truth each time the dialog opens.
  useEffect(() => {
    if (open) {
      setBand(initialBand);
      setSegment(initialSegment ?? '');
      setTotal(numToInput(initialTotalHeadcount));
      setSaudi(numToInput(initialSaudiHeadcount));
    }
  }, [open, initialBand, initialSegment, initialTotalHeadcount, initialSaudiHeadcount]);

  const handleSaveBand = useCallback(() => {
    // Never clear a manually-recorded band by accident: a null band here would send
    // band:null, which the server treats as an explicit clear. The Save button is
    // disabled while band is null; this guards the programmatic path too.
    if (band === null) return;
    onSaveBand({ band, industrySegment: segment.trim() || null });
  }, [band, segment, onSaveBand]);

  const handleSaveHeadcount = useCallback(() => {
    const totalNum = Number.parseInt(total, 10);
    const saudiNum = Number.parseInt(saudi, 10);
    if (Number.isNaN(totalNum) || Number.isNaN(saudiNum)) return;
    onSaveHeadcount({ totalHeadcount: totalNum, saudiHeadcount: saudiNum });
  }, [total, saudi, onSaveHeadcount]);

  const handleBandChange = useCallback(
    (value: NitaqatBand | null) => setBand(value as NitaqatBand),
    [],
  );

  const handleSegmentChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setSegment(e.target.value),
    [],
  );

  const handleTotalChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setTotal(e.target.value),
    [],
  );

  const handleSaudiChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setSaudi(e.target.value),
    [],
  );

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const totalNum = Number.parseInt(total, 10);
  const saudiNum = Number.parseInt(saudi, 10);
  const headcountValid =
    !(Number.isNaN(totalNum) || Number.isNaN(saudiNum)) &&
    totalNum >= 0 &&
    saudiNum >= 0 &&
    saudiNum <= totalNum;
  const headcountError =
    total !== '' && saudi !== '' && !Number.isNaN(totalNum) && saudiNum > totalNum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 py-2">
          <section className="space-y-4">
            <h3 className="text-base font-semibold">{t('bandSectionTitle')}</h3>

            <div className="space-y-2">
              <Label htmlFor={`${id}-band`} className="text-sm font-medium">
                {t('bandLabel')}
              </Label>
              <Select
                value={band ?? undefined}
                onValueChange={handleBandChange}
                disabled={isSavingBand}>
                <SelectTrigger id={`${id}-band`} className="w-full">
                  <SelectValue placeholder={t('bandPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {BANDS.map(value => (
                    <SelectItem key={value} value={value}>
                      {tBands(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('bandHelp')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-segment`} className="text-sm font-medium">
                {t('segmentLabel')}
              </Label>
              <Input
                id={`${id}-segment`}
                value={segment}
                onChange={handleSegmentChange}
                placeholder={t('segmentPlaceholder')}
                disabled={isSavingBand}
              />
            </div>

            {band === null ? (
              <p id={`${id}-band-hint`} className="text-xs text-muted-foreground">
                {t('bandRequiredHint')}
              </p>
            ) : null}

            <Button
              onClick={handleSaveBand}
              disabled={isSavingBand || band === null}
              aria-describedby={band === null ? `${id}-band-hint` : undefined}>
              {isSavingBand ? (
                <Loader2 aria-hidden="true" className="me-2 size-4 animate-spin" />
              ) : null}
              {t('saveBandButton')}
            </Button>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h3 className="text-base font-semibold">{t('headcountSectionTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('headcountHelp')}</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-total`} className="text-sm font-medium">
                  {t('totalLabel')}
                </Label>
                <Input
                  id={`${id}-total`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={total}
                  onChange={handleTotalChange}
                  disabled={isSavingHeadcount}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-saudi`} className="text-sm font-medium">
                  {t('saudiLabel')}
                </Label>
                <Input
                  id={`${id}-saudi`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={saudi}
                  onChange={handleSaudiChange}
                  disabled={isSavingHeadcount}
                  aria-invalid={headcountError}
                  aria-describedby={headcountError ? `${id}-saudi-error` : undefined}
                  className="tabular-nums"
                />
              </div>
            </div>
            {headcountError ? (
              <p id={`${id}-saudi-error`} className="text-xs text-destructive">
                {t('saudiExceedsTotal')}
              </p>
            ) : null}

            <Button onClick={handleSaveHeadcount} disabled={isSavingHeadcount || !headcountValid}>
              {isSavingHeadcount ? (
                <Loader2 aria-hidden="true" className="me-2 size-4 animate-spin" />
              ) : null}
              {t('saveHeadcountButton')}
            </Button>
          </section>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function numToInput(value: number | null): string {
  return value === null ? '' : String(value);
}
