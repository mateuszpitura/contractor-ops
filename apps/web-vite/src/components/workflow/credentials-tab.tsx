import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Plus } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { CredentialRow } from './hooks/use-credentials-tab.js';

export interface CredentialsTabProps {
  rows: CredentialRow[];
  isLoading: boolean;
  onAdd: () => void;
  onMarkRotated: (id: string) => void;
  onRemove: (id: string) => void;
  isMutating: boolean;
}

const STATUS_VARIANT = {
  PENDING: 'secondary',
  ROTATED: 'default',
  NOT_APPLICABLE: 'outline',
} as const;

/**
 * Presentational — credential-rotation list for an offboarding workflow run.
 * WHO rotates WHAT WHERE; never the secret itself (vault URL is a pointer).
 * Rendered as a definition-style list (short action list — not a sortable data
 * grid, so it intentionally avoids the shadcn Table primitive per the
 * web-vite table-pattern guard).
 */
export function CredentialsTab({
  rows,
  isLoading,
  onAdd,
  onMarkRotated,
  onRemove,
  isMutating,
}: CredentialsTabProps) {
  const t = useTranslations('Workflow.credentials');

  return (
    <section className="space-y-4" data-testid="credentials-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('tabName')}</h3>
        <Button size="sm" onClick={onAdd} data-testid="credential-add-trigger">
          <Plus className="size-4" /> {t('actions.add')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="credentials-empty">
          {t('empty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map(row => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.vaultProvider} · {row.accessType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    STATUS_VARIANT[row.status as keyof typeof STATUS_VARIANT] ?? 'secondary'
                  }>
                  {row.status}
                </Badge>
                {row.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMarkRotated(row.id)}
                    disabled={isMutating}>
                    {t('actions.markRotated')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(row.id)}
                  disabled={isMutating}>
                  {t('actions.remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
