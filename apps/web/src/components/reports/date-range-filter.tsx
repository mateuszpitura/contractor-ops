"use client";

import { format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Preset = "this-month" | "last-3m" | "last-6m" | "ytd" | "custom";

const PRESETS: Array<{ id: Preset; labelKey: string }> = [
  { id: "this-month", labelKey: "thisMonth" },
  { id: "last-3m", labelKey: "last3Months" },
  { id: "last-6m", labelKey: "last6Months" },
  { id: "ytd", labelKey: "yearToDate" },
  { id: "custom", labelKey: "custom" },
];

function computeDateRange(preset: Exclude<Preset, "custom">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case "this-month":
      return { from: startOfMonth(now).toISOString(), to };
    case "last-3m":
      return { from: subMonths(startOfMonth(now), 3).toISOString(), to };
    case "last-6m":
      return { from: subMonths(startOfMonth(now), 6).toISOString(), to };
    case "ytd":
      return { from: startOfYear(now).toISOString(), to };
  }
}

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

export function DateRangeFilter({ dateFrom, dateTo, onDateChange }: DateRangeFilterProps) {
  const t = useTranslations("Reports");
  const [activePreset, setActivePreset] = useState<Preset>("last-3m");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const calendarRange = useMemo<DateRange>(
    () => ({
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
    }),
    [dateFrom, dateTo],
  );

  const handlePresetClick = (preset: Preset) => {
    setActivePreset(preset);

    if (preset === "custom") {
      setPopoverOpen(true);
      return;
    }

    const range = computeDateRange(preset);
    onDateChange(range.from, range.to);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onDateChange(range.from.toISOString(), range.to.toISOString());
      setPopoverOpen(false);
    }
  };

  const formatDisplay = () => {
    if (!dateFrom || !dateTo) return "";
    return `${format(new Date(dateFrom), "MMM d, yyyy")} - ${format(new Date(dateTo), "MMM d, yyyy")}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.id}
          variant="ghost"
          size="sm"
          onClick={() => handlePresetClick(preset.id)}
          className={cn(
            "h-8 text-sm",
            activePreset === preset.id
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-muted-foreground",
          )}
        >
          {preset.id === "custom" ? (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger
                render={(props) => (
                  <span {...props} className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {activePreset === "custom" && formatDisplay()
                      ? formatDisplay()
                      : t(preset.labelKey as Parameters<typeof t>[0])}
                  </span>
                )}
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={calendarRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          ) : (
            t(preset.labelKey as Parameters<typeof t>[0])
          )}
        </Button>
      ))}
    </div>
  );
}
