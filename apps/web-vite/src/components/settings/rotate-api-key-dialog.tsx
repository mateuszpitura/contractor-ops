import { Button } from '@contractor-ops/ui/components/shadcn/button';
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
import { Check, ClipboardCopy, Key, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback } from 'react';
import {
  ROTATE_GRACE_OPTIONS,
  useRotateKeyDialog as useRotateKeyDialogHook,
} from './hooks/use-api-keys-tab.js';

interface RotateKeyDialogShellProps {
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type RotateKeyDialogViewProps = Pick<RotateKeyDialogShellProps, 'open'> &
  ReturnType<typeof useRotateKeyDialogHook>;

export function RotateKeyDialogView({
  open,
  t,
  tCommon,
  graceHours,
  setGraceHours,
  rotatedKey,
  copied,
  rotateMutation,
  handleRotate,
  handleCopy,
  handleClose,
}: RotateKeyDialogViewProps) {
  if (rotatedKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-4" />
              {t('rotateDialog.revealTitle')}
            </DialogTitle>
            <DialogDescription>{t('rotateDialog.revealDescription')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-xs">{rotatedKey}</code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                aria-label={t('aria.copyKey')}>
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t('rotateDialog.securityWarning')}</span>
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose render={<Button />}>{t('rotateDialog.doneButton')}</DialogClose>
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
            <RefreshCw className="size-4" />
            {t('rotateDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('rotateDialog.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('rotateDialog.graceLabel')}</legend>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={t('rotateDialog.graceLabel')}>
              {ROTATE_GRACE_OPTIONS.map(hours => (
                <GraceOption
                  key={hours}
                  hours={hours}
                  selected={graceHours === hours}
                  label={t('rotateDialog.graceOption', { hours })}
                  onSelect={setGraceHours}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('rotateDialog.graceExplain', { hours: graceHours })}
            </p>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button onClick={handleRotate} disabled={rotateMutation.isPending}>
            {!!rotateMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('rotateDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GraceOption({
  hours,
  selected,
  label,
  onSelect,
}: {
  hours: number;
  selected: boolean;
  label: string;
  onSelect: (hours: number) => void;
}) {
  const handleClick = useCallback(() => onSelect(hours), [hours, onSelect]);
  return (
    <Button
      type="button"
      role="radio"
      aria-checked={selected}
      variant={selected ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}>
      {label}
    </Button>
  );
}

export function RotateKeyDialog({ keyId, keyName, open, onOpenChange }: RotateKeyDialogShellProps) {
  const dialog = useRotateKeyDialogHook({ keyId, keyName, onOpenChange });
  return <RotateKeyDialogView open={open} {...dialog} />;
}
