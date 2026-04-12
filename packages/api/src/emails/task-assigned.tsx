import { Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";

interface TaskAssignedEmailProps {
  title: string;
  body: string;
  taskName?: string;
  workflowName?: string;
  dueDate?: string;
  ctaUrl: string;
  preferencesUrl: string;
}

export function TaskAssignedEmail({
  title,
  body,
  taskName,
  workflowName,
  dueDate,
  ctaUrl,
  preferencesUrl,
}: TaskAssignedEmailProps) {
  return (
    <BaseLayout ctaUrl={ctaUrl} preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>{title}</Text>
      <Text style={{ fontSize: "14px", color: "#4a4a4a", lineHeight: "24px" }}>{body}</Text>
      {taskName && (
        <Text style={{ fontSize: "14px", color: "#6b7280" }}>
          <strong>Task:</strong> {taskName}
          {workflowName && (
            <>
              <br />
              <strong>Workflow:</strong> {workflowName}
            </>
          )}
          {dueDate && (
            <>
              <br />
              <strong>Due:</strong> {dueDate}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default TaskAssignedEmail;
