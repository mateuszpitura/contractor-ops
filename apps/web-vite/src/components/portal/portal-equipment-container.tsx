import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalEquipment } from './hooks/use-portal-equipment.js';
import { PortalEquipmentTab } from './portal-equipment-tab.js';
import { PortalReturnFlow } from './portal-return-flow.js';

export function PortalEquipmentContainer() {
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
        onReturnClick={() => undefined}
        onViewLabelClick={() => undefined}
        onCancelReturnClick={() => undefined}
        cancelDialogOpen={false}
        onCancelDialogOpenChange={() => undefined}
        onConfirmCancelReturn={() => undefined}
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
        onReturnClick={() => undefined}
        onViewLabelClick={() => undefined}
        onCancelReturnClick={() => undefined}
        cancelDialogOpen={false}
        onCancelDialogOpenChange={() => undefined}
        onConfirmCancelReturn={() => undefined}
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
        onReturnClick={() => setReturnFlowOpen(true)}
        onViewLabelClick={() => setReturnFlowOpen(true)}
        onCancelReturnClick={() => setCancelDialogOpen(true)}
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
