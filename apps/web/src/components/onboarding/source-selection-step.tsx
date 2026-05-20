'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  JiraBrandIcon,
  LinearBrandIcon,
  SlackBrandIcon,
} from '@/components/integrations/brand-icons';
import { GoogleWorkspaceLogo } from '@/components/integrations/google-workspace-logo';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { SourceCard } from './source-card';

// ---------------------------------------------------------------------------
// Provider icon mapping
// ---------------------------------------------------------------------------

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
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

// ---------------------------------------------------------------------------
// SourceSelectionStep
// ---------------------------------------------------------------------------

interface SourceSelectionStepProps {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

export function SourceSelectionStep({
  selectedSources,
  onSourcesChange,
}: SourceSelectionStepProps) {
  const t = useTranslations('OnboardingImport');
  const router = useRouter();
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery(trpc.onboardingImport.listSources.queryOptions());

  const sources = sourcesQuery.data ?? [];

  const handleToggle = useCallback(
    (provider: string) => {
      if (selectedSources.includes(provider)) {
        onSourcesChange(selectedSources.filter(s => s !== provider));
      } else {
        onSourcesChange([...selectedSources, provider]);
      }
    },
    [selectedSources, onSourcesChange],
  );

  const handleConnect = useCallback(
    async (provider: string) => {
      try {
        const result = await queryClient.fetchQuery(
          trpc.integration.getOAuthUrlGeneric.queryOptions({ provider }),
        );
        if (!result?.url) {
          toast.error(t('step1.connectError'));
          return;
        }

        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          result.url,
          `oauth-${provider}`,
          `width=${width},height=${height},left=${left},top=${top}`,
        );

        if (!popup) {
          // Fallback: redirect in same window
          window.location.href = result.url;
          return;
        }

        // Poll for popup close
        const interval = setInterval(() => {
          if (popup.closed) {
            clearInterval(interval);
            void queryClient.invalidateQueries({
              queryKey: trpc.onboardingImport.listSources.queryKey(),
            });
            toast.info(`Checking ${PROVIDER_NAMES[provider] ?? provider} connection...`);
          }
        }, 500);
      } catch {
        toast.error(t('step1.connectError'));
      }
    },
    [queryClient, t],
  );

  const handleSkip = useCallback(() => {
    router.push('/settings?tab=members');
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('step1.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('step1.subtitle')}</p>
      </div>

      {/* Source cards grid */}
      {sourcesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`skel-${i}`} className="h-24 w-full" />
          ))}
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
              onToggle={() => handleToggle(source.provider)}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onConnect={() => handleConnect(source.provider)}
            />
          ))}
        </div>
      )}

      {/* Skip link */}
      <div className="text-center">
        <Button variant="link" onClick={handleSkip} className="text-muted-foreground">
          {t('step1.skipLink')}
        </Button>
      </div>
    </div>
  );
}
