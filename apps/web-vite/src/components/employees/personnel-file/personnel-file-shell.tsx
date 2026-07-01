import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { useParams } from 'react-router-dom';

import { Link } from '../../../i18n/navigation.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useFlag } from '../../layout/feature-flag-context.js';
import { usePersonnelFile } from './hooks/use-personnel-file.js';
import { PersonnelErasureDialog } from './personnel-erasure-dialog.js';
import type { SectionJurisdiction } from './personnel-file-section-card.js';
import { PersonnelFileSectionCard } from './personnel-file-section-card.js';
import { PersonnelRetentionPanel } from './personnel-retention-panel.js';

const SUPPORTED_JURISDICTIONS: readonly SectionJurisdiction[] = ['PL', 'DE', 'UK', 'US'];

/**
 * The section-label taxonomy is defined for PL/DE/UK/US. Any other resolved
 * jurisdiction (or an unresolved one) falls back to the UK organizational
 * groupings so the shell never renders raw section codes.
 */
function resolveSectionJurisdiction(jurisdiction: string | null): SectionJurisdiction {
  return jurisdiction && (SUPPORTED_JURISDICTIONS as readonly string[]).includes(jurisdiction)
    ? (jurisdiction as SectionJurisdiction)
    : 'UK';
}

function EmploymentStatusChip({
  active,
  terminatedAt,
}: {
  active: boolean;
  terminatedAt: Date | string | null;
}) {
  const t = useTranslations('PersonnelFile');
  const format = useFormatter();

  if (active) {
    return <Badge variant="success-outline">{t('shell.active')}</Badge>;
  }

  const date = terminatedAt ? format.dateTime(terminatedAt, 'medium') : '';
  return <Badge variant="warning">{t('shell.terminated', { date })}</Badge>;
}

function PersonnelFileNotFound() {
  const t = useTranslations('PersonnelFile');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('shell.notFoundHeading')}</CardTitle>
        <CardDescription>{t('shell.notFoundBody')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" render={<Link href="/dashboard/employees" />}>
          {t('shell.backToEmployees')}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Data-wired personnel file: header, retention panel, and four section cards. */
function PersonnelFile({ workerId }: { workerId: string }) {
  const t = useTranslations('PersonnelFile');
  const file = usePersonnelFile(workerId);
  const sectionJurisdiction = resolveSectionJurisdiction(file.jurisdiction);

  if (file.notFound) {
    return <PersonnelFileNotFound />;
  }

  return (
    <main aria-label={t('shell.header')} className="space-y-section-gap">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{t('shell.header')}</h1>
          {file.jurisdiction && (
            <Badge variant="secondary" aria-label={t('shell.jurisdictionAria')}>
              {file.jurisdiction}
            </Badge>
          )}
          <EmploymentStatusChip active={file.employmentActive} terminatedAt={file.terminatedAt} />
        </div>
      </header>

      <PersonnelRetentionPanel
        jurisdiction={sectionJurisdiction}
        sections={file.sections.map(section => ({ id: section.id, retention: section.retention }))}
      />

      <div className="space-y-section-gap">
        {file.sections.map(section => (
          <PersonnelFileSectionCard
            key={section.id}
            section={section.id}
            jurisdiction={sectionJurisdiction}
            state={section.state}
            retention={section.retention}
            documents={section.documents}
            onRetry={file.retry}
          />
        ))}
      </div>

      <section aria-label={t('erasure.requestCta')} className="border-t pt-section-gap">
        <PersonnelErasureDialog workerId={workerId} jurisdiction={sectionJurisdiction} />
      </section>
    </main>
  );
}

/**
 * Thin flag-gated composer for the staff personnel-file route. When
 * `module.workforce-employees` is OFF the whole surface leaves the render tree
 * (mirrors the employee registration surface), so the gated route never resolves
 * to a stub. All data access lives in {@link usePersonnelFile}; this view only
 * reads the route param, gates on the flag, and renders the wired section.
 */
export function PersonnelFileView() {
  const workforceEnabled = useFlag('module.workforce-employees');
  const params = useParams<{ workerId: string }>();
  const workerId = params.workerId ?? '';

  if (!workforceEnabled) return null;
  if (!workerId) return <PersonnelFileNotFound />;

  return <PersonnelFile workerId={workerId} />;
}
