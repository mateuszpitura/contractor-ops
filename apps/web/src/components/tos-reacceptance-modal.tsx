// apps/web/src/components/tos-reacceptance-modal.tsx
//
// Phase 64 · D-30 — Non-dismissible Terms of Service re-acceptance modal.
//
// Shown when the authenticated user's latest TOS ConsentEvent version is
// older than TOS_CURRENT_VERSION (or absent).
//
// Non-dismissible:
//   - ESC key disabled (onEscapeKeyDown)
//   - Click-outside disabled (onInteractOutside)
//   - No close button (showCloseButton={false})
//   - Focus-trap via shadcn Dialog (built-in)
//
// On "I accept": calls trpc.consent.recordToS and dismisses (modal disappears
// because the dashboard layout will find the ConsentEvent on next render).

'use client';

import { SOFTWARE_NOT_LEGAL_ADVICE_EN } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TOS_CURRENT_VERSION } from '@/lib/tos';
import { trpc } from '@/trpc/init';

interface TosReacceptanceModalProps {
  currentVersion: string;
  locale: string;
}

export function TosReacceptanceModal({ currentVersion, locale }: TosReacceptanceModalProps) {
  const t = useTranslations('Legal.TermsModal');
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();

  const recordToS = useMutation(
    trpc.consent.recordToS.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.consent.pathFilter());
        toast.success('Done.');
        setOpen(false);
        // Force a full reload so the dashboard layout re-queries and confirms acceptance.
        window.location.reload();
      },

      onError: err => toast.error(err.message),
    }),
  );

  return (
    <Dialog
      open={open}
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
          <Link
            href={`/${locale}/legal/terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline">
            {t('termsLink')}
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </Link>
        </p>

        <Button
          onClick={() => recordToS.mutate({ version: TOS_CURRENT_VERSION })}
          disabled={recordToS.isPending}
          className="w-full">
          {recordToS.isPending ? t('accepting') : t('accept')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
