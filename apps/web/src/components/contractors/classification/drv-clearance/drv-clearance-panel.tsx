// Phase 60 · CLASS-09 — Statusfeststellungsverfahren panel.
// See .planning/phases/60-classification-polish/60-UI-SPEC.md §CLASS-09.
//
// Renders on the engagement detail page for DE contractors only (gating is
// performed by the parent page based on contractor.countryCode).
//
// Phase 64 · D-27 — Extended with DRV decision letter upload + unverified disclaimer.

'use client';

import { DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE } from '@contractor-ops/validators';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/trpc/init';

import type { DrvClearanceFormInitial } from './drv-clearance-form';
import { DrvClearanceForm } from './drv-clearance-form';
import type { DrvClearanceRowData } from './drv-clearance-row';
import { DrvClearanceRow } from './drv-clearance-row';

const MAX_DRV_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StatusfeststellungsverfahrenPanelProps {
  engagementId: string;
  /** Phase 64 D-27 — assessment ID for DRV decision letter upload. Optional — upload section hidden when absent. */
  classificationAssessmentId?: string;
}

function toFormInitial(row: DrvClearanceRowData): DrvClearanceFormInitial {
  return {
    id: row.id,
    filedAt: row.filedAt instanceof Date ? row.filedAt : new Date(row.filedAt),
    drvReference: row.drvReference,
    outcome: row.outcome,
    validFrom: row.validFrom ? new Date(row.validFrom) : null,
    validTo: row.validTo ? new Date(row.validTo) : null,
    notes: row.notes,
  };
}

export function StatusfeststellungsverfahrenPanel({
  engagementId,
  classificationAssessmentId,
}: StatusfeststellungsverfahrenPanelProps) {
  const t = useTranslations('Classification.polish.drvClearance');
  const tDrv = useTranslations('Legal.DrvUpload');
  const headingId = useId();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInitial, setEditingInitial] = useState<DrvClearanceFormInitial | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasDecisionLetter, setHasDecisionLetter] = useState(false);

  const uploadMutation = useMutation(
    trpc.classificationDocument.uploadDrvDecisionLetter.mutationOptions({
      onSuccess: () => {
        setHasDecisionLetter(true);
        setUploadError(null);
      },
      onError: err => {
        setUploadError(err.message);
      },
    }),
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!(file && classificationAssessmentId)) return;
      if (file.size > MAX_DRV_FILE_BYTES) {
        setUploadError(tDrv('fileTooLarge'));
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        if (!base64) return;
        const mimeType = file.type as 'application/pdf' | 'image/jpeg' | 'image/png';
        uploadMutation.mutate({
          classificationAssessmentId,
          fileBase64: base64,
          fileName: file.name,
          mimeType,
          fileSizeBytes: file.size,
        });
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [classificationAssessmentId, uploadMutation, tDrv],
  );

  const listQuery = useQuery(
    trpc.statusfeststellungsverfahren.listByEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
  );

  const handleOpenCreate = useCallback(() => setIsCreateOpen(true), []);
  const handleEdit = useCallback((clearance: DrvClearanceRowData) => {
    setEditingInitial(toFormInitial(clearance));
  }, []);
  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingInitial(null);
  }, []);

  const rows: DrvClearanceRowData[] = (listQuery.data ?? []) as DrvClearanceRowData[];

  return (
    <>
      <Card aria-labelledby={headingId}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle id={headingId}>{t('panelTitle')}</CardTitle>
              <CardDescription>{t('panelSubline')}</CardDescription>
            </div>
            <Button type="button" onClick={handleOpenCreate}>
              {t('ctaPrimary')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Phase 64 D-27 — DRV decision letter upload section */}
          {!!classificationAssessmentId && (
            <div className="mb-6 space-y-3">
              {!hasDecisionLetter && (
                <div
                  role="note"
                  className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  {DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE}
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
                aria-label={tDrv('uploadDecisionLetter')}
              />
              {!hasDecisionLetter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden />
                  {uploadMutation.isPending ? tDrv('uploading') : tDrv('uploadDecisionLetter')}
                </Button>
              )}
              {uploadError && (
                <p role="alert" className="text-sm text-destructive">
                  {uploadError}
                </p>
              )}
              {hasDecisionLetter && (
                <p className="text-sm text-success">
                  {tDrv('uploadedAt', { date: new Date().toLocaleDateString(), user: '' })}
                </p>
              )}
            </div>
          )}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileText aria-hidden className="size-10 text-muted-foreground" />
              <h3 className="text-base font-medium">{t('emptyHeading')}</h3>
              <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('filedAtLabel')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('drvReferenceLabel')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('outcomeLabel')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('validToLabel')}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    <span className="sr-only">{t('editAction')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <DrvClearanceRow key={row.id} clearance={row} onEdit={handleEdit} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <DrvClearanceForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        contractorAssignmentId={engagementId}
      />

      {editingInitial ? (
        <DrvClearanceForm
          open
          onOpenChange={handleEditOpenChange}
          contractorAssignmentId={engagementId}
          initial={editingInitial}
        />
      ) : null}
    </>
  );
}
