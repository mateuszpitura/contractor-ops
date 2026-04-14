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

'use client';

import { peppolParticipantPairSchema } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeppolParticipantRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// peppol.connect mutation requires TRN + aspProvider + environment. We lift
// the asp/environment into fixed defaults (Storecove / sandbox) matching Plan
// 05 conventions; users only pick scheme + value.
const ASP_PROVIDER_DEFAULT = 'storecove' as const;
const ENVIRONMENT_DEFAULT = 'sandbox' as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeppolParticipantRegisterDialog({
  open,
  onOpenChange,
}: PeppolParticipantRegisterDialogProps) {
  const t = useTranslations('EInvoice.PeppolDialog');
  const tErrors = useTranslations('EInvoice.Errors');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient();
  const schemeId = useId();
  const valueId = useId();
  const schemeErrId = `${schemeId}-err`;
  const valueErrId = `${valueId}-err`;

  const [scheme, setScheme] = useState('0060');
  const [value, setValue] = useState('');
  const [apiKey, setApiKey] = useState('');

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

  const connectMutation = useMutation({
    ...trpc.peppol.connect.mutationOptions(),
    onSuccess: () => {
      toast.success(t('pendingHeading'));
      queryClient.invalidateQueries({
        queryKey: trpc.peppol.listParticipants.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.peppol.getStatus.queryKey(),
      });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || tErrors('Generic'));
    },
  });

  function reset() {
    setScheme('0060');
    setValue('');
    setApiKey('');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validation.ok) return;
    // peppol.connect shape: { trn, aspProvider, environment, apiKey }. We pass
    // the scheme+value as a compound `{scheme}:{value}` TRN — Plan 04 Task 5
    // converts this to participantId server-side.
    (
      connectMutation.mutate as (input: {
        trn: string;
        aspProvider: string;
        environment: string;
        apiKey: string;
      }) => void
    )({
      trn: `${scheme}:${value}`,
      aspProvider: ASP_PROVIDER_DEFAULT,
      environment: ENVIRONMENT_DEFAULT,
      apiKey: apiKey || 'pending-sandbox-key',
    });
  }

  const saveDisabled = !validation.ok || connectMutation.isPending;

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
              <p
                id={schemeErrId}
                role="alert"
                className="text-sm text-destructive">
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
              <p
                id={valueErrId}
                role="alert"
                className="text-sm text-destructive">
                {validation.value}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saveDisabled}>
              {connectMutation.isPending ? (
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
