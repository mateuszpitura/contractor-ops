'use client';

import type { DragEndEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, GripVertical, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getAvatarInitials } from '@/lib/avatar-initials';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
};

// ---------------------------------------------------------------------------
// Sortable Signer Row
// ---------------------------------------------------------------------------

function SortableSignerRow({ signer, index: _index }: { signer: Signer; index: number }) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('ContractDetail.signing.sendDialog');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: signer.id,
  });

  const _style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const initials = getAvatarInitials(signer.name, signer.email);

  return (
    <div ref={setNodeRef} className="flex items-center gap-3 rounded-lg border bg-card p-3">
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full setup dialog for sending a document for e-signature.
 * Per UI-SPEC D-07: provider picker, signer list with drag reorder,
 * message textarea, document preview, expiry/reminders selects.
 */
export function SendForSignatureDialog({
  open,
  onOpenChange,
  contractId,
  documentId,
  contractParties,
}: SendForSignatureDialogProps) {
  const queryClient = useQueryClient();
  const tSend = useTranslations('ContractDetail.signing.sendDialog');
  const tToast = useTranslations('ContractDetail.signing.toast');

  // ---------------------------------------------------------------------------
  // Provider selection
  // ---------------------------------------------------------------------------

  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const esignConnections = (connectionsQuery.data ?? []) as Array<{
    id: string;
    provider: string;
    status: string;
    displayName: string | null;
  }>;

  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const selectedConnection = esignConnections.find(c => c.id === selectedConnectionId);

  // ---------------------------------------------------------------------------
  // Signers with drag reorder
  // ---------------------------------------------------------------------------

  const [signers, setSigners] = useState<Signer[]>(() =>
    contractParties.map((p, i) => ({
      id: `signer-${i}`,
      name: p.name,
      email: p.email,
      role: p.role,
    })),
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSigners(prev => {
        const oldIndex = prev.findIndex(s => s.id === active.id);
        const newIndex = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Message & Options
  // ---------------------------------------------------------------------------

  const [message, setMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('14');
  const [reminderInterval, setReminderInterval] = useState('7');

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const sendMutation = useMutation(
    trpc.esign.sendForSignature.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('sentForSignature'));
        queryClient.invalidateQueries({
          queryKey: trpc.esign.listEnvelopes.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        onOpenChange(false);
        resetForm();
      },
      onError: () => {
        toast.error(tToast('sendFailed'));
      },
    }),
  );

  function resetForm() {
    setSelectedConnectionId('');
    setMessage('');
    setExpiresInDays('14');
    setReminderInterval('7');
    setSigners(
      contractParties.map((p, i) => ({
        id: `signer-${i}`,
        name: p.name,
        email: p.email,
        role: p.role,
      })),
    );
  }

  function handleSubmit() {
    if (!selectedConnection || signers.length === 0 || !documentId) return;

    sendMutation.mutate({
      contractId,
      documentId,
      connectionId: selectedConnection.id,
      provider: selectedConnection.provider as 'DOCUSIGN' | 'AUTENTI',
      signers: signers.map((s, i) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        routingOrder: i + 1,
      })),
      message: message || undefined,
      expiresInDays: parseInt(expiresInDays, 10),
      reminderIntervalDays: reminderInterval === 'none' ? null : parseInt(reminderInterval, 10),
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-semibold">{tSend('title')}</DialogTitle>
          <DialogDescription>{tSend('description')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-120px)]">
          <div className="space-y-4 px-6 pb-2">
            {/* Section 1: Provider */}
            <div className="space-y-2">
              <Label>{tSend('providerLabel')}</Label>
              {connectionsQuery.isPending ? (
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

            {/* Section 2: Signers */}
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
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() =>
                    setSigners(prev => [
                      ...prev,
                      {
                        id: `signer-${Date.now()}`,
                        name: '',
                        email: '',
                        role: 'countersigner',
                      },
                    ])
                  }>
                  <Plus className="size-3.5" />
                  {tSend('addCountersigner')}
                </button>
              )}
            </div>

            {/* Section 3: Message */}
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

            {/* Section 4: Document */}
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

            {/* Section 5: Options */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>{tSend('expiresLabel')}</Label>
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
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
          <Button
            variant="outline"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}>
            {tSend('discard')}
          </Button>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleSubmit}
            disabled={
              sendMutation.isPending || !selectedConnectionId || signers.length === 0 || !documentId
            }>
            {sendMutation.isPending ? (
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
