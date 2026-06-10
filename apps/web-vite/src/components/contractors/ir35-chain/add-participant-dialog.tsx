// Add participant dialog.
// Minimal dialog (not shadcn Dialog to keep this scope compact) — calls
// ir35Chain.upsertParticipant on submit.

import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useAddIr35Participant as UseAddIr35Participant } from '../hooks/use-ir35-chain.js';
import { useAddIr35Participant } from '../hooks/use-ir35-chain.js';

export interface AddParticipantDialogProps {
  engagementId: string;
  nextOrderIndex: number;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

type Role = 'AGENCY' | 'PSC';

type AddParticipantDialogViewProps = AddParticipantDialogProps &
  ReturnType<typeof UseAddIr35Participant>;

export function AddParticipantDialogView({
  engagementId,
  nextOrderIndex,
  open,
  onOpenChange,
  addParticipant,
  isPending,
  mutation,
}: AddParticipantDialogViewProps) {
  const t = useTranslations('Ir35Chain');
  const titleId = useId();
  const descriptionId = useId();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const [role, setRole] = useState<Role>('AGENCY');
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const errorMessage = mutation.isError ? mutation.error.message : null;

  const handleDisplayNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value),
    [],
  );

  const handleRoleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setRole(event.target.value as Role),
    [],
  );

  const handleContactEmailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setContactEmail(event.target.value),
    [],
  );

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    }
  }, [open]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      addParticipant({
        role,
        displayName,
        contactEmail: contactEmail.trim() === '' ? null : contactEmail,
      });
    },
    [addParticipant, role, displayName, contactEmail],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <header className="mb-4">
          <h3 id={titleId} className="text-base font-semibold">
            {t('addParticipantTitle')}
          </h3>
          <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
            {t('addParticipantHint')}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('displayName')}</span>
            <input
              ref={firstFieldRef}
              required
              type="text"
              value={displayName}
              onChange={handleDisplayNameChange}
              className="rounded-md border px-2 py-1.5"
              maxLength={200}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('roleLabel')}</span>
            <select
              value={role}
              onChange={handleRoleChange}
              className="rounded-md border px-2 py-1.5">
              <option value="AGENCY">{t('role.AGENCY')}</option>
              <option value="PSC">{t('role.PSC')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('contactEmail')}</span>
            <input
              type="email"
              value={contactEmail}
              onChange={handleContactEmailChange}
              className="rounded-md border px-2 py-1.5"
              maxLength={320}
            />
          </label>

          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border px-3 py-1.5 text-sm">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
              {isPending ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddParticipantDialog(props: AddParticipantDialogProps) {
  const participant = useAddIr35Participant(props.engagementId, props.nextOrderIndex, open => {
    props.onOpenChange(open);
  });
  return <AddParticipantDialogView {...props} {...participant} />;
}
