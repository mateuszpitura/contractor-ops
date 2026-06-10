import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { AlertTriangle, FileUp } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import type { useCostCenterCsvImport as UseCostCenterCsvImport } from '../hooks/use-cost-center-csv-import.js';
import { useCostCenterCsvImport } from '../hooks/use-cost-center-csv-import.js';

interface ParsedRow {
  index: number;
  name: string;
  code: string;
  selected: boolean;
  errors: string[];
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

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

interface CsvImportRowProps {
  row: ParsedRow;
  onToggle: (index: number, checked: boolean) => void;
}

// memoized: parsed CSV preview can reach MAX_ROWS=1000 rows.
const CsvImportRow = memo(function CsvImportRow({ row, onToggle }: CsvImportRowProps) {
  const handleToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onToggle(row.index, e.target.checked),
    [onToggle, row.index],
  );
  return (
    <TableRow className={row.errors.length > 0 ? 'bg-destructive/5' : undefined}>
      <TableCell>
        <input
          type="checkbox"
          checked={row.selected}
          onChange={handleToggle}
          disabled={row.errors.length > 0}
        />
      </TableCell>
      <TableCell>{row.name || <em className="text-muted-foreground">—</em>}</TableCell>
      <TableCell className="font-mono">
        {row.code || <em className="text-muted-foreground">—</em>}
      </TableCell>
      <TableCell className="text-destructive text-xs">{row.errors.join('; ')}</TableCell>
    </TableRow>
  );
});

interface CostCenterCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvImport: ReturnType<typeof UseCostCenterCsvImport>;
}

export function CostCenterCsvImportDialog({
  open,
  onOpenChange,
  csvImport,
}: CostCenterCsvImportDialogProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const { importMutation, importRows } = csvImport;

  useEffect(() => {
    if (!open) {
      setRows([]);
      setFileError(null);
    }
  }, [open]);

  const handleFile = useCallback(async (file: File) => {
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
    const header = grid[0]?.map(c => c.trim().toLowerCase());
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
      index: i + 2,
      name: (cells[nameIdx] ?? '').trim(),
      code: (cells[codeIdx] ?? '').trim(),
      selected: true,
      errors: [],
    }));
    setRows(validate(parsed));
  }, []);

  const selectedValidRows = rows.filter(r => r.selected && r.errors.length === 0);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleImport = useCallback(
    () => importRows(selectedValidRows.map(r => ({ name: r.name, code: r.code.toUpperCase() }))),
    [importRows, selectedValidRows],
  );
  const handleRowToggle = useCallback((index: number, checked: boolean) => {
    setRows(prev => prev.map(row => (row.index === index ? { ...row, selected: checked } : row)));
  }, []);

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
        <DialogBody className="space-y-4 py-2">
          <Input type="file" accept=".csv,text/csv" onChange={handleFileInputChange} />
          {fileError && (
            <div role="alert" className="text-destructive flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" /> {fileError}
            </div>
          )}
          {rows.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <CsvImportRow key={r.index} row={r} onToggle={handleRowToggle} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            disabled={selectedValidRows.length === 0 || importMutation.isPending}
            onClick={handleImport}>
            <FileUp className="me-2 h-4 w-4" />
            Import {selectedValidRows.length} {selectedValidRows.length === 1 ? 'row' : 'rows'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CostCenterCsvImportDialogWiredProps = Omit<CostCenterCsvImportDialogProps, 'csvImport'>;

export function CostCenterCsvImportDialogWired(props: CostCenterCsvImportDialogWiredProps) {
  const csvImport = useCostCenterCsvImport(props.onOpenChange);
  return <CostCenterCsvImportDialog {...props} csvImport={csvImport} />;
}
