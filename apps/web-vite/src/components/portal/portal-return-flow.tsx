import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowRight, Loader2, Package, PackageOpen } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { PaczkomatDisplay } from '../equipment/paczkomat-display.js';
import { PaczkomatPicker } from '../equipment/paczkomat-picker.js';
import { LabelDisplay } from '../equipment/shipment-label-view.js';
import { usePortalReturnFlow } from './hooks/use-portal-return-flow.js';

interface PortalReturnFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentItems: Array<{
    name: string;
    serialNumber: string | null;
  }>;
  returnRequest?: {
    id: string;
    status: string;
    shipmentId: string | null;
    targetPointName: string | null;
  } | null;
  onSuccess: () => void;
}

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={`step-${i}`}
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            i + 1 === currentStep ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

export function PortalReturnFlow({
  open,
  onOpenChange,
  equipmentItems,
  returnRequest,
  onSuccess,
}: PortalReturnFlowProps) {
  const t = useTranslations('Portal.return');
  const {
    step,
    setStep,
    selectedPoint,
    setSelectedPoint,
    pickerOpen,
    setPickerOpen,
    handleOpenChange,
    handleRequestReturn,
    requestMutation,
    labelQuery,
    labelData,
    geowidgetToken,
  } = usePortalReturnFlow({ open, onOpenChange, returnRequest, onSuccess });

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);
  const closeDialog = useCallback(() => onOpenChange(false), [onOpenChange]);
  const goToStep2 = useCallback(() => setStep(2), [setStep]);
  const goToStep1 = useCallback(() => setStep(1), [setStep]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageOpen className="size-4" />
              {t('title')}
            </DialogTitle>
          </DialogHeader>

          <StepIndicator currentStep={step} totalSteps={3} />

          {step === 1 && (
            <>
              <DialogBody className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('itemsToReturn', { count: equipmentItems.length })}
                </p>
                <ul className="space-y-1 text-sm">
                  {equipmentItems.map(item => (
                    <li key={item.name} className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {item.name}
                        {!!item.serialNumber && (
                          <span className="ms-1 font-mono text-xs text-muted-foreground">
                            ({item.serialNumber})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('selectDropOff')}</p>
                  {selectedPoint ? (
                    <PaczkomatDisplay
                      pointId={selectedPoint.id}
                      pointName={selectedPoint.name}
                      pointAddress={selectedPoint.address}
                      onChangeClick={openPicker}
                    />
                  ) : (
                    <Button variant="outline" className="w-full" onClick={openPicker}>
                      <Package className="me-2 h-4 w-4" />
                      {t('selectDropOff')}
                    </Button>
                  )}
                </div>
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  {t('cancel')}
                </Button>
                <Button onClick={goToStep2} disabled={!selectedPoint}>
                  {t('next')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 2 && (
            <>
              <DialogBody className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">
                      {t('itemsToReturn', { count: equipmentItems.length })}
                    </span>
                  </p>
                  <ul className="space-y-1 ps-4">
                    {equipmentItems.map(item => (
                      <li key={item.name}>
                        {item.name}
                        {!!item.serialNumber && (
                          <span className="ms-1 font-mono text-xs text-muted-foreground">
                            ({item.serialNumber})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!!selectedPoint && (
                    <p className="text-muted-foreground">
                      {t('dropOffAt', { name: selectedPoint.name })}
                      <br />
                      <span className="text-xs">{selectedPoint.address}</span>
                    </p>
                  )}
                </div>

                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">{t('approvalNotice')}</p>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" onClick={goToStep1}>
                  {t('back')}
                </Button>
                <Button
                  onClick={handleRequestReturn}
                  disabled={requestMutation.isPending || requestMutation.isSuccess}>
                  {!!requestMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t('requestReturn')}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 3 && (
            <>
              <DialogBody className="space-y-4">
                <p className="text-center text-lg font-semibold">{t('step3Title')}</p>

                {labelQuery.isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="mx-auto h-[240px] w-[240px] rounded-md" />
                    <Skeleton className="mx-auto h-4 w-32" />
                  </div>
                ) : labelData ? (
                  <LabelDisplay
                    label={{
                      url: `data:${labelData.contentType};base64,${labelData.data}`,
                      format: labelData.contentType.includes('pdf') ? 'PDF' : 'IMAGE',
                    }}
                  />
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('approvalNotice')}
                  </div>
                )}

                {!!returnRequest?.targetPointName && (
                  <p className="text-center text-sm text-muted-foreground">
                    {t('dropOffAt', { name: returnRequest.targetPointName })}
                  </p>
                )}
              </DialogBody>

              <DialogFooter>
                <Button onClick={closeDialog}>{t('cancel')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PaczkomatPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setSelectedPoint}
        geowidgetToken={geowidgetToken}
      />
    </>
  );
}
