/**
 * Expert help adviser directory.
 */

import {
  SOFTWARE_NOT_LEGAL_ADVICE_DE,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
} from '@contractor-ops/validators';
import { ExternalLink } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface ExpertHelpContentProps {
  isDE: boolean;
  expertReferralEmail?: string | null;
  assessmentId?: string | null;
}

export function ExpertHelpContent({
  isDE,
  expertReferralEmail,
  assessmentId,
}: ExpertHelpContentProps) {
  const t = useTranslations('Classification.ExpertHelp');
  const softwareNotLegalAdvice = isDE ? SOFTWARE_NOT_LEGAL_ADVICE_DE : SOFTWARE_NOT_LEGAL_ADVICE_EN;

  const mailtoSubject = assessmentId
    ? `?subject=IR35 Classification Query - Assessment ${assessmentId}`
    : '';

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {!!expertReferralEmail && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">{t('orgAdviser.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('orgAdviser.description')}</p>
          <a
            href={`mailto:${expertReferralEmail}${mailtoSubject}`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">
            {t('orgAdviser.contact')}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {isDE ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('de.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('de.description')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://www.bstbk.de/de/mitgliedschaft/kammern"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('de.steuerberater.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('de.steuerberater.description')}
                </div>
              </div>
            </a>
            <a
              href="https://www.deutsche-rentenversicherung.de/DRV/DE/Beitragszahler/Arbeitgeber-und-Steuerberater/Statusfeststellung/statusfeststellung_node.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('de.drv.title')}</div>
                <div className="text-sm text-muted-foreground">{t('de.drv.description')}</div>
              </div>
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('gb.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('gb.description')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://www.tax.org.uk/find-tax-adviser"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('gb.ciot.title')}</div>
                <div className="text-sm text-muted-foreground">{t('gb.ciot.description')}</div>
              </div>
            </a>
            <a
              href="https://www.gov.uk/hmrc-internal-manuals/employment-status-manual"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('gb.hmrc.title')}</div>
                <div className="text-sm text-muted-foreground">{t('gb.hmrc.description')}</div>
              </div>
            </a>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-muted bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">{softwareNotLegalAdvice}</p>
      </div>
    </div>
  );
}
