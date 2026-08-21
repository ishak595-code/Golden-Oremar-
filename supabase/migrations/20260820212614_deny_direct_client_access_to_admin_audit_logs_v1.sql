drop policy if exists admin_audit_logs_no_direct_client_access on private.admin_audit_logs;
create policy admin_audit_logs_no_direct_client_access
on private.admin_audit_logs
for all
to anon, authenticated
using (false)
with check (false);
