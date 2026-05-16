'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, HelpCircle, MoreHorizontal, UserPlus, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tKey, type TranslatorOf } from '@/i18n/typed-keys';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApprovalActions } from '@/hooks/use-approval-actions';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { formatAmount } from '@/lib/format-currency';
import { trpc } from '@/trpc/init';
import { SlaBadge } from '../sla-badge';
import type { ApprovalQueueRow } from './columns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalSidePanelProps {
  step: ApprovalQueueRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  APPROVED: 'bg-green-500/10 text-green-600 dark:text-green-400',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Mini chain tracker
// ---------------------------------------------------------------------------

function MiniChainTracker({ step }: { step: ApprovalQueueRow }) {
  // We show a simplified stepper with step circles based on current step info
  // In a full implementation this would read the flow's steps array
  const currentOrder = step.stepOrder;
  // Estimate total steps as max of currentOrder and 3 (common chain length)
  const totalSteps = Math.max(currentOrder, 1);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const order = i + 1;
        const isCurrent = order === currentOrder;
        const isPast = order < currentOrder;

        let circleClass =
          'h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors';
        if (isCurrent) {
          circleClass += ' bg-primary text-primary-foreground border-primary';
        } else if (isPast) {
          circleClass += ' bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30';
        } else {
          circleClass += ' bg-muted text-muted-foreground border-border';
        }

        return (
          <div key={order} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-3 ${
                  isPast ? 'bg-green-500' : isCurrent ? 'bg-border' : 'bg-border border-dashed'
                }`}
              />
            )}
            <Tooltip>
              <TooltipTrigger
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={props => (
                  <div {...props} className={circleClass}>
                    {/* biome-ignore lint/nursery/noLeakedRender: order is intentionally rendered as text */}
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : order}
                  </div>
                )}
              />
              <TooltipContent>
                {step.name} (Level {order})
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resolved-chain section — fetches the chain config that produced this step
// via `approval.getChain` and lists the resolved approver line-up
// ("this request goes through: User A → Role X").
// ---------------------------------------------------------------------------

type ChainStep = {
  name: string;
  approverUserId: string | null | undefined;
  approverRole: string | null | undefined;
  slaHours: number;
  required: boolean;
};

type ResolvedChain = {
  name: string;
  stepsJson: ChainStep[] | unknown;
};

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
  t: ReturnType<typeof useTranslations<'Approvals'>>;
  tRoles: ReturnType<typeof useTranslations<'Users.roles'>>;
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
  chainConfigId,
  currentStepOrder,
  t,
}: {
  chainConfigId: string;
  currentStepOrder: number;
  t: ReturnType<typeof useTranslations<'Approvals'>>;
}) {
  const tRoles = useTranslations('Users.roles');
  const chainQuery = useQuery({
    ...trpc.approval.getChain.queryOptions({ id: chainConfigId }),
  });

  const chain = chainQuery.data as ResolvedChain | undefined;
  const steps: ChainStep[] = Array.isArray(chain?.stepsJson)
    ? (chain.stepsJson as ChainStep[])
    : [];

  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-muted-foreground">
        {t('sidePanel.resolvedChain')}
      </h4>
      {chainQuery.isLoading ? (
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

// ---------------------------------------------------------------------------
// Extracted overlay sub-components
// ---------------------------------------------------------------------------

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
  t: TranslatorOf<'Approvals'>;
}) {
  const reactId = useId();
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10"
      role="dialog"
      aria-modal="true"
      aria-label={t('clarifyPopover.heading')}
      onClick={onClose}
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      }}>
      <div
        className="w-96 rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
        role="document"
        // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
        onClick={e => e.stopPropagation()}
        // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
        onKeyDown={e => e.stopPropagation()}>
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
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => onCommentChange(e.target.value)}
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
  t: TranslatorOf<'Approvals'>;
}) {
  const reactId = useId();
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10"
      role="dialog"
      aria-modal="true"
      aria-label={t('delegatePopover.heading')}
      onClick={onClose}
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      }}>
      <div
        className="w-96 rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
        role="document"
        // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
        onClick={e => e.stopPropagation()}
        // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
        onKeyDown={e => e.stopPropagation()}>
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => onUserIdChange(e.target.value)}
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => onNoteChange(e.target.value)}
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Side panel for viewing and acting on an approval step.
 * Opens on row click from the approval queue table.
 */
export function ApprovalSidePanel({ step, open, onOpenChange }: ApprovalSidePanelProps) {
  const t = useTranslations('Approvals');
  const locale = useLocale();
  const reactId = useId();

  // Approval action mutations (extracted hook)
  const {
    approve: approveAction,
    reject: rejectAction,
    delegate: delegateAction,
    requestClarification: clarifyAction,
    isPending: actionsPending,
  } = useApprovalActions(step?.id ?? '', () => {
    setRejectComment('');
    setRejectOpen(false);
    setClarifyComment('');
    setClarifyOpen(false);
    setDelegateUserId('');
    setDelegateNote('');
    setDelegateOpen(false);
    onOpenChange(false);
  });

  // Reject UI state
  const [rejectComment, setRejectComment] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  // Clarification UI state
  const [clarifyComment, setClarifyComment] = useState('');
  const [clarifyOpen, setClarifyOpen] = useState(false);

  // Delegate UI state
  const [delegateUserId, setDelegateUserId] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  const [delegateOpen, setDelegateOpen] = useState(false);

  if (!step) return null;

  const invoice = step.invoice;
  const isPending = step.status === 'PENDING';

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
          {/* Status and SLA */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusBadgeColors[step.status] ?? ''}>
              {step.status}
            </Badge>
            <SlaBadge slaDeadline={step.slaDeadline} status={step.status} />
          </div>

          {/* Mini chain tracker */}
          <div className="space-y-2">
            <h4 className="text-[12px] font-medium text-muted-foreground">
              {t('sidePanel.approvalChain')}
            </h4>
            <MiniChainTracker step={step} />
          </div>

          {/* Resolved chain config — fetched via `approval.getChain` so the
              approver can see the full upstream line-up before deciding */}
          {!!step.approvalFlow.chainConfigId && (
            <ResolvedChainSection
              chainConfigId={step.approvalFlow.chainConfigId}
              currentStepOrder={step.stepOrder}
              t={t}
            />
          )}

          {/* Contractor */}
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

          {/* Amounts */}
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

          {/* Dates */}
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

          {/* Approver info */}
          {!!step.approver && (
            <div className="space-y-1">
              <h4 className="text-[12px] font-medium text-muted-foreground">
                {t('sidePanel.approver')}
              </h4>
              <p className="text-sm">{step.approver.name ?? step.approver.email}</p>
            </div>
          )}
        </div>

        {/* Action bar */}
        {isPending && (
          <div className="border-t p-4 space-y-2">
            <div className="flex items-center gap-2">
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button className="flex-1" onClick={() => approveAction()} disabled={actionsPending}>
                <CheckCircle2 className="me-1.5 h-4 w-4" />
                {t('sidePanel.approve')}
              </Button>

              {/* Reject popover */}
              <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
                <PopoverTrigger
                  // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                  render={props => (
                    <Button {...props} variant="destructive" className="flex-1">
                      <XCircle className="me-1.5 h-4 w-4" />
                      {t('sidePanel.reject')}
                    </Button>
                  )}
                />
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
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={e => setRejectComment(e.target.value)}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() => {
                          setRejectOpen(false);
                          setRejectComment('');
                        }}>
                        {t('rejectPopover.dismiss')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={rejectComment.length < 10 || actionsPending}
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() => rejectAction(rejectComment)}>
                        {t('rejectPopover.confirm')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* More dropdown: clarify + delegate */}
            <DropdownMenu>
              <DropdownMenuTrigger
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={props => (
                  <Button {...props} variant="outline" size="sm" className="w-full">
                    <MoreHorizontal className="me-1.5 h-4 w-4" />
                    {t('sidePanel.more')}
                  </Button>
                )}
              />
              <DropdownMenuContent align="end" className="w-56">
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <DropdownMenuItem onClick={() => setClarifyOpen(true)}>
                  <HelpCircle className="me-2 h-4 w-4" />
                  {t('sidePanel.requestClarification')}
                </DropdownMenuItem>
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <DropdownMenuItem onClick={() => setDelegateOpen(true)}>
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
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClose={() => {
          setClarifyOpen(false);
          setClarifyComment('');
        }}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSubmit={() => clarifyAction(clarifyComment)}
        isPending={actionsPending}
        t={t}
      />

      <DelegateOverlay
        open={delegateOpen}
        userId={delegateUserId}
        note={delegateNote}
        onUserIdChange={setDelegateUserId}
        onNoteChange={setDelegateNote}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClose={() => {
          setDelegateOpen(false);
          setDelegateUserId('');
          setDelegateNote('');
        }}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSubmit={() => delegateAction(delegateUserId, delegateNote)}
        isPending={actionsPending}
        t={t}
      />
    </Sheet>
  );
}
