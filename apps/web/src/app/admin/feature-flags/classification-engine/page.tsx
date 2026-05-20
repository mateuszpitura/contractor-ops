// apps/web/src/app/admin/feature-flags/classification-engine/page.tsx
//
// Phase 64 · D-11 — Super-admin classification engine flag status page.
//
// Shows:
//   1. App-side evaluated value (may differ due to disclaimer gate D-10)
//   2. Signoff registry overview (PENDING count vs total)
//   3. Per-disclaimer signoff registry table (PENDING / APPROVED)
//   4. Actionable copy when flag is overridden by PENDING disclaimers
//
// Read-only — no Unleash toggle flipping from UI (that's in Unleash console).
// F-SEC-04 — Per-page authorization is enforced via requirePlatformOperator()
// (defense-in-depth; the admin layout is not the sole gate).

import { prisma } from '@contractor-ops/db';
import { evaluate } from '@contractor-ops/feature-flags';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { getAllPending, getRegistry, LOCKED_DISCLAIMERS } from '@contractor-ops/validators';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requirePlatformOperator } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'Classification Engine Flag Status — Admin',
};

export default async function ClassificationEngineFlagPage() {
  const { organizationId } = await requirePlatformOperator();
  const t = await getTranslations('Admin.ClassificationEngineFlag');

  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { countryCode: true, dataRegion: true },
  });

  const region = org?.dataRegion === 'ME' ? ('ME' as const) : ('EU' as const);

  // Evaluate with the disclaimer gate active (this reflects what users actually see)
  const evaluated = evaluate('module.classification-engine', {
    organizationId,
    region,
  });

  const registry = getRegistry();
  const pendingKeys = getAllPending();
  const allDisclaimerKeys = Object.keys(LOCKED_DISCLAIMERS);

  // Flag is overridden when app-side is disabled due to PENDING disclaimers
  const isOverridden = !evaluated.enabled && pendingKeys.length > 0;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('moduleName')}</h1>
        <p className="mt-1 text-muted-foreground">{t('killSwitchDesc')}</p>
      </div>

      {/* Flag state summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('appSideValue')}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {evaluated.enabled ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
                <span className="font-semibold text-green-700">ENABLED</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" aria-hidden />
                <span className="font-semibold text-red-700">DISABLED</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('signoffRegistry')}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {pendingKeys.length === 0 ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
                <span className="font-semibold text-green-700">
                  All {allDisclaimerKeys.length} APPROVED
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden />
                <span className="font-semibold text-amber-700">
                  {pendingKeys.length} of {allDisclaimerKeys.length} PENDING
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Override explanation */}
      {isOverridden && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {t('pendingGate', { count: pendingKeys.length })}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {t('pendingGateResolution')} <code className="font-mono">{t('registryPath')}</code> to
            set each PENDING key to APPROVED with approvedBy + approvedAt + approverRole. The PR
            requires @contractor-ops/legal-platform review (CODEOWNERS).
          </p>
        </div>
      )}

      {/* Signoff registry table */}
      <div>
        <h2 className="text-lg font-semibold">{t('disclaimerRegistryTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('allKeysMustBeApproved')}</p>
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colDisclaimerKey')}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{t('colApprovedBy')}</TableHead>
                <TableHead>{t('colApprovedAt')}</TableHead>
                <TableHead>{t('colApproverRole')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDisclaimerKeys.map(key => {
                const entry = registry[key];
                const isPending = !entry || entry.status === 'PENDING';
                return (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs">{key}</TableCell>
                    <TableCell>
                      <Badge variant={isPending ? 'destructive' : 'default'}>
                        {entry?.status ?? 'MISSING'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry?.approvedBy ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry?.approvedAt
                        ? new Date(entry.approvedAt).toLocaleDateString('en-GB')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry?.approverRole ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
