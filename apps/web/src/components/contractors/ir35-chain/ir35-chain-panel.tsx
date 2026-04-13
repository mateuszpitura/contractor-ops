// Phase 59 · Plan 03 Task 3 — IR35 chain panel.
// Renders chain participants as a semantic <table> with per-row actions.

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { trpc } from '@/trpc/init';

import { AddParticipantDialog } from './add-participant-dialog';
import { ChainParticipantRow } from './chain-participant-row';

interface Ir35ChainPanelProps {
  engagementId: string;
}

export function Ir35ChainPanel({ engagementId }: Ir35ChainPanelProps) {
  const t = useTranslations('Ir35Chain');
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const listQuery = useQuery(
    trpc.ir35Chain.listByEngagement.queryOptions({ contractorAssignmentId: engagementId }),
  );

  const markDelivered = useMutation(
    trpc.ir35Chain.markDelivered.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [['ir35Chain', 'listByEngagement']] });
      },
    }),
  );

  const markAcknowledged = useMutation(
    trpc.ir35Chain.markAcknowledged.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [['ir35Chain', 'listByEngagement']] });
      },
    }),
  );

  const removeParticipant = useMutation(
    trpc.ir35Chain.removeParticipant.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [['ir35Chain', 'listByEngagement']] });
      },
    }),
  );

  const rows = listQuery.data ?? [];

  return (
    <section aria-labelledby="ir35-chain-heading" className="rounded-lg border bg-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 id="ir35-chain-heading" className="text-lg font-semibold">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('addParticipant')}
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              <th scope="col" className="py-2 pr-2">
                {t('columnRole')}
              </th>
              <th scope="col" className="py-2 pr-2">
                {t('columnDisplayName')}
              </th>
              <th scope="col" className="py-2 pr-2">
                {t('columnDelivered')}
              </th>
              <th scope="col" className="py-2 pr-2">
                {t('columnAcknowledged')}
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                {t('columnActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <ChainParticipantRow
                key={row.id}
                row={row}
                onMarkDelivered={note => markDelivered.mutate({ id: row.id, note })}
                onMarkAcknowledged={note =>
                  markAcknowledged.mutate({ id: row.id, note })
                }
                onRemove={() => removeParticipant.mutate({ id: row.id })}
              />
            ))}
          </tbody>
        </table>
      )}

      <AddParticipantDialog
        engagementId={engagementId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        nextOrderIndex={rows.length}
      />
    </section>
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
