import { Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";

interface InvoiceReceivedEmailProps {
  title: string;
  body: string;
  invoiceNumber?: string;
  contractorName?: string;
  amount?: string;
  ctaUrl: string;
  preferencesUrl: string;
}

export function InvoiceReceivedEmail({
  title,
  body,
  invoiceNumber,
  contractorName,
  amount,
  ctaUrl,
  preferencesUrl,
}: InvoiceReceivedEmailProps) {
  return (
    <BaseLayout ctaUrl={ctaUrl} preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>{title}</Text>
      <Text style={{ fontSize: "14px", color: "#4a4a4a", lineHeight: "24px" }}>{body}</Text>
      {invoiceNumber && (
        <Text style={{ fontSize: "14px", color: "#6b7280" }}>
          <strong>Invoice:</strong> {invoiceNumber}
          {contractorName && (
            <>
              <br />
              <strong>From:</strong> {contractorName}
            </>
          )}
          {amount && (
            <>
              <br />
              <strong>Amount:</strong> {amount}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default InvoiceReceivedEmail;
