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

import type { TranslateFn } from '../../i18n/useTranslations.js';
import type { useBankStatementImport } from './hooks/use-bank-statement-import.js';

interface BankStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: TranslateFn;
  importFlow: ReturnType<typeof useBankStatementImport>;
}

export function BankStatementDialog({
  open,
  onOpenChange,
  t,
  importFlow,
}: BankStatementDialogProps) {
  const {
    fileInputRef,
    step,
    parseError,
    matches,
    selectedMatches,
    handleClose,
    handleFileSelect,
    toggleMatch,
    handleConfirm,
    handleRetry,
    isConfirmPending,
  } = importFlow;

  const matchedCount = matches.filter(m => m.matched).length;
  const totalCount = matches.length;
  const selectedCount = selectedMatches.size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            {t('bankStatement.title')}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors w-full"
              aria-label={t('bankStatement.dropzoneText')}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
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
              onChange={handleFileSelect}
            />
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('bankStatement.parsingProgress')}</p>
            <Progress value={60} className="w-48" />
          </div>
        )}

        {step === 'results' && (
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
                            onCheckedChange={() => toggleMatch(match.transactionIndex)}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {new Intl.NumberFormat('pl-PL', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(match.amountMinor / 100)}
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
                          {match.matched
                            ? t('bankStatement.matched')
                            : t('bankStatement.unmatched')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{match.invoiceNumber ?? '\u2014'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" onClick={handleClose}>
                {t('bankStatement.cancel')}
              </Button>
              <Button onClick={handleConfirm} disabled={selectedCount === 0 || isConfirmPending}>
                {isConfirmPending ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {t('confirmMatches', { count: selectedCount })}
              </Button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{parseError}</p>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={handleRetry}>
              {t('bankStatement.tryAgain')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
