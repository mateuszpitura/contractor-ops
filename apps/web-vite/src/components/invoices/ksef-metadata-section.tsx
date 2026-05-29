/**
 * KSeF metadata section. Step 11 codemod port from
 * apps/web/src/components/invoices/ksef-metadata-section.tsx:
 *   - `next-intl`                        → `../../i18n/useTranslations.js`
 *   - `@/components/shared/copyable-field` → inline `CopyableField` helper
 *     below (the shared component is not yet ported into the vite tree and
 *     `components/shared/**` is out of scope for the invoices batch).
 */

import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { KsefSourceBadge } from './invoice-table/ksef-source-badge.js';

interface KsefMetadataSectionProps {
  ksefReference: string;
  upoReceipt: string | null;
  fetchedAt: string | Date;
  source: string;
}

interface CopyableFieldProps {
  value: string;
  ariaLabel: string;
}

function CopyableField({ value, ariaLabel }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs hover:bg-muted/50">
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="size-3 text-green-600 dark:text-green-400" aria-hidden="true" />
      ) : (
        <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

export function KsefMetadataSection({
  ksefReference,
  upoReceipt,
  fetchedAt,
  source: _source,
}: KsefMetadataSectionProps) {
  const t = useTranslations('ksef');
  const fetchedDate = new Date(fetchedAt);
  const relativeTime = formatDistanceToNow(fetchedDate, { addSuffix: true });
  const exactDate = format(fetchedDate, 'yyyy-MM-dd HH:mm:ss');

  const ksefUrl = `https://ksef.mf.gov.pl/web/${encodeURIComponent(ksefReference)}`;

  return (
    <Card className="border-l-2 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold">{t('metadataHeading')}</h3>
          <a
            href={ksefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {t('viewInKsef')}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('referenceLabel')}</p>
            <CopyableField value={ksefReference} ariaLabel="Copy KSeF reference" />
          </div>

          {!!upoReceipt && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">{t('upoLabel')}</p>
              <CopyableField value={upoReceipt} ariaLabel="Copy UPO receipt" />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('fetchedLabel')}</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="text-sm text-muted-foreground">
                  {relativeTime}
                </TooltipTrigger>
                <TooltipContent>{exactDate}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('sourceBadge')}</p>
            <KsefSourceBadge fetchedAt={fetchedAt} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
