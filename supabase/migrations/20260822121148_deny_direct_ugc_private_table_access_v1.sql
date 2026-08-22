create policy user_terms_acceptances_deny_direct_access
on private.user_terms_acceptances
for all
to public
using (false)
with check (false);

create policy user_blocks_deny_direct_access
on private.user_blocks
for all
to public
using (false)
with check (false);

create policy user_content_reports_deny_direct_access
on private.user_content_reports
for all
to public
using (false)
with check (false);
