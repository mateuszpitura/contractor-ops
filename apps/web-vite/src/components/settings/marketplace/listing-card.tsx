import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import { useId, useState } from 'react';

import type { TranslateFn } from '../../../i18n/useTranslations.js';
import type {
  MarketplaceListingRow,
  MarketplaceListingStatus,
  MarketplacePlatform,
} from '../hooks/use-marketplace-tab.js';
import { nextStatusesFor } from '../hooks/use-marketplace-tab.js';

type BadgeVariant = 'secondary' | 'info' | 'warning' | 'success' | 'destructive';

const STATUS_PRESENTATION: Record<
  MarketplaceListingStatus,
  { variant: BadgeVariant; icon: LucideIcon }
> = {
  DRAFT: { variant: 'secondary', icon: FileEdit },
  SUBMITTED: { variant: 'info', icon: Send },
  IN_REVIEW: { variant: 'warning', icon: Clock },
  LIVE: { variant: 'success', icon: CheckCircle2 },
  REJECTED: { variant: 'destructive', icon: XCircle },
  NEEDS_CHANGES: { variant: 'warning', icon: AlertTriangle },
};

function StatusBadge({ status, label }: { status: MarketplaceListingStatus; label: string }) {
  const presentation = STATUS_PRESENTATION[status] ?? STATUS_PRESENTATION.DRAFT;
  const Icon = presentation.icon;
  return (
    <Badge variant={presentation.variant} className="gap-1.5">
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </Badge>
  );
}

interface ListingCardProps {
  listing: MarketplaceListingRow;
  t: TranslateFn;
  isUpdating: boolean;
  onAdvance: (platform: MarketplacePlatform, status: MarketplaceListingStatus) => void;
}

export function ListingCard({ listing, t, isUpdating, onAdvance }: ListingCardProps) {
  const selectId = useId();
  const status = listing.status as MarketplaceListingStatus;
  const platform = listing.platform as MarketplacePlatform;
  const options = nextStatusesFor(status);
  const [nextStatus, setNextStatus] = useState<MarketplaceListingStatus | ''>('');

  const canAdvance = options.length > 0;
  const selected = nextStatus || options[0] || '';

  function handleAdvance() {
    if (!selected) return;
    onAdvance(platform, selected as MarketplaceListingStatus);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t(`platforms.${platform}`)}</CardTitle>
        <StatusBadge status={status} label={t(`statuses.${status}`)} />
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t('statusLabel')}</dt>
            <dd className="font-medium">{t('versionPin', { version: listing.versionPin })}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">{t('lastFeedback')}</dt>
            <dd className={listing.lastReviewFeedback ? '' : 'text-muted-foreground italic'}>
              {listing.lastReviewFeedback || t('noFeedback')}
            </dd>
          </div>
          {listing.listingUrl ? (
            <div>
              <a
                href={listing.listingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
                <ExternalLink aria-hidden="true" className="size-3.5" />
                {t('viewListing')}
              </a>
            </div>
          ) : null}
        </dl>

        {canAdvance ? (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor={selectId} className="text-xs font-medium text-muted-foreground">
                {t('advanceLabel')}
              </label>
              <Select
                value={selected}
                onValueChange={value => setNextStatus((value ?? '') as MarketplaceListingStatus)}>
                <SelectTrigger id={selectId} className="w-full sm:w-56">
                  <SelectValue placeholder={t('selectNextStatus')} />
                </SelectTrigger>
                <SelectContent>
                  {options.map(option => (
                    <SelectItem key={option} value={option}>
                      {t(`statuses.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdvance} disabled={isUpdating || !selected} className="shrink-0">
              {isUpdating ? (
                <Loader2 aria-hidden="true" className="me-2 size-4 animate-spin" />
              ) : null}
              {t('advanceButton')}
            </Button>
          </div>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">{t('noTransitions')}</p>
        )}
      </CardContent>
    </Card>
  );
}
