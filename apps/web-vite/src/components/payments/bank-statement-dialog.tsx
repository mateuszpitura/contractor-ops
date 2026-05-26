import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import type { TranslateFn } from '../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../lib/format-currency.js';
import type { BankStatementMatchResult } from './hooks/use-bank-statement-import.js';

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
  return (
    <div className="space-y-4">
      <button
        type="button"
        className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors w-full"
        aria-label={t('bankStatement.dropzoneText')}
        // biome-ignore lint/nursery/noJsxPropsBind: ref callback in JSX
        onClick={() => fileInputRef.current?.click()}
        // biome-ignore lint/nursery/noJsxPropsBind: inline drag handler
        onDragOver={e => e.preventDefault()}
        // biome-ignore lint/nursery/noJsxPropsBind: inline drop handler
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && fileInputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInputRef.current.files = dt.files;
            fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }}>
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {t('bankStatement.dropzoneText')}
        </p>
        <p className="text-xs text-muted-foreground">{t('bankStatement.dropzoneFormats')}</p>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mt940,.csv"
        className="hidden"
        onChange={onFileSelect}
      />
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

      <div className="rounded-xl border bg-background max-h-[300px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="text-xs">{t('bankStatement.colAmount')}</TableHead>
              <TableHead className="text-xs">{t('bankStatement.colIban')}</TableHead>
              <TableHead className="text-xs">{t('bankStatement.colStatus')}</TableHead>
              <TableHead className="text-xs">{t('bankStatement.colInvoice')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map(match => (
              <TableRow
                key={match.transactionIndex}
                className={match.matched ? '' : 'bg-yellow-500/10'}>
                <TableCell>
                  {match.matched ? (
                    <Checkbox
                      checked={selectedMatches.has(match.transactionIndex)}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX
                      onCheckedChange={() => onToggleMatch(match.transactionIndex)}
                    />
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {formatMinorUnits(match.amountMinor, null, 'pl-PL')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  ****{match.iban.slice(-4)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      match.matched
                        ? 'bg-green-500/10 text-green-800 dark:text-green-400'
                        : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                    }>
                    {match.matched ? t('bankStatement.matched') : t('bankStatement.unmatched')}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{match.invoiceNumber ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
