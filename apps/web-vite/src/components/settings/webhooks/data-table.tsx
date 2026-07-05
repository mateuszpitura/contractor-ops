import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { MoreHorizontal, Plus, RefreshCw, Send, Trash2, Webhook } from 'lucide-react';
import type { TranslateFn } from '../../../i18n/useTranslations.js';

export interface WebhookRow {
  id: string;
  url: string;
  eventFilter: string[];
  includePii: boolean;
  httpAllowed: boolean;
  enabled: boolean;
  lastSuccessAt: Date | string | null;
  lastFailureAt: Date | string | null;
}

interface WebhooksDataTableProps {
  t: TranslateFn;
  subscriptions: WebhookRow[];
  isLoading: boolean;
  onCreate: () => void;
  onTestFire: (id: string) => void;
  onRotateSecret: (id: string) => void;
  onDelete: (row: WebhookRow) => void;
}

function formatTimestamp(value: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function WebhooksDataTable({
  t,
  subscriptions,
  isLoading,
  onCreate,
  onTestFire,
  onRotateSecret,
  onDelete,
}: WebhooksDataTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label={t('loading')}>
        {[0, 1, 2].map(row => (
          <div key={row} className="h-14 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <Webhook className="size-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{t('empty.title')}</p>
          <p className="text-xs text-muted-foreground">{t('empty.description')}</p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="me-1.5 size-4" />
          {t('createButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t('table.url')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('table.events')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('table.status')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('table.lastSuccess')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('table.lastFailure')}</th>
            <th className="px-3 py-2 text-end font-medium">{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map(row => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="max-w-xs truncate px-3 py-2 font-mono text-xs" title={row.url}>
                {row.url}
                {row.httpAllowed ? (
                  <Badge variant="outline" className="ms-2 text-amber-600">
                    HTTP
                  </Badge>
                ) : null}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {t('table.eventCount', { count: row.eventFilter.length })}
              </td>
              <td className="px-3 py-2">
                <Badge variant={row.enabled ? 'default' : 'secondary'}>
                  {row.enabled ? t('status.enabled') : t('status.disabled')}
                </Badge>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {formatTimestamp(row.lastSuccessAt)}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {formatTimestamp(row.lastFailureAt)}
              </td>
              <td className="px-3 py-2 text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={t('table.actions')} />}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onTestFire(row.id)}>
                      <Send className="me-2 size-4" />
                      {t('actions.testFire')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRotateSecret(row.id)}>
                      <RefreshCw className="me-2 size-4" />
                      {t('actions.rotateSecret')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(row)}>
                      <Trash2 className="me-2 size-4" />
                      {t('actions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
