'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

const CONFIRM_PHRASE = 'DELETE ALL DATA';

/**
 * GDPR data-subject-rights section (Art. 15 + 17 + 20).
 * Wires gdpr.exportData (data portability) and gdpr.requestErasure
 * (right to erasure).
 */
export function GdprDataRightsSection() {
  const t = useTranslations('Settings.gdpr');
  const queryClient = useQueryClient();
  const router = useRouter();
  const utils = trpc;

  const [erasureOpen, setErasureOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [retainFinancial, setRetainFinancial] = useState(true);

  const [exportPending, setExportPending] = useState(false);

  async function handleExport() {
    setExportPending(true);
    try {
      // gdpr.exportData is a query — fetch on demand without prefetching.
      const data = await queryClient.fetchQuery(utils.gdpr.exportData.queryOptions());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `org-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('toast.exportReady'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.exportFailed'));
    } finally {
      setExportPending(false);
    }
  }

  // soft-delete-self: org erasure is terminal. Clear client cache + redirect
  // to /login so the user is signed out instead of stranded on a stale page.
  const erasureMutation = useMutation(
    trpc.gdpr.requestErasure.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.erasureRequested'));
        setErasureOpen(false);
        setConfirmInput('');
        queryClient.clear();
        router.push('/login');
      },
      onError: err => toast.error(err.message || t('toast.erasureFailed')),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{t('export.title')}</p>
          <p className="text-sm text-muted-foreground">{t('export.body')}</p>
          <div>
            <Button variant="outline" onClick={handleExport} disabled={exportPending}>
              {exportPending ? (
                <Loader2 className="me-1.5 size-3.5 animate-spin" />
              ) : (
                <Download className="me-1.5 size-3.5" />
              )}
              {t('export.cta')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm font-medium text-destructive">{t('erasure.title')}</p>
          <p className="text-sm text-muted-foreground">{t('erasure.body')}</p>
          <div>
            <Button variant="destructive" onClick={() => setErasureOpen(true)}>
              <Trash2 className="me-1.5 size-3.5" />
              {t('erasure.cta')}
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={erasureOpen} onOpenChange={setErasureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('erasure.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('erasure.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="erasure-confirm">
                {t('erasure.typePhrase', { phrase: CONFIRM_PHRASE })}
              </Label>
              <Input
                id="erasure-confirm"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={retainFinancial}
                onChange={e => setRetainFinancial(e.target.checked)}
              />
              <span>{t('erasure.retainFinancialLabel')}</span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('erasure.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmInput !== CONFIRM_PHRASE || erasureMutation.isPending}
              onClick={() =>
                erasureMutation.mutate({
                  confirmPhrase: confirmInput,
                  retainFinancialRecords: retainFinancial,
                })
              }>
              {erasureMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t('erasure.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
