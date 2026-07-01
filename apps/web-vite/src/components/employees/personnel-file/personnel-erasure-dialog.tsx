import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_AR,
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_DE,
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN,
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_PL,
} from '@contractor-ops/validators';
import { CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useLocale } from '../../../i18n/navigation.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { ErasureDispositionBadge } from './erasure-disposition-badge.js';
import type { ErasureDisposition, ErasureResult } from './hooks/use-personnel-erasure.js';
import { usePersonnelErasure } from './hooks/use-personnel-erasure.js';
import type { SectionJurisdiction } from './personnel-file-section-card.js';

/**
 * The adviser-verify legal note rendered under the disposition list is a locked
 * constant per locale (test-guarded in validators), not a freely-editable i18n
 * string, so the wording cannot silently drift. An unrecognised locale (e.g.
 * `en-US`) falls back to the English canonical form.
 */
function erasureAdviserVerifyNote(locale: string): string {
  switch (locale) {
    case 'de':
      return PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_DE;
    case 'pl':
      return PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_PL;
    case 'ar':
      return PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_AR;
    default:
      return PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN;
  }
}

function DispositionRow({
  disposition,
  jurisdiction,
}: {
  disposition: ErasureDisposition;
  jurisdiction: SectionJurisdiction;
}) {
  const t = useTranslations('PersonnelFile.erasure');
  const tSections = useTranslations('PersonnelFile');
  const format = useFormatter();

  const label = tDynLoose(tSections, `sections.${jurisdiction}.${disposition.section}`, 'label');
  const erased = disposition.disposition === 'erased';
  const citation = disposition.citation ?? '';

  return (
    <li className="flex items-start justify-between gap-3 p-3">
      <div className="flex items-start gap-2">
        {erased ? (
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-[var(--status-success-fg)]"
            aria-hidden="true"
          />
        ) : (
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-[var(--status-warning-fg)]"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{label}</p>
          {!erased && (
            <p className="text-xs text-muted-foreground">
              {disposition.retainUntil
                ? t('sectionRetained', {
                    date: format.dateTime(disposition.retainUntil, 'medium'),
                    citation,
                  })
                : t('retainedNoDate', { citation })}
            </p>
          )}
        </div>
      </div>
      <ErasureDispositionBadge disposition={disposition.disposition} />
    </li>
  );
}

export interface ErasureResultViewProps {
  result: ErasureResult;
  jurisdiction: SectionJurisdiction;
}

/**
 * The erasure result — the single most legally load-bearing surface in the
 * phase. The page-level banner branches STRICTLY on `result.fullErasureClaimed`:
 * only `true` renders the full-erasure success; any `false` renders the
 * partial-erasure warning, even when just one of four sections is retained. The
 * banner never softens a retained hold into a success. Retained rows use
 * ShieldAlert (distinct from the RBAC Lock) with their statutory citation and
 * retain-until; the list is footed by the locked adviser-verify note.
 */
export function ErasureResultView({ result, jurisdiction }: ErasureResultViewProps) {
  const t = useTranslations('PersonnelFile.erasure');
  const locale = useLocale();

  const total = result.sections.length;
  const retainedCount = result.sections.filter(
    section => section.disposition === 'retained',
  ).length;
  const erasedCount = total - retainedCount;

  return (
    <div className="space-y-4">
      {result.fullErasureClaimed ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border bg-[var(--status-success-bg)] p-3 text-[var(--status-success-fg)]">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">{t('fullyErased')}</p>
        </div>
      ) : (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border bg-[var(--status-warning-bg)] p-3 text-[var(--status-warning-fg)]">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">
            {t('partialErased', { erased: erasedCount, total, retained: retainedCount })}
          </p>
        </div>
      )}

      <ul className="divide-y rounded-lg border">
        {result.sections.map(section => (
          <DispositionRow key={section.section} disposition={section} jurisdiction={jurisdiction} />
        ))}
      </ul>

      <p
        role="note"
        className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        {erasureAdviserVerifyNote(locale)}
      </p>
    </div>
  );
}

export interface PersonnelErasureDialogProps {
  workerId: string;
  jurisdiction: SectionJurisdiction;
}

/**
 * Page-level RODO erasure entry for a whole personnel file. The primary-accent
 * "Request erasure" button opens a destructive AlertDialog confirm explaining
 * that a hold may retain some sections; confirming runs the erasure via the hook
 * (the sole tRPC boundary) and renders the honest per-section result beneath.
 */
export function PersonnelErasureDialog({ workerId, jurisdiction }: PersonnelErasureDialogProps) {
  const t = useTranslations('PersonnelFile.erasure');
  const erasure = usePersonnelErasure();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpen = useCallback(() => setConfirmOpen(true), []);
  const handleConfirm = useCallback(() => {
    erasure.request(workerId);
    setConfirmOpen(false);
  }, [erasure, workerId]);

  return (
    <div className="space-y-4">
      <Button onClick={handleOpen} disabled={erasure.isPending}>
        <Trash2 className="me-1.5 size-4" aria-hidden="true" />
        {t('requestCta')}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirm}>
              {t('confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {erasure.isPending && <p className="text-sm text-muted-foreground">{t('pending')}</p>}
      {erasure.result && <ErasureResultView result={erasure.result} jurisdiction={jurisdiction} />}
    </div>
  );
}
