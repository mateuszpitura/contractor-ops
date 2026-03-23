"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical, Loader2, Plus, FileText } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Signer = {
  id: string;
  name: string;
  email: string;
  role: "signer" | "countersigner";
};

type SendForSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  documentId: string;
  contractParties: Array<{
    name: string;
    email: string;
    role: "signer" | "countersigner";
  }>;
};

// ---------------------------------------------------------------------------
// Sortable Signer Row
// ---------------------------------------------------------------------------

function SortableSignerRow({
  signer,
  index,
}: {
  signer: Signer;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: signer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const initials = signer.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
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
        {signer.role === "signer" ? "Contractor" : "Countersigner"}
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

  // ---------------------------------------------------------------------------
  // Provider selection
  // ---------------------------------------------------------------------------

  const connectionsQuery = useQuery(
    trpc.esign.listConnections.queryOptions()
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const esignConnections = ((connectionsQuery.data as any) ?? []) as Array<{
    id: string;
    provider: string;
    status: string;
    displayName: string | null;
  }>;

  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const selectedConnection = esignConnections.find(
    (c) => c.id === selectedConnectionId
  );

  // ---------------------------------------------------------------------------
  // Signers with drag reorder
  // ---------------------------------------------------------------------------

  const [signers, setSigners] = useState<Signer[]>(() =>
    contractParties.map((p, i) => ({
      id: `signer-${i}`,
      name: p.name,
      email: p.email,
      role: p.role,
    }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSigners((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Message & Options
  // ---------------------------------------------------------------------------

  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [reminderInterval, setReminderInterval] = useState("7");

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const sendMutation = useMutation(
    trpc.esign.sendForSignature.mutationOptions({
      onSuccess: () => {
        toast.success("Document sent for signature");
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
        toast.error("Failed to send for signature. Please try again.");
      },
    })
  );

  function resetForm() {
    setSelectedConnectionId("");
    setMessage("");
    setExpiresInDays("14");
    setReminderInterval("7");
    setSigners(
      contractParties.map((p, i) => ({
        id: `signer-${i}`,
        name: p.name,
        email: p.email,
        role: p.role,
      }))
    );
  }

  function handleSubmit() {
    if (!selectedConnection || signers.length === 0 || !documentId) return;

    sendMutation.mutate({
      contractId,
      documentId,
      connectionId: selectedConnection.id,
      provider: selectedConnection.provider as "DOCUSIGN" | "AUTENTI",
      signers: signers.map((s, i) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        routingOrder: i + 1,
      })),
      message: message || undefined,
      expiresInDays: parseInt(expiresInDays, 10),
      reminderIntervalDays:
        reminderInterval === "none" ? null : parseInt(reminderInterval, 10),
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-semibold">
            Send for Signature
          </DialogTitle>
          <DialogDescription>
            Choose a signing provider and configure signers for this document.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-120px)]">
          <div className="space-y-4 px-6 pb-2">
            {/* Section 1: Provider */}
            <div className="space-y-2">
              <Label>Signing Provider</Label>
              {connectionsQuery.isPending ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={selectedConnectionId}
                  onValueChange={(val) => setSelectedConnectionId(val ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {esignConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.provider === "DOCUSIGN"
                          ? "DocuSign"
                          : "Autenti"}
                      </SelectItem>
                    ))}
                    {esignConnections.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No signing providers connected. Connect DocuSign or
                        Autenti in Settings &gt; Integrations.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Section 2: Signers */}
            <div className="space-y-2">
              <Label>Signers</Label>
              {signers.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={signers.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {signers.map((signer, index) => (
                        <SortableSignerRow
                          key={signer.id}
                          signer={signer}
                          index={index}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No signers configured. Add contract parties first.
                </p>
              )}

              {!signers.some((s) => s.role === "countersigner") && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  onClick={() =>
                    setSigners((prev) => [
                      ...prev,
                      {
                        id: `signer-${Date.now()}`,
                        name: "",
                        email: "",
                        role: "countersigner",
                      },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  Add countersigner
                </button>
              )}
            </div>

            {/* Section 3: Message */}
            <div className="space-y-2">
              <Label>Message to Signers</Label>
              <Textarea
                rows={3}
                placeholder="Optional message included in the signing email"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Section 4: Document */}
            <div className="space-y-2">
              <Label>Document</Label>
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-background">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {documentId || "No document selected"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5: Options */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>Expires After</Label>
                <Select
                  value={expiresInDays}
                  onValueChange={(val) => setExpiresInDays(val ?? "14")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label>Send Reminders</Label>
                <Select
                  value={reminderInterval}
                  onValueChange={(val) => setReminderInterval(val ?? "7")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="3">Every 3 days</SelectItem>
                    <SelectItem value="7">Every 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Discard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              sendMutation.isPending ||
              !selectedConnectionId ||
              signers.length === 0 ||
              !documentId
            }
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send for Signature"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
