"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/use-permissions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type OnboardingStep = {
  id: string;
  icon: LucideIcon;
  optional: boolean;
  /** i18n key prefix under Onboarding.steps, e.g. "orgDetails" */
  stepKey: string;
  ctaHref: string;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "org-details",
    icon: Building2,
    optional: false,
    stepKey: "orgDetails",
    ctaHref: "/settings",
  },
  {
    id: "privacy-consent",
    icon: Shield,
    optional: false,
    stepKey: "privacyConsent",
    ctaHref: "/settings?tab=privacy",
  },
  {
    id: "invite-team",
    icon: UserPlus,
    optional: false,
    stepKey: "inviteTeam",
    ctaHref: "/onboarding/import",
  },
  {
    id: "add-contractor",
    icon: Users,
    optional: false,
    stepKey: "addContractor",
    ctaHref: "/contractors?action=new",
  },
  {
    id: "configure-approvals",
    icon: CheckCircle,
    optional: true,
    stepKey: "configureApprovals",
    ctaHref: "/settings?tab=approvals",
  },
  {
    id: "connect-slack",
    icon: MessageSquare,
    optional: true,
    stepKey: "connectSlack",
    ctaHref: "/settings?tab=integrations",
  },
] as const;

// ---------------------------------------------------------------------------
// Step item component
// ---------------------------------------------------------------------------

function StepIndicator({ completed, current }: { completed: boolean; current: boolean }) {
  if (completed) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
        <Check className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
    );
  }

  if (current) {
    return <div className="step-current-ring h-6 w-6 shrink-0 rounded-full ring-2 ring-primary" />;
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
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  const title = t(`steps.${step.stepKey}.title` as Parameters<typeof t>[0]);
  const description = t(`steps.${step.stepKey}.description` as Parameters<typeof t>[0]);
  const cta = t(`steps.${step.stepKey}.cta` as Parameters<typeof t>[0]);

  return (
    <div className="flex gap-3">
      <div className="mt-0.5">
        <StepIndicator completed={completed} current={current} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm",
              completed && "text-muted-foreground line-through",
              current && "font-semibold",
            )}
          >
            {title}
          </span>
          {step.optional && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ({t("optional")})
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

// ---------------------------------------------------------------------------
// Collapsed bar
// ---------------------------------------------------------------------------

function CollapsedBar({
  completedCount,
  totalCount,
  onExpand,
  t,
}: {
  completedCount: number;
  totalCount: number;
  onExpand: () => void;
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm">
            {t("collapsed")} &mdash;{" "}
            <span className="font-semibold text-primary">
              {t("progress", { completed: completedCount, total: totalCount })}
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

// ---------------------------------------------------------------------------
// Main checklist widget
// ---------------------------------------------------------------------------

export function OnboardingChecklist() {
  const t = useTranslations("Onboarding");
  const { can, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();

  // Fetch settings for onboarding state
  const { data: settings, isLoading: settingsLoading } = useQuery(trpc.settings.get.queryOptions());

  // Local UI state for collapse toggle
  const [localDismissed, setLocalDismissed] = useState<boolean | null>(null);

  // Extract onboarding state from metadata
  const metadata = (settings?.metadata ?? {}) as Record<string, unknown>;
  const completedSteps = (metadata.onboardingCompletedSteps as string[]) ?? [];
  const serverDismissed = (metadata.onboardingDismissed as boolean) ?? false;
  const isDismissed = localDismissed ?? serverDismissed;

  const totalCount = ONBOARDING_STEPS.length;
  const completedCount = completedSteps.length;

  // Settings update mutation
  const updateMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.settings.get.queryOptions().queryKey,
        });
      },
    }),
  );

  // Mark a step as complete
  const completeStep = useCallback(
    (stepId: string) => {
      if (completedSteps.includes(stepId)) return;
      const newSteps = [...completedSteps, stepId];
      updateMutation.mutate({
        onboardingCompletedSteps: newSteps,
      });
    },
    [completedSteps, updateMutation],
  );

  // Dismiss / expand toggle
  const handleDismiss = useCallback(() => {
    setLocalDismissed(true);
    updateMutation.mutate({ onboardingDismissed: true });
  }, [updateMutation]);

  const handleExpand = useCallback(() => {
    setLocalDismissed(false);
    updateMutation.mutate({ onboardingDismissed: false });
  }, [updateMutation]);

  // Visibility: only show for admins when setup is incomplete and not loading
  if (permissionsLoading || settingsLoading) return null;
  if (!can("settings", ["write"])) return null;
  if (completedCount >= totalCount) return null;

  // Collapsed state
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

  // Determine current step (first non-completed)
  const currentStepId = ONBOARDING_STEPS.find((s) => !completedSteps.includes(s.id))?.id;

  return (
    <Card className="iridescent neon-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="gradient-text text-[20px] font-bold">{t("widgetTitle")}</CardTitle>
          <span className="text-xs font-semibold text-primary">
            {t("progress", { completed: completedCount, total: totalCount })}
          </span>
        </div>
        <Progress value={(completedCount / totalCount) * 100} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {ONBOARDING_STEPS.map((step) => (
            <StepItem
              key={step.id}
              step={step}
              completed={completedSteps.includes(step.id)}
              current={step.id === currentStepId}
              t={t}
            />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          <ChevronUp className="me-1 h-3.5 w-3.5" />
          {t("dismiss")}
        </Button>
      </CardFooter>
    </Card>
  );
}
