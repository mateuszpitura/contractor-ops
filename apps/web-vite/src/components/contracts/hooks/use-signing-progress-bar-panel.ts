import { useCallback, useState } from 'react';

import { useSigningAuditTrail } from './use-signing-audit-trail.js';
import { useSigningProgressBar } from './use-signing-progress-bar.js';
import { useVoidEnvelopeDialog } from './use-void-envelope-dialog.js';

/**
 * Composes the signing progress bar + audit trail panel + void dialog
 * state. Container becomes a JSX wiring layer.
 */
export function useSigningProgressBarPanel(envelopeId: string) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const signing = useSigningProgressBar(envelopeId);
  const audit = useSigningAuditTrail(envelopeId, auditOpen);
  const voidDialog = useVoidEnvelopeDialog(
    envelopeId,
    voidOpen,
    setVoidOpen,
    signing.invalidateAfterVoid,
  );

  const openVoid = useCallback(() => setVoidOpen(true), []);

  return {
    signing,
    audit,
    voidDialog,
    auditOpen,
    setAuditOpen,
    voidOpen,
    setVoidOpen,
    openVoid,
  } as const;
}
