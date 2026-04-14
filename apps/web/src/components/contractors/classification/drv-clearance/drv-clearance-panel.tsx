// Phase 60 · CLASS-09 — Statusfeststellungsverfahren panel.
// See .planning/phases/60-classification-polish/60-UI-SPEC.md §CLASS-09.
//
// Renders on the engagement detail page for DE contractors only (gating is
// performed by the parent page based on contractor.countryCode).

'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/trpc/init';

import type { DrvClearanceFormInitial } from './drv-clearance-form';
import { DrvClearanceForm } from './drv-clearance-form';
import { DrvClearanceRow, type DrvClearanceRowData } from './drv-clearance-row';

export interface StatusfeststellungsverfahrenPanelProps {
  engagementId: string;
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
}: StatusfeststellungsverfahrenPanelProps) {
  const t = useTranslations('Classification.polish.drvClearance');
  const headingId = useId();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInitial, setEditingInitial] = useState<DrvClearanceFormInitial | null>(null);

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
