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
import { useOktaProviderSection } from './hooks/use-okta-provider-section.js';

export type OktaProviderSectionViewProps = Omit<
  ReturnType<typeof useOktaProviderSection>,
  'isLoading' | 'isError' | 'onRetry'
>;

export function OktaProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useOktaProviderSection();

  if (isLoading) return <OktaProviderSectionSkeleton />;
  if (isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('error')}</p>
        <button type="button" className="text-sm underline" onClick={onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  return <OktaProviderSectionView t={t} {...rest} />;
}

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
      onCheckedChange={onToggle}
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
