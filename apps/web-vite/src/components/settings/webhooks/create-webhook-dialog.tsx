import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Check, ClipboardCopy, KeyRound, Loader2, Plus, ShieldAlert } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';
import type { WebhookEventValue } from './hooks/use-webhooks-tab.js';
import { useCreateWebhookDialog, WEBHOOK_EVENT_OPTIONS } from './hooks/use-webhooks-tab.js';

interface ShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewProps = ShellProps & ReturnType<typeof useCreateWebhookDialog>;

export function CreateWebhookDialogView({
  open,
  t,
  tCommon,
  id,
  url,
  setUrl,
  isHttp,
  events,
  toggleEvent,
  includePii,
  setIncludePii,
  createdSecret,
  copied,
  createMutation,
  handleCreate,
  handleCopy,
  handleClose,
}: ViewProps) {
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value),
    [setUrl],
  );
  const handleIncludePii = useCallback(
    (checked: boolean) => setIncludePii(checked === true),
    [setIncludePii],
  );
  const handleToggleEvent = useCallback(
    (value: WebhookEventValue) => toggleEvent(value),
    [toggleEvent],
  );

  if (createdSecret) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {t('createdDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('createdDialog.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-xs">{createdSecret}</code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                aria-label={t('createdDialog.copy')}>
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t('createdDialog.securityWarning')}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button />}>{t('createdDialog.done')}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            {t('createDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-url`}>{t('createDialog.urlLabel')}</Label>
            <Input
              id={`${id}-url`}
              placeholder="https://api.example.com/webhooks"
              value={url}
              onChange={handleUrlChange}
              autoFocus
            />
            {isHttp ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-600">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                {t('createDialog.httpWarning')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t('createDialog.eventsLabel')}</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
              {WEBHOOK_EVENT_OPTIONS.map(event => (
                <label
                  key={event}
                  htmlFor={`${id}-event-${event}`}
                  className="flex cursor-pointer items-center gap-2.5 font-mono text-xs">
                  <Checkbox
                    id={`${id}-event-${event}`}
                    checked={events.includes(event)}
                    onCheckedChange={() => handleToggleEvent(event)}
                  />
                  <span>{event}</span>
                </label>
              ))}
            </div>
          </div>

          <label
            htmlFor={`${id}-include-pii`}
            className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              id={`${id}-include-pii`}
              checked={includePii}
              onCheckedChange={handleIncludePii}
            />
            <span>
              {t('createDialog.includePiiLabel')}
              <span className="block text-xs text-muted-foreground">
                {t('createDialog.includePiiHint')}
              </span>
            </span>
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button
            onClick={handleCreate}
            disabled={!url.trim() || events.length === 0 || createMutation.isPending}>
            {!!createMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('createDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateWebhookDialog({ open, onOpenChange }: ShellProps) {
  const dialog = useCreateWebhookDialog({ open, onOpenChange });
  return <CreateWebhookDialogView open={open} onOpenChange={onOpenChange} {...dialog} />;
}
