import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { StateFilingOutput } from './hooks/use-iris-filing.js';

export interface StateFilingOutputSectionProps {
  taxYear: number;
  selectedState: string | null;
  onSelectState: (stateCode: string) => void;
  output: StateFilingOutput | null;
  isPending: boolean;
  error: unknown;
}

/**
 * Per-state filing output. A CFSF-participating state shows a "handled via the
 * B-record" indicator (no file); a direct-filing state offers the per-state CSV
 * download + manual-portal guidance. The download builds a Blob client-side from
 * the server-produced CSV — no PII beyond the last-4 already in the CSV.
 */
export function StateFilingOutputSection({
  taxYear,
  selectedState,
  onSelectState,
  output,
  isPending,
  error,
}: StateFilingOutputSectionProps) {
  const t = useTranslations('Tax1099Filing');
  const fieldId = useId();
  const [draft, setDraft] = useState('');

  const handleDownload = useCallback(() => {
    if (!output?.csv) return;
    const blob = new Blob([output.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `1099-nec-${output.stateCode}-${taxYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [output, taxYear]);

  return (
    <section className="space-y-3 border-t pt-4">
      <h4 className="font-display text-sm font-semibold">{t('state.heading')}</h4>

      <form
        className="flex items-end gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (draft.trim().length === 2) onSelectState(draft.trim().toUpperCase());
        }}>
        <div className="space-y-1">
          <Label htmlFor={fieldId} className="font-normal text-xs">
            {t('state.stateLabel')}
          </Label>
          <Input
            id={fieldId}
            value={draft}
            maxLength={2}
            placeholder="CA"
            onChange={event => setDraft(event.target.value)}
            className="w-20 font-mono uppercase"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={draft.trim().length !== 2}>
          {t('state.lookup')}
        </Button>
      </form>

      {isPending ? (
        <div
          aria-busy
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('state.loading')}
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {t('loadError')}
        </p>
      ) : output ? (
        output.cfsfHandled ? (
          <p className="flex items-start gap-1.5 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('state.cfsfHandled', { state: output.stateCode })}</span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{output.guidance}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!output.csv}>
              <Download className="me-2 size-4" aria-hidden />
              {t('state.download')}
            </Button>
          </div>
        )
      ) : selectedState ? null : (
        <p className="text-sm text-muted-foreground">{t('state.prompt')}</p>
      )}
    </section>
  );
}
