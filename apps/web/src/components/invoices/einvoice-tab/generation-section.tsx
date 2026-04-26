'use client';

import { FileCode2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { EInvoiceLifecycleShape } from './types';

interface GenerationSectionProps {
  lifecycle: EInvoiceLifecycleShape | null;
  isFinalizePending: boolean;
  isDownloadXmlPending: boolean;
  onFinalize: () => void;
  onDownloadXml: () => void;
}

function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const delta = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(delta), 'second');
  if (abs < 3600) return rtf.format(Math.round(delta / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(delta / 3600), 'hour');
  return rtf.format(Math.round(delta / 86_400), 'day');
}

/**
 * Generation section of the E-invoice tab. Shows either the empty state
 * (no XRechnung XML yet + Generate CTA) or the finalized state (caption
 * with SHA-256 prefix + ruleSetVersion + Finalize/re-finalize + Download XML).
 */
export function GenerationSection({
  lifecycle,
  isFinalizePending,
  isDownloadXmlPending,
  onFinalize,
  onDownloadXml,
}: GenerationSectionProps) {
  const t = useTranslations('EInvoice.InvoiceTab');

  const handleFinalize = useCallback(() => onFinalize(), [onFinalize]);
  const handleDownload = useCallback(() => onDownloadXml(), [onDownloadXml]);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h3 className="text-xl font-semibold">{t('generationHeading')}</h3>

        {lifecycle ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('generationCaptionPattern', {
                relativeTime: formatRelative(lifecycle.finalizedAt ?? null),
                ruleSetVersion: lifecycle.ruleSetVersion ?? '—',
                hashPrefix8: (lifecycle.xmlSha256 ?? '').slice(0, 16) || '—',
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleFinalize} disabled={isFinalizePending}>
                {isFinalizePending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('finalizeCta')}
              </Button>
              <Button variant="outline" onClick={handleDownload} disabled={isDownloadXmlPending}>
                {t('downloadXmlButton')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('downloadXmlHelper')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <FileCode2 className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('generationNotGeneratedBody')}</p>
            <Button onClick={handleFinalize} disabled={isFinalizePending}>
              {isFinalizePending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('generateCta')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
