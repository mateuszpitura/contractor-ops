/**
 * Invoice import split button.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { ChevronDown, Inbox, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import { IntakeUploadDialogContainer } from './intake-upload-dialog-container.js';

export interface ImportSplitButtonViewProps {
  onCreateNewClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function ImportSplitButtonCreateOnly({
  onCreateNewClick,
  className,
  disabled = false,
}: ImportSplitButtonViewProps) {
  const t = useTranslations('EInvoice.intake');
  return (
    <Button type="button" disabled={disabled} onClick={onCreateNewClick} className={className}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span>{t('splitButtonPrimary')}</span>
    </Button>
  );
}

export function ImportSplitButtonView({
  onCreateNewClick,
  className,
  disabled = false,
}: ImportSplitButtonViewProps) {
  const t = useTranslations('EInvoice.intake');
  const [uploadOpen, setUploadOpen] = useState(false);

  const primaryLabel = t('splitButtonPrimary');

  const handleOpenUpload = useCallback(() => {
    setUploadOpen(true);
  }, []);

  return (
    <>
      <div className={cn('inline-flex rounded-md shadow-sm', className)}>
        <Button
          type="button"
          disabled={disabled}
          onClick={onCreateNewClick}
          className="rounded-e-none border-e border-primary-foreground/20">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{primaryLabel}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                disabled={disabled}
                className="rounded-s-none px-2"
                aria-label={t('splitButtonImport')}
              />
            }>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleOpenUpload}>
              <Inbox className="h-4 w-4" aria-hidden="true" />
              <span>{t('splitButtonImport')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <IntakeUploadDialogContainer open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}
