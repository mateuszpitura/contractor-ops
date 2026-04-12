-- Extend Row Level Security coverage to all remaining tenant-scoped tables.
-- Follows the same pattern as 20260318120000_enable_rls:
--   - SELECT: org membership check
--   - Write: role-based check per domain

-- =========================
-- Equipment domain (ops write)
-- =========================

alter table "Equipment" enable row level security;
alter table "Equipment" force row level security;
drop policy if exists equipment_select on "Equipment";
create policy equipment_select on "Equipment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists equipment_write on "Equipment";
create policy equipment_write on "Equipment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "EquipmentAssignment" enable row level security;
alter table "EquipmentAssignment" force row level security;
drop policy if exists equipmentassignment_select on "EquipmentAssignment";
create policy equipmentassignment_select on "EquipmentAssignment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists equipmentassignment_write on "EquipmentAssignment";
create policy equipmentassignment_write on "EquipmentAssignment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Shipment" enable row level security;
alter table "Shipment" force row level security;
drop policy if exists shipment_select on "Shipment";
create policy shipment_select on "Shipment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists shipment_write on "Shipment";
create policy shipment_write on "Shipment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ShipmentEvent" enable row level security;
alter table "ShipmentEvent" force row level security;
drop policy if exists shipmentevent_select on "ShipmentEvent";
create policy shipmentevent_select on "ShipmentEvent"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists shipmentevent_write on "ShipmentEvent";
create policy shipmentevent_write on "ShipmentEvent"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ReturnRequest" enable row level security;
alter table "ReturnRequest" force row level security;
drop policy if exists returnrequest_select on "ReturnRequest";
create policy returnrequest_select on "ReturnRequest"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists returnrequest_write on "ReturnRequest";
create policy returnrequest_write on "ReturnRequest"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "CourierConfig" enable row level security;
alter table "CourierConfig" force row level security;
drop policy if exists courierconfig_select on "CourierConfig";
create policy courierconfig_select on "CourierConfig"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists courierconfig_write on "CourierConfig";
create policy courierconfig_write on "CourierConfig"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- E-signature domain (ops write)
-- =========================

alter table "SigningEnvelope" enable row level security;
alter table "SigningEnvelope" force row level security;
drop policy if exists signingenvelope_select on "SigningEnvelope";
create policy signingenvelope_select on "SigningEnvelope"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists signingenvelope_write on "SigningEnvelope";
create policy signingenvelope_write on "SigningEnvelope"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "SigningEvent" enable row level security;
alter table "SigningEvent" force row level security;
drop policy if exists signingevent_select on "SigningEvent";
create policy signingevent_select on "SigningEvent"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists signingevent_write on "SigningEvent";
create policy signingevent_write on "SigningEvent"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- SigningRecipient has no organizationId — enforce via parent envelope.
alter table "SigningRecipient" enable row level security;
alter table "SigningRecipient" force row level security;
drop policy if exists signingrecipient_select on "SigningRecipient";
create policy signingrecipient_select on "SigningRecipient"
  for select
  using (
    app.is_org_member()
    and exists (
      select 1
      from "SigningEnvelope" e
      where e."id" = "SigningRecipient"."signingEnvelopeId"
        and e."organizationId" = app.current_org_id()
    )
  );
drop policy if exists signingrecipient_write on "SigningRecipient";
create policy signingrecipient_write on "SigningRecipient"
  for all
  using (
    app.can_write_ops()
    and exists (
      select 1
      from "SigningEnvelope" e
      where e."id" = "SigningRecipient"."signingEnvelopeId"
        and e."organizationId" = app.current_org_id()
    )
  )
  with check (
    app.can_write_ops()
    and exists (
      select 1
      from "SigningEnvelope" e
      where e."id" = "SigningRecipient"."signingEnvelopeId"
        and e."organizationId" = app.current_org_id()
    )
  );

-- =========================
-- Time-tracking domain (ops write)
-- =========================

alter table "Timesheet" enable row level security;
alter table "Timesheet" force row level security;
drop policy if exists timesheet_select on "Timesheet";
create policy timesheet_select on "Timesheet"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists timesheet_write on "Timesheet";
create policy timesheet_write on "Timesheet"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "TimeEntry" enable row level security;
alter table "TimeEntry" force row level security;
drop policy if exists timeentry_select on "TimeEntry";
create policy timeentry_select on "TimeEntry"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists timeentry_write on "TimeEntry";
create policy timeentry_write on "TimeEntry"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- OCR domain (ops write)
-- =========================

alter table "OcrExtraction" enable row level security;
alter table "OcrExtraction" force row level security;
drop policy if exists ocrextraction_select on "OcrExtraction";
create policy ocrextraction_select on "OcrExtraction"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists ocrextraction_write on "OcrExtraction";
create policy ocrextraction_write on "OcrExtraction"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- Billing domain (finance write)
-- =========================

alter table "OcrCreditLedger" enable row level security;
alter table "OcrCreditLedger" force row level security;
drop policy if exists ocrcreditledger_select on "OcrCreditLedger";
create policy ocrcreditledger_select on "OcrCreditLedger"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists ocrcreditledger_write on "OcrCreditLedger";
create policy ocrcreditledger_write on "OcrCreditLedger"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "Subscription" enable row level security;
alter table "Subscription" force row level security;
drop policy if exists subscription_select on "Subscription";
create policy subscription_select on "Subscription"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists subscription_write on "Subscription";
create policy subscription_write on "Subscription"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- =========================
-- Portal domain (ops write)
-- =========================

alter table "PortalSession" enable row level security;
alter table "PortalSession" force row level security;
drop policy if exists portalsession_select on "PortalSession";
create policy portalsession_select on "PortalSession"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists portalsession_write on "PortalSession";
create policy portalsession_write on "PortalSession"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorChangeRequest" enable row level security;
alter table "ContractorChangeRequest" force row level security;
drop policy if exists contractorchangerequest_select on "ContractorChangeRequest";
create policy contractorchangerequest_select on "ContractorChangeRequest"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorchangerequest_write on "ContractorChangeRequest";
create policy contractorchangerequest_write on "ContractorChangeRequest"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorNotificationPreference" enable row level security;
alter table "ContractorNotificationPreference" force row level security;
drop policy if exists contractornotificationpreference_select on "ContractorNotificationPreference";
create policy contractornotificationpreference_select on "ContractorNotificationPreference"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractornotificationpreference_write on "ContractorNotificationPreference";
create policy contractornotificationpreference_write on "ContractorNotificationPreference"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());
