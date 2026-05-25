import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { UserPlus } from 'lucide-react';
import { usePermissions } from '../../../hooks/use-permissions.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { canViewSensitivePii, maskTaxId } from '../../../lib/mask-pii.js';
import { cn } from '../../../lib/utils.js';
import type { useIntakeDetailMatch } from '../hooks/use-intake-detail-match.js';

interface IntakeDetailMatchPaneProps {
  match: ReturnType<typeof useIntakeDetailMatch>;
  className?: string;
}

interface IntakeDetailMatchPaneEmptyProps {
  className?: string;
  alreadyMatched: boolean;
  onCreateFromData: () => void;
}

export function IntakeDetailMatchPaneSkeleton({ className }: { className?: string }) {
  const t = useTranslations('EInvoice.intake');
  return (
    <Card className={className} data-slot="intake-detail-match-pane">
      <CardHeader>
        <CardTitle className="text-base">{t('ctaConfirmMatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function IntakeDetailMatchPaneEmpty({
  className,
  alreadyMatched,
  onCreateFromData,
}: IntakeDetailMatchPaneEmptyProps) {
  const t = useTranslations('EInvoice.intake');
  return (
    <Card className={className} data-slot="intake-detail-match-pane">
      <CardHeader>
        <CardTitle className="text-base">{t('ctaConfirmMatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-3 rounded-md border border-dashed p-4 text-center">
          <p className="font-medium">{t('noMatchCandidatesHeading')}</p>
          <p className="text-xs text-muted-foreground">{t('noMatchCandidatesBody')}</p>
        </div>
        {!alreadyMatched && (
          <Button type="button" variant="outline" onClick={onCreateFromData} className="w-full">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>{t('ctaCreateContractor')}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function IntakeDetailMatchPane({ match, className }: IntakeDetailMatchPaneProps) {
  const t = useTranslations('EInvoice.intake');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  return (
    <Card className={className} data-slot="intake-detail-match-pane">
      <CardHeader>
        <CardTitle className="text-base">{t('ctaConfirmMatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {match.candidates.map(candidate => {
          const isSelected = candidate.contractorId === match.selectedId;
          return (
            <button
              key={candidate.contractorId}
              type="button"
              onClick={() => match.setSelectedId(candidate.contractorId)}
              disabled={match.alreadyMatched}
              className={cn(
                'w-full rounded-lg border p-3 text-start transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-accent/40',
                match.alreadyMatched && 'opacity-60',
              )}
              data-testid="intake-match-candidate"
              aria-pressed={isSelected}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{candidate.contractorName}</span>
                {candidate.contractorVatId && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {showPii ? candidate.contractorVatId : maskTaxId(candidate.contractorVatId)}
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
              {isSelected && !match.alreadyMatched && (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={event => {
                      event.stopPropagation();
                      match.onConfirm(candidate.contractorId);
                    }}
                    disabled={match.isConfirmPending}>
                    {t('ctaUseThisContractor')}
                  </Button>
                </div>
              )}
            </button>
          );
        })}

        {!match.alreadyMatched && (
          <Button
            type="button"
            variant="outline"
            onClick={match.onCreateFromData}
            className="w-full">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>{t('ctaCreateContractor')}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function renderReason(t: LooseTranslator, reason: { kind: string; distance?: number }): string {
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
