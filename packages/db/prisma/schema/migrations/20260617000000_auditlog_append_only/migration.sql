-- ==========================================================================
-- AuditLog append-only hardening
-- ==========================================================================
-- Replaces the prior `auditlog_write` policy (declared `FOR ALL`, which
-- silently granted UPDATE/DELETE to any org-writer) with DB-level append-only
-- enforcement:
--
--   * INSERT — allowed for org ops-writers (unchanged tenant predicate).
--   * UPDATE — never permitted. No RLS policy + an unconditional BEFORE UPDATE
--              trigger that raises, so even a future BYPASSRLS / owner role
--              cannot mutate an audit row.
--   * DELETE — denied by default (RLS deny-by-default), EXCEPT inside a
--              transaction that has opted in via the transaction-local
--              `app.allow_audit_purge` flag. The GDPR Right-to-Erasure path
--              (packages/api/src/routers/compliance/gdpr.ts) sets that flag
--              before wiping a tenant's audit rows; ordinary writers never do.
--
-- RLS context is the same per-transaction session-variable mechanism used by
-- the rest of the schema (app.org_id / app.user_id via SET LOCAL).

-- Escape hatch read by the DELETE policy + UPDATE trigger. Transaction-local
-- (SET LOCAL app.allow_audit_purge = 'on'); absent/anything-else => denied.
create or replace function app.audit_purge_allowed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.allow_audit_purge', true), '') = 'on'
$$;

-- Unconditional immutability guard for UPDATE. Audit rows are never updated by
-- any legitimate path (the GDPR erasure only DELETEs), so this raises always.
create or replace function app.reject_auditlog_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AuditLog is append-only: UPDATE is not permitted'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists auditlog_no_update on "AuditLog";
create trigger auditlog_no_update
  before update on "AuditLog"
  for each row
  execute function app.reject_auditlog_update();

-- Replace the over-broad FOR ALL policy with INSERT-only + a gated DELETE.
drop policy if exists auditlog_write on "AuditLog";

create policy auditlog_insert on "AuditLog"
  for insert
  with check (app.org_match("organizationId") and app.can_write_ops());

create policy auditlog_delete on "AuditLog"
  for delete
  using (
    app.org_match("organizationId")
    and app.can_write_ops()
    and app.audit_purge_allowed()
  );
