export type DocumentListItem = {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  virusScanStatus: string;
  createdAt: string | Date;
  uploadedByUserId: string | null;
  status: string;
};
