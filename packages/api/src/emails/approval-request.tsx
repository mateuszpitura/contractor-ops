import { Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";

interface ApprovalRequestEmailProps {
  title: string;
  body: string;
  invoiceNumber?: string;
  contractorName?: string;
  amount?: string;
  ctaUrl: string;
  preferencesUrl: string;
}

export function ApprovalRequestEmail({
  title,
  body,
  invoiceNumber,
  contractorName,
  amount,
  ctaUrl,
  preferencesUrl,
}: ApprovalRequestEmailProps) {
  return (
    <BaseLayout ctaUrl={ctaUrl} ctaText="Review & Approve" preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        {title}
      </Text>
      <Text style={{ fontSize: "14px", color: "#4a4a4a", lineHeight: "24px" }}>
        {body}
      </Text>
      {invoiceNumber && (
        <Text style={{ fontSize: "14px", color: "#6b7280" }}>
          <strong>Invoice:</strong> {invoiceNumber}
          {contractorName && <><br /><strong>Contractor:</strong> {contractorName}</>}
          {amount && <><br /><strong>Amount:</strong> {amount}</>}
        </Text>
      )}
    </BaseLayout>
  );
}

export default ApprovalRequestEmail;
