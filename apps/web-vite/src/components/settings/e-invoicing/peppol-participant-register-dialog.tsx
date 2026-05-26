// apps/web/src/components/settings/e-invoicing/peppol-participant-register-dialog.tsx
//
// Phase 61 · Plan 61-07 — Register Peppol participant dialog.
//
// Form fields:
//   - scheme  (Identifier scheme, 4-digit ICD literal — 0060 / 0088 / 0106 or "Other")
//   - value   (Identifier value, 1–64 chars)
//
// Client-side validation: peppolParticipantPairSchema (imported from
// @contractor-ops/validators) enforces (a) scheme is exactly 4 digits, (b)
// value is non-empty ≤64 chars, (c) both set or both null. The Save button is
// disabled until both fields are valid (half-set pairs are disallowed).
//
// On submit: trpc.peppol.connect mutation; on success invalidates the
// listParticipants query so the card flips to PENDING.
//
// A11y: real-time inline errors via role="alert"; each field associates its
// error message via aria-describedby.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { peppolParticipantPairSchema } from '@contractor-ops/validators';
import { Loader2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils.js';
import type { usePeppolParticipantRegisterDialog } from './hooks/use-peppol-participant-register-dialog.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeppolParticipantRegisterDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type PeppolParticipantRegisterDialogProps = PeppolParticipantRegisterDialogShellProps &
  ReturnType<typeof usePeppolParticipantRegisterDialog> & {
    tCommon: (key: string) => string;
    resetNonce: number;
  };

export function PeppolParticipantRegisterDialog({
  open,
  onOpenChange,
  tCommon,
  resetNonce,
  t,
  connect,
  isPending,
}: PeppolParticipantRegisterDialogProps) {
  const schemeId = useId();
  const valueId = useId();
  const schemeErrId = `${schemeId}-err`;
  const valueErrId = `${valueId}-err`;

  const [scheme, setScheme] = useState('0060');
  const [value, setValue] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setScheme('0060');
    setValue('');
    setApiKey('');
  }, []);

  // Real-time pair validation — schema requires both-set-or-both-null.
  const validation = useMemo(() => {
    const parsed = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: scheme.trim() || null,
      peppolParticipantValue: value.trim() || null,
    });
    if (parsed.success) {
      // Registration requires non-null pair (both set).
      if (scheme.trim() && value.trim()) return { ok: true } as const;
      return { ok: false, scheme: 'required', value: 'required' } as const;
    }
    const issues = parsed.error.issues;
    const schemeIssue = issues.find(i => i.path[0] === 'peppolSchemeId');
    const valueIssue = issues.find(i => i.path[0] === 'peppolParticipantValue');
    return {
      ok: false,
      scheme: schemeIssue?.message ?? null,
      value: valueIssue?.message ?? null,
    } as const;
  }, [scheme, value]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validation.ok) return;
    connect(scheme, value, apiKey);
  }

  const saveDisabled = !validation.ok || isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('registerHeading')}</DialogTitle>
          <DialogDescription>{t('registerBody')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={schemeId}>{t('schemeLabel')}</Label>
            <Input
              id={schemeId}
              name="scheme"
              value={scheme}
              onChange={e => setScheme(e.target.value)}
              pattern="\d{4}"
              inputMode="numeric"
              maxLength={4}
              aria-invalid={!validation.ok && 'scheme' in validation && !!validation.scheme}
              aria-describedby={cn(schemeErrId)}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">{t('schemeHelper')}</p>
            {!validation.ok && 'scheme' in validation && validation.scheme ? (
              <p id={schemeErrId} role="alert" className="text-sm text-destructive">
                {validation.scheme}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={valueId}>{t('valueLabel')}</Label>
            <Input
              id={valueId}
              name="value"
              value={value}
              onChange={e => setValue(e.target.value)}
              maxLength={64}
              aria-invalid={!validation.ok && 'value' in validation && !!validation.value}
              aria-describedby={cn(valueErrId)}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">{t('valueHelper')}</p>
            {!validation.ok && 'value' in validation && validation.value ? (
              <p id={valueErrId} role="alert" className="text-sm text-destructive">
                {validation.value}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saveDisabled}>
              {isPending ? (
                <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {t('registerButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
