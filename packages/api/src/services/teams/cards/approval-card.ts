// ---------------------------------------------------------------------------
// Stub: Approval Card Builder
// ---------------------------------------------------------------------------
// This file is a placeholder for the approval card builder that will be
// implemented in Plan 02. It provides the correct export signature so that
// teams-bot-handler.ts and teams-messaging-provider.ts can compile.
// Plan 02 will replace this file with the full Adaptive Card implementation.
// ---------------------------------------------------------------------------

export function buildApprovalCard(_params: {
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceId: string;
  flowId: string;
}): Record<string, unknown> {
  throw new Error("buildApprovalCard stub -- Plan 02 not yet merged");
}
