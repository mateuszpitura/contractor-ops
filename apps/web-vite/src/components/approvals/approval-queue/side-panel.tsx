import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { CheckCircle2, HelpCircle, MoreHorizontal, UserPlus, XCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';

function stopPropagationClick(e: React.MouseEvent) {
  e.stopPropagation();
}
function stopPropagationKeyDown(e: React.KeyboardEvent) {
  e.stopPropagation();
}

import type { useApprovalActions } from '../../../hooks/use-approval-actions.js';
import { Link, useLocale } from '../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { formatAmount } from '../../../lib/format-currency.js';
import type { ApprovalChainStep, ResolvedApprovalChain } from '../hooks/use-approval-chain.js';
import { SlaBadge } from '../sla-badge.js';
import type { ApprovalQueueRow } from './columns.js';

export interface ApprovalSidePanelProps {
  step: ApprovalQueueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolvedChain?: {
    chain: ResolvedApprovalChain | undefined;
    steps: ApprovalChainStep[];
    isLoading: boolean;
  };
  actions: ReturnType<typeof useApprovalActions>;
}

const statusBadgeColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  APPROVED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
};

function ChainStepCircle({
  order,
  isCurrent,
  isPast,
  stepName,
}: {
  order: number;
  isCurrent: boolean;
  isPast: boolean;
  stepName: string;
}) {
  let circleClass =
    'h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors';
  if (isCurrent) {
    circleClass += ' bg-primary text-primary-foreground border-primary';
  } else if (isPast) {
    circleClass += ' bg-green-500/10 text-green-800 dark:text-green-400 border-green-500/30';
  } else {
    circleClass += ' bg-muted text-muted-foreground border-border';
  }

  const renderTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props} className={circleClass}>
        {/* biome-ignore lint/nursery/noLeakedRender: order is intentionally rendered as text */}
        {isPast ? <CheckCircle2 className="h-4 w-4" /> : order}
      </div>
    ),
    [circleClass, isPast, order],
  );

  return (
    <div className="flex items-center gap-1">
      {order > 1 && (
        <div
          className={`h-0.5 w-3 ${
            isPast ? 'bg-green-500' : isCurrent ? 'bg-border' : 'bg-border border-dashed'
          }`}
        />
      )}
      <Tooltip>
        <TooltipTrigger render={renderTrigger} />
        <TooltipContent>
          {stepName} (Level {order})
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function MiniChainTracker({ step }: { step: ApprovalQueueRow }) {
  const currentOrder = step.stepOrder;
  const totalSteps = Math.max(currentOrder, 1);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const order = i + 1;
        return (
          <ChainStepCircle
            key={order}
            order={order}
            isCurrent={order === currentOrder}
            isPast={order < currentOrder}
            stepName={step.name}
          />
        );
      })}
    </div>
  );
}

type ChainStep = ApprovalChainStep;

type ResolvedChain = ResolvedApprovalChain;

function ChainStepRow({
  step,
  order,
  isCurrent,
  isPast,
  t,
  tRoles,
}: {
  step: ChainStep;
  order: number;
  isCurrent: boolean;
  isPast: boolean;
  t: LooseTranslator;
  tRoles: LooseTranslator;
}) {
  const approverLabel = step.approverUserId
    ? t('sidePanel.specificUser')
    : step.approverRole
      ? tKey(tRoles, enumKey(step.approverRole))
      : t('sidePanel.unassigned');
  const stateClass = isCurrent
    ? 'text-foreground font-medium'
    : isPast
      ? 'line-through opacity-70'
      : '';
  return (
    <li className={`flex items-baseline gap-1.5 ${stateClass}`}>
      <span className="tabular-nums">{order}.</span>
      <span className="flex-1">{step.name}</span>
      <span className="text-[12px]">&middot; {approverLabel}</span>
    </li>
  );
}

function ResolvedChainSection({
  chain,
  steps,
  isLoading,
  currentStepOrder,
  t,
}: {
  chain: ResolvedChain | undefined;
  steps: ChainStep[];
  isLoading: boolean;
  currentStepOrder: number;
  t: LooseTranslator;
}) {
  const tRoles = useTranslations('Users.roles');

  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-muted-foreground">
        {t('sidePanel.resolvedChain')}
      </h4>
      {isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : chain ? (
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-foreground">{chain.name}</p>
          <ol className="space-y-1 text-[13px] text-muted-foreground">
            {steps.map((s, i) => {
              const order = i + 1;
              return (
                <ChainStepRow
                  key={`${s.name}-${order}`}
                  step={s}
                  order={order}
                  isCurrent={order === currentStepOrder}
                  isPast={order < currentStepOrder}
                  t={t}
                  tRoles={tRoles}
                />
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t('sidePanel.resolvedChainEmpty')}</p>
      )}
    </div>
  );
}

function ClarifyOverlay({
  open: isOpen,
  comment,
  onCommentChange,
  onClose,
  onSubmit,
  isPending,
  t,
}: {
  open: boolean;
  comment: string;
  onCommentChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  t: LooseTranslator;
}) {
  const reactId = useId();
  const handleEscape = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onCommentChange(e.target.value),
    [onCommentChange],
  );

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10"
      role="dialog"
      aria-modal="true"
      aria-label={t('clarifyPopover.heading')}
      onClick={onClose}
      onKeyDown={handleEscape}>
      <div
        className="w-96 rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
        role="document"
        onClick={stopPropagationClick}
        onKeyDown={stopPropagationKeyDown}>
        <h4 className="font-medium text-sm mb-3">{t('clarifyPopover.heading')}</h4>
        <div className="space-y-1.5 mb-3">
          <label
            htmlFor={`${reactId}-clarify-comment`}
            className="text-[12px] text-muted-foreground">
            {t('clarifyPopover.commentLabel')}
          </label>
          <Textarea
            id={`${reactId}-clarify-comment`}
            value={comment}
            onChange={handleCommentChange}
            placeholder={t('clarifyPopover.commentPlaceholder')}
            className="min-h-[80px]"
          />
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('clarifyPopover.dismiss')}
          </Button>
          <Button size="sm" disabled={comment.length < 1 || isPending} onClick={onSubmit}>
            {t('clarifyPopover.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DelegateOverlay({
  open: isOpen,
  userId,
  note,
  onUserIdChange,
  onNoteChange,
  onClose,
  onSubmit,
  isPending,
  t,
}: {
  open: boolean;
  userId: string;
  note: string;
  onUserIdChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  t: LooseTranslator;
}) {
  const reactId = useId();
  const handleEscape = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );
  const handleUserIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUserIdChange(e.target.value),
    [onUserIdChange],
  );
  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange(e.target.value),
    [onNoteChange],
  );

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10"
      role="dialog"
      aria-modal="true"
      aria-label={t('delegatePopover.heading')}
      onClick={onClose}
      onKeyDown={handleEscape}>
      <div
        className="w-96 rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
        role="document"
        onClick={stopPropagationClick}
        onKeyDown={stopPropagationKeyDown}>
        <h4 className="font-medium text-sm mb-3">{t('delegatePopover.heading')}</h4>
        <div className="space-y-3 mb-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`${reactId}-delegate-user-id`}
              className="text-[12px] text-muted-foreground">
              {t('delegatePopover.userLabel')}
            </label>
            <Input
              id={`${reactId}-delegate-user-id`}
              value={userId}
              onChange={handleUserIdChange}
              placeholder={t('delegatePopover.userPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${reactId}-delegate-note`}
              className="text-[12px] text-muted-foreground">
              {t('delegatePopover.noteLabel')}
            </label>
            <Textarea
              id={`${reactId}-delegate-note`}
              value={note}
              onChange={handleNoteChange}
              placeholder={t('delegatePopover.notePlaceholder')}
              className="min-h-[60px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('delegatePopover.dismiss')}
          </Button>
          <Button size="sm" disabled={!userId.trim() || isPending} onClick={onSubmit}>
            {t('delegatePopover.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalSidePanelView({
  step,
  open,
  onOpenChange,
  resolvedChain,
  actions,
}: ApprovalSidePanelProps) {
  const t = useTranslations('Approvals');
  const locale = useLocale();
  const reactId = useId();

  const {
    approve: approveAction,
    reject: rejectAction,
    delegate: delegateAction,
    requestClarification: clarifyAction,
    isPending: actionsPending,
  } = actions;

  const [rejectComment, setRejectComment] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [clarifyComment, setClarifyComment] = useState('');
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [delegateUserId, setDelegateUserId] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  const [delegateOpen, setDelegateOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setRejectComment('');
      setRejectOpen(false);
      setClarifyComment('');
      setClarifyOpen(false);
      setDelegateUserId('');
      setDelegateNote('');
      setDelegateOpen(false);
    }
  }, [open]);

  const invoice = step.invoice;
  const isPending = step.status === 'PENDING';

  const handleApprove = useCallback(() => approveAction(), [approveAction]);
  const handleRejectCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectComment(e.target.value),
    [],
  );
  const handleRejectDismiss = useCallback(() => {
    setRejectOpen(false);
    setRejectComment('');
  }, []);
  const handleRejectConfirm = useCallback(
    () => rejectAction(rejectComment),
    [rejectAction, rejectComment],
  );
  const handleOpenClarify = useCallback(() => setClarifyOpen(true), []);
  const handleOpenDelegate = useCallback(() => setDelegateOpen(true), []);
  const handleClarifyClose = useCallback(() => {
    setClarifyOpen(false);
    setClarifyComment('');
  }, []);
  const handleClarifySubmit = useCallback(
    () => clarifyAction(clarifyComment),
    [clarifyAction, clarifyComment],
  );
  const handleDelegateClose = useCallback(() => {
    setDelegateOpen(false);
    setDelegateUserId('');
    setDelegateNote('');
  }, []);
  const handleDelegateSubmit = useCallback(
    () => delegateAction(delegateUserId, delegateNote),
    [delegateAction, delegateUserId, delegateNote],
  );

  const renderRejectTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="destructive" className="flex-1">
        <XCircle className="me-1.5 h-4 w-4" />
        {t('sidePanel.reject')}
      </Button>
    ),
    [t],
  );
  const renderMoreTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="sm" className="w-full">
        <MoreHorizontal className="me-1.5 h-4 w-4" />
        {t('sidePanel.more')}
      </Button>
    ),
    [t],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-xl">
            {invoice?.invoiceNumber ?? t('sidePanel.unknownInvoice')}
          </SheetTitle>
          <SheetDescription className="sr-only">{t('sidePanel.description')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusBadgeColors[step.status] ?? ''}>
              {step.status}
            </Badge>
            <SlaBadge slaDeadline={step.slaDeadline} status={step.status} />
          </div>

          <div className="space-y-2">
            <h4 className="text-[12px] font-medium text-muted-foreground">
              {t('sidePanel.approvalChain')}
            </h4>
            <MiniChainTracker step={step} />
          </div>

          {!!step.approvalFlow.chainConfigId && resolvedChain && (
            <ResolvedChainSection
              chain={resolvedChain.chain}
              steps={resolvedChain.steps}
              isLoading={resolvedChain.isLoading}
              currentStepOrder={step.stepOrder}
              t={t}
            />
          )}

          {!!invoice?.contractor && (
            <div className="space-y-1">
              <h4 className="text-[12px] font-medium text-muted-foreground">
                {t('sidePanel.contractor')}
              </h4>
              <Link
                href={`/contractors/${invoice.contractor.id}`}
                className="text-sm text-primary hover:underline">
                {invoice.contractor.legalName}
              </Link>
            </div>
          )}

          {!!invoice && (
            <div className="space-y-1">
              <h4 className="text-[12px] font-medium text-muted-foreground">
                {t('sidePanel.amount')}
              </h4>
              <p className="font-mono text-sm tabular-nums">
                {formatAmount(invoice.totalMinor, invoice.currency, locale)}
              </p>
            </div>
          )}

          {!!invoice && (
            <div className="space-y-1">
              <h4 className="text-[12px] font-medium text-muted-foreground">
                {t('sidePanel.submitted')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {new Date(invoice.createdAt).toLocaleDateString('pl-PL', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}

          {!!step.approver && (
            <div className="space-y-1">
              <h4 className="text-[12px] font-medium text-muted-foreground">
                {t('sidePanel.approver')}
              </h4>
              <p className="text-sm">{step.approver.name ?? step.approver.email}</p>
            </div>
          )}
        </div>

        {isPending && (
          <div className="border-t p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Button className="flex-1" onClick={handleApprove} disabled={actionsPending}>
                <CheckCircle2 className="me-1.5 h-4 w-4" />
                {t('sidePanel.approve')}
              </Button>

              <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
                <PopoverTrigger render={renderRejectTrigger} />
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">{t('rejectPopover.heading')}</h4>
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`${reactId}-side-reject-comment`}
                        className="text-[12px] text-muted-foreground">
                        {t('rejectPopover.commentLabel')}
                      </label>
                      <Textarea
                        id={`${reactId}-side-reject-comment`}
                        value={rejectComment}
                        onChange={handleRejectCommentChange}
                        placeholder={t('rejectPopover.commentPlaceholder')}
                        className="min-h-[80px]"
                      />
                      {rejectComment.length > 0 && rejectComment.length < 10 && (
                        <p className="text-[12px] text-destructive">
                          {t('rejectPopover.minChars')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={handleRejectDismiss}>
                        {t('rejectPopover.dismiss')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={rejectComment.length < 10 || actionsPending}
                        onClick={handleRejectConfirm}>
                        {t('rejectPopover.confirm')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger render={renderMoreTrigger} />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleOpenClarify}>
                  <HelpCircle className="me-2 h-4 w-4" />
                  {t('sidePanel.requestClarification')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenDelegate}>
                  <UserPlus className="me-2 h-4 w-4" />
                  {t('sidePanel.delegateApproval')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SheetContent>

      <ClarifyOverlay
        open={clarifyOpen}
        comment={clarifyComment}
        onCommentChange={setClarifyComment}
        onClose={handleClarifyClose}
        onSubmit={handleClarifySubmit}
        isPending={actionsPending}
        t={t}
      />

      <DelegateOverlay
        open={delegateOpen}
        userId={delegateUserId}
        note={delegateNote}
        onUserIdChange={setDelegateUserId}
        onNoteChange={setDelegateNote}
        onClose={handleDelegateClose}
        onSubmit={handleDelegateSubmit}
        isPending={actionsPending}
        t={t}
      />
    </Sheet>
  );
}
