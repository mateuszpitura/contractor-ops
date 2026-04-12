"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type EmptyStateProps = {
  icon: LucideIcon;
  heading: string;
  body: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** When set, overrides primary CTA if prerequisite data doesn't exist */
  prerequisiteAction?: EmptyStateAction;
  /** Set to true when prerequisite entity count is 0 */
  prerequisiteMissing?: boolean;
};

function ActionButton({
  action,
  variant = "default",
}: {
  action: EmptyStateAction;
  variant?: "default" | "outline";
}) {
  if (action.href) {
    return (
      <Button variant={variant} nativeButton={false} render={<Link href={action.href} />}>
        {action.label}
      </Button>
    );
  }

  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  icon: Icon,
  heading,
  body,
  primaryAction,
  secondaryAction,
  prerequisiteAction,
  prerequisiteMissing,
}: EmptyStateProps) {
  // Smart sequencing: when prerequisite is missing, override primary CTA
  const effectivePrimary =
    prerequisiteMissing && prerequisiteAction ? prerequisiteAction : primaryAction;

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <Icon className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 font-display text-[20px] font-semibold">{heading}</h2>
      <p className="mt-2 max-w-[420px] text-sm text-muted-foreground">{body}</p>
      {(effectivePrimary || secondaryAction) && (
        <div className="mt-6 flex gap-3">
          {effectivePrimary && <ActionButton action={effectivePrimary} />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="outline" />}
        </div>
      )}
    </div>
  );
}
