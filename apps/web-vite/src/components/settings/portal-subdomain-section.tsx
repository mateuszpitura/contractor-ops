import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Save } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { usePortalSubdomainSection } from './hooks/use-portal-subdomain-section.js';
import type { usePortalSubdomainSection as UsePortalSubdomainSection } from './hooks/use-portal-subdomain-section.js';

export type PortalSubdomainSectionProps = ReturnType<typeof UsePortalSubdomainSection>;

export function PortalSubdomainSectionView({
  id,
  t,
  tSettings,
  tAria,
  portalSubdomain,
  subdomainError,
  handleSubdomainChange,
  isDirty,
  handleSaveSubdomain,
  isPending,
}: PortalSubdomainSectionProps) {
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => handleSubdomainChange(e.target.value),
    [handleSubdomainChange],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('subdomainHeading')}</CardTitle>
        <CardDescription>{t('subdomainCardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('subdomainDescription')}{' '}
          <span className="font-medium text-foreground">{portalSubdomain || 'your-subdomain'}</span>
          {t('subdomainSuffix')}
        </p>

        <div className="flex items-center gap-2">
          <Input
            value={portalSubdomain}
            onChange={handleInputChange}
            placeholder={t('subdomainPlaceholder')}
            className="max-w-[200px]"
            aria-label={tAria('portalSubdomain')}
            aria-describedby="subdomain-suffix subdomain-error"
          />
          <span
            id={`${id}-subdomain-suffix`}
            className="text-sm text-muted-foreground whitespace-nowrap">
            {t('subdomainSuffix')}
          </span>
        </div>

        {!!subdomainError && (
          <p id={`${id}-subdomain-error`} className="text-sm text-destructive" role="alert">
            {subdomainError}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveSubdomain} disabled={!isDirty || isPending}>
          {isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {isPending ? tSettings('saving') : tSettings('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function PortalSubdomainSection() {
  const section = usePortalSubdomainSection();
  return <PortalSubdomainSectionView {...section} />;
}
