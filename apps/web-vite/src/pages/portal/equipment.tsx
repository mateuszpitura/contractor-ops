/**
 * Portal equipment — route shell with inlined page content.
 */

import { Suspense, useCallback } from 'react';

import { usePortalEquipment } from '../../components/portal/hooks/use-portal-equipment.js';
import { PortalEquipmentTab } from '../../components/portal/portal-equipment-tab.js';
import { PortalReturnFlow } from '../../components/portal/portal-return-flow.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../i18n/useTranslations.js';

const noop = () => undefined;

function PortalEquipmentPageContent() {
  const t = useTranslations('Portal.equipment');
  const tReturn = useTranslations('Portal.return');
  const tErrors = useTranslations('Portal.login.errors');
  const equipmentState = usePortalEquipment();
  const {
    isPending,
    isError,
    equipment,
    returnRequest,
    returnFlowOpen,
    setReturnFlowOpen,
    cancelDialogOpen,
    setCancelDialogOpen,
    isCancelling,
    confirmCancelReturn,
    invalidateReturnQueries,
    canReturn,
    returnableItems,
    hasActiveReturn,
  } = equipmentState;

  const errorMessage = tErrors('somethingWentWrong');

  const openReturnFlow = useCallback(() => setReturnFlowOpen(true), [setReturnFlowOpen]);
  const openCancelDialog = useCallback(() => setCancelDialogOpen(true), [setCancelDialogOpen]);

  if (isPending) {
    return (
      <PortalEquipmentTab
        t={t}
        tReturn={tReturn}
        isPending
        isError={false}
        equipment={[]}
        returnRequest={null}
        canReturn={false}
        hasActiveReturn={false}
        onReturnClick={noop}
        onViewLabelClick={noop}
        onCancelReturnClick={noop}
        cancelDialogOpen={false}
        onCancelDialogOpenChange={noop}
        onConfirmCancelReturn={noop}
        isCancelling={false}
        errorMessage={errorMessage}
      />
    );
  }

  if (isError) {
    return (
      <PortalEquipmentTab
        t={t}
        tReturn={tReturn}
        isPending={false}
        isError
        equipment={[]}
        returnRequest={null}
        canReturn={false}
        hasActiveReturn={false}
        onReturnClick={noop}
        onViewLabelClick={noop}
        onCancelReturnClick={noop}
        cancelDialogOpen={false}
        onCancelDialogOpenChange={noop}
        onConfirmCancelReturn={noop}
        isCancelling={false}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <>
      <PortalEquipmentTab
        t={t}
        tReturn={tReturn}
        isPending={false}
        isError={false}
        equipment={equipment}
        returnRequest={returnRequest}
        canReturn={canReturn}
        hasActiveReturn={hasActiveReturn}
        onReturnClick={openReturnFlow}
        onViewLabelClick={openReturnFlow}
        onCancelReturnClick={openCancelDialog}
        cancelDialogOpen={cancelDialogOpen}
        onCancelDialogOpenChange={setCancelDialogOpen}
        onConfirmCancelReturn={confirmCancelReturn}
        isCancelling={isCancelling}
        errorMessage={errorMessage}
      />

      <PortalReturnFlow
        open={returnFlowOpen}
        onOpenChange={setReturnFlowOpen}
        equipmentItems={returnableItems}
        returnRequest={returnRequest}
        onSuccess={invalidateReturnQueries}
      />
    </>
  );
}

export default function PortalEquipmentPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalEquipmentPageContent />
    </Suspense>
  );
}
