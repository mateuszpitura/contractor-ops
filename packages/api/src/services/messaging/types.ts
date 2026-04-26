// ---------------------------------------------------------------------------
// MessagingProvider Interface
// ---------------------------------------------------------------------------
// Abstraction over messaging platforms (Slack, Teams, future).
// Each provider implements this interface; notification-service.ts iterates
// all connected providers without knowing platform specifics.
// ---------------------------------------------------------------------------

export interface ApprovalCardParams {
  organizationId: string;
  recipientId: string;
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceId: string;
  flowId: string;
}

export interface ReminderDMParams {
  organizationId: string;
  recipientId: string;
  text: string;
  overdueInDays?: number;
  invoiceNumber?: string;
  contractorName?: string;
  amount?: string;
  currency?: string;
  dueDate?: string;
  invoiceId?: string;
  flowId?: string;
}

export interface ChannelAlertParams {
  organizationId: string;
  channelId: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  details: Array<{ label: string; value: string }>;
  viewUrl: string;
}

export interface MessagingProvider {
  readonly platform: 'slack' | 'teams';
  sendApprovalCard(params: ApprovalCardParams): Promise<void>;
  sendReminderDM(params: ReminderDMParams): Promise<void>;
  sendChannelAlert(params: ChannelAlertParams): Promise<void>;
  getUserId(organizationId: string, userId: string): Promise<string | null>;
}
