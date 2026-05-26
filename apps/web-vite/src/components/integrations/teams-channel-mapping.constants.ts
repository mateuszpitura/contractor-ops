export const NOTIFICATION_CATEGORIES = [
  'approvals',
  'invoices',
  'contracts',
  'tasks',
  'equipment',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABEL_KEYS: Record<NotificationCategory, string> = {
  approvals: 'categoryApprovals',
  invoices: 'categoryInvoices',
  contracts: 'categoryContracts',
  tasks: 'categoryTasks',
  equipment: 'categoryEquipment',
};

export interface TeamsChannel {
  id: string;
  displayName: string;
}
