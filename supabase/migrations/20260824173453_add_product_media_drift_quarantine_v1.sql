create or replace function private.quarantine_invalid_published_product_media_v1()
returns integer
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  affected_count integer:=0;
begin
  update public.products p
     set is_active=false
   where p.status='published'
     and p.is_active=true
     and p.deleted_at is null
     and not private.product_media_integrity_ok_v1(p.id);
  get diagnostics affected_count=row_count;
  return affected_count;
end;
$$;
revoke all on function private.quarantine_invalid_published_product_media_v1() from public,anon,authenticated,service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='golden-oremar-product-media-integrity';

select cron.schedule(
  'golden-oremar-product-media-integrity',
  '*/5 * * * *',
  'select private.quarantine_invalid_published_product_media_v1();'
);
