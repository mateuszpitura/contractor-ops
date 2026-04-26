'use client';

import { useMutation } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplianceCsidProps {
  onSuccess: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Status Item
// ---------------------------------------------------------------------------

interface StatusItemProps {
  label: string;
  status: 'pending' | 'loading' | 'done';
}

function StatusItem({ label, status }: StatusItemProps) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {status === 'loading' && (
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Loading" />
      )}
      {status === 'done' && <Check className="h-4 w-4 text-green-600" aria-label="Complete" />}
      {status === 'pending' && (
        <span
          className="h-4 w-4 rounded-full border-2 border-muted-foreground/30"
          role="img"
          aria-label="Pending"
        />
      )}
      <span className={status === 'done' ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Compliance CSID — Step 3
// ---------------------------------------------------------------------------

/**
 * Step 3 of ZATCA onboarding wizard.
 * Submits CSR to ZATCA for compliance certificate.
 * Shows animated status list: spinner -> checkmarks.
 * Next enabled only after all statuses pass.
 */
export function ComplianceCsid({ onSuccess, onBack }: ComplianceCsidProps) {
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'storing' | 'done'>('idle');

  const requestMutation = useMutation({
    ...zatcaTrpc.requestComplianceCsid.mutationOptions(),
    onMutate: () => {
      setPhase('submitting');
    },
    onSuccess: () => {
      setPhase('storing');
      // Simulate brief storage confirmation
      setTimeout(() => {
        setPhase('done');
        toast.success('Compliance CSID received');
      }, 500);
    },
    onError: (error: Error) => {
      setPhase('idle');
      toast.error(error.message || 'Failed to request compliance CSID');
    },
  });

  const csrSubmitted = phase === 'submitting' || phase === 'storing' || phase === 'done';
  const csidReceived = phase === 'storing' || phase === 'done';
  const certStored = phase === 'done';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Step 3 of 5: Request Compliance Certificate</h3>
        <p className="text-sm text-muted-foreground">
          Your CSR will be submitted to ZATCA to obtain a compliance certificate for testing.
        </p>
      </div>

      {phase === 'idle' && (
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => (requestMutation.mutate as () => void)()}
          disabled={requestMutation.isPending}>
          {!!requestMutation.isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          Request Compliance CSID
        </Button>
      )}

      {/* Status list */}
      {!!csrSubmitted && (
        <ol
          className="space-y-3 rounded-lg border bg-muted/20 p-4"
          aria-label="Compliance CSID progress"
          aria-live="polite">
          <StatusItem
            label="Submitting CSR to ZATCA..."
            status={csidReceived ? 'done' : 'loading'}
          />
          <StatusItem label="Compliance CSID received" status={csidReceived ? 'done' : 'pending'} />
          <StatusItem
            label="Certificate stored securely"
            status={certStored ? 'done' : csidReceived ? 'loading' : 'pending'}
          />
        </ol>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSuccess} disabled={!certStored}>
          Next
        </Button>
      </div>
    </div>
  );
}
