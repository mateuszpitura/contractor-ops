/**
 * ChainTracker — visual stepper for an invoice's approval chain.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { CheckCircle2, XCircle } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../lib/avatar-initials.js';
import { cn } from '../../lib/utils.js';
import { SlaBadge } from './sla-badge.js';

interface StepData {
  id: string;
  stepOrder: number;
  name: string;
  status: string;
  approverUserId: string | null;
  approverRole: string | null;
  slaDeadline: string | null;
  actedAt: string | null;
  decision: string | null;
  approver: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

function getStepStyles(status: string, isAfterRejected: boolean) {
  if (isAfterRejected) {
    return {
      circleBg: 'bg-muted',
      circleText: 'text-muted-foreground',
      showIcon: false,
    };
  }

  switch (status) {
    case 'APPROVED':
      return {
        circleBg: 'bg-green-500/10',
        circleText: 'text-green-500',
        showIcon: true,
        icon: CheckCircle2,
      };
    case 'REJECTED':
      return {
        circleBg: 'bg-destructive/10',
        circleText: 'text-destructive',
        showIcon: true,
        icon: XCircle,
      };
    case 'PENDING':
      return {
        circleBg: 'bg-primary',
        circleText: 'text-primary-foreground',
        showIcon: false,
      };
    default:
      return {
        circleBg: 'bg-muted',
        circleText: 'text-muted-foreground',
        showIcon: false,
      };
  }
}

function getConnectorStyle(leftStatus: string, rightStatus: string): string {
  if (leftStatus === 'APPROVED' && rightStatus === 'APPROVED') {
    return 'border-green-500 border-solid';
  }
  if (leftStatus === 'APPROVED' && rightStatus === 'PENDING') {
    return 'border-green-500 border-solid';
  }
  if (leftStatus === 'REJECTED' || rightStatus === 'REJECTED') {
    return 'border-destructive border-solid';
  }
  return 'border-border border-dashed';
}

export function ChainTrackerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <div key={`approver-${i}`} className="flex items-center gap-2">
              {i > 0 && <Skeleton className="h-[2px] w-8 flex-1" />}
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getApproverName(step: StepData) {
  return step.approver?.name ?? step.approverRole ?? `Step ${step.stepOrder + 1}`;
}

function StepCircle({ step, isAfterRejected }: { step: StepData; isAfterRejected: boolean }) {
  const styles = getStepStyles(step.status, isAfterRejected);
  const Icon = styles.showIcon ? styles.icon : null;

  const tooltipLabel = `${step.name} - ${getApproverName(step)}${
    step.slaDeadline ? ` - SLA: ${new Date(step.slaDeadline).toLocaleString()}` : ''
  }`;

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          styles.circleBg,
          styles.circleText,
        )}>
        {Icon ? <Icon className="h-4 w-4" /> : step.stepOrder + 1}
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}

function StepLabel({ step, align }: { step: StepData; align: 'center' | 'start' }) {
  return (
    <div className={cn('flex flex-col gap-1', align === 'center' ? 'items-center' : 'items-start')}>
      <div className="flex items-center gap-1.5">
        {!!step.approver && (
          <Avatar size="sm">
            {!!step.approver.image && <AvatarImage src={step.approver.image} />}
            <AvatarFallback>
              {getAvatarInitials(step.approver.name, step.approver.email)}
            </AvatarFallback>
          </Avatar>
        )}
        <span
          className={cn(
            'truncate text-[12px] text-muted-foreground',
            align === 'center' ? 'max-w-[88px]' : 'max-w-[160px]',
          )}>
          {getApproverName(step)}
        </span>
      </div>

      {step.status === 'PENDING' && !!step.slaDeadline && (
        <SlaBadge slaDeadline={step.slaDeadline} status={step.status} />
      )}
    </div>
  );
}

interface ChainTrackerProps {
  steps: StepData[];
  chainName?: string;
}

export function ChainTracker({ steps, chainName }: ChainTrackerProps) {
  const t = useTranslations('Approvals');

  let rejectedIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].status === 'REJECTED') {
      rejectedIndex = i;
      break;
    }
  }

  const lastIndex = steps.length - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t('chainTracker.heading')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider>
          {/* Desktop: horizontal stepper — connector halves live on the circle row so circles stay aligned regardless of label height */}
          <div className="hidden lg:flex lg:items-start">
            {steps.map((step, idx) => {
              const isAfterRejected = rejectedIndex >= 0 && idx > rejectedIndex;

              return (
                <div key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex w-full items-center">
                    <span
                      className={cn(
                        'h-0 flex-1 border-t-2',
                        idx > 0
                          ? getConnectorStyle(steps[idx - 1].status, step.status)
                          : 'border-transparent',
                      )}
                    />
                    <StepCircle step={step} isAfterRejected={isAfterRejected} />
                    <span
                      className={cn(
                        'h-0 flex-1 border-t-2',
                        idx < lastIndex
                          ? getConnectorStyle(step.status, steps[idx + 1].status)
                          : 'border-transparent',
                      )}
                    />
                  </div>
                  <StepLabel step={step} align="center" />
                </div>
              );
            })}
          </div>

          {/* Mobile: vertical rail — circle + connector share a fixed-width column so the line stays centered under each circle */}
          <ol className="flex flex-col lg:hidden">
            {steps.map((step, idx) => {
              const isAfterRejected = rejectedIndex >= 0 && idx > rejectedIndex;

              return (
                <li key={step.id} className="flex gap-3">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <StepCircle step={step} isAfterRejected={isAfterRejected} />
                    {idx < lastIndex && (
                      <span
                        className={cn(
                          'my-1 w-0 flex-1 border-s-2',
                          getConnectorStyle(step.status, steps[idx + 1].status),
                        )}
                      />
                    )}
                  </div>
                  <div className={cn('min-w-0', idx < lastIndex && 'pb-4')}>
                    <StepLabel step={step} align="start" />
                  </div>
                </li>
              );
            })}
          </ol>
        </TooltipProvider>

        {!!chainName && (
          <p className="text-[12px] text-muted-foreground">
            {t('chainTracker.chain', { chainName })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
