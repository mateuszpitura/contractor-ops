/**
 * Structured list renderer — replaces JSON debug dumps on Step 10 anchor
 * pages while full DataTable ports land in later batches.
 */

type Row = Record<string, unknown>;

function extractRows(data: unknown): Row[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data.filter((r): r is Row => typeof r === 'object' && r !== null);
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of [
      'items',
      'rows',
      'data',
      'results',
      'contractors',
      'invoices',
      'payments',
      'contracts',
      'equipment',
      'approvals',
      'documents',
    ]) {
      const candidate = obj[key];
      if (Array.isArray(candidate)) {
        return candidate.filter((r): r is Row => typeof r === 'object' && r !== null);
      }
    }
    if ('total' in obj || 'page' in obj) return [];
    return [obj];
  }
  return [];
}

function pickColumns(rows: Row[]): string[] {
  if (rows.length === 0) return [];
  const keys = new Set<string>();
  for (const row of rows.slice(0, 5)) {
    for (const key of Object.keys(row)) {
      if (key === 'metadata' || key === 'credentialsRef') continue;
      const val = row[key];
      if (val != null && typeof val === 'object' && !Array.isArray(val)) continue;
      keys.add(key);
      if (keys.size >= 6) break;
    }
    if (keys.size >= 6) break;
  }
  return [...keys];
}

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.length}]`;
  return JSON.stringify(value);
}

export interface ListDataViewProps {
  data: unknown;
  emptyLabel: string;
  totalLabel?: string;
}

export function ListDataView({ data, emptyLabel, totalLabel }: ListDataViewProps) {
  const rows = extractRows(data);
  const total =
    typeof data === 'object' && data !== null && 'total' in (data as Record<string, unknown>)
      ? (data as { total?: number }).total
      : rows.length;
  const columns = pickColumns(rows);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {totalLabel != null && (
        <p className="text-sm text-muted-foreground">
          {totalLabel}: {total ?? rows.length}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {columns.map(col => (
                <th key={col} scope="col" className="px-4 py-2 font-medium text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, index) => (
              <tr
                key={(row.id as string | undefined) ?? index}
                className="border-b border-border/60 last:border-0">
                {columns.map(col => (
                  <td key={col} className="max-w-[16rem] truncate px-4 py-2">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 50 && (
        <p className="text-xs text-muted-foreground">
          Showing 50 of {rows.length} rows — full table UI arrives in Step 10 batch ports.
        </p>
      )}
    </div>
  );
}
