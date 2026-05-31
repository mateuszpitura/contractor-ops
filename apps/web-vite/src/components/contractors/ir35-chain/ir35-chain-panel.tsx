import { useCallback, useId, useState } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';

import { useTranslations } from '../../../i18n/useTranslations.js';

import { AddParticipantDialogContainer } from './add-participant-dialog-container';
import { ChainParticipantRow } from './chain-participant-row';

interface MutationLike<I> {
  mutate: (vars: I) => void;
  isPending: boolean;
}

export interface Ir35ChainPanelViewProps {
  engagementId: string;
  rows: Ir35ChainParticipantRow[];
  markDelivered: MutationLike<{ id: string; note: string | null }>;
  markAcknowledged: MutationLike<{ id: string; note: string | null }>;
  removeParticipant: MutationLike<{ id: string }>;
}

export function Ir35ChainPanelEmpty({ engagementId }: { engagementId: string }) {
  const t = useTranslations('Ir35Chain');
  const headingId = useId();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const handleOpenAdd = useCallback(() => setIsAddOpen(true), []);
  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {t('addParticipant')}
        </button>
      </header>
      <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
      <AddParticipantDialogContainer
        engagementId={engagementId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        nextOrderIndex={0}
      />
    </section>
  );
}

export function Ir35ChainPanelView({
  engagementId,
  rows,
  markDelivered,
  markAcknowledged,
  removeParticipant,
}: Ir35ChainPanelViewProps) {
  const t = useTranslations('Ir35Chain');
  const headingId = useId();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleOpenAdd = useCallback(() => setIsAddOpen(true), []);

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {t('addParticipant')}
        </button>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columnRole')}</TableHead>
            <TableHead>{t('columnDisplayName')}</TableHead>
            <TableHead>{t('columnDelivered')}</TableHead>
            <TableHead>{t('columnAcknowledged')}</TableHead>
            <TableHead className="text-right">{t('columnActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <ConnectedParticipantRow
              key={row.id}
              row={row}
              markDelivered={markDelivered}
              markAcknowledged={markAcknowledged}
              removeParticipant={removeParticipant}
            />
          ))}
        </TableBody>
      </Table>

      <AddParticipantDialogContainer
        engagementId={engagementId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        nextOrderIndex={rows.length}
      />
    </section>
  );
}

interface ConnectedParticipantRowProps {
  row: Ir35ChainParticipantRow;
  markDelivered: MutationLike<{ id: string; note: string | null }>;
  markAcknowledged: MutationLike<{ id: string; note: string | null }>;
  removeParticipant: MutationLike<{ id: string }>;
}

function ConnectedParticipantRow({
  row,
  markDelivered,
  markAcknowledged,
  removeParticipant,
}: ConnectedParticipantRowProps) {
  const handleMarkDelivered = useCallback(
    (note: string | null) => markDelivered.mutate({ id: row.id, note }),
    [markDelivered, row.id],
  );
  const handleMarkAcknowledged = useCallback(
    (note: string | null) => markAcknowledged.mutate({ id: row.id, note }),
    [markAcknowledged, row.id],
  );
  const handleRemove = useCallback(
    () => removeParticipant.mutate({ id: row.id }),
    [removeParticipant, row.id],
  );

  return (
    <ChainParticipantRow
      row={row}
      onMarkDelivered={handleMarkDelivered}
      onMarkAcknowledged={handleMarkAcknowledged}
      onRemove={handleRemove}
      isMarkingDelivered={markDelivered.isPending}
      isMarkingAcknowledged={markAcknowledged.isPending}
      isRemoving={removeParticipant.isPending}
    />
  );
}

export interface Ir35ChainParticipantRow {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  role: 'CLIENT' | 'AGENCY' | 'PSC' | 'WORKER';
  orderIndex: number;
  displayName: string;
  contactEmail: string | null;
  linkedOrganizationId: string | null;
  linkedContractorId: string | null;
  sdsDeliveredAt: Date | null;
  sdsDeliveredNote: string | null;
  sdsAcknowledgedAt: Date | null;
  sdsAcknowledgedNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}
