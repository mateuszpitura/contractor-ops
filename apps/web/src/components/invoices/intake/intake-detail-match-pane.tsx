'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import type { LooseTranslator } from '@/i18n/typed-keys';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

type MatchReason = 'VAT_ID' | 'LEITWEG_ID' | 'EXACT_NAME' | 'FUZZY_NAME' | string;

interface MatchCandidate {
  contractorId: string;
  contractorName: string;
  contractorVatId?: string | null;
  matchReasons: Array<{ kind: MatchReason; distance?: number }>;
  score?: number;
}

interface IntakeDetailMatchPaneProps {
  intakeId: string;
  currentStatus: string;
  /**
   * Surfaced so the parent page / actions bar can disable Convert until a
   * candidate is selected. Controlled externally.
   */
  onSelectedCandidateChange?: (contractorId: string | null) => void;
  className?: string;
}

/**
 * Contractor match-candidate panel. Reads from
 * `trpc.invoiceIntake.getMatchCandidates` — the router returns the ranked
 * list *every time* (never persisted), which is the secure default for
 * scoring drift. Single unambiguous match is pre-selected; the user still
 * has to click "Confirm match" (no auto-write).
 */
export function IntakeDetailMatchPane({
  intakeId,
  currentStatus,
  onSelectedCandidateChange,
  className,
}: IntakeDetailMatchPaneProps) {
  const t = useTranslations('EInvoice.intake');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidatesQuery = useQuery(
    trpc.invoiceIntake.getMatchCandidates.queryOptions({ intakeId }),
  );
  const candidates = (candidatesQuery.data as MatchCandidate[] | undefined) ?? [];

  // Pre-select the sole candidate when there's exactly one.
  useEffect(() => {
    if (candidates.length === 1 && !selectedId) {
      setSelectedId(candidates[0]?.contractorId ?? null);
    }
  }, [candidates, selectedId]);

  useEffect(() => {
    onSelectedCandidateChange?.(selectedId);
  }, [selectedId, onSelectedCandidateChange]);

  const confirmMutation = useMutation(
    trpc.invoiceIntake.confirmMatch.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invoiceIntake.getById.queryKey({ intakeId }),
        });
        toast.success('Done.');
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const handleConfirm = (contractorId: string) => {
    setSelectedId(contractorId);
    confirmMutation.mutate({ intakeId, contractorId });
  };

  const handleCreateFromData = () => {
    // Navigate to the contractor form with the intake id for prefill.
    router.push(`/contractors?createFromIntake=${intakeId}`);
  };

  const alreadyMatched = currentStatus === 'MATCHED' || currentStatus === 'CONVERTED';

  return (
    <Card className={className} data-slot="intake-detail-match-pane">
      <CardHeader>
        <CardTitle className="text-base">{t('ctaConfirmMatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {candidatesQuery.isLoading && (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        )}

        {!candidatesQuery.isLoading && candidates.length === 0 && (
          <div className="space-y-3 rounded-md border border-dashed p-4 text-center">
            <p className="font-medium">{t('noMatchCandidatesHeading')}</p>
            <p className="text-xs text-muted-foreground">{t('noMatchCandidatesBody')}</p>
          </div>
        )}

        {candidates.map(candidate => {
          const isSelected = candidate.contractorId === selectedId;
          return (
            <button
              key={candidate.contractorId}
              type="button"
              onClick={() => setSelectedId(candidate.contractorId)}
              disabled={alreadyMatched}
              className={cn(
                'w-full rounded-lg border p-3 text-start transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-accent/40',
                alreadyMatched && 'opacity-60',
              )}
              data-testid="intake-match-candidate"
              aria-pressed={isSelected}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{candidate.contractorName}</span>
                {candidate.contractorVatId && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {candidate.contractorVatId}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {candidate.matchReasons.map((reason, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: reasons are stable per candidate
                    key={`reason-${reason.kind}-${index}`}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {renderReason(t, reason)}
                  </span>
                ))}
              </div>
              {isSelected && !alreadyMatched && (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={event => {
                      event.stopPropagation();
                      handleConfirm(candidate.contractorId);
                    }}
                    disabled={confirmMutation.isPending}>
                    {t('ctaUseThisContractor')}
                  </Button>
                </div>
              )}
            </button>
          );
        })}

        {!alreadyMatched && (
          <Button type="button" variant="outline" onClick={handleCreateFromData} className="w-full">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>{t('ctaCreateContractor')}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function renderReason(
  t: LooseTranslator,
  reason: { kind: MatchReason; distance?: number },
): string {
  switch (reason.kind) {
    case 'VAT_ID':
      return t('matchReasonVat');
    case 'LEITWEG_ID':
      return t('matchReasonLeitweg');
    case 'EXACT_NAME':
      return t('matchReasonExactName');
    case 'FUZZY_NAME':
      return t('matchReasonFuzzyName', { n: reason.distance ?? 0 });
    default:
      return String(reason.kind);
  }
}
