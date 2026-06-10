import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
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
import { CheckCircle2, Clock, Users } from 'lucide-react';
import { useId } from 'react';
import { GitHubBrandIcon } from './brand-icons.js';
import { useGitHubProviderSection } from './hooks/use-github-provider-section.js';

export type GitHubProviderSectionViewProps = Omit<
  ReturnType<typeof useGitHubProviderSection>,
  'isLoading' | 'isError' | 'onRetry'
>;

export function GitHubProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useGitHubProviderSection();

  if (isLoading) return <GitHubProviderSectionSkeleton />;
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
  return <GitHubProviderSectionView t={t} {...rest} />;
}

export function GitHubProviderSectionSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-md" />
    </div>
  );
}

export function GitHubProviderSectionView({
  flagApproved,
  enabled,
  isToggling,
  onToggle,
  t,
}: GitHubProviderSectionViewProps) {
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
          <GitHubBrandIcon className="size-8" />
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
      <CardContent className="space-y-4">
        {/* Outside collaborators bypass org sync, so they need an explicit warning. */}
        <Alert>
          <Users className="size-4" aria-hidden="true" />
          <AlertTitle>{t('outsideCollabTitle')}</AlertTitle>
          <AlertDescription>{t('outsideCollabBody')}</AlertDescription>
        </Alert>

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
