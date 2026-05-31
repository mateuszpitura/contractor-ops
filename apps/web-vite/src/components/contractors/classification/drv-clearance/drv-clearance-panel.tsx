// Gated to DE contractors by parent (contractor.countryCode).

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE } from '@contractor-ops/validators';
import { FileText, Upload } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';

import type { useDrvDecisionLetterUpload } from '../hooks/use-drv-clearance.js';
import type { DrvClearanceFormInitial } from './drv-clearance-form.js';
import { DrvClearanceFormContainer } from './drv-clearance-form-container.js';
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

export type StatusfeststellungsverfahrenPanelViewProps = StatusfeststellungsverfahrenPanelProps & {
  rows: DrvClearanceRowData[];
  uploadMutation: ReturnType<typeof useDrvDecisionLetterUpload>['uploadMutation'];
  uploadPending: boolean;
};

export function StatusfeststellungsverfahrenPanelView({
  engagementId,
  classificationAssessmentId,
  rows,
  uploadMutation,
  uploadPending,
}: StatusfeststellungsverfahrenPanelViewProps) {
  const t = useTranslations('Classification.polish.drvClearance');
  const tDrv = useTranslations('Legal.DrvUpload');
  const headingId = useId();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInitial, setEditingInitial] = useState<DrvClearanceFormInitial | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasDecisionLetter, setHasDecisionLetter] = useState(false);

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
        uploadMutation.mutate(
          {
            classificationAssessmentId,
            fileBase64: base64,
            fileName: file.name,
            mimeType,
            fileSizeBytes: file.size,
          },
          {
            onSuccess: () => {
              setHasDecisionLetter(true);
              setUploadError(null);
            },
            onError: err => setUploadError(err.message),
          },
        );
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [classificationAssessmentId, uploadMutation, tDrv],
  );

  const handleOpenCreate = useCallback(() => setIsCreateOpen(true), []);
  const handleEdit = useCallback((clearance: DrvClearanceRowData) => {
    setEditingInitial(toFormInitial(clearance));
  }, []);
  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingInitial(null);
  }, []);
  const handleUploadButtonClick = useCallback(() => fileInputRef.current?.click(), []);

  const clearanceRows: DrvClearanceRowData[] = (rows ?? []) as DrvClearanceRowData[];

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
                  onClick={handleUploadButtonClick}
                  disabled={uploadPending}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden />
                  {uploadPending ? tDrv('uploading') : tDrv('uploadDecisionLetter')}
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
          {clearanceRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileText aria-hidden className="size-10 text-muted-foreground" />
              <h3 className="text-base font-medium">{t('emptyHeading')}</h3>
              <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('filedAtLabel')}</TableHead>
                  <TableHead>{t('drvReferenceLabel')}</TableHead>
                  <TableHead>{t('outcomeLabel')}</TableHead>
                  <TableHead>{t('validToLabel')}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">{t('editAction')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clearanceRows.map(row => (
                  <DrvClearanceRow key={row.id} clearance={row} onEdit={handleEdit} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DrvClearanceFormContainer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        contractorAssignmentId={engagementId}
      />

      {editingInitial ? (
        <DrvClearanceFormContainer
          open
          onOpenChange={handleEditOpenChange}
          contractorAssignmentId={engagementId}
          initial={editingInitial}
        />
      ) : null}
    </>
  );
}
