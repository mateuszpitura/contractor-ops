import { Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";

interface ContractExpiringEmailProps {
  title: string;
  body: string;
  contractTitle?: string;
  contractorName?: string;
  expiryDate?: string;
  ctaUrl: string;
  preferencesUrl: string;
}

export function ContractExpiringEmail({
  title,
  body,
  contractTitle,
  contractorName,
  expiryDate,
  ctaUrl,
  preferencesUrl,
}: ContractExpiringEmailProps) {
  return (
    <BaseLayout ctaUrl={ctaUrl} preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>{title}</Text>
      <Text style={{ fontSize: "14px", color: "#4a4a4a", lineHeight: "24px" }}>{body}</Text>
      {contractTitle && (
        <Text style={{ fontSize: "14px", color: "#6b7280" }}>
          <strong>Contract:</strong> {contractTitle}
          {contractorName && (
            <>
              <br />
              <strong>Contractor:</strong> {contractorName}
            </>
          )}
          {expiryDate && (
            <>
              <br />
              <strong>Expires:</strong> {expiryDate}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default ContractExpiringEmail;
