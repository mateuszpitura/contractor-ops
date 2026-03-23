"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  UserPlus,
  Users,
  CheckCircle,
  MessageSquare,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { trpc } from "@/trpc/init";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type OnboardingStep = {
  id: string;
  icon: LucideIcon;
  optional: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "org-details",
    icon: Building2,
    optional: false,
    title: "Complete organization details",
    description:
      "Add your legal name, billing email, and fiscal year settings.",
    ctaLabel: "Go to settings",
    ctaHref: "/settings",
  },
  {
    id: "invite-team",
    icon: UserPlus,
    optional: false,
    title: "Invite your team",
    description: "Add team members and assign roles for collaboration.",
    ctaLabel: "Invite members",
    ctaHref: "/settings/users",
  },
  {
    id: "add-contractor",
    icon: Users,
    optional: false,
    title: "Add your first contractor",
    description:
      "Create a contractor profile to start managing their lifecycle.",
    ctaLabel: "Add contractor",
    ctaHref: "/contractors/new",
  },
  {
    id: "configure-approvals",
    icon: CheckCircle,
    optional: true,
    title: "Configure approval chains",
    description: "Set up approval workflows for invoices and payments.",
    ctaLabel: "Configure approvals",
    ctaHref: "/settings/approvals",
  },
  {
    id: "connect-slack",
    icon: MessageSquare,
    optional: true,
    title: "Connect Slack",
    description:
      "Get approval notifications and task reminders in your Slack workspace.",
    ctaLabel: "Connect Slack",
    ctaHref: "/settings/integrations",
  },
] as const;

// ---------------------------------------------------------------------------
// Step item component
// ---------------------------------------------------------------------------

function StepIndicator({
  completed,
  current,
}: {
  completed: boolean;
  current: boolean;
}) {
  if (completed) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
        <Check className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
    );
  }

  if (current) {
    return (
      <div className="h-6 w-6 shrink-0 rounded-full ring-2 ring-primary" />
    );
  }

  return (
    <div className="h-6 w-6 shrink-0 rounded-full ring-2 ring-border" />
  );
}

function StepItem({
  step,
  completed,
  current,
}: {
  step: OnboardingStep;
  completed: boolean;
  current: boolean;
}) {
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
            {step.title}
          </span>
          {step.optional && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              (Optional)
            </span>
          )}
        </div>
        {current && (
          <div className="mt-1.5">
            <p className="text-sm text-muted-foreground">
              {step.description}
            </p>
            <Button
              size="sm"
              className="mt-2"
              render={<Link href={step.ctaHref} />}
            >
              {step.ctaLabel}
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
}: {
  completedCount: number;
  totalCount: number;
  onExpand: () => void;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm">
            Continue setup &mdash;{" "}
            <span className="font-semibold text-primary">
              {completedCount} of {totalCount}
            </span>{" "}
            complete
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
  const { can, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();

  // Fetch settings for onboarding state
  const { data: settings, isLoading: settingsLoading } = useQuery(
    trpc.settings.get.queryOptions(),
  );

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
      />
    );
  }

  // Determine current step (first non-completed)
  const currentStepId = ONBOARDING_STEPS.find(
    (s) => !completedSteps.includes(s.id),
  )?.id;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-[20px] font-semibold">
            Setup guide
          </CardTitle>
          <span className="text-xs font-semibold text-primary">
            {completedCount} of {totalCount} complete
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
            />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          <ChevronUp className="mr-1 h-3.5 w-3.5" />
          Dismiss
        </Button>
      </CardFooter>
    </Card>
  );
}
