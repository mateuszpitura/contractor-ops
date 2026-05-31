/**
 * Phase 77 D-15 — presentational per-provider IdP-deprovisioning enable matrix.
 * Columns: Provider | Connection Status | Flag Status | Action. The per-row
 * switch is disabled (with a tooltip) when the provider's signoff flag is not
 * APPROVED. GWS and Slack rows are independent. Props-in / JSX-out.
 *
 * Raw <Table> is allowlisted in check-web-vite-table-pattern (settings matrix).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
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

import { useTranslations } from '../../i18n/useTranslations.js';
import type { ProviderToggleRow, ToggleProvider } from './hooks/use-idp-deprovisioning-toggles.js';

export interface IdpDeprovisioningToggleTableProps {
  rows: ProviderToggleRow[];
  onToggle: (provider: ToggleProvider, enabled: boolean) => void;
  pendingProvider?: ToggleProvider;
}

export function IdpDeprovisioningToggleTable({
  rows,
  onToggle,
  pendingProvider,
}: IdpDeprovisioningToggleTableProps) {
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
              <Switch
                checked={row.enabled}
                disabled={row.toggleDisabled || pendingProvider === row.provider}
                onCheckedChange={checked => onToggle(row.provider, checked)}
                aria-label={t('toggleAria', { provider: t(`provider.${row.provider}`) })}
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
