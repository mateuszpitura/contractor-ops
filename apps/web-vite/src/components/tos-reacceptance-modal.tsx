import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { SOFTWARE_NOT_LEGAL_ADVICE_EN } from '@contractor-ops/validators';
import { ExternalLink, ScrollText } from 'lucide-react';
import { Link } from '../i18n/navigation.js';
import { useTranslations } from '../i18n/useTranslations.js';

/**
 * Presentational ToS re-acceptance modal. Always rendered as an open,
 * non-dismissible dialog — visibility (mount/unmount) is decided by
 * `TosReacceptanceModalContainer` from the hook's `open` flag.
 */
export interface TosReacceptanceModalViewProps {
  currentVersion: string;
  isPending: boolean;
  onAccept: () => void;
}

export function TosReacceptanceModalView({
  currentVersion,
  isPending,
  onAccept,
}: TosReacceptanceModalViewProps) {
  const t = useTranslations('Legal.TermsModal');

  return (
    <Dialog
      open
      onOpenChange={() => {
        /* Modal is non-dismissible — block external close attempts */
      }}>
      <DialogContent
        className="max-w-lg"
        showCloseButton={false}
        onEscapeKeyDown={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description', { version: currentVersion })}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 rounded-md border p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {SOFTWARE_NOT_LEGAL_ADVICE_EN}
          </p>
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          {t('readFull')}{' '}
          <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline">
            {t('termsLink')}
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </Link>
        </p>

        <Button onClick={onAccept} disabled={isPending} className="w-full">
          {isPending ? t('accepting') : t('accept')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
