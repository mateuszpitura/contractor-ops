-- ==========================================================================
-- EwidencjaSnapshot append-only hardening (KP art. 149 working-time register)
-- ==========================================================================
-- The ewidencja is the evidentiary record-of-record for PL statutory
-- working-time. Immutability is DB-enforced, never by app convention:
--
--   * SELECT — allowed for org members (tenant predicate).
--   * INSERT — allowed for org ops-writers. Regenerating a register INSERTs a
--              new version row (incremented `version` + `previousSnapshotId`
--              back-pointer set at insert); prior rows are NEVER updated, so the
--              strict UPDATE-reject trigger below never conflicts with a supersede.
--   * UPDATE — never permitted. No RLS policy + an unconditional BEFORE UPDATE
--              trigger that raises, so even a future BYPASSRLS / owner role
--              cannot rewrite an archived register.
--   * DELETE — denied by default (RLS deny-by-default), EXCEPT inside a
--              transaction that opts in via the transaction-local
--              `app.allow_ewidencja_purge` flag. No application path ever sets
--              that flag: the 3-year immutability floor and the 10-year KP §94⁴
--              statutory retention are both satisfied by non-deletion. The gated
--              policy exists only as a break-glass escape hatch, symmetric with
--              the AuditLog append-only hardening.
--
-- RLS context is the same per-transaction session-variable mechanism used by
-- the rest of the schema (app.org_id / app.user_id via SET LOCAL).

alter table "EwidencjaSnapshot" enable row level security;
alter table "EwidencjaSnapshot" force row level security;

-- Break-glass escape hatch read by the DELETE policy. Transaction-local
-- (SET LOCAL app.allow_ewidencja_purge = 'on'); absent/anything-else => denied.
-- No application code sets this flag.
create or replace function app.ewidencja_purge_allowed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.allow_ewidencja_purge', true), '') = 'on'
$$;

-- Unconditional immutability guard for UPDATE. Ewidencja rows are never updated
-- by any legitimate path (regeneration INSERTs a new version), so this raises
-- always — even for a BYPASSRLS / owner role.
create or replace function app.reject_ewidencja_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'EwidencjaSnapshot is append-only: UPDATE is not permitted'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists ewidencja_no_update on "EwidencjaSnapshot";
create trigger ewidencja_no_update
  before update on "EwidencjaSnapshot"
  for each row
  execute function app.reject_ewidencja_update();

create policy ewidencja_select on "EwidencjaSnapshot"
  for select
  using (app.org_match("organizationId") and app.is_org_member());

create policy ewidencja_insert on "EwidencjaSnapshot"
  for insert
  with check (app.org_match("organizationId") and app.can_write_ops());

create policy ewidencja_delete on "EwidencjaSnapshot"
  for delete
  using (
    app.org_match("organizationId")
    and app.can_write_ops()
    and app.ewidencja_purge_allowed()
  );
