insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('accounting-receipts','accounting-receipts',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists accounting_receipts_super_admin_select on storage.objects;
create policy accounting_receipts_super_admin_select on storage.objects
for select to authenticated
using(bucket_id='accounting-receipts' and coalesce(private.has_role('super_admin'),false));

drop policy if exists accounting_receipts_super_admin_insert on storage.objects;
create policy accounting_receipts_super_admin_insert on storage.objects
for insert to authenticated
with check(
  bucket_id='accounting-receipts'
  and coalesce(private.has_role('super_admin'),false)
  and (storage.foldername(name))[1]='expenses'
  and (storage.foldername(name))[2] ~ '^\d{4}$'
  and (storage.foldername(name))[3] ~ '^\d{2}$'
);

drop policy if exists accounting_receipts_super_admin_delete on storage.objects;
create policy accounting_receipts_super_admin_delete on storage.objects
for delete to authenticated
using(bucket_id='accounting-receipts' and coalesce(private.has_role('super_admin'),false));
