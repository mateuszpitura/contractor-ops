"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarInitials } from "@/lib/avatar-initials";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { SlaBadge } from "@/components/approvals/sla-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepData {
  id: string;
  stepOrder: number;
  name: string;
  status: string;
  approverUserId: string | null;
  approverRole: string | null;
  slaDeadline: string | null;
  actedAt: string | null;
  decision: string | null;
  approver: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Step status styles per UI-SPEC
// ---------------------------------------------------------------------------

function getStepStyles(status: string, isAfterRejected: boolean) {
  if (isAfterRejected) {
    return {
      circleBg: "bg-muted",
      circleText: "text-muted-foreground",
      showIcon: false,
    };
  }

  switch (status) {
    case "APPROVED":
      return {
        circleBg: "bg-green-500/10",
        circleText: "text-green-500",
        showIcon: true,
        icon: CheckCircle2,
      };
    case "REJECTED":
      return {
        circleBg: "bg-destructive/10",
        circleText: "text-destructive",
        showIcon: true,
        icon: XCircle,
      };
    case "PENDING":
      return {
        circleBg: "bg-primary",
        circleText: "text-primary-foreground",
        showIcon: false,
      };
    default:
      // NOT_STARTED or CANCELLED
      return {
        circleBg: "bg-muted",
        circleText: "text-muted-foreground",
        showIcon: false,
      };
  }
}

function getConnectorStyle(
  leftStatus: string,
  rightStatus: string,
): string {
  if (leftStatus === "APPROVED" && rightStatus === "APPROVED") {
    return "border-green-500 border-solid";
  }
  if (leftStatus === "APPROVED" && rightStatus === "PENDING") {
    return "border-green-500 border-solid";
  }
  if (leftStatus === "REJECTED" || rightStatus === "REJECTED") {
    return "border-destructive border-solid";
  }
  return "border-border border-dashed";
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ChainTrackerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <Skeleton className="h-[2px] w-8 flex-1" />}
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Approver initials helper
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step component
// ---------------------------------------------------------------------------

function StepCircle({
  step,
  isAfterRejected,
  isVertical,
}: {
  step: StepData;
  isAfterRejected: boolean;
  isVertical: boolean;
}) {
  const styles = getStepStyles(step.status, isAfterRejected);
  const Icon = styles.showIcon ? styles.icon : null;

  const approverName =
    step.approver?.name ?? step.approverRole ?? `Step ${step.stepOrder + 1}`;

  const tooltipLabel = `${step.name} - ${approverName}${
    step.slaDeadline
      ? ` - SLA: ${new Date(step.slaDeadline).toLocaleString()}`
      : ""
  }`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "flex gap-2",
            isVertical ? "flex-row items-start" : "flex-col items-center",
          )}
        >
          {/* Circle */}
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              styles.circleBg,
              styles.circleText,
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : step.stepOrder + 1}
          </div>

          {/* Step info below (horizontal) or to the right (vertical) */}
          <div
            className={cn(
              "flex flex-col gap-0.5",
              isVertical ? "items-start" : "items-center",
            )}
          >
            {/* Approver avatar + name */}
            <div className="flex items-center gap-1">
              {step.approver && (
                <Avatar size="sm">
                  {step.approver.image && (
                    <AvatarImage src={step.approver.image} />
                  )}
                  <AvatarFallback>
                    {getAvatarInitials(step.approver.name, step.approver.email)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="max-w-[80px] truncate text-[12px] text-muted-foreground">
                {approverName}
              </span>
            </div>

            {/* SLA badge for pending steps */}
            {step.status === "PENDING" && step.slaDeadline && (
              <SlaBadge
                slaDeadline={step.slaDeadline}
                status={step.status}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ChainTrackerProps {
  invoiceId: string;
}

export function ChainTracker({ invoiceId }: ChainTrackerProps) {
  const t = useTranslations("Approvals");
  const { data, isLoading } = useQuery(
    trpc.approval.getAuditTrail.queryOptions({ invoiceId }),
  );

  if (isLoading) return <ChainTrackerSkeleton />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flow = (data as any)?.flow;
  if (!flow || !flow.steps || flow.steps.length === 0) return null;

  const steps: StepData[] = flow.steps;

  // Determine if any step was rejected, so subsequent steps are greyed out
  let rejectedIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].status === "REJECTED") {
      rejectedIndex = i;
      break;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {t("chainTracker.heading")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Horizontal stepper (lg+), vertical stepper (< lg) */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-0">
          {steps.map((step, idx) => {
            const isAfterRejected =
              rejectedIndex >= 0 && idx > rejectedIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start",
                  // Horizontal layout
                  "lg:flex-col lg:items-center",
                )}
              >
                {/* Connector before this step */}
                {idx > 0 && (
                  <>
                    {/* Horizontal connector (lg+) */}
                    <div
                      className={cn(
                        "hidden lg:block",
                        "h-[2px] w-8 flex-shrink-0 border-t-2",
                        "self-center lg:self-auto lg:mt-4",
                        getConnectorStyle(
                          steps[idx - 1].status,
                          step.status,
                        ),
                      )}
                    />
                    {/* Vertical connector (< lg) */}
                    <div
                      className={cn(
                        "lg:hidden",
                        "ml-[15px] h-6 w-[2px] border-l-2",
                        getConnectorStyle(
                          steps[idx - 1].status,
                          step.status,
                        ),
                      )}
                    />
                  </>
                )}

                <StepCircle
                  step={step}
                  isAfterRejected={isAfterRejected}
                  isVertical={false}
                />
              </div>
            );
          })}
        </div>

        {/* Chain name */}
        {flow.chainName && (
          <p className="text-[12px] text-muted-foreground">
            {t("chainTracker.chain", { chainName: flow.chainName })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
