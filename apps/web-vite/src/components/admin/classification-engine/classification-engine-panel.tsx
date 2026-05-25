import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ClassificationEngineRow } from '../hooks/use-admin-classification-engine.js';

export function ClassificationEnginePanelHeader() {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('moduleName')}</h1>
      <p className="mt-1 text-muted-foreground">{t('killSwitchDesc')}</p>
    </div>
  );
}

interface FlagStatusCardProps {
  flagEnabled: boolean;
}

export function FlagStatusCard({ flagEnabled }: FlagStatusCardProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('appSideValue')}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {flagEnabled ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
            <span className="font-semibold text-green-800">ENABLED</span>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-red-600" aria-hidden />
            <span className="font-semibold text-red-700">DISABLED</span>
          </>
        )}
      </div>
    </div>
  );
}

interface RegistryStatusCardProps {
  pendingCount: number;
  totalCount: number;
}

export function RegistryStatusCard({ pendingCount, totalCount }: RegistryStatusCardProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  const allApproved = pendingCount === 0;
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('signoffRegistry')}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {allApproved ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
            <span className="font-semibold text-green-800">All {totalCount} APPROVED</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden />
            <span className="font-semibold text-amber-700">
              {pendingCount} of {totalCount} PENDING
            </span>
          </>
        )}
      </div>
    </div>
  );
}

interface OverrideBannerProps {
  pendingCount: number;
}

export function ClassificationOverrideBanner({ pendingCount }: OverrideBannerProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        {t('pendingGate', { count: pendingCount })}
      </p>
      <p className="mt-1 text-xs text-amber-700">
        {t('pendingGateResolution')} <code className="font-mono">{t('registryPath')}</code> to set
        each PENDING key to APPROVED with approvedBy + approvedAt + approverRole. The PR requires
        @contractor-ops/legal-platform review (CODEOWNERS).
      </p>
    </div>
  );
}

interface DisclaimerRegistryTableProps {
  rows: ClassificationEngineRow[];
}

export function DisclaimerRegistryTable({ rows }: DisclaimerRegistryTableProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
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
            {rows.map(row => (
              <TableRow key={row.key}>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell>
                  <Badge variant={row.isPending ? 'destructive' : 'default'}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.approvedBy ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.approvedAt ? new Date(row.approvedAt).toLocaleDateString('en-GB') : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.approverRole ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
