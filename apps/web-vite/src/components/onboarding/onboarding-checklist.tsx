/**
 * Onboarding checklist — collapsible card guiding first-time admins
 * through org setup, privacy consent (PDPL only), team invite, first
 * contractor, plus optional approval / Slack steps.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { isPdplJurisdiction } from '@contractor-ops/validators';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { usePermissions } from '../../hooks/use-permissions.js';
import { Link } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { OnboardingConsentStep } from '../consent/onboarding-consent-step.js';
import { useOnboardingChecklist } from './hooks/use-onboarding-checklist.js';

type OnboardingStep = {
  id: string;
  icon: LucideIcon;
  optional: boolean;
  /** i18n key prefix under Onboarding.steps, e.g. "orgDetails" */
  stepKey: string;
  ctaHref: string;
};

const ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [
  {
    id: 'org-details',
    icon: Building2,
    optional: false,
    stepKey: 'orgDetails',
    ctaHref: '/settings',
  },
  {
    id: 'privacy-consent',
    icon: Shield,
    optional: false,
    stepKey: 'privacyConsent',
    ctaHref: '/settings?tab=privacy',
  },
  {
    id: 'invite-team',
    icon: UserPlus,
    optional: false,
    stepKey: 'inviteTeam',
    ctaHref: '/onboarding/import',
  },
  {
    id: 'add-contractor',
    icon: Users,
    optional: false,
    stepKey: 'addContractor',
    ctaHref: '/contractors?action=new',
  },
  {
    id: 'configure-approvals',
    icon: CheckCircle,
    optional: true,
    stepKey: 'configureApprovals',
    ctaHref: '/settings?tab=approvals',
  },
  {
    id: 'connect-slack',
    icon: MessageSquare,
    optional: true,
    stepKey: 'connectSlack',
    ctaHref: '/settings?tab=integrations',
  },
];

function StepIndicator({ completed, current }: { completed: boolean; current: boolean }) {
  if (completed) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
        <Check className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
    );
  }
  if (current) {
    return <div className="h-6 w-6 shrink-0 rounded-full ring-2 ring-primary" />;
  }
  return <div className="h-6 w-6 shrink-0 rounded-full ring-2 ring-border" />;
}

function StepItem({
  step,
  completed,
  current,
  t,
}: {
  step: OnboardingStep;
  completed: boolean;
  current: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const title = tKey(t, `steps.${step.stepKey}.title`);
  const description = tKey(t, `steps.${step.stepKey}.description`);
  const cta = tKey(t, `steps.${step.stepKey}.cta`);

  return (
    <div className="flex gap-3">
      <div className="mt-0.5">
        <StepIndicator completed={completed} current={current} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm',
              completed && 'text-muted-foreground line-through',
              current && 'font-semibold',
            )}>
            {title}
          </span>
          {step.optional && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ({t('optional')})
            </span>
          )}
        </div>
        {current && (
          <div className="mt-1.5">
            <p className="text-sm text-muted-foreground">{description}</p>
            <Button size="sm" className="mt-2" render={<Link href={step.ctaHref} />}>
              {cta}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsedBar({
  completedCount,
  totalCount,
  onExpand,
  t,
}: {
  completedCount: number;
  totalCount: number;
  onExpand: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm">
            {t('collapsed')} &mdash;{' '}
            <span className="font-semibold text-primary">
              {t('progress', { completed: completedCount, total: totalCount })}
            </span>
          </span>
          <Button variant="ghost" size="icon-sm" onClick={onExpand}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OnboardingChecklist() {
  const t = useTranslations('Onboarding');
  const { can, isLoading: permissionsLoading } = usePermissions();

  // First fetch: identify PDPL state. The PDPL gate also drives the
  // `consent.hasRequiredConsents` query inside the hook (enabled-only-when-PDPL).
  // We resolve the country code lazily from the first hook return.
  const initial = useOnboardingChecklist({ pdplGate: false });
  const pdplGate = isPdplJurisdiction(initial.orgCountryCode);
  const data = useOnboardingChecklist({ pdplGate });
  const {
    settingsLoading,
    completedSteps,
    serverDismissed,
    orgCountryCode,
    hasConsents,
    updateMetadata,
    isUpdating,
  } = data;

  const [localDismissed, setLocalDismissed] = useState<boolean | null>(null);
  const isDismissed = localDismissed ?? serverDismissed;

  const visibleSteps = pdplGate
    ? ONBOARDING_STEPS
    : ONBOARDING_STEPS.filter(s => s.id !== 'privacy-consent');
  const totalCount = visibleSteps.length;
  const completedCount = completedSteps.length;

  const completeStep = useCallback(
    (stepId: string, skipValidation = false) => {
      if (completedSteps.includes(stepId)) return;
      // Server-side consent validation for privacy-consent step (belt-and-suspenders)
      if (stepId === 'privacy-consent' && !skipValidation && !hasConsents) {
        return;
      }
      updateMetadata({ onboardingCompletedSteps: [...completedSteps, stepId] });
    },
    [completedSteps, hasConsents, updateMetadata],
  );

  const handleDismiss = useCallback(() => {
    setLocalDismissed(true);
    updateMetadata({ onboardingDismissed: true });
  }, [updateMetadata]);

  const handleExpand = useCallback(() => {
    setLocalDismissed(false);
    updateMetadata({ onboardingDismissed: false });
  }, [updateMetadata]);

  const handlePrivacyConsentComplete = useCallback(
    () => completeStep('privacy-consent', true),
    [completeStep],
  );

  if (permissionsLoading || settingsLoading) {
    return (
      <Card size="sm">
        <CardContent>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!can('settings', ['update'])) return null;
  if (completedCount >= totalCount) return null;

  if (isDismissed) {
    return (
      <CollapsedBar
        completedCount={completedCount}
        totalCount={totalCount}
        onExpand={handleExpand}
        t={t}
      />
    );
  }

  const currentStepId = visibleSteps.find(s => !completedSteps.includes(s.id))?.id;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-[20px] font-bold">{t('widgetTitle')}</CardTitle>
          <span className="text-xs font-semibold text-primary">
            {t('progress', { completed: completedCount, total: totalCount })}
          </span>
        </div>
        <Progress value={(completedCount / totalCount) * 100} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {visibleSteps.map(step => (
            <div key={step.id}>
              <StepItem
                step={step}
                completed={completedSteps.includes(step.id)}
                current={step.id === currentStepId}
                t={t}
              />
              {step.id === 'privacy-consent' &&
                step.id === currentStepId &&
                !completedSteps.includes(step.id) && (
                  <div className="ms-9 mt-2">
                    <OnboardingConsentStep
                      orgCountryCode={orgCountryCode}
                      onComplete={handlePrivacyConsentComplete}
                    />
                  </div>
                )}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" onClick={handleDismiss} disabled={isUpdating}>
          <ChevronUp className="me-1 h-3.5 w-3.5" />
          {t('dismiss')}
        </Button>
      </CardFooter>
    </Card>
  );
}
