import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalEquipment } from './hooks/use-portal-equipment.js';
import { PortalEquipmentTab } from './portal-equipment-tab.js';
import { PortalReturnFlow } from './portal-return-flow.js';

export function PortalEquipmentContainer() {
  const t = useTranslations('Portal.equipment');
  const tReturn = useTranslations('Portal.return');
  const tErrors = useTranslations('Portal.login.errors');
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
  } = usePortalEquipment();

  return (
    <>
      <PortalEquipmentTab
        t={t}
        tReturn={tReturn}
        isPending={isPending}
        isError={isError}
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
        errorMessage={tErrors('somethingWentWrong')}
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
