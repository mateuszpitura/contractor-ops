'use client';

// CSV import for cost centers — preview + per-row validation + transactional submit.
// Parsing happens client-side so the user can deselect bad rows before sending.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

interface ParsedRow {
  index: number;
  name: string;
  code: string;
  selected: boolean;
  errors: string[];
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

/** Tiny RFC-4180-ish CSV parser. Handles double-quoted fields + commas inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(cell => cell.trim().length > 0));
}

function validate(rows: ParsedRow[]): ParsedRow[] {
  const codeCounts = new Map<string, number>();
  for (const r of rows) {
    const k = r.code.trim().toUpperCase();
    codeCounts.set(k, (codeCounts.get(k) ?? 0) + 1);
  }
  return rows.map(r => {
    const errors: string[] = [];
    if (!r.name.trim()) errors.push('Missing name');
    if (!r.code.trim()) errors.push('Missing code');
    else if (r.code !== r.code.toUpperCase()) errors.push('Code must be uppercase');
    if ((codeCounts.get(r.code.trim().toUpperCase()) ?? 0) > 1) {
      errors.push('Duplicate code in upload');
    }
    return { ...r, errors };
  });
}

interface CostCenterCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CostCenterCsvImportDialog({ open, onOpenChange }: CostCenterCsvImportDialogProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const importMutation = useMutation(
    trpc.organizationDefinitions.costCenter.importCsv.mutationOptions({
      onSuccess: result => {
        toast.success(`Imported ${result.inserted} cost centers`);
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        setRows([]);
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const handleFile = async (file: File) => {
    setFileError(null);
    if (file.size > MAX_BYTES) {
      setFileError('File exceeds 5 MB limit');
      return;
    }
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length === 0) {
      setFileError('CSV appears empty');
      return;
    }
    const header = grid[0]!.map(c => c.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const codeIdx = header.indexOf('code');
    if (nameIdx === -1 || codeIdx === -1) {
      setFileError('Header row must contain `name` and `code`');
      return;
    }
    const dataRows = grid.slice(1);
    if (dataRows.length > MAX_ROWS) {
      setFileError(`Too many rows — max ${MAX_ROWS}`);
      return;
    }
    const parsed: ParsedRow[] = dataRows.map((cells, i) => ({
      index: i + 2, // line number in source CSV (header is line 1)
      name: (cells[nameIdx] ?? '').trim(),
      code: (cells[codeIdx] ?? '').trim(),
      selected: true,
      errors: [],
    }));
    setRows(validate(parsed));
  };

  const selectedValidRows = rows.filter(r => r.selected && r.errors.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import cost centers</DialogTitle>
          <DialogDescription>
            Upload a UTF-8 CSV with a header row of <code>name,code</code>. Max {MAX_ROWS} rows, 5
            MB. All selected rows are imported in a single transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {fileError && (
            <div role="alert" className="text-destructive flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" /> {fileError}
            </div>
          )}
          {rows.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr
                      key={r.index}
                      className={r.errors.length > 0 ? 'bg-destructive/5' : undefined}>
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={e => {
                            setRows(prev =>
                              prev.map(row =>
                                row.index === r.index
                                  ? { ...row, selected: e.target.checked }
                                  : row,
                              ),
                            );
                          }}
                          disabled={r.errors.length > 0}
                        />
                      </td>
                      <td className="px-2 py-1">
                        {r.name || <em className="text-muted-foreground">—</em>}
                      </td>
                      <td className="px-2 py-1 font-mono">
                        {r.code || <em className="text-muted-foreground">—</em>}
                      </td>
                      <td className="px-2 py-1 text-destructive text-xs">{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selectedValidRows.length === 0 || importMutation.isPending}
            onClick={() =>
              importMutation.mutate({
                rows: selectedValidRows.map(r => ({ name: r.name, code: r.code.toUpperCase() })),
              })
            }>
            <FileUp className="mr-2 h-4 w-4" />
            Import {selectedValidRows.length} {selectedValidRows.length === 1 ? 'row' : 'rows'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
