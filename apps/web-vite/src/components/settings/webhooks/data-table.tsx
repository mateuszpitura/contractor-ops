import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
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
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.url')}</TableHead>
            <TableHead>{t('table.events')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead>{t('table.lastSuccess')}</TableHead>
            <TableHead>{t('table.lastFailure')}</TableHead>
            <TableHead className="text-end">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map(row => (
            <TableRow key={row.id}>
              <TableCell className="max-w-xs truncate font-mono text-xs" title={row.url}>
                {row.url}
                {row.httpAllowed ? (
                  <Badge variant="outline" className="ms-2 text-amber-600">
                    HTTP
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {t('table.eventCount', { count: row.eventFilter.length })}
              </TableCell>
              <TableCell>
                <Badge variant={row.enabled ? 'default' : 'secondary'}>
                  {row.enabled ? t('status.enabled') : t('status.disabled')}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatTimestamp(row.lastSuccessAt)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatTimestamp(row.lastFailureAt)}
              </TableCell>
              <TableCell className="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label={t('table.actions')} />
                    }>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
