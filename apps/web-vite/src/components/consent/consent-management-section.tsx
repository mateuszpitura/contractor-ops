import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Download, FileText, Globe, History, Loader2 } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { ConsentPurposeToggle } from './consent-purpose-toggle';
import { useConsentManagement, type UseConsentManagementResult } from './hooks/use-consent-management.js';
import { PrivacyNoticeDisplay } from './privacy-notice-display';

export type ConsentManagementSectionViewProps = Omit<
  UseConsentManagementResult,
  'isLoading' | 'showNotRequired'
>;

export function ConsentManagementSectionLoading() {
  const t = useTranslations('Consent');
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-live="polite"
      aria-label={t('settings.loading')}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ConsentManagementSectionNotRequired() {
  const t = useTranslations('Consent');
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">{t('settings.notRequired')}</p>
      </CardContent>
    </Card>
  );
}

export function ConsentManagementSectionView({
  notice,
  purposeToggles,
  onToggle,
  consentHistory,
  hasConsentHistory,
  crossBorder,
  showCrossBorder,
  dpaDownload,
  sccDownload,
}: ConsentManagementSectionViewProps) {
  const t = useTranslations('Consent');

  return (
    <div className="space-y-6">
      {/* Section A: Privacy Notice */}
      {notice ? <PrivacyNoticeDisplay notice={notice} /> : null}

      <Separator />

      {/* Section B: Your Consents */}
      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold">{t('settings.yourConsents')}</h3>

        <div className="space-y-3">
          {purposeToggles.map(toggle => (
            <ConsentPurposeToggle
              key={toggle.purpose}
              purpose={toggle.purpose}
              required={toggle.required}
              granted={toggle.granted}
              onToggle={onToggle}
              disabled={toggle.disabled}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Section C: Consent History */}
      {hasConsentHistory ? (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-base font-semibold">
                {t('settings.consentHistory')}
              </h3>
            </div>

            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead>{t('settings.historyPurpose')}</TableHead>
                    <TableHead>{t('settings.historyAction')}</TableHead>
                    <TableHead>{t('settings.historyDate')}</TableHead>
                    <TableHead>{t('settings.historyVersion')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consentHistory.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono">{record.purpose}</TableCell>
                      <TableCell>
                        <Badge
                          variant={record.granted ? 'default' : 'destructive'}
                          className="text-[10px]">
                          {record.granted ? t('settings.granted') : t('settings.revoked')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">v{record.version}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator />
        </>
      ) : null}

      {/* Section D: Legal Documents */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">{t('settings.legalDocuments')}</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('settings.dpaTitle')}</CardTitle>
              <CardDescription className="text-xs">{t('settings.dpaDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={dpaDownload.onDownload}
                disabled={dpaDownload.isPending}
                className="w-full">
                {dpaDownload.isPending ? (
                  <Loader2 className="me-2 h-3 w-3 animate-spin" />
                ) : (
                  <Download className="me-2 h-3 w-3" />
                )}
                {t('settings.downloadDPA')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('settings.sccTitle')}</CardTitle>
              <CardDescription className="text-xs">{t('settings.sccDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={sccDownload.onDownload}
                disabled={sccDownload.isPending}
                className="w-full">
                {sccDownload.isPending ? (
                  <Loader2 className="me-2 h-3 w-3 animate-spin" />
                ) : (
                  <Download className="me-2 h-3 w-3" />
                )}
                {t('settings.downloadSCC')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Section E: Cross-Border Transfer Status */}
      {showCrossBorder && crossBorder ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-base font-semibold">
              {t('settings.crossBorderTitle')}
            </h3>
          </div>

          <Card>
            <CardContent className="py-4">
              {crossBorder.detected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t('settings.crossBorderDetected')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.crossBorderInfo', {
                      orgRegion: crossBorder.orgRegion ?? '',
                      hostingRegion: crossBorder.hostingRegion ?? '',
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('settings.noCrossBorder')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function ConsentManagementSection() {
  const consent = useConsentManagement();

  if (consent.isLoading) return <ConsentManagementSectionLoading />;
  if (consent.showNotRequired) return <ConsentManagementSectionNotRequired />;

  return <ConsentManagementSectionView {...consent} />;
}
