import { DropZoneSurface } from '@contractor-ops/ui/components/origin/drop-zone-surface';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import type * as React from 'react';
import type { ReactNode, RefObject } from 'react';
import { useCallback, useState } from 'react';

import type { TranslateFn } from '../../i18n/useTranslations.js';
import { BankStatementMatchesDataTable } from './bank-statement/data-table.js';
import type { BankStatementMatchResult } from './hooks/use-bank-statement-import.js';

function preventDefault(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
}

interface BankStatementDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAttempt: () => void;
  t: TranslateFn;
  children: ReactNode;
}

export function BankStatementDialogShell({
  open,
  onOpenChange: _onOpenChange,
  onCloseAttempt,
  t,
  children,
}: BankStatementDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onCloseAttempt}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            {t('bankStatement.title')}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

interface UploadStepProps {
  t: TranslateFn;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function BankStatementUploadStep({ t, fileInputRef, onFileSelect }: UploadStepProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const handleZoneClick = useCallback(() => fileInputRef.current?.click(), [fileInputRef]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [fileInputRef],
  );
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    preventDefault(e);
    setIsDragActive(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragActive(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file && fileInputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    [fileInputRef],
  );

  return (
    <div className="space-y-4">
      <DropZoneSurface
        role="button"
        tabIndex={0}
        aria-label={t('bankStatement.dropzoneText')}
        onClick={handleZoneClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDragActive={isDragActive}
        label={t('bankStatement.dropzoneText')}
        description={t('bankStatement.dropzoneFormats')}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mt940,.csv"
          className="sr-only"
          onChange={onFileSelect}
        />
      </DropZoneSurface>
    </div>
  );
}

export function BankStatementParsingStep({ t }: { t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t('bankStatement.parsingProgress')}</p>
      <Progress value={60} className="w-48" />
    </div>
  );
}

interface ErrorStepProps {
  t: TranslateFn;
  parseError: string;
  onRetry: () => void;
}

export function BankStatementErrorStep({ t, parseError, onRetry }: ErrorStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground text-center">{parseError}</p>
      <button type="button" className="text-sm text-primary hover:underline" onClick={onRetry}>
        {t('bankStatement.tryAgain')}
      </button>
    </div>
  );
}

interface ResultsStepProps {
  t: TranslateFn;
  matches: BankStatementMatchResult[];
  selectedMatches: Set<number>;
  matchedCount: number;
  totalCount: number;
  selectedCount: number;
  onToggleMatch: (index: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirmPending: boolean;
}

export function BankStatementResultsStep({
  t,
  matches,
  selectedMatches,
  matchedCount,
  totalCount,
  selectedCount,
  onToggleMatch,
  onCancel,
  onConfirm,
  isConfirmPending,
}: ResultsStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('bankStatement.matchedCount', {
          matched: matchedCount,
          total: totalCount,
        })}
      </p>

      <BankStatementMatchesDataTable
        t={t}
        matches={matches}
        selectedMatches={selectedMatches}
        onToggleMatch={onToggleMatch}
      />

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onCancel}>
          {t('bankStatement.cancel')}
        </Button>
        <Button onClick={onConfirm} disabled={selectedCount === 0 || isConfirmPending}>
          {isConfirmPending ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t('confirmMatches', { count: selectedCount })}
        </Button>
      </div>
    </div>
  );
}
