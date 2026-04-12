"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

interface DrillDownBreadcrumbProps {
  segments: Array<{ label: string; id?: string }>;
  onClear: () => void;
}

export function DrillDownBreadcrumb({ segments, onClear }: DrillDownBreadcrumbProps) {
  const t = useTranslations("Reports");

  // Only render when a drill-down is active (more than 1 segment)
  if (segments.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={(props) => (
                <button
                  {...props}
                  type="button"
                  onClick={onClear}
                  className="cursor-pointer text-sm transition-colors hover:text-foreground"
                >
                  {t("all")}
                </button>
              )}
            />
          </BreadcrumbItem>
          {segments.slice(1).map((segment, idx) => (
            <BreadcrumbItem key={segment.id ?? idx}>
              <BreadcrumbSeparator />
              <BreadcrumbPage>{segment.label}</BreadcrumbPage>
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-6 gap-1 px-2 text-xs text-muted-foreground"
      >
        <X className="h-3 w-3" />
        {t("clearFilter")}
      </Button>
    </div>
  );
}
