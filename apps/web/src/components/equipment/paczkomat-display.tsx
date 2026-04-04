"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaczkomatDisplayProps {
  pointId: string;
  pointName: string;
  pointAddress: string;
  onChangeClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Read-only display of a selected Paczkomat locker with name, address,
 * and a "Change" button to re-open the picker.
 */
export function PaczkomatDisplay({
  pointName,
  pointAddress,
  onChangeClick,
}: PaczkomatDisplayProps) {
  const t = useTranslations("Equipment.paczkomat");

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <MapPin className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{pointName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {pointAddress}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onChangeClick}>
          {t("change")}
        </Button>
      </CardContent>
    </Card>
  );
}
