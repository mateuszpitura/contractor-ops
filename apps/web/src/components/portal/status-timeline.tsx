"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "review", label: "In Review" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Payment Scheduled" },
  { key: "paid", label: "Paid" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusTimelineProps {
  status: string;
  approvalStatus: string;
  paymentStatus: string;
  rejectedAt?: Date | string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActiveStep(props: StatusTimelineProps): number {
  if (props.paymentStatus === "PAID") return 4;
  if (props.paymentStatus === "IN_RUN") return 3;
  if (props.approvalStatus === "APPROVED") return 2;
  if (
    props.status === "UNDER_REVIEW" ||
    props.status === "APPROVAL_PENDING"
  )
    return 1;
  return 0; // RECEIVED = submitted
}

function isRejected(props: StatusTimelineProps): boolean {
  return !!props.rejectedAt;
}

// ---------------------------------------------------------------------------
// Step Circle
// ---------------------------------------------------------------------------

function StepCircle({
  index,
  activeIndex,
  rejected,
}: {
  index: number;
  activeIndex: number;
  rejected: boolean;
}) {
  // Rejected state: step 1 (review) shows destructive
  if (rejected && index === 1) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive">
        <X className="h-3.5 w-3.5 text-white" />
      </div>
    );
  }

  // Past steps: green with check
  if (index < activeIndex) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600">
        <Check className="h-3.5 w-3.5 text-white" />
      </div>
    );
  }

  // Active step: primary with ring pulse
  if (index === activeIndex && !rejected) {
    return (
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
        <span className="absolute inset-0 animate-pulse rounded-full ring-2 ring-primary/30" />
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    );
  }

  // Future steps: muted border
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background" />
  );
}

// ---------------------------------------------------------------------------
// Desktop Timeline (horizontal)
// ---------------------------------------------------------------------------

function DesktopTimeline({
  activeIndex,
  rejected,
}: {
  activeIndex: number;
  rejected: boolean;
}) {
  return (
    <div className="hidden items-center md:flex" role="list" aria-label="Invoice status timeline">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center" role="listitem">
          <div className="flex flex-col items-center gap-1.5">
            <StepCircle index={i} activeIndex={activeIndex} rejected={rejected} />
            <span
              className={cn(
                "text-[13px] whitespace-nowrap",
                rejected && i === 1
                  ? "text-destructive font-medium"
                  : i < activeIndex
                    ? "text-green-700 dark:text-green-400"
                    : i === activeIndex && !rejected
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {/* Connector line between steps */}
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "mx-2 h-0.5 w-12 flex-1 min-w-8",
                i < activeIndex ? "bg-green-600" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Timeline (vertical)
// ---------------------------------------------------------------------------

function MobileTimeline({
  activeIndex,
  rejected,
}: {
  activeIndex: number;
  rejected: boolean;
}) {
  return (
    <div className="flex flex-col md:hidden" role="list" aria-label="Invoice status timeline">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-start" role="listitem">
          <div className="flex flex-col items-center">
            <StepCircle index={i} activeIndex={activeIndex} rejected={rejected} />
            {/* Vertical connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "my-1 w-0.5 h-6",
                  i < activeIndex ? "bg-green-600" : "bg-border"
                )}
              />
            )}
          </div>
          <span
            className={cn(
              "ml-3 mt-0.5 text-[13px]",
              rejected && i === 1
                ? "text-destructive font-medium"
                : i < activeIndex
                  ? "text-green-700 dark:text-green-400"
                  : i === activeIndex && !rejected
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StatusTimeline(props: StatusTimelineProps) {
  const activeIndex = getActiveStep(props);
  const rejected = isRejected(props);

  return (
    <div className="py-4">
      <DesktopTimeline activeIndex={activeIndex} rejected={rejected} />
      <MobileTimeline activeIndex={activeIndex} rejected={rejected} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function StatusTimelineSkeleton() {
  return (
    <div className="py-4">
      {/* Desktop skeleton */}
      <div className="hidden items-center gap-2 md:flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            {i < 4 && <Skeleton className="h-0.5 w-12" />}
          </div>
        ))}
      </div>
      {/* Mobile skeleton */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
