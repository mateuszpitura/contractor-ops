"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SourceCardProps {
  provider: string;
  name: string;
  icon: ReactNode;
  connected: boolean;
  selected: boolean;
  onToggle: () => void;
  onConnect: () => void;
}

// ---------------------------------------------------------------------------
// SourceCard
// ---------------------------------------------------------------------------

export function SourceCard({
  provider,
  name,
  icon,
  connected,
  selected,
  onToggle,
  onConnect,
}: SourceCardProps) {
  const t = useTranslations("OnboardingImport.sourceCard");

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === " " || e.key === "Enter") && connected) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        selected && "ring-2 ring-primary bg-teal-50/50 dark:bg-teal-950/20",
      )}
      role="checkbox"
      aria-checked={selected}
      aria-label={name}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={connected ? onToggle : undefined}
    >
      <CardContent className="flex items-center gap-4 py-4">
        {/* Provider icon */}
        <div className="flex size-10 shrink-0 items-center justify-center">{icon}</div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">{name}</span>
          {connected ? (
            <Badge variant="success" className="w-fit">
              {t("connected")}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{t("notConnected")}</span>
          )}
        </div>

        {/* Action */}
        {connected ? (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor={`import-toggle-${provider}`}>
              {t("importToggle", { tool: name })}
            </label>
            <Switch
              id={`import-toggle-${provider}`}
              checked={selected}
              onCheckedChange={onToggle}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
          >
            {t("connect")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
