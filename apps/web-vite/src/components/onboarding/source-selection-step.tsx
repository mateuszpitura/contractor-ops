import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { JiraBrandIcon, LinearBrandIcon, SlackBrandIcon } from '../integrations/brand-icons.js';
import { GoogleWorkspaceLogo } from '../integrations/google-workspace-logo.js';
import type { OnboardingSource } from './hooks/use-onboarding-source-selection.js';
import { SourceSelectionSkeleton } from './onboarding-skeletons.js';
import { SourceCard } from './source-card.js';

const PROVIDER_ICONS: Record<string, ReactNode> = {
  JIRA: <JiraBrandIcon className="size-8" />,
  LINEAR: <LinearBrandIcon className="size-8" />,
  GOOGLE_WORKSPACE: <GoogleWorkspaceLogo className="size-8" />,
  SLACK: <SlackBrandIcon className="size-8" />,
};

const PROVIDER_NAMES: Record<string, string> = {
  JIRA: 'Jira',
  LINEAR: 'Linear',
  GOOGLE_WORKSPACE: 'Google Workspace',
  SLACK: 'Slack',
};

export interface SourceSelectionStepProps {
  isLoading: boolean;
  isError: boolean;
  sources: OnboardingSource[];
  selectedSources: string[];
  onToggle: (provider: string) => void;
  onConnect: (provider: string) => void;
  onRefetch: () => void;
  onSkip: () => void;
}

export function SourceSelectionStep({
  isLoading,
  isError,
  sources,
  selectedSources,
  onToggle,
  onConnect,
  onRefetch,
  onSkip,
}: SourceSelectionStepProps) {
  const t = useTranslations('OnboardingImport');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('step1.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('step1.subtitle')}</p>
      </div>

      {isLoading ? (
        <SourceSelectionSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={onRefetch}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {tErr('retry')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sources.map(source => (
            <SourceCard
              key={source.provider}
              provider={source.provider}
              name={PROVIDER_NAMES[source.provider] ?? source.provider}
              icon={PROVIDER_ICONS[source.provider] ?? null}
              connected={source.connected}
              selected={selectedSources.includes(source.provider)}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onToggle={() => onToggle(source.provider)}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onConnect={() => onConnect(source.provider)}
            />
          ))}
        </div>
      )}

      <div className="text-center">
        <Button variant="link" onClick={onSkip} className="text-muted-foreground">
          {t('step1.skipLink')}
        </Button>
      </div>
    </div>
  );
}
