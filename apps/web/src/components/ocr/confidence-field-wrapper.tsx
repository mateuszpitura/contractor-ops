import type { ReactNode } from "react";
import { ConfidenceBadge } from "@/components/ocr/confidence-badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ConfidenceFieldWrapperProps {
  confidence: number;
  label: string;
  children: ReactNode;
  className?: string;
}

function getBorderColorClass(confidence: number) {
  if (confidence > 90) return "border-s-green-600 dark:border-s-green-500";
  if (confidence >= 70) return "border-s-amber-500 dark:border-s-amber-400";
  return "border-s-destructive dark:border-s-destructive";
}

export function ConfidenceFieldWrapper({
  confidence,
  label,
  children,
  className,
}: ConfidenceFieldWrapperProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-s-2 ps-3 transition-[border-color] duration-150 ease-in-out",
        getBorderColorClass(confidence),
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <ConfidenceBadge confidence={confidence} showPercentage={false} />
      </div>
      {children}
    </div>
  );
}
