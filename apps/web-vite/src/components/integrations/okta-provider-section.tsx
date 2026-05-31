import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { CheckCircle2, Clock } from 'lucide-react';
import { useId } from 'react';
import { OktaBrandIcon } from './brand-icons.js';
import type { useOktaProviderSection } from './hooks/use-okta-provider-section.js';

export type OktaProviderSectionViewProps = Omit<
  ReturnType<typeof useOktaProviderSection>,
  'isLoading' | 'isError' | 'onRetry'
>;

export function OktaProviderSectionSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <Skeleton className="h-28 w-full rounded-md" />
    </div>
  );
}

export function OktaProviderSectionView({
  flagApproved,
  enabled,
  isToggling,
  onToggle,
  t,
}: OktaProviderSectionViewProps) {
  const switchId = useId();
  const toggleDisabled = !flagApproved || isToggling;

  const toggle = (
    <Switch
      id={switchId}
      checked={enabled}
      disabled={toggleDisabled}
      onCheckedChange={checked => onToggle(checked)}
      aria-label={t('toggleAria')}
    />
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <OktaBrandIcon className="size-8" />
          <div className="flex-1">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Badge
            variant={flagApproved ? 'default' : 'secondary'}
            className="inline-flex items-center gap-1">
            {flagApproved ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <Clock className="size-3.5" aria-hidden="true" />
            )}
            {t(flagApproved ? 'flagApproved' : 'flagPending')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <label htmlFor={switchId} className="text-sm font-medium select-none">
            {t('enableLabel')}
          </label>
          {toggleDisabled && !isToggling ? (
            <Tooltip>
              <TooltipTrigger className="inline-flex">{toggle}</TooltipTrigger>
              <TooltipContent>{t('enableDisabledTooltip')}</TooltipContent>
            </Tooltip>
          ) : (
            toggle
          )}
        </div>
      </CardContent>
    </Card>
  );
}
