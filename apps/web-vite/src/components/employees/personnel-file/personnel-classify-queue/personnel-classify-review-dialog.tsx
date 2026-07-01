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
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useCallback, useEffect, useId, useState } from 'react';

import { tDynLoose } from '../../../../i18n/typed-keys.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import type {
  ClassifyRejectReason,
  ClassifySection,
  PersonnelClassifyQueueRow,
} from '../hooks/use-personnel-classify-queue.js';
import { CLASSIFY_REJECT_REASONS } from '../hooks/use-personnel-classify-queue.js';
import type { SectionJurisdiction } from '../personnel-file-section-card.js';

const SECTIONS: readonly ClassifySection[] = ['SECTION_A', 'SECTION_B', 'SECTION_C', 'SECTION_D'];

/** Short A..D code (queue projection + row guess) → the SECTION_A..D enum. */
const SHORT_TO_SECTION: Record<string, ClassifySection> = {
  A: 'SECTION_A',
  B: 'SECTION_B',
  C: 'SECTION_C',
  D: 'SECTION_D',
};

/** SECTION_A..D → the short A..D code used to look up the localized label. */
function sectionShortCode(section: ClassifySection): 'A' | 'B' | 'C' | 'D' {
  return section.slice('SECTION_'.length) as 'A' | 'B' | 'C' | 'D';
}

export interface PersonnelClassifyReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PersonnelClassifyQueueRow | null;
  jurisdiction: SectionJurisdiction;
  initialTab: 'approve' | 'reject';
  isPending: boolean;
  onApprove: (input: { section: ClassifySection }) => void;
  onReject: (input: { reason: ClassifyRejectReason; note?: string }) => void;
}

/**
 * Admin review of one PENDING_REVIEW personnel document. Reuses the shared
 * approve/reject dialog shell (Tabs + DialogBody/DialogFooter): the Approve tab
 * swaps the upload-review expiry input for a Select of the four
 * jurisdiction-resolved section labels — pre-selected to the AI's top guess when
 * one exists — and the Reject tab keeps the closed-enum reason + optional note.
 * The section assignment (default/accent confirm) and the reject (destructive
 * confirm) route through the classify-queue hook, the sole tRPC boundary.
 */
export function PersonnelClassifyReviewDialog({
  open,
  onOpenChange,
  row,
  jurisdiction,
  initialTab,
  isPending,
  onApprove,
  onReject,
}: PersonnelClassifyReviewDialogProps) {
  const t = useTranslations('PersonnelFile.classifyReview');
  const tSections = useTranslations('PersonnelFile');
  const sectionId = useId();
  const reasonId = useId();
  const noteId = useId();

  const [tab, setTab] = useState<'approve' | 'reject'>(initialTab);
  const [section, setSection] = useState<ClassifySection | ''>('');
  const [reason, setReason] = useState<ClassifyRejectReason | ''>('');
  const [note, setNote] = useState('');

  // Reset the form to this row's AI guess each time the dialog opens for a row —
  // a fresh review must not inherit a prior document's chosen section.
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSection(row?.aiSectionGuess ? (SHORT_TO_SECTION[row.aiSectionGuess] ?? '') : '');
    setReason('');
    setNote('');
  }, [open, initialTab, row]);

  const handleTabChange = useCallback((value: string) => setTab(value as 'approve' | 'reject'), []);
  const handleSectionChange = useCallback(
    (value: ClassifySection | '' | null) => setSection(value ?? ''),
    [],
  );
  const handleReasonChange = useCallback(
    (value: ClassifyRejectReason | '' | null) => setReason(value ?? ''),
    [],
  );
  const handleNoteChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleApprove = useCallback(() => {
    if (section !== '') onApprove({ section });
  }, [onApprove, section]);
  const handleReject = useCallback(() => {
    if (reason !== '') onReject({ reason, note: note.trim() || undefined });
  }, [onReject, reason, note]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approve">{t('approveTab')}</TabsTrigger>
              <TabsTrigger value="reject">{t('rejectTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="approve" className="flex flex-col gap-2 pt-4">
              <Label htmlFor={sectionId}>{t('sectionLabel')}</Label>
              <Select value={section} onValueChange={handleSectionChange}>
                <SelectTrigger id={sectionId}>
                  <SelectValue placeholder={t('sectionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(value => (
                    <SelectItem key={value} value={value}>
                      {tDynLoose(
                        tSections,
                        `sections.${jurisdiction}.${sectionShortCode(value)}`,
                        'label',
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="reject" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={reasonId}>{t('reasonLabel')}</Label>
                <Select value={reason} onValueChange={handleReasonChange}>
                  <SelectTrigger id={reasonId}>
                    <SelectValue placeholder={t('reasonPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFY_REJECT_REASONS.map(value => (
                      <SelectItem key={value} value={value}>
                        {tDynLoose(t, 'reason', value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={noteId}>{t('freeTextLabel')}</Label>
                <Textarea id={noteId} value={note} onChange={handleNoteChange} rows={3} />
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
          {tab === 'approve' ? (
            <Button disabled={section === '' || isPending} onClick={handleApprove}>
              {t('confirmApprove')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={reason === '' || isPending}
              onClick={handleReject}>
              {t('confirmReject')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
