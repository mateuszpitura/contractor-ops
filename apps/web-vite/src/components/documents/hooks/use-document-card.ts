import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { DocumentListItem } from '../types.js';
import { useDocumentDownload } from './use-document-download.js';

export interface UseDocumentCardOptions {
  document: DocumentListItem;
  onUploadNewVersion?: (documentId: string) => void;
}

export interface DocumentCardProps {
  document: DocumentListItem;
  isPdf: boolean;
  isInfected: boolean;
  canDownload: boolean;
  canUploadNewVersion: boolean;
  previewOpen: boolean;
  onPreviewOpenChange: (open: boolean) => void;
  onOpenPreview: () => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onOpenDelete: () => void;
  isDeletePending: boolean;
  onConfirmDelete: () => void;
  onDownload: () => void;
  onUploadNewVersion: (() => void) | undefined;
}

export function useDocumentCard({
  document,
  onUploadNewVersion,
}: UseDocumentCardOptions): DocumentCardProps {
  const t = useTranslations('Documents');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const triggerDownload = useDocumentDownload();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation(
    trpc.document.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t('deleted'));
        void queryClient.invalidateQueries(trpc.document.pathFilter());
        setDeleteOpen(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const isPdf = document.mimeType === 'application/pdf';
  const isInfected = document.virusScanStatus === 'INFECTED';

  const handleOpenPreview = useCallback(() => setPreviewOpen(true), []);
  const handleOpenDelete = useCallback(() => setDeleteOpen(true), []);
  const handlePreviewOpenChange = useCallback((next: boolean) => setPreviewOpen(next), []);
  const handleDeleteOpenChange = useCallback((next: boolean) => setDeleteOpen(next), []);

  const handleDownload = useCallback(() => {
    void triggerDownload(document.id);
  }, [triggerDownload, document.id]);

  const handleConfirmDelete = useCallback(() => {
    deleteMutation.mutate({ documentId: document.id });
  }, [deleteMutation, document.id]);

  const canUploadNewVersion = Boolean(onUploadNewVersion) && document.status === 'ACTIVE';
  const handleUploadNewVersion = useCallback(() => {
    onUploadNewVersion?.(document.id);
  }, [onUploadNewVersion, document.id]);

  return {
    document,
    isPdf,
    isInfected,
    canDownload: !isInfected,
    canUploadNewVersion,
    previewOpen,
    onPreviewOpenChange: handlePreviewOpenChange,
    onOpenPreview: handleOpenPreview,
    deleteOpen,
    onDeleteOpenChange: handleDeleteOpenChange,
    onOpenDelete: handleOpenDelete,
    isDeletePending: deleteMutation.isPending,
    onConfirmDelete: handleConfirmDelete,
    onDownload: handleDownload,
    onUploadNewVersion: canUploadNewVersion ? handleUploadNewVersion : undefined,
  };
}
