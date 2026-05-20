'use client';

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
import type { ConsentPurpose } from '@contractor-ops/validators';
import { OPTIONAL_PURPOSES, REQUIRED_PURPOSES } from '@contractor-ops/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Globe, History, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';
import { ConsentPurposeToggle } from './consent-purpose-toggle';
import { PrivacyNoticeDisplay } from './privacy-notice-display';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConsentManagementSection() {
  const t = useTranslations('Consent');
  const queryClient = useQueryClient();

  // Queries
  const { data: notice, isLoading: noticeLoading } = useQuery(
    trpc.consent.getPrivacyNotice.queryOptions(),
  );
  const { data: currentConsent, isLoading: consentLoading } = useQuery(
    trpc.consent.getCurrentConsent.queryOptions(),
  );
  const { data: consentHistory } = useQuery(trpc.consent.getConsentHistory.queryOptions({}));
  const { data: crossBorder } = useQuery(trpc.consent.getCrossBorderStatus.queryOptions());

  // Mutations
  const grantMutation = useMutation(
    trpc.consent.grant.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.consent.getCurrentConsent.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.consent.getConsentHistory.queryKey({}),
        });
        toast.success(t('settings.consentUpdated'));
      },
      onError: error => {
        toast.error(error.message);
      },
    }),
  );

  const downloadDPAMutation = useMutation(
    trpc.consent.downloadDPA.mutationOptions({
      onSuccess: data => {
        downloadHtml(data.content, data.filename);
        toast.success(t('settings.dpaDownloaded'));
        queryClient.invalidateQueries(trpc.consent.pathFilter());
      },
      onError: error => {
        toast.error(error.message);
      },
    }),
  );

  const downloadSCCMutation = useMutation(
    trpc.consent.downloadSCC.mutationOptions({
      onSuccess: data => {
        downloadHtml(data.content, data.filename);
        toast.success(t('settings.sccDownloaded'));
        queryClient.invalidateQueries(trpc.consent.pathFilter());
      },
      onError: error => {
        if (error.data?.code === 'NOT_FOUND') {
          toast.info(t('settings.sccNotRequired'));
        } else {
          toast.error(error.message);
        }
      },
    }),
  );

  const handleToggle = useCallback(
    (purpose: ConsentPurpose, granted: boolean) => {
      grantMutation.mutate({ purpose, granted });
    },
    [grantMutation],
  );

  if (noticeLoading || consentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Non-PDPL jurisdiction message
  if (!notice) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{t('settings.notRequired')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Privacy Notice */}
      <PrivacyNoticeDisplay notice={notice} />

      <Separator />

      {/* Section B: Your Consents */}
      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold">{t('settings.yourConsents')}</h3>

        <div className="space-y-3">
          {[...REQUIRED_PURPOSES, ...OPTIONAL_PURPOSES].map(purpose => {
            const state = currentConsent?.[purpose];
            const isRequired = REQUIRED_PURPOSES.includes(purpose);

            return (
              <ConsentPurposeToggle
                key={purpose}
                purpose={purpose}
                required={isRequired}
                granted={state?.granted ?? false}
                onToggle={handleToggle}
                disabled={grantMutation.isPending}
              />
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Section C: Consent History */}
      {consentHistory && consentHistory.length > 0 && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-base font-semibold">
                {t('settings.consentHistory')}
              </h3>
            </div>

            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">
                      {t('settings.historyPurpose')}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t('settings.historyAction')}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t('settings.historyDate')}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t('settings.historyVersion')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {consentHistory.map(record => (
                    <tr key={record.id} className="border-t border-border/50">
                      <td className="px-3 py-2 font-mono">
                        {record.purpose.toLowerCase().replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={record.granted ? 'default' : 'destructive'}
                          className="text-[10px]">
                          {record.granted ? t('settings.granted') : t('settings.revoked')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">v{record.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />
        </>
      )}

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
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => downloadDPAMutation.mutate()}
                disabled={downloadDPAMutation.isPending}
                className="w-full">
                {downloadDPAMutation.isPending ? (
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
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => downloadSCCMutation.mutate()}
                disabled={downloadSCCMutation.isPending}
                className="w-full">
                {downloadSCCMutation.isPending ? (
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
      {!!crossBorder && (
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadHtml(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
