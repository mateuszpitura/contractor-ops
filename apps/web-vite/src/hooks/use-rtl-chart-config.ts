/**
 * RTL-aware Recharts config.
 */

import { useTranslation } from 'react-i18next';

import type { Locale } from '../i18n/messages.js';

function isRtl(locale: Locale | string): boolean {
  return locale === 'ar';
}

export function useRtlChartConfig() {
  const { i18n } = useTranslation();
  const rtl = isRtl(i18n.language);

  return {
    isRtl: rtl,
    xAxisProps: rtl ? { reversed: true } : {},
    yAxisProps: rtl ? { orientation: 'right' as const } : {},
    gridProps: {},
    legendProps: rtl ? { layout: 'horizontal' as const, align: 'right' as const } : {},
    tooltipProps: {},
    chartStyle: rtl ? { direction: 'rtl' as const } : {},
  };
}
