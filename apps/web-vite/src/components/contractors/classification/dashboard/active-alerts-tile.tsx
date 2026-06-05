/**
 * Active alerts tile.
 */

import { useTranslations } from '../../../../i18n/useTranslations.js';

export type ActiveAlertsDataGb = { kind: 'gb'; openReassessmentTriggers: number };
export type ActiveAlertsDataDe = {
  kind: 'de';
  economicBands: { warning: number; critical: number };
  drvExpiringWithin90d: number;
};

export interface ActiveAlertsTileProps {
  data: ActiveAlertsDataGb | ActiveAlertsDataDe;
}

export function ActiveAlertsTile({ data }: ActiveAlertsTileProps) {
  const t = useTranslations('Classification.polish.dashboard');

  if (data.kind === 'gb') {
    const count = data.openReassessmentTriggers;
    return (
      <div className="flex flex-col gap-2" data-testid="active-alerts-tile-gb">
        <h3 className="text-sm font-medium text-foreground">{t('alertsGbTitle')}</h3>
        <span
          className={`text-3xl font-semibold tabular-nums ${count > 0 ? 'text-[--warning]' : 'text-foreground'}`}
          data-count={count}>
          {count}
        </span>
        {count === 0 ? <p className="text-sm text-muted-foreground">{t('alertsEmpty')}</p> : null}
      </div>
    );
  }

  const total =
    data.economicBands.warning + data.economicBands.critical + data.drvExpiringWithin90d;

  return (
    <div className="flex flex-col gap-2" data-testid="active-alerts-tile-de">
      <h3 className="text-sm font-medium text-foreground">{t('alertsDeTitle')}</h3>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{t('alertsEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {data.economicBands.warning > 0 ? (
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full bg-[--warning]"
              />
              <span>{t('alertsEconomicWarning', { count: data.economicBands.warning })}</span>
            </li>
          ) : null}
          {data.economicBands.critical > 0 ? (
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full bg-[--destructive]"
              />
              <span>{t('alertsEconomicCritical', { count: data.economicBands.critical })}</span>
            </li>
          ) : null}
          {data.drvExpiringWithin90d > 0 ? (
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full bg-[--warning]"
              />
              <span>{t('alertsDrvExpiring', { count: data.drvExpiringWithin90d })}</span>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
