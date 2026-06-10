/**
 * Data hook for the onboarding-checklist widget.
 *
 * Ported alongside `onboarding-checklist.tsx` from legacy apps/web
 * (commit 62a97d73). Encapsulates the three tRPC interactions —
 * `settings.get` (current onboarding metadata), `settings.update` (mark
 * step complete / dismiss), and `consent.hasRequiredConsents` (PDPL gate
 * for the privacy-consent step) — so the widget UI stays free of
 * `useQuery` / `useMutation` per `scripts/check-web-vite-data-layer.mjs`.
 */

import { useQuery } from '@tanstack/react-query';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface OnboardingChecklistData {
  settingsLoading: boolean;
  completedSteps: string[];
  serverDismissed: boolean;
  orgCountryCode: string | null;
  hasConsents: boolean | undefined;
  updateMetadata: (patch: Record<string, unknown>) => void;
  isUpdating: boolean;
}

export function useOnboardingChecklist(opts: { pdplGate: boolean }): OnboardingChecklistData {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const consentsQuery = useQuery({
    ...trpc.consent.hasRequiredConsents.queryOptions(),
    enabled: opts.pdplGate,
  });

  const updateMutation = useResourceMutation(trpc.settings.update.mutationOptions(), {
    successMessage: toasts.done(),
    invalidate: [trpc.settings.get.queryOptions().queryKey],
  });

  const metadata = (settingsQuery.data?.metadata ?? {}) as Record<string, unknown>;
  const completedSteps = (metadata.onboardingCompletedSteps as string[] | undefined) ?? [];
  const serverDismissed = (metadata.onboardingDismissed as boolean | undefined) ?? false;
  const orgCountryCode = (metadata.countryCode as string | null | undefined) ?? null;

  return {
    settingsLoading: settingsQuery.isPending,
    completedSteps,
    serverDismissed,
    orgCountryCode,
    hasConsents: consentsQuery.data,
    updateMetadata: patch => updateMutation.mutate(patch as never),
    isUpdating: updateMutation.isPending,
  };
}
