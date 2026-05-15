'use client';

import { Cloud, Settings, TestTube } from 'lucide-react';
import { useId, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZatcaEnvironment = 'sandbox' | 'production';

interface EnvironmentToggleProps {
  value: ZatcaEnvironment;
  onChange: (environment: ZatcaEnvironment) => void;
  /** Whether production onboarding is complete */
  productionReady?: boolean;
}

// ---------------------------------------------------------------------------
// Environment Toggle
// ---------------------------------------------------------------------------

/**
 * ZATCA environment toggle per UI-SPEC Section 5.
 * RadioGroup styled as selectable cards: Sandbox / Production.
 * - Selected card: ring-2 ring-primary
 * - Production -> Sandbox requires confirmation dialog
 * - Sandbox -> Production requires completed onboarding
 */
export function EnvironmentToggle({
  value,
  onChange,
  productionReady = false,
}: EnvironmentToggleProps) {
  const reactId = useId();
  const [confirmSandbox, setConfirmSandbox] = useState(false);

  function handleChange(newValue: string) {
    const env = newValue as ZatcaEnvironment;

    if (env === 'sandbox' && value === 'production') {
      // Production -> Sandbox requires confirmation
      setConfirmSandbox(true);
      return;
    }

    if (env === 'production' && !productionReady) {
      // Can't switch to production without completing onboarding
      return;
    }

    onChange(env);
  }

  function confirmSwitchToSandbox() {
    setConfirmSandbox(false);
    onChange('sandbox');
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm font-medium">Environment</p>
        <RadioGroup
          value={value}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={handleChange}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Sandbox */}
          <label
            htmlFor={`${reactId}-zatca-env-sandbox`}
            className={`relative flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all ${
              value === 'sandbox'
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border hover:border-muted-foreground/30'
            }`}>
            <RadioGroupItem
              id={`${reactId}-zatca-env-sandbox`}
              value="sandbox"
              className="mt-0.5"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <TestTube className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <span className="text-sm font-medium">Sandbox</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Test invoices are not submitted to ZATCA
              </p>
            </div>
          </label>

          {/* Production */}
          <label
            htmlFor={`${reactId}-zatca-env-production`}
            className={`relative flex items-start gap-3 rounded-lg border-2 p-4 transition-all ${
              productionReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            } ${
              value === 'production'
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border hover:border-muted-foreground/30'
            }`}>
            <RadioGroupItem
              id={`${reactId}-zatca-env-production`}
              value="production"
              className="mt-0.5"
              disabled={!productionReady}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-green-600" aria-hidden="true" />
                <span className="text-sm font-medium">Production</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Invoices are submitted to ZATCA for clearance
              </p>
              {!productionReady && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Complete onboarding to enable production mode
                </p>
              )}
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Sandbox confirmation dialog */}
      <AlertDialog open={confirmSandbox} onOpenChange={setConfirmSandbox}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Settings className="size-4" />
              Switch to Sandbox
            </AlertDialogTitle>
            <AlertDialogDescription>
              Switch to Sandbox: Production submissions will pause. Pending invoices will remain
              queued. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <AlertDialogAction onClick={confirmSwitchToSandbox}>
              Switch to Sandbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
