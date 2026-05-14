-- Remove RLS from PortalSession.
--
-- PortalSession is in tenant.ts globalModels (not tenant-scoped) because
-- portal auth flows look up sessions by token without tenant context.
-- The RLS policies (requiring app.org_id session var) contradict this and
-- would cause hard failures when RLS is enforced. App-layer access control
-- is sufficient for portal sessions (token-based, short-lived, contractor-scoped).

drop policy if exists portalsession_select on "PortalSession";
drop policy if exists portalsession_write on "PortalSession";
alter table "PortalSession" disable row level security;
alter table "PortalSession" no force row level security;
