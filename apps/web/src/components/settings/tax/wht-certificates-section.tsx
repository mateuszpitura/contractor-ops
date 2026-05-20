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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Loader2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatMinorUnits } from '@/lib/format-currency';
import { trpc } from '@/trpc/init';

/**
 * Issued WHT certificates browser.
 *
 * Wires:
 *  - tax.listWhtCertificates (query)
 *  - tax.getWhtCertificate   (query, on-demand inside the Dialog)
 *
 * The detail dialog includes a Download button when the certificate has an
 * attached document — clicking it resolves a signed URL via
 * `document.getDownloadUrl` and opens it in a new tab.
 */
export function WhtCertificatesSection() {
  const t = useTranslations('TaxAdmin.certificates');
  const format = useFormatter();
  const locale = useLocale();

  const [openId, setOpenId] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);

  const listQuery = useQuery(trpc.tax.listWhtCertificates.queryOptions());

  const detailQuery = useQuery({
    ...trpc.tax.getWhtCertificate.queryOptions({ certificateId: openId ?? '' }),
    enabled: !!openId,
  });

  async function handleDownload(documentId: string) {
    setDownloadPending(true);
    try {
      const response = await fetch(
        `/api/trpc/document.getDownloadUrl?input=${encodeURIComponent(
          JSON.stringify({ documentId }),
        )}`,
      );
      if (!response.ok) throw new Error(t('toast.downloadFailed'));
      const data = await response.json();
      const url = data?.result?.data?.url;
      if (!url) throw new Error(t('toast.downloadFailed'));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.downloadFailed'));
    } finally {
      setDownloadPending(false);
    }
  }

  if (listQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = listQuery.data ?? [];
  const detail = detailQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.certificateNumber')}</TableHead>
                  <TableHead>{t('table.contractor')}</TableHead>
                  <TableHead>{t('table.country')}</TableHead>
                  <TableHead className="text-end">{t('table.whtAmount')}</TableHead>
                  <TableHead>{t('table.paymentDate')}</TableHead>
                  <TableHead className="text-end">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.certificateNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{row.contractorName}</span>
                        {row.contractorTaxId && (
                          <span className="text-xs text-muted-foreground">
                            {row.contractorTaxId}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.contractorCountry}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatMinorUnits(row.whtAmountMinor, row.currency, locale)}
                    </TableCell>
                    <TableCell>
                      {format.dateTime(new Date(row.paymentDate), { dateStyle: 'medium' })}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('action.view')}
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() => setOpenId(row.id)}>
                        <Eye className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!openId} onOpenChange={open => !open && setOpenId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('detail.title')}</DialogTitle>
            <DialogDescription>{t('detail.description')}</DialogDescription>
          </DialogHeader>

          {detailQuery.isFetching ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : detail ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-2 text-sm">
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.certificateNumber')}
                </dt>
                <dd className="font-mono">{detail.certificateNumber}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.contractor')}
                </dt>
                <dd>{detail.contractorName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.country')}
                </dt>
                <dd className="font-mono">{detail.contractorCountry}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.gross')}
                </dt>
                <dd className="tabular-nums">
                  {formatMinorUnits(detail.grossAmountMinor, detail.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.rate')}
                </dt>
                <dd className="tabular-nums">{Number(detail.whtRate).toFixed(2)}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.withheld')}
                </dt>
                <dd className="tabular-nums">
                  {formatMinorUnits(detail.whtAmountMinor, detail.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.net')}
                </dt>
                <dd className="tabular-nums">
                  {formatMinorUnits(detail.netAmountMinor, detail.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.paymentDate')}
                </dt>
                <dd>{format.dateTime(new Date(detail.paymentDate), { dateStyle: 'medium' })}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('detail.generatedAt')}
                </dt>
                <dd>
                  {format.dateTime(new Date(detail.generatedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>
              {detail.treatyApplied && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('detail.treaty')}
                  </dt>
                  <dd>{detail.treatyReference ?? t('detail.treatyApplied')}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">{t('detail.notFound')}</p>
          )}

          <DialogFooter>
            {detail?.documentId ? (
              <Button
                variant="default"
                disabled={downloadPending}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => handleDownload(detail.documentId as string)}>
                {downloadPending ? (
                  <Loader2 className="me-1.5 size-3.5 animate-spin" />
                ) : (
                  <Download className="me-1.5 size-3.5" />
                )}
                {t('detail.downloadCta')}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpenId(null)}>
                {t('detail.closeCta')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
