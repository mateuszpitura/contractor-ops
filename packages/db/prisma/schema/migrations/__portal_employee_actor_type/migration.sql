-- Employee-portal audit actor (additive).
--
-- The employee self-service portal writes AuditLog rows for a NEW actor kind: an
-- employee Worker acting on their own records (leave request, document upload) or
-- a line manager acting on a direct report. That actor is neither a Contractor
-- nor a staff User, so ActorType gains an 'EMPLOYEE' member.
--
-- ORDERING: requires the "ActorType" enum to already exist (it does — AuditLog is
-- a base table). Independent of __portal_employee_subject; either order is safe.
--
-- Reversibility: PostgreSQL cannot DROP a value from an enum type, so the paired
-- down.sql is a documented no-op — the surplus 'EMPLOYEE' member is inert once no
-- AuditLog row references it. To truly reverse, recreate the type without the
-- value (a full column swap), which is out of scope for a local rollback.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME) at
-- the blocking human migration gate.

ALTER TYPE "ActorType" ADD VALUE IF NOT EXISTS 'EMPLOYEE';
