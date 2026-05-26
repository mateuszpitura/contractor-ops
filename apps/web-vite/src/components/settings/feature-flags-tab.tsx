import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Flag, Loader2 } from 'lucide-react';

import type { useFeatureFlagsTab } from './hooks/use-feature-flags-tab.js';

// ---------------------------------------------------------------------------
// Feature Flags admin tab
//
// Read-only matrix of every declared flag plus its resolved value for the
// caller's organization. Backed by `trpc.featureFlags.list` (appRouter),
// which itself hydrates from the Unleash service the BE talks to. There is
// no mutation here on purpose — toggle authority lives in Unleash's own
// admin UI; this surface is just diagnostic.
// ---------------------------------------------------------------------------

export type FeatureFlagsTabProps = ReturnType<typeof useFeatureFlagsTab>;

export function FeatureFlagsTabSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function FeatureFlagsTabError({ t }: { t: FeatureFlagsTabProps['t'] }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">{t('loadFailedTitle')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('loadFailedBody')}</p>
    </div>
  );
}

export function FeatureFlagsTab({ t, flags }: FeatureFlagsTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </div>

      {flags.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <div className="rounded-lg bg-muted p-2.5">
            <Flag className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t('emptyHeading')}</p>
          <p className="text-xs text-muted-foreground">{t('emptyBody')}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tableHeaders.flag')}</TableHead>
                <TableHead>{t('tableHeaders.category')}</TableHead>
                <TableHead>{t('tableHeaders.jurisdiction')}</TableHead>
                <TableHead>{t('tableHeaders.state')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map(flag => (
                <TableRow key={flag.key}>
                  <TableCell className="space-y-0.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {flag.key}
                    </code>
                    {flag.description ? (
                      <p className="text-xs text-muted-foreground">{flag.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs capitalize">
                    {flag.category}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {flag.jurisdiction ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={flag.enabled ? 'success' : 'outline'} className="capitalize">
                      {flag.enabled ? t('state.on') : t('state.off')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
