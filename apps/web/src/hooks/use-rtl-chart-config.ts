"use client";

import { useLocale } from "next-intl";

/**
 * Returns RTL-aware configuration props for Recharts components.
 * When the locale is Arabic (RTL), charts should:
 * - Mirror the X-axis to read right-to-left
 * - Place the Y-axis on the right side
 * - Reverse legend/tooltip layout
 */
export function useRtlChartConfig() {
  const locale = useLocale();
  const isRtl = locale === "ar";

  return {
    /** Whether the current locale is RTL */
    isRtl,
    /** X-axis props: reversed for RTL */
    xAxisProps: isRtl ? { reversed: true } : {},
    /** Y-axis props: orientation flipped for RTL */
    yAxisProps: isRtl ? { orientation: "right" as const } : {},
    /** CartesianGrid props */
    gridProps: {},
    /** Legend props: reversed layout for RTL */
    legendProps: isRtl
      ? { layout: "horizontal" as const, align: "right" as const }
      : {},
    /** Tooltip props */
    tooltipProps: {},
    /** Bar/Line chart wrapper direction */
    chartStyle: isRtl ? { direction: "rtl" as const } : {},
  };
}
