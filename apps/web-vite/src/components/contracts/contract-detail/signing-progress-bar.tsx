import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Ban, Check, MoreVertical, RefreshCw, X } from 'lucide-react';
import { memo, useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import type { useSigningProgressBar } from '../hooks/use-signing-progress-bar.js';

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
  signing: ReturnType<typeof useSigningProgressBar>;
  auditOpen: boolean;
  onAuditOpenChange: (open: boolean) => void;
  onVoidOpen: () => void;
};

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

function ConnectorLine({ completed }: { completed: boolean }) {
  return <div className={cn('h-0.5 w-6 flex-shrink-0', completed ? 'bg-green-600' : 'bg-muted')} />;
}

function ResendMenuItem({
  email,
  disabled,
  onResend,
  label,
}: {
  email: string;
  disabled: boolean;
  onResend: (email: string) => void;
  label: string;
}) {
  const handleClick = useCallback(() => onResend(email), [email, onResend]);
  return (
    <DropdownMenuItem onClick={handleClick} disabled={disabled}>
      <RefreshCw className="me-2 size-3.5" />
      {label}
    </DropdownMenuItem>
  );
}

const ResendMenuItemMemo = memo(ResendMenuItem);

/**
 * Horizontal progress indicator for signing envelopes.
 */
export function SigningProgressBar({
  envelope,
  signing,
  onAuditOpenChange,
  onVoidOpen,
}: SigningProgressBarProps) {
  const t = useTranslations('ContractDetail.signing.progress');
  const tCommon = useTranslations('Common');

  const sortedRecipients = [...envelope.recipients].sort((a, b) => a.routingOrder - b.routingOrder);

  const signedCount = sortedRecipients.filter(r => r.status === 'SIGNED').length;
  const totalCount = sortedRecipients.length;
  const allSigned = signedCount === totalCount && totalCount > 0;

  const currentIndex = sortedRecipients.findIndex(r => !['SIGNED', 'DECLINED'].includes(r.status));

  let statusText = t('signedCount', { signed: signedCount, total: totalCount });
  if (allSigned) {
    statusText = t('allSigned');
  } else if (currentIndex >= 0) {
    const currentRecipient = sortedRecipients[currentIndex];
    if (currentRecipient) {
      statusText = t('waitingFor', { name: currentRecipient.name });
    }
  }

  const pendingRecipients = sortedRecipients.filter(
    r => !['SIGNED', 'DECLINED'].includes(r.status),
  );

  const handleOpenAudit = useCallback(() => onAuditOpenChange(true), [onAuditOpenChange]);
  const renderActionsTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="ghost" size="icon-sm">
        <MoreVertical className="size-4" />
        <span className="sr-only">{tCommon('srOnly.signingActions')}</span>
      </Button>
    ),
    [tCommon],
  );

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{statusText}</p>

          <Button variant="ghost" size="sm" onClick={handleOpenAudit}>
            {t('viewHistory')}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={renderActionsTrigger} />
            <DropdownMenuContent align="end">
              {pendingRecipients.map(r => (
                <ResendMenuItemMemo
                  key={r.id}
                  email={r.email}
                  disabled={signing.isResendPending}
                  onResend={signing.resendToRecipient}
                  label={t('resendTo', { name: r.name })}
                />
              ))}
              <DropdownMenuItem variant="destructive" onClick={onVoidOpen}>
                <Ban className="me-2 size-3.5" />
                {t('voidEnvelope')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
