import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertTriangle, ChevronDown, FileText, Info, Lock } from 'lucide-react';
import { useId, useState } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { DocumentList } from '../../documents/document-list.js';
import type {
  SectionCode,
  SectionDocument,
  SectionRetention,
  SectionState,
} from './hooks/use-personnel-file.js';
import { PersonnelFileSectionStatusBadge } from './personnel-file-section-status-badge.js';

export type SectionJurisdiction = 'PL' | 'DE' | 'UK' | 'US';

export interface PersonnelFileSectionCardProps {
  section: SectionCode;
  jurisdiction: SectionJurisdiction;
  state: SectionState;
  retention: SectionRetention | null;
  documents: SectionDocument[];
  onRetry: () => void;
}

const SKELETON_KEYS = ['row-a', 'row-b', 'row-c'] as const;
const NEAR_EXPIRY_DAYS = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Statutory jurisdictions carry a "Statutory" chip on the section header. */
function isStatutory(jurisdiction: SectionJurisdiction): boolean {
  return jurisdiction === 'PL' || jurisdiction === 'US';
}

function isNearExpiry(retainUntil: Date | string): boolean {
  const until = retainUntil instanceof Date ? retainUntil : new Date(retainUntil);
  const daysLeft = (until.getTime() - Date.now()) / MS_PER_DAY;
  return daysLeft <= NEAR_EXPIRY_DAYS;
}

/** Right-aligned retention posture chip for the section header. */
function RetentionChip({ retention }: { retention: SectionRetention | null }) {
  const t = useTranslations('PersonnelFile');
  const format = useFormatter();

  if (!retention || retention.indefinite || retention.retainUntil == null) {
    return <span className="text-xs text-muted-foreground">{t('retention.whileEmployed')}</span>;
  }

  const date = format.dateTime(retention.retainUntil, 'medium');
  const near = isNearExpiry(retention.retainUntil);
  return (
    <span
      className={
        near ? 'text-xs text-[var(--status-warning-fg)]' : 'text-xs text-muted-foreground'
      }>
      {t('retention.retainedUntil', { date })}
    </span>
  );
}

/** Adviser-verify info affordance carrying the seeded-data disclaimer per section. */
function AdviserVerifyInfo({ note, label }: { note: string; label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Info className="size-3.5" aria-hidden="true" />
            </button>
          }
        />
        <TooltipContent className="max-w-xs text-xs">{note}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Documents-list loading skeleton, reusing the documents-family row rhythm. */
function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {SKELETON_KEYS.map(key => (
        <div key={key} className="flex items-start gap-4 rounded-lg border p-4">
          <Skeleton className="size-12 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Section-scoped empty state — the documents empty pattern with section copy. */
function SectionEmpty() {
  const t = useTranslations('PersonnelFile');
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
      <FileText className="size-8 text-muted-foreground/50" aria-hidden="true" />
      <h4 className="text-sm font-medium text-muted-foreground">{t('sections.empty.heading')}</h4>
      <p className="max-w-sm text-sm text-muted-foreground">{t('sections.empty.body')}</p>
    </div>
  );
}

/** Section-scoped error — does not take down sibling sections; Retry refetches. */
function SectionError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('PersonnelFile');
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
      <AlertTriangle className="size-8 text-[var(--status-warning-fg)]" aria-hidden="true" />
      <h4 className="text-sm font-medium">{t('sections.error.heading')}</h4>
      <p className="max-w-sm text-sm text-muted-foreground">{t('sections.error.body')}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
        {t('sections.error.retry')}
      </Button>
    </div>
  );
}

/** One populated document row from the per-section metadata the router returns. */
function PersonnelDocumentRow({ document }: { document: SectionDocument }) {
  const t = useTranslations('PersonnelFile');
  const format = useFormatter();
  const effectiveDate = document.documentDate ?? document.createdAt;
  return (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <FileText className="size-8 text-muted-foreground/70" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{t('sections.documentCaption')}</p>
        <p className="text-xs text-muted-foreground">{format.dateTime(effectiveDate, 'medium')}</p>
      </div>
    </div>
  );
}

function SectionPopulated({ documents }: { documents: SectionDocument[] }) {
  return (
    <DocumentList isLoading={false} isEmpty={false}>
      {documents.map(document => (
        <PersonnelDocumentRow key={document.id} document={document} />
      ))}
    </DocumentList>
  );
}

/**
 * A single personnel-file section rendered in one of five visually distinct
 * states. A `locked` section is deliberately conspicuous — the title stays
 * visible with a Lock icon and blocked badge, but NO body, count, or skeleton is
 * mounted, so a caller without the grant sees "this section exists and is gated"
 * rather than a silent absence. The locked header row is announced as disabled to
 * assistive tech yet stays reachable via Tab; activating it is inert.
 */
export function PersonnelFileSectionCard({
  section,
  jurisdiction,
  state,
  retention,
  documents,
  onRetry,
}: PersonnelFileSectionCardProps) {
  const t = useTranslations('PersonnelFile');
  const headingId = useId();
  const [open, setOpen] = useState(true);

  const label = tDynLoose(t, `sections.${jurisdiction}.${section}`, 'label');
  const adviserNote = tDynLoose(t, `sections.${jurisdiction}.${section}`, 'adviserVerifyNote');
  const statutory = isStatutory(jurisdiction);

  const headerMeta = (
    <div className="flex min-w-0 items-center gap-2">
      <h3 id={headingId} className="truncate text-base font-semibold">
        {label}
      </h3>
      <AdviserVerifyInfo note={adviserNote} label={t('sections.adviserVerifyAria')} />
      {statutory && (
        <Badge variant="outline" className="text-xs">
          {t('sections.citationChip')}
        </Badge>
      )}
    </div>
  );

  if (state === 'locked') {
    return (
      <Card aria-labelledby={headingId}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            {headerMeta}
            <div
              // Reachable via Tab so assistive tech announces the gated section,
              // but inert — no handler, aria-disabled — so activating is a no-op.
              className="flex items-center gap-1.5 opacity-70"
              role="button"
              aria-disabled="true"
              aria-describedby={headingId}
              tabIndex={0}>
              <Lock className="size-4 text-[var(--status-blocked-fg)]" aria-hidden="true" />
              <PersonnelFileSectionStatusBadge state="locked" />
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const badge =
    state === 'empty' ? (
      <PersonnelFileSectionStatusBadge state="empty" />
    ) : state === 'populated' ? (
      <PersonnelFileSectionStatusBadge state="populated" />
    ) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card aria-labelledby={headingId}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            {headerMeta}
            <div className="flex items-center gap-2">
              <RetentionChip retention={retention} />
              {badge}
              <CollapsibleTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={open ? t('sections.collapse') : t('sections.expand')}
                  />
                }>
                <ChevronDown
                  className={
                    open ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'
                  }
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {state === 'loading' && <SectionSkeleton />}
            {state === 'error' && <SectionError onRetry={onRetry} />}
            {state === 'empty' && <SectionEmpty />}
            {state === 'populated' && <SectionPopulated documents={documents} />}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
