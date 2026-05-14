-- Add RLS policies for tenant-scoped tables introduced after the initial
-- RLS migration but before the baseline squash. These tables have
-- organizationId NOT NULL but were missing RLS coverage.

-- =========================
-- InvoiceIntakeRequest (finance write — contains uploaded invoice data)
-- =========================

alter table "InvoiceIntakeRequest" enable row level security;
alter table "InvoiceIntakeRequest" force row level security;
drop policy if exists invoiceintakerequest_select on "InvoiceIntakeRequest";
create policy invoiceintakerequest_select on "InvoiceIntakeRequest"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoiceintakerequest_write on "InvoiceIntakeRequest";
create policy invoiceintakerequest_write on "InvoiceIntakeRequest"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- =========================
-- WorkflowRoleTemplate (ops write — offboarding role definitions)
-- =========================

alter table "WorkflowRoleTemplate" enable row level security;
alter table "WorkflowRoleTemplate" force row level security;
drop policy if exists workflowroletemplate_select on "WorkflowRoleTemplate";
create policy workflowroletemplate_select on "WorkflowRoleTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowroletemplate_write on "WorkflowRoleTemplate";
create policy workflowroletemplate_write on "WorkflowRoleTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- WorkflowRoleTaskTemplate (ops write — offboarding task definitions)
-- =========================

alter table "WorkflowRoleTaskTemplate" enable row level security;
alter table "WorkflowRoleTaskTemplate" force row level security;
drop policy if exists workflowroletasktemplate_select on "WorkflowRoleTaskTemplate";
create policy workflowroletasktemplate_select on "WorkflowRoleTaskTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowroletasktemplate_write on "WorkflowRoleTaskTemplate";
create policy workflowroletasktemplate_write on "WorkflowRoleTaskTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());
