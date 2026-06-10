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
  DialogBody,
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
import { Download, Eye, Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { formatMinorUnits } from '../../../lib/money.js';
import {
  useWhtCertificatesSection,
  type useWhtCertificatesSection as UseWhtCertificatesSection,
} from './hooks/use-wht-certificates-section.js';

export type WhtCertificatesSectionProps = ReturnType<typeof UseWhtCertificatesSection>;

type SetOpenId = WhtCertificatesSectionProps['setOpenId'];
type HandleDownload = WhtCertificatesSectionProps['handleDownload'];

function ViewCertificateButton({
  id,
  label,
  onOpen,
}: {
  id: string;
  label: string;
  onOpen: SetOpenId;
}) {
  const handleClick = useCallback(() => onOpen(id), [onOpen, id]);
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} onClick={handleClick}>
      <Eye className="size-3.5" />
    </Button>
  );
}

function DownloadCertificateButton({
  documentId,
  disabled,
  label,
  onDownload,
}: {
  documentId: string;
  disabled: boolean;
  label: string;
  onDownload: HandleDownload;
}) {
  const handleClick = useCallback(() => onDownload(documentId), [onDownload, documentId]);
  return (
    <Button variant="default" disabled={disabled} onClick={handleClick}>
      {disabled ? (
        <Loader2 className="me-1.5 size-3.5 animate-spin" />
      ) : (
        <Download className="me-1.5 size-3.5" />
      )}
      {label}
    </Button>
  );
}

export function WhtCertificatesSectionSkeleton({ t }: { t: WhtCertificatesSectionProps['t'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
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
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`wht-cert-skel-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </TableCell>
                  <TableCell className="text-end">
                    <Skeleton className="ms-auto h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-end">
                    <Skeleton className="ms-auto size-7 rounded" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function WhtCertificatesSectionView({
  t,
  format,
  locale,
  openId,
  setOpenId,
  downloadPending,
  detailQuery,
  rows,
  detail,
  handleDownload,
}: WhtCertificatesSectionProps) {
  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setOpenId(null);
    },
    [setOpenId],
  );
  const handleClose = useCallback(() => setOpenId(null), [setOpenId]);

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
                      <ViewCertificateButton
                        id={row.id}
                        label={t('action.view')}
                        onOpen={setOpenId}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!openId} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('detail.title')}</DialogTitle>
            <DialogDescription>{t('detail.description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
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
          </DialogBody>

          <DialogFooter>
            {detail?.documentId ? (
              <DownloadCertificateButton
                documentId={detail.documentId as string}
                disabled={downloadPending}
                label={t('detail.downloadCta')}
                onDownload={handleDownload}
              />
            ) : (
              <Button variant="outline" onClick={handleClose}>
                {t('detail.closeCta')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function WhtCertificatesSection() {
  const section = useWhtCertificatesSection();
  if (section.listQuery.isLoading) return <WhtCertificatesSectionSkeleton t={section.t} />;
  return <WhtCertificatesSectionView {...section} />;
}
