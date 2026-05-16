'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CopyableField } from '@/components/shared/copyable-field';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { KsefSourceBadge } from './ksef-badge';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KsefMetadataSectionProps {
  ksefReference: string;
  upoReceipt: string | null;
  fetchedAt: string | Date;
  source: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
          {/* KSeF Reference */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('referenceLabel')}</p>
            <CopyableField value={ksefReference} ariaLabel="Copy KSeF reference" />
          </div>

          {/* UPO Receipt */}
          {!!upoReceipt && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">{t('upoLabel')}</p>
              <CopyableField value={upoReceipt} ariaLabel="Copy UPO receipt" />
            </div>
          )}

          {/* Fetched timestamp */}
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

          {/* Source */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('sourceBadge')}</p>
            <KsefSourceBadge fetchedAt={fetchedAt} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
