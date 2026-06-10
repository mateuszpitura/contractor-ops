/**
 * Equipment list — route shell with inlined page content.
 */

import {
  AtelierEmptyState,
  EquipmentIllustration,
  QueryErrorPanel,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Package, Plus } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';

import { AssignmentDialog } from '../../components/equipment/assignment-dialog.js';
import { EquipmentForm } from '../../components/equipment/equipment-form.js';
import type { EquipmentRow } from '../../components/equipment/equipment-table/equipment-columns.js';
import { EquipmentDataTable } from '../../components/equipment/equipment-table/data-table.js';
import { useEquipmentList } from '../../components/equipment/hooks/use-equipment-list.js';
import { ShipmentForm } from '../../components/equipment/shipment-form.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function EquipmentListPageContent() {
  const t = useTranslations('Equipment');
  const te = useTranslations('EmptyStates');
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');
  const list = useEquipmentList();

  const [formOpen, setFormOpen] = useState(false);
  const [editEquipment, setEditEquipment] = useState<EquipmentRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<EquipmentRow | null>(null);
  const [shipmentTarget, setShipmentTarget] = useState<EquipmentRow | null>(null);
  const [retireTarget, setRetireTarget] = useState<EquipmentRow | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<EquipmentRow | null>(null);

  const handleEdit = useCallback((equipment: EquipmentRow) => {
    setEditEquipment(equipment);
    setFormOpen(true);
  }, []);

  const handleAddEquipment = useCallback(() => {
    setEditEquipment(null);
    setFormOpen(true);
  }, []);

  const handleAssign = useCallback((eq: EquipmentRow) => setAssignTarget(eq), []);
  const handleUnassign = useCallback((eq: EquipmentRow) => setUnassignTarget(eq), []);
  const handleCreateShipment = useCallback((eq: EquipmentRow) => setShipmentTarget(eq), []);
  const handleRetire = useCallback((eq: EquipmentRow) => setRetireTarget(eq), []);

  const handleFormOpenChange = useCallback((v: boolean) => {
    setFormOpen(v);
    if (!v) setEditEquipment(null);
  }, []);

  const handleAssignDialogClose = useCallback((v: boolean) => {
    if (!v) setAssignTarget(null);
  }, []);

  const handleShipmentDialogClose = useCallback((v: boolean) => {
    if (!v) setShipmentTarget(null);
  }, []);

  const handleRetireDialogClose = useCallback((v: boolean) => {
    if (!v) setRetireTarget(null);
  }, []);

  const handleUnassignDialogClose = useCallback((v: boolean) => {
    if (!v) setUnassignTarget(null);
  }, []);

  const handleCancelRetire = useCallback(() => setRetireTarget(null), []);
  const handleConfirmRetire = useCallback(() => {
    if (retireTarget) {
      list.retire(retireTarget.id);
      setRetireTarget(null);
    }
  }, [retireTarget, list]);

  const handleCancelUnassign = useCallback(() => setUnassignTarget(null), []);
  const handleConfirmUnassign = useCallback(() => {
    if (unassignTarget) {
      list.unassign(unassignTarget.id);
      setUnassignTarget(null);
    }
  }, [unassignTarget, list]);

  const handleRefetchCount = useCallback(() => {
    void list.refetchCount();
  }, [list]);

  if (list.isCountError) {
    return (
      <div className="space-y-section-gap">
        <AnimateIn delay={0}>
          <WorkbenchPageHeader title={t('title')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1}>
          <QueryErrorPanel
            message={tCommon('networkError')}
            retryLabel={tProfile('error.retry')}
            onRetry={handleRefetchCount}
          />
        </AnimateIn>
      </div>
    );
  }

  if (list.showEmptyState) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
        <AnimateIn delay={0}>
          <WorkbenchPageHeader title={t('title')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
          <AtelierEmptyState
            illustration={EquipmentIllustration}
            heading={te('equipment.heading')}
            body={te('equipment.body')}
            primaryAction={{ label: te('equipment.cta'), onClick: handleAddEquipment, icon: Plus }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
        <EquipmentForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          equipment={editEquipment}
        />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <section aria-label={t('title')} className={WORKBENCH_TABLE_SECTION_CLASS}>
          <SectionLabel icon={Package}>{t('title')}</SectionLabel>
          <EquipmentDataTable
            onEdit={handleEdit}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onCreateShipment={handleCreateShipment}
            onRetire={handleRetire}
            onAddEquipment={handleAddEquipment}
            parentLoading={list.isCountLoading}
            sectionClassName=""
          />
        </section>
      </AnimateIn>

      <EquipmentForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        equipment={editEquipment}
      />

      {!!assignTarget && (
        <AssignmentDialog
          open={!!assignTarget}
          onOpenChange={handleAssignDialogClose}
          equipmentId={assignTarget.id}
          equipmentName={assignTarget.name}
        />
      )}

      {!!shipmentTarget && (
        <ShipmentForm
          open={!!shipmentTarget}
          onOpenChange={handleShipmentDialogClose}
          equipmentId={shipmentTarget.id}
          equipmentName={shipmentTarget.name}
        />
      )}

      <Dialog open={!!retireTarget} onOpenChange={handleRetireDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.retireConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('detail.retireConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRetire} disabled={list.isRetiring}>
              {t('form.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmRetire} disabled={list.isRetiring}>
              {t('detail.retire')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unassignTarget} onOpenChange={handleUnassignDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.unassignConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('detail.unassignConfirmDescription', {
                contractorName: unassignTarget?.currentAssignment?.contractorName ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelUnassign} disabled={list.isUnassigning}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUnassign}
              disabled={list.isUnassigning}>
              {t('detail.unassignEquipment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EquipmentListPageContent />
    </Suspense>
  );
}
