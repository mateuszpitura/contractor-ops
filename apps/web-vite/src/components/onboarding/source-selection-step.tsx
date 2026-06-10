import { QueryErrorPanel } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { JiraBrandIcon, LinearBrandIcon, SlackBrandIcon } from '../integrations/brand-icons.js';
import { GoogleWorkspaceLogo } from '../integrations/google-workspace-logo.js';
import type { OnboardingSource } from './hooks/use-onboarding-source-selection.js';
import { useOnboardingSourceSelection } from './hooks/use-onboarding-source-selection.js';
import { SourceSelectionSkeleton } from './onboarding-skeletons.js';
import { SourceCard } from './source-card.js';

interface SourceCardItemProps {
  source: OnboardingSource;
  name: string;
  icon: ReactNode;
  selected: boolean;
  onToggle: (provider: string) => void;
  onConnect: (provider: string) => void;
  connectingProvider: string | null;
}

function SourceCardItem({
  source,
  name,
  icon,
  selected,
  onToggle,
  onConnect,
  connectingProvider,
}: SourceCardItemProps) {
  const handleToggle = useCallback(() => onToggle(source.provider), [source.provider, onToggle]);
  const handleConnect = useCallback(() => onConnect(source.provider), [source.provider, onConnect]);
  return (
    <SourceCard
      provider={source.provider}
      name={name}
      icon={icon}
      connected={source.connected}
      selected={selected}
      onToggle={handleToggle}
      onConnect={handleConnect}
      connectDisabled={connectingProvider !== null}
    />
  );
}

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
  sources: OnboardingSource[];
  selectedSources: string[];
  onToggle: (provider: string) => void;
  onConnect: (provider: string) => void;
  connectingProvider: string | null;
  onSkip: () => void;
}

export function SourceSelectionStep({
  sources,
  selectedSources,
  onToggle,
  onConnect,
  connectingProvider,
  onSkip,
}: SourceSelectionStepProps) {
  const t = useTranslations('OnboardingImport');

  return (
    <div className="space-y-6">
      <SourceSelectionHeader />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sources.map(source => (
          <SourceCardItem
            key={source.provider}
            source={source}
            name={PROVIDER_NAMES[source.provider] ?? source.provider}
            icon={PROVIDER_ICONS[source.provider] ?? null}
            selected={selectedSources.includes(source.provider)}
            onToggle={onToggle}
            onConnect={onConnect}
            connectingProvider={connectingProvider}
          />
        ))}
      </div>

      <div className="text-center">
        <Button variant="link" onClick={onSkip} className="text-muted-foreground">
          {t('step1.skipLink')}
        </Button>
      </div>
    </div>
  );
}

export function SourceSelectionHeader() {
  const t = useTranslations('OnboardingImport');
  return (
    <div>
      <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('step1.heading')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('step1.subtitle')}</p>
    </div>
  );
}

export interface SourceSelectionErrorProps {
  onRefetch: () => void;
  onSkip: () => void;
}

export function SourceSelectionError({ onRefetch, onSkip }: SourceSelectionErrorProps) {
  const t = useTranslations('OnboardingImport');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="space-y-6">
      <SourceSelectionHeader />
      <QueryErrorPanel
        message={tCommon('networkError')}
        retryLabel={tErr('retry')}
        onRetry={onRefetch}
      />
      <div className="text-center">
        <Button variant="link" onClick={onSkip} className="text-muted-foreground">
          {t('step1.skipLink')}
        </Button>
      </div>
    </div>
  );
}

type SourceSelectionStepContainerProps = {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
};

export function SourceSelectionStepContainer(props: SourceSelectionStepContainerProps) {
  const section = useOnboardingSourceSelection(props);

  if (section.isLoading) {
    return (
      <div className="space-y-6">
        <SourceSelectionHeader />
        <SourceSelectionSkeleton />
      </div>
    );
  }

  if (section.isError) {
    return <SourceSelectionError onRefetch={section.handleRefetch} onSkip={section.handleSkip} />;
  }

  return (
    <SourceSelectionStep
      sources={section.sources}
      selectedSources={section.selectedSources}
      onToggle={section.handleToggle}
      onConnect={section.handleConnect}
      connectingProvider={section.connectingProvider}
      onSkip={section.handleSkip}
    />
  );
}
