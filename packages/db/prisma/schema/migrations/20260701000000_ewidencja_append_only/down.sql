-- Reverses the EwidencjaSnapshot append-only hardening.

drop policy if exists ewidencja_delete on "EwidencjaSnapshot";
drop policy if exists ewidencja_insert on "EwidencjaSnapshot";
drop policy if exists ewidencja_select on "EwidencjaSnapshot";

drop trigger if exists ewidencja_no_update on "EwidencjaSnapshot";
drop function if exists app.reject_ewidencja_update();
drop function if exists app.ewidencja_purge_allowed();

alter table "EwidencjaSnapshot" no force row level security;
alter table "EwidencjaSnapshot" disable row level security;
