-- Reverse of __portal_employee_actor_type.
--
-- PostgreSQL has no `ALTER TYPE ... DROP VALUE`, so removing the 'EMPLOYEE'
-- member requires recreating the "ActorType" type and swapping every column that
-- uses it — a heavyweight operation that is unsafe while any AuditLog row
-- references the value. The member is inert when unused, so this rollback is a
-- documented no-op rather than a data-destroying type swap.

SELECT 1;
