/**
 * Presentational per-provider IdP-deprovisioning enable matrix. Columns:
 * Provider | Connection Status | Flag Status | Action. The per-row switch is
 * disabled (with a tooltip) when the provider's signoff flag is not APPROVED.
 * GWS and Slack rows are independent. Props-in / JSX-out.
 *
 * Raw <Table> is allowlisted in check-web-vite-table-pattern (settings matrix).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';

import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { ProviderToggleRow, ToggleProvider } from './hooks/use-idp-deprovisioning-toggles.js';
import { useIdpDeprovisioningToggles } from './hooks/use-idp-deprovisioning-toggles.js';

export interface IdpDeprovisioningToggleTableViewProps {
  rows: ProviderToggleRow[];
  onToggle: (provider: ToggleProvider, enabled: boolean) => void;
  pendingProvider?: ToggleProvider;
}

interface ProviderToggleSwitchProps {
  provider: ToggleProvider;
  enabled: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: (provider: ToggleProvider, enabled: boolean) => void;
}

function ProviderToggleSwitch({
  provider,
  enabled,
  disabled,
  ariaLabel,
  onToggle,
}: ProviderToggleSwitchProps) {
  const handleCheckedChange = useCallback(
    (checked: boolean) => onToggle(provider, checked),
    [provider, onToggle],
  );
  return (
    <Switch
      checked={enabled}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
      aria-label={ariaLabel}
    />
  );
}

export function IdpDeprovisioningToggleTableView({
  rows,
  onToggle,
  pendingProvider,
}: IdpDeprovisioningToggleTableViewProps) {
  const t = useTranslations('Idp.toggleTable');

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.provider')}</TableHead>
            <TableHead>{t('columns.connection')}</TableHead>
            <TableHead>{t('columns.flag')}</TableHead>
            <TableHead className="text-end">{t('columns.action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const toggle = (
              <ProviderToggleSwitch
                provider={row.provider}
                enabled={row.enabled}
                disabled={row.toggleDisabled || pendingProvider === row.provider}
                ariaLabel={t('toggleAria', { provider: t(`provider.${row.provider}`) })}
                onToggle={onToggle}
              />
            );
            return (
              <TableRow key={row.provider}>
                <TableCell className="font-medium">{t(`provider.${row.provider}`)}</TableCell>
                <TableCell>
                  <Badge variant={row.connected ? 'default' : 'outline'}>
                    {t(
                      row.connected
                        ? 'connectionStatus.connected'
                        : 'connectionStatus.notConnected',
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.flagApproved ? 'default' : 'secondary'}>
                    {t(row.flagApproved ? 'flagStatus.approved' : 'flagStatus.pending')}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  {row.toggleDisabled ? (
                    <Tooltip>
                      <TooltipTrigger className="inline-flex">{toggle}</TooltipTrigger>
                      <TooltipContent>{t('disabledTooltip')}</TooltipContent>
                    </Tooltip>
                  ) : (
                    toggle
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function IdpDeprovisioningToggleTable() {
  const t = useTranslations('Idp.toggleTable');
  const state = useIdpDeprovisioningToggles();

  if (state.isLoading) {
    return <Skeleton className="h-32 w-full" data-testid="idp-toggle-table-skeleton" />;
  }
  if (state.isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('error')}</p>
        <button type="button" className="text-sm underline" onClick={state.onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  if (state.isEmpty) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('empty')}
      </p>
    );
  }

  return (
    <IdpDeprovisioningToggleTableView
      rows={state.rows}
      onToggle={state.onToggle}
      pendingProvider={state.pendingProvider}
    />
  );
}
