// Phase 59 · Plan 03 Task 3 — Mark delivered/acknowledged dialog.
// Optional dialog to capture a delivery/acknowledgement note. The inline row
// buttons also call markDelivered/markAcknowledged without a note — this
// component is exported for richer workflows (future UX polish).

'use client';

import { useTranslations } from 'next-intl';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface MarkDeliveredDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: (note: string | null) => void;
  /** Either 'delivered' or 'acknowledged' — switches the heading copy. */
  mode: 'delivered' | 'acknowledged';
}

export function MarkDeliveredDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
}: MarkDeliveredDialogProps) {
  const t = useTranslations('Ir35Chain');
  const titleId = useId();
  const noteFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const [note, setNote] = useState('');

  const handleNoteChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleConfirm = useCallback(() => {
    onConfirm(note.trim() === '' ? null : note);
    onOpenChange(false);
  }, [onConfirm, onOpenChange, note]);

  useEffect(() => {
    if (open) {
      noteFieldRef.current?.focus();
      setNote('');
    }
  }, [open]);

  if (!open) return null;

  const title = mode === 'delivered' ? t('markDeliveredTitle') : t('markAcknowledgedTitle');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h3 id={titleId} className="mb-3 text-base font-semibold">
          {title}
        </h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('noteLabel')}</span>
          <textarea
            ref={noteFieldRef}
            value={note}
            onChange={handleNoteChange}
            maxLength={500}
            rows={4}
            className="rounded-md border px-2 py-1.5"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border px-3 py-1.5 text-sm">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
