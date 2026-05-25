import { useState } from 'react';
import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';
import { useBoeRateList } from '../hooks/use-admin-boe-rate.js';
import { BoeRateTable } from './boe-rate-table.js';
import { DeleteBoeRateDialogContainer } from './delete-boe-rate-dialog-container.js';
import { EditBoeRateDialogContainer } from './edit-boe-rate-dialog-container.js';

export function BoeRateTableContainer() {
  const { entries, isLoading } = useBoeRateList();
  const [editEntry, setEditEntry] = useState<BoeRateEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<BoeRateEntry | null>(null);

  return (
    <>
      <BoeRateTable
        entries={entries}
        isLoading={isLoading}
        onEdit={setEditEntry}
        onDelete={setDeleteEntry}
      />
      {editEntry ? (
        <EditBoeRateDialogContainer
          entry={editEntry}
          open={!!editEntry}
          onOpenChange={open => {
            if (!open) setEditEntry(null);
          }}
        />
      ) : null}
      {deleteEntry ? (
        <DeleteBoeRateDialogContainer
          entry={deleteEntry}
          open={!!deleteEntry}
          onOpenChange={open => {
            if (!open) setDeleteEntry(null);
          }}
        />
      ) : null}
    </>
  );
}
