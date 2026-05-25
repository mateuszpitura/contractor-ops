import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, GripVertical, Loader2, Plus, Send } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import type { useSendForSignatureDialog } from '../hooks/use-send-for-signature-dialog.js';

type Signer = {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'countersigner';
};

type SendForSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  documentId: string;
  contractParties: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
  dialog: ReturnType<typeof useSendForSignatureDialog>;
};

function SortableSignerRow({ signer, index: _index }: { signer: Signer; index: number }) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('ContractDetail.signing.sendDialog');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: signer.id,
  });

  const initials = getAvatarInitials(signer.name, signer.email);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label={tAria('dragToReorder')}
        {...attributes}
        {...listeners}>
        <GripVertical className="size-4" />
      </button>

      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{signer.name}</p>
        <p className="truncate text-sm text-muted-foreground">{signer.email}</p>
      </div>

      <Badge variant="secondary" className="shrink-0">
        {signer.role === 'signer' ? t('contractor') : t('countersigner')}
      </Badge>
    </div>
  );
}

/**
 * Full setup dialog for sending a document for e-signature.
 */
export function SendForSignatureDialog({
  open,
  onOpenChange,
  documentId,
  dialog,
}: SendForSignatureDialogProps) {
  const tSend = useTranslations('ContractDetail.signing.sendDialog');

  const {
    addCountersigner,
    connectionsLoading,
    esignConnections,
    expiresInDays,
    handleDiscard,
    handleDragEnd,
    handleSubmit,
    isSendPending,
    message,
    reminderInterval,
    selectedConnectionId,
    setExpiresInDays,
    setMessage,
    setReminderInterval,
    setSelectedConnectionId,
    signers,
  } = dialog;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Send className="size-4" />
            {tSend('title')}
          </DialogTitle>
          <DialogDescription>{tSend('description')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-120px)]">
          <div className="space-y-4 px-6 pb-2">
            <div className="space-y-2">
              <Label>{tSend('providerLabel')}</Label>
              {connectionsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={selectedConnectionId}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onValueChange={val => setSelectedConnectionId(val ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tSend('providerPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {esignConnections.map(conn => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.provider === 'DOCUSIGN' ? 'DocuSign' : 'Autenti'}
                      </SelectItem>
                    ))}
                    {esignConnections.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {tSend('noProviders')}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>{tSend('signersLabel')}</Label>
              {signers.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={signers.map(s => s.id)}
                    strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {signers.map((signer, index) => (
                        <SortableSignerRow key={signer.id} signer={signer} index={index} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-sm text-muted-foreground">{tSend('noSigners')}</p>
              )}

              {!signers.some(s => s.role === 'countersigner') && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  onClick={addCountersigner}>
                  <Plus className="size-3.5" />
                  {tSend('addCountersigner')}
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label>{tSend('messageLabel')}</Label>
              <Textarea
                rows={3}
                placeholder={tSend('messagePlaceholder')}
                value={message}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{tSend('documentLabel')}</Label>
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-background">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {documentId || tSend('noDocument')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>{tSend('expiresLabel')}</Label>
                {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
                <Select value={expiresInDays} onValueChange={val => setExpiresInDays(val ?? '14')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">{tSend('expires7')}</SelectItem>
                    <SelectItem value="14">{tSend('expires14')}</SelectItem>
                    <SelectItem value="30">{tSend('expires30')}</SelectItem>
                    <SelectItem value="60">{tSend('expires60')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label>{tSend('remindersLabel')}</Label>
                <Select
                  value={reminderInterval}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onValueChange={val => setReminderInterval(val ?? '7')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tSend('reminderNone')}</SelectItem>
                    <SelectItem value="3">{tSend('reminderEvery3')}</SelectItem>
                    <SelectItem value="7">{tSend('reminderEvery7')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={handleDiscard}>
            {tSend('discard')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSendPending || !selectedConnectionId || signers.length === 0 || !documentId
            }>
            {isSendPending ? (
              <>
                <Loader2 className="me-1.5 size-4 animate-spin" />
                {tSend('sending')}
              </>
            ) : (
              tSend('send')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
