import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageKpiCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subText?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsageKpiCard({ icon, label, value, subText }: UsageKpiCardProps) {
  return (
    <Card className="p-4">
      <CardContent className="flex flex-col gap-1 p-0">
        <div className="flex items-start justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="text-2xl font-semibold">{value}</div>
        {subText && <span className="text-xs text-muted-foreground">{subText}</span>}
      </CardContent>
    </Card>
  );
}
