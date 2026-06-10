import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import type { DirectoryRole } from '@contractor-ops/validators';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { ROLE_LABELS } from './role-assignment-controls';

// ---------------------------------------------------------------------------
// ImportConfirmStep
// ---------------------------------------------------------------------------

interface ImportConfirmStepProps {
  userCount: number;
  roleBreakdown: ReadonlyArray<{ role: DirectoryRole; count: number; source: string }>;
}

export function ImportConfirmStep({ userCount, roleBreakdown }: ImportConfirmStepProps) {
  const t = useTranslations('GoogleWorkspace.import');

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <h3 className="text-lg font-semibold">{t('readyToImport', { count: userCount })}</h3>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('roleBreakdown')}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {roleBreakdown.map(item => (
              <li key={`${item.role}-${item.source}`}>
                {t('roleCount', { count: item.count, role: ROLE_LABELS[item.role] })}{' '}
                <span className="text-xs">{t('roleSource', { source: item.source })}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">{t('inviteNotice')}</p>
      </CardContent>
    </Card>
  );
}
