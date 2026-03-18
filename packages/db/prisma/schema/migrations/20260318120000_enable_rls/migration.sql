-- Enable Row Level Security (RLS) tenant isolation for business tables.
-- Context is provided via Postgres session variables set per-transaction:
--   app.org_id, app.user_id

create schema if not exists app;

create or replace function app.current_org_id()
returns text
language sql
stable
as $$
  select current_setting('app.org_id', true)
$$;

create or replace function app.current_user_id()
returns text
language sql
stable
as $$
  select current_setting('app.user_id', true)
$$;

create or replace function app.is_org_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from "Member" m
    where m."organizationId" = app.current_org_id()
      and m."userId" = app.current_user_id()
  )
$$;

create or replace function app.has_role(allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from "Member" m
    where m."organizationId" = app.current_org_id()
      and m."userId" = app.current_user_id()
      and m."role" = any(allowed_roles)
  )
$$;

-- Role sets (based on packages/auth/src/roles.ts)
-- Read is any member; writes are split per domain.
create or replace function app.can_write_ops()
returns boolean
language sql
stable
as $$
  select app.has_role(array['admin','ops_manager'])
$$;

create or replace function app.can_write_finance()
returns boolean
language sql
stable
as $$
  select app.has_role(array['admin','finance_admin'])
$$;

create or replace function app.can_write_workflow()
returns boolean
language sql
stable
as $$
  select app.has_role(array['admin','ops_manager','team_manager'])
$$;

-- Helper: guard organizationId match
create or replace function app.org_match(row_org_id text)
returns boolean
language sql
stable
as $$
  select row_org_id = app.current_org_id()
$$;

-- =========================
-- Tenant-scoped app tables
-- =========================

-- Org-structure tables (exclude Better Auth org plugin tables: "Organization","Member","Invitation")
alter table "Team" enable row level security;
alter table "Team" force row level security;
drop policy if exists team_select on "Team";
create policy team_select on "Team"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists team_write on "Team";
create policy team_write on "Team"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Project" enable row level security;
alter table "Project" force row level security;
drop policy if exists project_select on "Project";
create policy project_select on "Project"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists project_write on "Project";
create policy project_write on "Project"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "CostCenter" enable row level security;
alter table "CostCenter" force row level security;
drop policy if exists costcenter_select on "CostCenter";
create policy costcenter_select on "CostCenter"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists costcenter_write on "CostCenter";
create policy costcenter_write on "CostCenter"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Contractor domain
alter table "Contractor" enable row level security;
alter table "Contractor" force row level security;
drop policy if exists contractor_select on "Contractor";
create policy contractor_select on "Contractor"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractor_write on "Contractor";
create policy contractor_write on "Contractor"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorContact" enable row level security;
alter table "ContractorContact" force row level security;
drop policy if exists contractorcontact_select on "ContractorContact";
create policy contractorcontact_select on "ContractorContact"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorcontact_write on "ContractorContact";
create policy contractorcontact_write on "ContractorContact"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorBillingProfile" enable row level security;
alter table "ContractorBillingProfile" force row level security;
drop policy if exists contractorbillingprofile_select on "ContractorBillingProfile";
create policy contractorbillingprofile_select on "ContractorBillingProfile"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorbillingprofile_write on "ContractorBillingProfile";
create policy contractorbillingprofile_write on "ContractorBillingProfile"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorAssignment" enable row level security;
alter table "ContractorAssignment" force row level security;
drop policy if exists contractorassignment_select on "ContractorAssignment";
create policy contractorassignment_select on "ContractorAssignment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorassignment_write on "ContractorAssignment";
create policy contractorassignment_write on "ContractorAssignment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorTag" enable row level security;
alter table "ContractorTag" force row level security;
drop policy if exists contractortag_select on "ContractorTag";
create policy contractortag_select on "ContractorTag"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractortag_write on "ContractorTag";
create policy contractortag_write on "ContractorTag"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Join table without organizationId: enforce via parents.
alter table "ContractorTagLink" enable row level security;
alter table "ContractorTagLink" force row level security;
drop policy if exists contractortaglink_select on "ContractorTagLink";
create policy contractortaglink_select on "ContractorTagLink"
  for select
  using (
    app.is_org_member()
    and exists (
      select 1
      from "Contractor" c
      where c."id" = "ContractorTagLink"."contractorId"
        and c."organizationId" = app.current_org_id()
    )
    and exists (
      select 1
      from "ContractorTag" t
      where t."id" = "ContractorTagLink"."tagId"
        and t."organizationId" = app.current_org_id()
    )
  );
drop policy if exists contractortaglink_write on "ContractorTagLink";
create policy contractortaglink_write on "ContractorTagLink"
  for all
  using (
    app.can_write_ops()
    and exists (
      select 1
      from "Contractor" c
      where c."id" = "ContractorTagLink"."contractorId"
        and c."organizationId" = app.current_org_id()
    )
    and exists (
      select 1
      from "ContractorTag" t
      where t."id" = "ContractorTagLink"."tagId"
        and t."organizationId" = app.current_org_id()
    )
  )
  with check (
    app.can_write_ops()
    and exists (
      select 1
      from "Contractor" c
      where c."id" = "ContractorTagLink"."contractorId"
        and c."organizationId" = app.current_org_id()
    )
    and exists (
      select 1
      from "ContractorTag" t
      where t."id" = "ContractorTagLink"."tagId"
        and t."organizationId" = app.current_org_id()
    )
  );

alter table "ComplianceRequirementTemplate" enable row level security;
alter table "ComplianceRequirementTemplate" force row level security;
drop policy if exists compliancerequirementtemplate_select on "ComplianceRequirementTemplate";
create policy compliancerequirementtemplate_select on "ComplianceRequirementTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists compliancerequirementtemplate_write on "ComplianceRequirementTemplate";
create policy compliancerequirementtemplate_write on "ComplianceRequirementTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorComplianceItem" enable row level security;
alter table "ContractorComplianceItem" force row level security;
drop policy if exists contractorcomplianceitem_select on "ContractorComplianceItem";
create policy contractorcomplianceitem_select on "ContractorComplianceItem"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorcomplianceitem_write on "ContractorComplianceItem";
create policy contractorcomplianceitem_write on "ContractorComplianceItem"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Contract + documents
alter table "Contract" enable row level security;
alter table "Contract" force row level security;
drop policy if exists contract_select on "Contract";
create policy contract_select on "Contract"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contract_write on "Contract";
create policy contract_write on "Contract"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractAmendment" enable row level security;
alter table "ContractAmendment" force row level security;
drop policy if exists contractamendment_select on "ContractAmendment";
create policy contractamendment_select on "ContractAmendment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractamendment_write on "ContractAmendment";
create policy contractamendment_write on "ContractAmendment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractRatePeriod" enable row level security;
alter table "ContractRatePeriod" force row level security;
drop policy if exists contractrateperiod_select on "ContractRatePeriod";
create policy contractrateperiod_select on "ContractRatePeriod"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractrateperiod_write on "ContractRatePeriod";
create policy contractrateperiod_write on "ContractRatePeriod"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Document" enable row level security;
alter table "Document" force row level security;
drop policy if exists document_select on "Document";
create policy document_select on "Document"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists document_write on "Document";
create policy document_write on "Document"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "DocumentLink" enable row level security;
alter table "DocumentLink" force row level security;
drop policy if exists documentlink_select on "DocumentLink";
create policy documentlink_select on "DocumentLink"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists documentlink_write on "DocumentLink";
create policy documentlink_write on "DocumentLink"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Invoice + payment (finance write)
alter table "Invoice" enable row level security;
alter table "Invoice" force row level security;
drop policy if exists invoice_select on "Invoice";
create policy invoice_select on "Invoice"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoice_write on "Invoice";
create policy invoice_write on "Invoice"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "InvoiceFile" enable row level security;
alter table "InvoiceFile" force row level security;
drop policy if exists invoicefile_select on "InvoiceFile";
create policy invoicefile_select on "InvoiceFile"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoicefile_write on "InvoiceFile";
create policy invoicefile_write on "InvoiceFile"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "InvoiceLine" enable row level security;
alter table "InvoiceLine" force row level security;
drop policy if exists invoiceline_select on "InvoiceLine";
create policy invoiceline_select on "InvoiceLine"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoiceline_write on "InvoiceLine";
create policy invoiceline_write on "InvoiceLine"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "InvoiceMatchResult" enable row level security;
alter table "InvoiceMatchResult" force row level security;
drop policy if exists invoicematchresult_select on "InvoiceMatchResult";
create policy invoicematchresult_select on "InvoiceMatchResult"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoicematchresult_write on "InvoiceMatchResult";
create policy invoicematchresult_write on "InvoiceMatchResult"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "PaymentRun" enable row level security;
alter table "PaymentRun" force row level security;
drop policy if exists paymentrun_select on "PaymentRun";
create policy paymentrun_select on "PaymentRun"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists paymentrun_write on "PaymentRun";
create policy paymentrun_write on "PaymentRun"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "PaymentRunItem" enable row level security;
alter table "PaymentRunItem" force row level security;
drop policy if exists paymentrunitem_select on "PaymentRunItem";
create policy paymentrunitem_select on "PaymentRunItem"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists paymentrunitem_write on "PaymentRunItem";
create policy paymentrunitem_write on "PaymentRunItem"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "PaymentExport" enable row level security;
alter table "PaymentExport" force row level security;
drop policy if exists paymentexport_select on "PaymentExport";
create policy paymentexport_select on "PaymentExport"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists paymentexport_write on "PaymentExport";
create policy paymentexport_write on "PaymentExport"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- Workflow (workflow write)
alter table "WorkflowTemplate" enable row level security;
alter table "WorkflowTemplate" force row level security;
drop policy if exists workflowtemplate_select on "WorkflowTemplate";
create policy workflowtemplate_select on "WorkflowTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowtemplate_write on "WorkflowTemplate";
create policy workflowtemplate_write on "WorkflowTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowTaskTemplate" enable row level security;
alter table "WorkflowTaskTemplate" force row level security;
drop policy if exists workflowtasktemplate_select on "WorkflowTaskTemplate";
create policy workflowtasktemplate_select on "WorkflowTaskTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowtasktemplate_write on "WorkflowTaskTemplate";
create policy workflowtasktemplate_write on "WorkflowTaskTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowRun" enable row level security;
alter table "WorkflowRun" force row level security;
drop policy if exists workflowrun_select on "WorkflowRun";
create policy workflowrun_select on "WorkflowRun"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowrun_write on "WorkflowRun";
create policy workflowrun_write on "WorkflowRun"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowTaskRun" enable row level security;
alter table "WorkflowTaskRun" force row level security;
drop policy if exists workflowtaskrun_select on "WorkflowTaskRun";
create policy workflowtaskrun_select on "WorkflowTaskRun"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowtaskrun_write on "WorkflowTaskRun";
create policy workflowtaskrun_write on "WorkflowTaskRun"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowComment" enable row level security;
alter table "WorkflowComment" force row level security;
drop policy if exists workflowcomment_select on "WorkflowComment";
create policy workflowcomment_select on "WorkflowComment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowcomment_write on "WorkflowComment";
create policy workflowcomment_write on "WorkflowComment"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowAttachment" enable row level security;
alter table "WorkflowAttachment" force row level security;
drop policy if exists workflowattachment_select on "WorkflowAttachment";
create policy workflowattachment_select on "WorkflowAttachment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowattachment_write on "WorkflowAttachment";
create policy workflowattachment_write on "WorkflowAttachment"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

-- Approval (treat as finance write)
alter table "ApprovalChainConfig" enable row level security;
alter table "ApprovalChainConfig" force row level security;
drop policy if exists approvalchainconfig_select on "ApprovalChainConfig";
create policy approvalchainconfig_select on "ApprovalChainConfig"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvalchainconfig_write on "ApprovalChainConfig";
create policy approvalchainconfig_write on "ApprovalChainConfig"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "ApprovalFlow" enable row level security;
alter table "ApprovalFlow" force row level security;
drop policy if exists approvalflow_select on "ApprovalFlow";
create policy approvalflow_select on "ApprovalFlow"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvalflow_write on "ApprovalFlow";
create policy approvalflow_write on "ApprovalFlow"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "ApprovalStep" enable row level security;
alter table "ApprovalStep" force row level security;
drop policy if exists approvalstep_select on "ApprovalStep";
create policy approvalstep_select on "ApprovalStep"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvalstep_write on "ApprovalStep";
create policy approvalstep_write on "ApprovalStep"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "ApprovalDecision" enable row level security;
alter table "ApprovalDecision" force row level security;
drop policy if exists approvaldecision_select on "ApprovalDecision";
create policy approvaldecision_select on "ApprovalDecision"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvaldecision_write on "ApprovalDecision";
create policy approvaldecision_write on "ApprovalDecision"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- Integration (ops write)
alter table "IntegrationConnection" enable row level security;
alter table "IntegrationConnection" force row level security;
drop policy if exists integrationconnection_select on "IntegrationConnection";
create policy integrationconnection_select on "IntegrationConnection"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists integrationconnection_write on "IntegrationConnection";
create policy integrationconnection_write on "IntegrationConnection"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ExternalLink" enable row level security;
alter table "ExternalLink" force row level security;
drop policy if exists externallink_select on "ExternalLink";
create policy externallink_select on "ExternalLink"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists externallink_write on "ExternalLink";
create policy externallink_write on "ExternalLink"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "IntegrationSyncLog" enable row level security;
alter table "IntegrationSyncLog" force row level security;
drop policy if exists integrationsynclog_select on "IntegrationSyncLog";
create policy integrationsynclog_select on "IntegrationSyncLog"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists integrationsynclog_write on "IntegrationSyncLog";
create policy integrationsynclog_write on "IntegrationSyncLog"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "WebhookDelivery" enable row level security;
alter table "WebhookDelivery" force row level security;
drop policy if exists webhookdelivery_select on "WebhookDelivery";
create policy webhookdelivery_select on "WebhookDelivery"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists webhookdelivery_write on "WebhookDelivery";
create policy webhookdelivery_write on "WebhookDelivery"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Notifications / comments / reminders (member read; ops write)
alter table "Notification" enable row level security;
alter table "Notification" force row level security;
drop policy if exists notification_select on "Notification";
create policy notification_select on "Notification"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists notification_write on "Notification";
create policy notification_write on "Notification"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "UserNotificationPreference" enable row level security;
alter table "UserNotificationPreference" force row level security;
drop policy if exists usernotificationpreference_select on "UserNotificationPreference";
create policy usernotificationpreference_select on "UserNotificationPreference"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists usernotificationpreference_write on "UserNotificationPreference";
create policy usernotificationpreference_write on "UserNotificationPreference"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Comment" enable row level security;
alter table "Comment" force row level security;
drop policy if exists comment_select on "Comment";
create policy comment_select on "Comment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists comment_write on "Comment";
create policy comment_write on "Comment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ReminderRule" enable row level security;
alter table "ReminderRule" force row level security;
drop policy if exists reminderrule_select on "ReminderRule";
create policy reminderrule_select on "ReminderRule"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists reminderrule_write on "ReminderRule";
create policy reminderrule_write on "ReminderRule"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ReminderInstance" enable row level security;
alter table "ReminderInstance" force row level security;
drop policy if exists reminderinstance_select on "ReminderInstance";
create policy reminderinstance_select on "ReminderInstance"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists reminderinstance_write on "ReminderInstance";
create policy reminderinstance_write on "ReminderInstance"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Audit/outbox (ops write)
alter table "AuditLog" enable row level security;
alter table "AuditLog" force row level security;
drop policy if exists auditlog_select on "AuditLog";
create policy auditlog_select on "AuditLog"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists auditlog_write on "AuditLog";
create policy auditlog_write on "AuditLog"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "OutboxEvent" enable row level security;
alter table "OutboxEvent" force row level security;
drop policy if exists outboxevent_select on "OutboxEvent";
create policy outboxevent_select on "OutboxEvent"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists outboxevent_write on "OutboxEvent";
create policy outboxevent_write on "OutboxEvent"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

