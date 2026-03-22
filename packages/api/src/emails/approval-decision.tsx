import { Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";

interface ApprovalDecisionEmailProps {
  title: string;
  body: string;
  decision?: string;
  approverName?: string;
  comment?: string;
  ctaUrl: string;
  preferencesUrl: string;
}

export function ApprovalDecisionEmail({
  title,
  body,
  decision,
  approverName,
  comment,
  ctaUrl,
  preferencesUrl,
}: ApprovalDecisionEmailProps) {
  return (
    <BaseLayout ctaUrl={ctaUrl} preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        {title}
      </Text>
      <Text style={{ fontSize: "14px", color: "#4a4a4a", lineHeight: "24px" }}>
        {body}
      </Text>
      {decision && (
        <Text style={{ fontSize: "14px", color: "#6b7280" }}>
          <strong>Decision:</strong> {decision}
          {approverName && <><br /><strong>By:</strong> {approverName}</>}
          {comment && <><br /><strong>Comment:</strong> {comment}</>}
        </Text>
      )}
    </BaseLayout>
  );
}

export default ApprovalDecisionEmail;
