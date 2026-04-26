'use client';

import { ChevronDown, Inbox, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFlag } from '@/components/layout/feature-flag-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { IntakeUploadDialog } from './intake-upload-dialog';

interface ImportSplitButtonProps {
  /**
   * Primary "+ New invoice" click handler (unchanged behaviour from the
   * existing invoices-page button). When the EINVOICE_IMPORT_ENABLED flag
   * is off the component degrades to a plain primary button so users
   * still see the existing primary CTA.
   */
  onCreateNewClick: () => void;
  className?: string;
}

/**
 * Split-button composition for the invoices-page header:
 *   Primary slot → "+ New invoice" (existing behaviour, unchanged)
 *   Secondary slot → DropdownMenu with "Import e-invoice" → opens the
 *                    intake upload dialog.
 *
 * The secondary slot and its DropdownMenu are gated behind the
 * `einvoice.import-enabled` feature flag — when off, the component renders
 * as a single plain primary button for behavioural parity with pre-Phase-62
 * surfaces.
 */
export function ImportSplitButton({ onCreateNewClick, className }: ImportSplitButtonProps) {
  const t = useTranslations('EInvoice.intake');
  const importEnabled = useFlag('einvoice.import-enabled');
  const [uploadOpen, setUploadOpen] = useState(false);

  const primaryLabel = t('splitButtonPrimary');

  if (!importEnabled) {
    return (
      <Button type="button" onClick={onCreateNewClick} className={className}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>{primaryLabel}</span>
      </Button>
    );
  }

  return (
    <>
      <div className={cn('inline-flex rounded-md shadow-sm', className)}>
        <Button
          type="button"
          onClick={onCreateNewClick}
          className="rounded-r-none border-r border-primary-foreground/20">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{primaryLabel}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                className="rounded-l-none px-2"
                aria-label={t('splitButtonImport')}
              />
            }>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setUploadOpen(true)}>
              <Inbox className="h-4 w-4" aria-hidden="true" />
              <span>{t('splitButtonImport')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <IntakeUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}
