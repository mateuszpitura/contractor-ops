import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ipAssignmentResultsSchema } from '@contractor-ops/validators';
import { Loader2 } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useHealthCheckPanel } from './hooks/use-health-check-panel.js';

export interface HealthCheckPanelProps {
  /** Contract.complianceFlagsJson or ContractHealthCheckRun.resultsJson. */
  resultsJson: unknown;
  /** Re-run callback — omitted/ignored in readOnly mode (audit-log drill-in). */
  onRerun?: () => void;
  isRerunning?: boolean;
  /** Hides the Re-run button (audit-log drill-in renders an immutable view). */
  readOnly?: boolean;
}

const VERDICT_VARIANT = {
  LIKELY_PRESENT: 'default',
  LIKELY_MISSING: 'secondary',
  MANUAL_REVIEW_REQUIRED: 'destructive',
} as const;

/**
 * Presentational — renders an IP-assignment health-check verdict + cited clauses.
 * Reused on the contract detail page and the AuditLog drill-in (readOnly).
 * Data + the re-run callback are injected by the parent container/hook.
 */
export function HealthCheckPanel({
  resultsJson,
  onRerun,
  isRerunning,
  readOnly,
}: HealthCheckPanelProps) {
  const t = useTranslations('Contracts.healthCheck');

  const parsed = ipAssignmentResultsSchema.safeParse(resultsJson);
  if (!parsed.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('schemaUnsupported')}</p>
        </CardContent>
      </Card>
    );
  }

  const { verdict, citedClauses, crossJurisdictionMismatch, pendingPhrasesCited } =
    parsed.data.ipAssignment;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={VERDICT_VARIANT[verdict]}>{t(`verdict.${verdict}`)}</Badge>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRerun}
              disabled={isRerunning}
              data-testid="health-check-rerun">
              {isRerunning ? <Loader2 className="size-4 animate-spin" /> : t('rerunButton')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {crossJurisdictionMismatch ? (
          <div
            className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900"
            data-testid="cross-jurisdiction-mismatch">
            <p className="font-semibold">{t('crossJurisdictionMismatch.title')}</p>
            <p className="text-sm">
              {t('crossJurisdictionMismatch.description', {
                found: crossJurisdictionMismatch.foundJurisdiction,
                expected: crossJurisdictionMismatch.expectedJurisdiction,
              })}
            </p>
          </div>
        ) : null}

        {citedClauses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noCitedClauses')}</p>
        ) : (
          <ul className="space-y-3">
            {citedClauses.map(clause => {
              const isPending = pendingPhrasesCited?.includes(clause.phraseId) ?? false;
              const span = clause.regexMatchSpan;
              // phraseId alone can repeat across distinct citations of the same
              // phrase, so qualify it by where the match was found: the regex
              // span when present, else the cited text.
              const clauseKey = span
                ? `${clause.phraseId}@${span.startChar}-${span.endChar}`
                : `${clause.phraseId}:${clause.citedText}`;
              return (
                <li key={clauseKey} className="border-s-2 border-s-blue-300 ps-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{clause.jurisdiction}</Badge>
                    <Badge variant={clause.regexMatched ? 'default' : 'secondary'}>
                      {clause.regexMatched ? t('source.regexAndLlm') : t('source.llmOnly')}
                    </Badge>
                    <span className="text-muted-foreground">
                      {t('confidence', { value: Math.round(clause.confidence * 100) })}
                    </span>
                    {isPending ? (
                      <sup
                        data-testid="pending-phrase-marker"
                        className="text-amber-600"
                        role="note"
                        aria-label={t('pendingPhraseFooter')}>
                        ¹
                      </sup>
                    ) : null}
                  </div>
                  <blockquote className="mt-1 italic">{clause.citedText}</blockquote>
                </li>
              );
            })}
          </ul>
        )}

        {(pendingPhrasesCited?.length ?? 0) > 0 && (
          <p className="text-xs text-amber-700" data-testid="pending-phrase-footer">
            {t('pendingPhraseFooter')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export interface HealthCheckPanelWiredProps {
  contractId: string;
  resultsJson: unknown;
}

export function HealthCheckPanelWired({ contractId, resultsJson }: HealthCheckPanelWiredProps) {
  const { onRerun, isRerunning } = useHealthCheckPanel(contractId);
  return <HealthCheckPanel resultsJson={resultsJson} onRerun={onRerun} isRerunning={isRerunning} />;
}
