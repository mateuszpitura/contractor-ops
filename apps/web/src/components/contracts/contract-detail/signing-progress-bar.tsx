'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, MoreVertical, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';
import { SigningAuditTrail } from './signing-audit-trail';
import { VoidEnvelopeDialog } from './void-envelope-dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Recipient = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  routingOrder: number;
};

type SigningProgressBarProps = {
  envelope: {
    id: string;
    status: string;
    recipients: Recipient[];
  };
};

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ recipient, isCurrent }: { recipient: Recipient; isCurrent: boolean }) {
  const initial = recipient.name.charAt(0).toUpperCase();
  const status = recipient.status;

  if (status === 'SIGNED') {
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-green-600 text-white">
        <Check className="size-4" />
      </div>
    );
  }

  if (status === 'DECLINED') {
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white">
        <X className="size-4" />
      </div>
    );
  }

  if (isCurrent) {
    return (
      <div className="relative flex size-8 items-center justify-center rounded-full border-2 border-primary text-primary">
        <span className="absolute inset-0 animate-pulse rounded-full border-2 border-primary/40" />
        <span className="text-xs font-semibold">{initial}</span>
      </div>
    );
  }

  return (
    <div className="flex size-8 items-center justify-center rounded-full border-2 border-muted text-muted-foreground">
      <span className="text-xs font-semibold">{initial}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connector Line
// ---------------------------------------------------------------------------

function ConnectorLine({ completed }: { completed: boolean }) {
  return <div className={cn('h-0.5 w-6 flex-shrink-0', completed ? 'bg-green-600' : 'bg-muted')} />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal progress indicator for signing envelopes.
 * Shows per-signer step indicators with status-based styling.
 * Per UI-SPEC D-08.
 */
export function SigningProgressBar({ envelope }: SigningProgressBarProps) {
  const t = useTranslations('ContractDetail.signing.progress');
  const tToast = useTranslations('ContractDetail.signing.toast');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient();
  const [auditOpen, setAuditOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const sortedRecipients = [...envelope.recipients].sort((a, b) => a.routingOrder - b.routingOrder);

  const signedCount = sortedRecipients.filter(r => r.status === 'SIGNED').length;
  const totalCount = sortedRecipients.length;
  const allSigned = signedCount === totalCount && totalCount > 0;

  // Find the current signer (first non-signed, non-declined)
  const currentIndex = sortedRecipients.findIndex(r => !['SIGNED', 'DECLINED'].includes(r.status));

  // Resend mutation
  const resendMutation = useMutation(
    trpc.esign.resendToRecipient.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(tToast('reminderSent', { email: variables.recipientEmail }));
        queryClient.invalidateQueries(trpc.esign.pathFilter());
      },
      onError: () => {
        toast.error(tToast('resendFailed'));
      },
    }),
  );

  // Status text
  let statusText = t('signedCount', { signed: signedCount, total: totalCount });
  if (allSigned) {
    statusText = t('allSigned');
  } else if (currentIndex >= 0) {
    const currentRecipient = sortedRecipients[currentIndex];
    if (currentRecipient) {
      statusText = t('waitingFor', { name: currentRecipient.name });
    }
  }

  // Pending recipients for resend
  const pendingRecipients = sortedRecipients.filter(
    r => !['SIGNED', 'DECLINED'].includes(r.status),
  );

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Step indicators */}
          <div className="flex items-center gap-1">
            {sortedRecipients.map((recipient, idx) => (
              <div key={recipient.id} className="flex items-center gap-1">
                {idx > 0 && (
                  <ConnectorLine completed={sortedRecipients[idx - 1]?.status === 'SIGNED'} />
                )}
                <StepIndicator recipient={recipient} isCurrent={idx === currentIndex} />
              </div>
            ))}
          </div>

          {/* Right: Status + actions */}
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{statusText}</p>

            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>
              {t('viewHistory')}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={props => (
                  <Button {...props} variant="ghost" size="icon-sm">
                    <MoreVertical className="size-4" />
                    <span className="sr-only">{tCommon('srOnly.signingActions')}</span>
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                {pendingRecipients.map(r => (
                  <DropdownMenuItem
                    key={r.id}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() =>
                      resendMutation.mutate({
                        envelopeId: envelope.id,
                        recipientEmail: r.email,
                      })
                    }
                    disabled={resendMutation.isPending}>
                    <RefreshCw className="me-2 size-3.5" />
                    {t('resendTo', { name: r.name })}
                  </DropdownMenuItem>
                ))}
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <DropdownMenuItem variant="destructive" onClick={() => setVoidOpen(true)}>
                  <Ban className="me-2 size-3.5" />
                  {t('voidEnvelope')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      <SigningAuditTrail envelopeId={envelope.id} open={auditOpen} onOpenChange={setAuditOpen} />

      <VoidEnvelopeDialog
        envelopeId={envelope.id}
        open={voidOpen}
        onOpenChange={setVoidOpen}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onVoided={() => {
          queryClient.invalidateQueries({
            queryKey: trpc.esign.listEnvelopes.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.contract.getById.queryKey(),
          });
        }}
      />
    </>
  );
}
